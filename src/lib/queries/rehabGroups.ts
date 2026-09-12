import type { AvailabilityStatus, BodyArea, BodySide } from '@/lib/types/database';
import { fetchCurrentAvailability, fetchOpenInjuries } from './availability';
import type { Db } from './groups';
import { restrictionLine } from '@/lib/restrictions';

/* screens/rehab-groups.md, screen 42, cut down hard.
 *
 * A rehab group is an ordinary groups row with group_type = 'rehab' and its membership
 * is an ordinary group_memberships row — both already existed, already tested, before
 * this file. Migration 0018 added exactly one new table, rehab_assignments, to track an
 * athlete's rehab phase over time, and tightened group_memberships so writing to a rehab
 * group specifically requires medical, the same "Only medical allocates" rule
 * team-allocation.md gives coaches over teams, inverted.
 *
 * What's cut, and why, in more depth than the migration's own header:
 *   - No programmes / programme_assignments. Assigning a "shared rehab programme" to a
 *     group needs a programme content system this schema does not have — the same
 *     "genuine new part of the database" scale of decision as Gym programme, not a
 *     quick add riding on this one. Phase is free text, medical-authored, and is the
 *     whole of what this pass tracks.
 *   - No compliance ring (needs gym_session_logs, which does not exist), no session
 *     schedule per group (needs session_participants.group_id joined in, cut for the
 *     same reason), no realtime "cleared and removed" notice.
 *   - Drag and drop is a chip picker instead, the same trade team-allocation.md's own
 *     build made: slower per athlete, works on a phone and a keyboard, and makes
 *     "allocated to two rehab groups at once" awkward to reach by accident rather than
 *     merely policed after the fact.
 *   - "At most one rehab group at a time" is enforced here, in the query layer, by
 *     closing any other open rehab membership before opening a new one — not a database
 *     constraint, the same choice team_allocations made for one team per week.
 *   - Coach sees body area and restrictions on this board, matching rehab-groups.md's
 *     own role table ("Sees which athletes are in which rehab group... cannot see
 *     clinical detail") and matching what a coach already sees on the injuries list and
 *     the dashboard's availability card. 20-route-map.md's role_notes for this screen
 *     says "no body area", narrower than the screen's own spec — read as a stricter
 *     early draft note rather than the binding contract, because nowhere else in this
 *     app hides body area from a coach and injuries.md and the dashboard both show it to
 *     them today. Worth a second look from someone who can ask the client which one is
 *     current.
 *   - Never reads injury_clinical. Body area and side come from `injuries`, the
 *     non-clinical record, exactly as fetchOpenInjuries already does for the dashboard
 *     and the injuries list — reused here rather than duplicated.
 */

export type RehabGroup = { id: string; name: string; colour: string | null; sort_order: number };

export async function fetchRehabGroups(db: Db, orgId: string): Promise<RehabGroup[]> {
  const { data, error } = await db
    .from('groups')
    .select('id, name, colour, sort_order')
    .eq('org_id', orgId)
    .eq('group_type', 'rehab')
    .is('deleted_at', null)
    .order('sort_order')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type RehabMember = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  squad_number: number | null;
  availability: AvailabilityStatus;
  restrictions: string[];
  body_area: BodyArea | null;
  side: BodySide | null;
  expected_return: string | null;
  phase: string | null;
  /** null means unallocated — in the pool, not on any rehab group. */
  group_id: string | null;
};

export type RehabBoard = { members: RehabMember[] };

/** The population this board manages is derived, not stored: every athlete whose
 *  current availability is not 'available'. Being in the pool or a group is downstream
 *  of that, never the other way round — an athlete cleared to play simply stops
 *  appearing here, whether or not anyone remembers to take them off a rehab group.
 *  (The spec's own realtime "cleared and removed" notice is the live version of this;
 *  cut here, but the underlying correctness — a fit athlete never lingers on the board
 *  — holds regardless, because the population is recomputed on every load.) */
export async function fetchRehabBoard(db: Db, orgId: string): Promise<RehabBoard> {
  const availability = await fetchCurrentAvailability(db, orgId, null);
  const athleteIds = availability
    .filter((a) => a.status !== 'available')
    .map((a) => a.athlete_id);

  if (athleteIds.length === 0) return { members: [] };

  const rehabGroups = await fetchRehabGroups(db, orgId);
  const rehabGroupIds = rehabGroups.map((g) => g.id);

  const [athletesRes, injuries, memberships, assignments] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name, squad_number')
      .eq('org_id', orgId)
      .in('id', athleteIds)
      .is('deleted_at', null)
      .neq('status', 'left_club'),
    fetchOpenInjuries(db, orgId, athleteIds),
    rehabGroupIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : db
          .from('group_memberships')
          .select('athlete_id, group_id')
          .eq('org_id', orgId)
          .in('group_id', rehabGroupIds)
          .in('athlete_id', athleteIds)
          .is('removed_at', null),
    db
      .from('rehab_assignments')
      .select('athlete_id, phase')
      .eq('org_id', orgId)
      .in('athlete_id', athleteIds)
      .is('effective_to', null),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (memberships.error) throw new Error(memberships.error.message);
  if (assignments.error) throw new Error(assignments.error.message);

  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a]));
  const injuryByAthlete = new Map<string, (typeof injuries)[number]>();
  for (const inj of injuries) {
    // An athlete can have more than one open injury; the board shows one line, so the
    // most recently reported wins. fetchOpenInjuries has no reliable order for this, so
    // this is a documented best-effort pick, not a guarantee of "the relevant one".
    injuryByAthlete.set(inj.athlete_id, inj);
  }
  const groupByAthlete = new Map((memberships.data ?? []).map((m) => [m.athlete_id, m.group_id]));
  const phaseByAthlete = new Map((assignments.data ?? []).map((a) => [a.athlete_id, a.phase]));

  const members: RehabMember[] = (athletesRes.data ?? [])
    .map((athlete) => {
      const current = availByAthlete.get(athlete.id);
      const injury = injuryByAthlete.get(athlete.id);
      return {
        athlete_id: athlete.id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        squad_number: athlete.squad_number,
        availability: current?.status ?? 'unavailable',
        restrictions: restrictionLine(current?.restrictions),
        body_area: injury?.body_area ?? null,
        side: injury?.side ?? null,
        expected_return: injury?.expected_return ?? null,
        phase: phaseByAthlete.get(athlete.id) ?? null,
        group_id: groupByAthlete.get(athlete.id) ?? null,
      };
    })
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  return { members };
}

async function closeOpenPhase(db: Db, orgId: string, athleteId: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('rehab_assignments')
    .update({ effective_to: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('effective_to', null);
  return { error: error?.message ?? null };
}

/** Allocates an athlete to a rehab group, medical only (migration 0018's
 *  group_memberships policy refuses this from a coach or admin outright — this
 *  function's own role is to give that refusal a plain-English message rather than a
 *  raw Postgres error, not to be the thing enforcing it). Closes any other open rehab
 *  group membership first: one rehab group at a time. */
export async function allocateToRehabGroup(
  db: Db,
  orgId: string,
  userId: string,
  input: { athleteId: string; groupId: string; phase: string | null },
): Promise<{ error: string | null }> {
  const rehabGroups = await fetchRehabGroups(db, orgId);
  const rehabGroupIds = rehabGroups.map((g) => g.id);

  if (rehabGroupIds.length > 0) {
    const { error: closeMemErr } = await db
      .from('group_memberships')
      .update({ removed_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('athlete_id', input.athleteId)
      .in('group_id', rehabGroupIds)
      .is('removed_at', null);
    if (closeMemErr) return { error: translateGroupWriteError(closeMemErr.message) };
  }

  const { error: insMemErr } = await db.from('group_memberships').insert({
    org_id: orgId,
    group_id: input.groupId,
    athlete_id: input.athleteId,
  });
  // 23505: already a live member of this exact group (a double click). Not an error.
  if (insMemErr && insMemErr.code !== '23505') {
    return { error: translateGroupWriteError(insMemErr.message) };
  }

  const { error: closePhaseErr } = await closeOpenPhase(db, orgId, input.athleteId);
  if (closePhaseErr) return { error: closePhaseErr };

  const { error: insPhaseErr } = await db.from('rehab_assignments').insert({
    org_id: orgId,
    athlete_id: input.athleteId,
    rehab_group_id: input.groupId,
    phase: input.phase,
    set_by: userId,
  });
  if (insPhaseErr) return { error: insPhaseErr.message };

  return { error: null };
}

/** Returns an athlete to the unallocated pool. Their phase is carried forward rather
 *  than cleared — leaving a group is not the same as their recovery resetting to
 *  unknown. */
export async function removeFromRehabGroup(
  db: Db,
  orgId: string,
  userId: string,
  athleteId: string,
): Promise<{ error: string | null }> {
  const rehabGroups = await fetchRehabGroups(db, orgId);
  const rehabGroupIds = rehabGroups.map((g) => g.id);
  if (rehabGroupIds.length === 0) return { error: null };

  const { error: closeMemErr } = await db
    .from('group_memberships')
    .update({ removed_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .in('group_id', rehabGroupIds)
    .is('removed_at', null);
  if (closeMemErr) return { error: translateGroupWriteError(closeMemErr.message) };

  const { data: current } = await db
    .from('rehab_assignments')
    .select('phase')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('effective_to', null)
    .maybeSingle();

  const { error: closePhaseErr } = await closeOpenPhase(db, orgId, athleteId);
  if (closePhaseErr) return { error: closePhaseErr };

  const { error: insErr } = await db.from('rehab_assignments').insert({
    org_id: orgId,
    athlete_id: athleteId,
    rehab_group_id: null,
    phase: current?.phase ?? null,
    set_by: userId,
  });
  if (insErr) return { error: insErr.message };

  return { error: null };
}

/** Updates phase without moving the athlete, carrying their current group forward. */
export async function setRehabPhase(
  db: Db,
  orgId: string,
  userId: string,
  athleteId: string,
  phase: string | null,
): Promise<{ error: string | null }> {
  const { data: current } = await db
    .from('rehab_assignments')
    .select('rehab_group_id')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('effective_to', null)
    .maybeSingle();

  const { error: closeErr } = await closeOpenPhase(db, orgId, athleteId);
  if (closeErr) return { error: closeErr };

  const { error: insErr } = await db.from('rehab_assignments').insert({
    org_id: orgId,
    athlete_id: athleteId,
    rehab_group_id: current?.rehab_group_id ?? null,
    phase,
    set_by: userId,
  });
  if (insErr) return { error: insErr.message };

  return { error: null };
}

/** migration 0018's group_memberships policy raises a generic RLS denial when a coach
 *  attempts to write a rehab row. Turned into the same plain-English refusal the rest of
 *  this app gives for a role boundary, rather than a raw Postgres permission error. */
function translateGroupWriteError(message: string): string {
  if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('policy')) {
    return 'Only medical staff can allocate athletes to a rehab group.';
  }
  return message;
}
