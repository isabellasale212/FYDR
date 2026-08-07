import type { AvailabilityStatus } from '@/lib/types/database';
import { fetchCurrentAvailability } from './availability';
import { fetchCurrentSeasonId } from './schedule';
import type { Db } from './groups';

/* screens/team-allocation.md, screen 14, cut down hard. No new schema: teams and
 * team_allocations have existed since migration 0003 and their RLS already matches
 * the spec's role table exactly — coach allocates and publishes, medical reads and
 * can only change availability, an athlete never sees a draft row. That RLS is what
 * makes the clinical boundary on this screen absolute: this file's queries never
 * select from injury_clinical, and could not surface it even by accident, because
 * medical's own read access here is availability only.
 *
 * What's cut: drag and drop (one team-picker chip row per athlete instead — it also
 * makes double-allocation structurally impossible, which sidesteps that whole warning
 * class rather than detecting it after the fact), "copy last week", the load and
 * days-since-last-match columns, the specialist-position and short-turnaround-match
 * warnings, and O-808's "teams in the global group filter" change. The one warning
 * kept is the one the schema itself enforces: allocating an athlete whose
 * availability is not 'available' requires a reason, checked by
 * team_allocations' own constraint, not just by this form. Revisions are
 * simplified too: changing an athlete's team withdraws the old row (status =
 * 'withdrawn', never deleted, per the table's own "no delete policy at all") and
 * opens a fresh draft, rather than the full revision_of chain the spec allows for a
 * published row — a real, documented gap, not the schema's limitation. */

export type Team = {
  id: string;
  name: string;
  short_name: string | null;
  rank: number;
};

export async function fetchTeams(db: Db, orgId: string): Promise<Team[]> {
  const { data, error } = await db
    .from('teams')
    .select('id, name, short_name, rank')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('rank');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type AllocationRow = {
  id: string;
  athlete_id: string;
  first_name: string;
  last_name: string;
  team_id: string;
  status: 'draft' | 'published' | 'withdrawn';
  availability_at_allocation: AvailabilityStatus | null;
  override_reason: string | null;
};

export type WeekBoard = {
  allocations: AllocationRow[];
  unallocated: { athlete_id: string; first_name: string; last_name: string; availability: AvailabilityStatus | null }[];
};

/** Everything for one week: who is on which team, and who is on none. Availability
 *  only, per the clinical boundary this screen holds without exception — no join,
 *  no select, no path to injury_clinical from this function or any other in this
 *  file. */
export async function fetchWeekBoard(db: Db, orgId: string, weekStart: string): Promise<WeekBoard> {
  const [athletesRes, allocRes] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club')
      .order('last_name'),
    db
      .from('team_allocations')
      .select('id, athlete_id, team_id, status, availability_at_allocation, override_reason, athletes!inner(first_name, last_name)')
      .eq('org_id', orgId)
      .eq('week_start', weekStart)
      .neq('status', 'withdrawn')
      .is('deleted_at', null),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (allocRes.error) throw new Error(allocRes.error.message);

  const allocatedIds = new Set((allocRes.data ?? []).map((a) => a.athlete_id));
  const athleteIds = (athletesRes.data ?? []).map((a) => a.id);
  const availability = await fetchCurrentAvailability(db, orgId, athleteIds);
  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a.status]));

  const allocations: AllocationRow[] = (allocRes.data ?? []).map((a) => ({
    id: a.id,
    athlete_id: a.athlete_id,
    first_name: a.athletes.first_name,
    last_name: a.athletes.last_name,
    team_id: a.team_id,
    status: a.status,
    availability_at_allocation: a.availability_at_allocation,
    override_reason: a.override_reason,
  }));

  const unallocated = (athletesRes.data ?? [])
    .filter((a) => !allocatedIds.has(a.id))
    .map((a) => ({
      athlete_id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      availability: availByAthlete.get(a.id) ?? null,
    }));

  return { allocations, unallocated };
}

export type SetAllocationInput = {
  athleteId: string;
  teamId: string;
  weekStart: string;
  overrideReason: string | null;
};

/** One team per athlete per week, exclusive, enforced here rather than by a unique
 *  index: withdraw whatever active row this athlete has for this week (if any),
 *  then open a fresh draft on the chosen team. Snapshots the athlete's current
 *  availability onto the row, and the database itself refuses to accept the write
 *  if that snapshot is not 'available' and no override_reason is given — this
 *  function surfaces that refusal as a message rather than a raw constraint error,
 *  but does not soften it. */
export async function setTeamAllocation(
  db: Db,
  orgId: string,
  userId: string,
  input: SetAllocationInput,
): Promise<{ error: string | null }> {
  const [seasonId, availability] = await Promise.all([
    fetchCurrentSeasonId(db, orgId),
    fetchCurrentAvailability(db, orgId, [input.athleteId]),
  ]);

  const { error: withdrawError } = await db
    .from('team_allocations')
    .update({ status: 'withdrawn' })
    .eq('org_id', orgId)
    .eq('athlete_id', input.athleteId)
    .eq('week_start', input.weekStart)
    .neq('status', 'withdrawn');
  if (withdrawError) return { error: withdrawError.message };

  const currentStatus = availability[0]?.status ?? null;

  const { error } = await db.from('team_allocations').insert({
    org_id: orgId,
    team_id: input.teamId,
    athlete_id: input.athleteId,
    season_id: seasonId,
    week_start: input.weekStart,
    status: 'draft',
    source: 'manual',
    availability_at_allocation: currentStatus,
    override_reason: input.overrideReason,
    created_by: userId,
  });
  if (error) {
    if (error.message.includes('check') || error.message.includes('constraint')) {
      return { error: 'This athlete is not available. Give a reason to allocate them anyway.' };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function withdrawAllocation(db: Db, orgId: string, allocationId: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('team_allocations')
    .update({ status: 'withdrawn' })
    .eq('id', allocationId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}

/** Publish is a batch action: every draft row for this week becomes visible to the
 *  athletes on it in one step, which is deliberate — a half-published week (some
 *  athletes told, others not) is exactly the confusion the spec's own "publish
 *  discloses the whole board" framing exists to avoid. */
export async function publishWeek(db: Db, orgId: string, userId: string, weekStart: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('team_allocations')
    .update({ status: 'published', published_at: new Date().toISOString(), published_by: userId })
    .eq('org_id', orgId)
    .eq('week_start', weekStart)
    .eq('status', 'draft');
  return { error: error?.message ?? null };
}

export type MyAllocation = { team_name: string; week_start: string };

/** An athlete's own published team for a week — the read side of "once an
 *  allocation is published, the athlete sees their own team on Today." RLS
 *  (team_allocations_self_select) already restricts this to their own published
 *  rows only; this just adds the team name. */
export async function fetchMyAllocation(db: Db, athleteId: string, weekStart: string): Promise<MyAllocation | null> {
  const { data, error } = await db
    .from('team_allocations')
    .select('week_start, teams!inner(name)')
    .eq('athlete_id', athleteId)
    .eq('week_start', weekStart)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { team_name: data.teams.name, week_start: data.week_start };
}
