import type { AvailabilityStatus, BodyArea, BodySide } from '@/lib/types/database';
import { humanizeDbError } from '@/lib/writeErrors';
import { fetchCurrentAvailability, fetchOpenInjuries } from './availability';
import { fetchCurrentSeasonId } from './schedule';
import type { Db } from './groups';
import { restrictionLine } from '@/lib/restrictions';

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
  /** Current availability, not the snapshot above: the snapshot records what was
   *  true when the pick was made, this is what is true now. */
  availability: AvailabilityStatus | null;
  /* THE LIMITED INJURY VIEW, decided 2026-09-09 (29-team-allocation.md).
     Same four non-clinical fields every other coach-facing screen shows, from the
     same sources: restrictions ride on the availability record, body area / side /
     expected return come from `injuries` via fetchOpenInjuries. injury_clinical is
     still never selected from, joined to, or reachable from this file. */
  restrictions: string[];
  body_area: BodyArea | null;
  side: BodySide | null;
  expected_return: string | null;
};

export type WeekBoard = {
  allocations: AllocationRow[];
  unallocated: {
    athlete_id: string;
    first_name: string;
    last_name: string;
    availability: AvailabilityStatus | null;
  /* THE LIMITED INJURY VIEW, decided 2026-09-09 (29-team-allocation.md).
     Same four non-clinical fields every other coach-facing screen shows, from the
     same sources: restrictions ride on the availability record, body area / side /
     expected return come from `injuries` via fetchOpenInjuries. injury_clinical is
     still never selected from, joined to, or reachable from this file. */
  restrictions: string[];
  body_area: BodyArea | null;
  side: BodySide | null;
  expected_return: string | null;
  }[];
};

/** Everything for one week: who is on which team, and who is on none, each with
 *  the limited injury view.
 *
 *  THIS USED TO SAY "availability only", and that was the whole of the boundary
 *  this screen held — which made it the ONLY coach-facing screen not showing body
 *  area, restrictions and expected return, while its own on-screen caption claimed
 *  it showed two of them. Isabella decided on 2026-09-09 to match the other five
 *  (29-team-allocation.md), because picking a side needs "modified · shoulder · no
 *  contact" rather than a bare "modified".
 *
 *  THE CLINICAL BOUNDARY IS UNCHANGED AND STILL ABSOLUTE: no join, no select, no
 *  path to injury_clinical from this function or any other in this file. Body area
 *  and side come from `injuries`, the non-clinical record, exactly as
 *  fetchOpenInjuries already supplies the dashboard, the injuries list and the
 *  rehab board. */
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
  const [availability, injuries] = await Promise.all([
    fetchCurrentAvailability(db, orgId, athleteIds),
    fetchOpenInjuries(db, orgId, athleteIds),
  ]);
  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a]));
  const injuryByAthlete = new Map<string, (typeof injuries)[number]>();
  for (const inj of injuries) {
    /* Same documented best-effort pick as the rehab board: an athlete can carry
       more than one open injury, each row shows one line, and fetchOpenInjuries
       has no reliable order — so the last seen wins. Not a claim about which
       injury is the relevant one. */
    injuryByAthlete.set(inj.athlete_id, inj);
  }
  /** The four fields, resolved once for either row shape. */
  const injuryView = (athleteId: string) => {
    const current = availByAthlete.get(athleteId);
    const injury = injuryByAthlete.get(athleteId);
    return {
      availability: current?.status ?? null,
      restrictions: restrictionLine(current?.restrictions),
      body_area: injury?.body_area ?? null,
      side: injury?.side ?? null,
      expected_return: injury?.expected_return ?? null,
    };
  };

  const allocations: AllocationRow[] = (allocRes.data ?? []).map((a) => ({
    id: a.id,
    athlete_id: a.athlete_id,
    first_name: a.athletes.first_name,
    last_name: a.athletes.last_name,
    team_id: a.team_id,
    status: a.status,
    availability_at_allocation: a.availability_at_allocation,
    override_reason: a.override_reason,
    ...injuryView(a.athlete_id),
  }));

  const unallocated = (athletesRes.data ?? [])
    .filter((a) => !allocatedIds.has(a.id))
    .map((a) => ({
      athlete_id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      ...injuryView(a.id),
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
    /* Raw driver strings never leave this file — audit S5. */
    return { error: humanizeDbError(error.message, 'staff') };
  }
  return { error: null };
}

export async function withdrawAllocation(db: Db, orgId: string, allocationId: string): Promise<{ error: string | null }> {
/* G-34. `.select('id')` so a refusal is sayable. An UPDATE that RLS filters
   matches no row and does NOT raise, so checking `error` alone reported success
   and changed nothing. This is a single row addressed by id that was on screen a
   moment ago, so zero rows can only mean refused. */
  const { data, error } = await db
    .from('team_allocations')
    .update({ status: 'withdrawn' })
    .eq('id', allocationId)
    .eq('org_id', orgId)
    .select('id');
  if (error) return { error: humanizeDbError(error.message, 'staff') };
  if (!data || data.length === 0) {
    return { error: 'Not saved: selection belongs to the coach and the sport scientist. A medic sets availability, not selection.' };
  }
  return { error: null };
}

/** Publish is a batch action: every draft row for this week becomes visible to the
 *  athletes on it in one step, which is deliberate — a half-published week (some
 *  athletes told, others not) is exactly the confusion the spec's own "publish
 *  discloses the whole board" framing exists to avoid. */
export async function publishWeek(db: Db, orgId: string, userId: string, weekStart: string): Promise<{ error: string | null }> {
  /* G-34, and the one case where zero rows does NOT settle it. This is a bulk
     update over a week, so nothing changing can mean two different things: the
     week had no drafts, which is fine, or RLS refused, which is not. Guessing
     either way produces a wrong message, so the ambiguous branch asks. The extra
     query only runs when nothing changed. */
  const { data, error } = await db
    .from('team_allocations')
    .update({ status: 'published', published_at: new Date().toISOString(), published_by: userId })
    .eq('org_id', orgId)
    .eq('week_start', weekStart)
    .eq('status', 'draft')
    .select('id');
  if (error) return { error: humanizeDbError(error.message, 'staff') };
  if (!data || data.length === 0) {
    const { count } = await db
      .from('team_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('week_start', weekStart)
      .eq('status', 'draft');
    if ((count ?? 0) > 0) {
      return { error: 'Not saved: publishing a selection belongs to the coach and the sport scientist. A medic sets availability, not selection.' };
    }
    return { error: 'There were no draft selections to publish for this week.' };
  }
  return { error: null };
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
