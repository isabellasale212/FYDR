import type {
  AssignmentStatus,
  ExerciseCategory,
  GymLogStatus,
  LoadBasis,
  OverrideType,
  ProgrammeStatus,
  ProgrammeType,
} from '@/lib/types/database';
import type { GymSetLogInput } from '@/lib/validation/gym';
import { todayIso } from '@/lib/format';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';
import { fetchAllPaged } from './paged';
import { recordInjuryEvent } from './injuryTimeline';
import { mustAffect } from '@/lib/write';

/* screens/gym-programmes.md, screens/programme-builder.md, screens/my-programme.md
 * and screens/gym-logging.md, cut down hard. Migration 0021's own header has the
 * full list of what that first pass did not build; migration 0043 (audit findings
 * 29/32, "gym-fix-gameplan" item 3.5) closes two of those real cuts —
 * exercise_overrides and percent_1rm-to-kg resolution — and this file's
 * resolve/override/status functions below were written or rewritten for it. Still
 * not built, on purpose, both here and in 0043's own header: programme_change_events
 * / programme_change_divergences (parent-edit propagation with divergence tracking —
 * still the largest unbuilt part of the spec), the athlete-by-exercise tailoring
 * matrix, drag-and-drop reordering (sequence is a plain integer set at creation
 * time), and deleting programme structure (no DELETE grant anywhere in this domain,
 * including on exercise_overrides — an override is retired by expiring it, see
 * `expireOverride` below). */

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  primary_muscle: string | null;
  equipment: string[] | null;
  cues: string | null;
  one_rm_test_definition_id: string | null;
};

export async function fetchExercises(db: Db, orgId: string): Promise<Exercise[]> {
  const { data, error } = await db
    .from('exercises')
    .select('id, name, category, primary_muscle, equipment, cues, one_rm_test_definition_id')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createExercise(
  db: Db,
  orgId: string,
  input: {
    name: string;
    category: ExerciseCategory;
    primaryMuscle: string | null;
    cues: string | null;
    oneRmTestDefinitionId: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await db.from('exercises').insert({
    org_id: orgId,
    name: input.name.trim(),
    category: input.category,
    primary_muscle: input.primaryMuscle,
    cues: input.cues,
    one_rm_test_definition_id: input.oneRmTestDefinitionId,
  });
  /* Raw driver strings never leave this file — audit S5. */
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

/** The exercise library's "1RM test" picker only ever lists strength-category
 *  test_definitions — O-254's policy question ("which exercises get a linked
 *  test") is answered per exercise, by the coach, from this list; nothing
 *  auto-links. A CMJ or a Bronco test is never offered here even though it is
 *  a real test_definitions row, because it cannot answer "what is 80% of
 *  this athlete's 1RM back squat". */
export type StrengthTestDefinition = { id: string; name: string };

export async function fetchStrengthTestDefinitions(db: Db, orgId: string): Promise<StrengthTestDefinition[]> {
  const { data, error } = await db
    .from('test_definitions')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('test_category', 'strength')
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type ProgrammeSummary = {
  id: string;
  name: string;
  programme_type: ProgrammeType;
  status: ProgrammeStatus;
  goal: string | null;
  duration_weeks: number | null;
  assignment_count: number;
};

export async function fetchProgrammes(db: Db, orgId: string): Promise<ProgrammeSummary[]> {
  const [programmesRes, assignmentsRes] = await Promise.all([
    db
      .from('programmes')
      .select('id, name, programme_type, status, goal, duration_weeks')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    db.from('programme_assignments').select('programme_id').eq('org_id', orgId).eq('status', 'active'),
  ]);
  if (programmesRes.error) throw new Error(programmesRes.error.message);
  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);

  const counts = new Map<string, number>();
  for (const a of assignmentsRes.data ?? []) {
    counts.set(a.programme_id, (counts.get(a.programme_id) ?? 0) + 1);
  }

  return (programmesRes.data ?? []).map((p) => ({ ...p, assignment_count: counts.get(p.id) ?? 0 }));
}

export type ProgrammeListItem = ProgrammeSummary & {
  session_count: number;
  assigned_athlete_count: number;
};

/** GYM-PROGRAMME-SPEC.md's list panel wants "{assigned} · {n} days" per
 *  programme — two real counts fetchProgrammes doesn't give. session_count
 *  is every programme_sessions row under the programme's blocks.
 *  assigned_athlete_count is a de-duplicated athlete count: an athlete can
 *  be assigned individually and through a group at once (a real state —
 *  Pre-season strength below has both James Barnes individually and the
 *  whole Forwards group), and should only count once. Everything here is
 *  one batched query per data source, not one query per programme — four
 *  programmes exist today, but this should not degrade if a club adds
 *  forty. */
export async function fetchProgrammeListDetails(db: Db, orgId: string): Promise<ProgrammeListItem[]> {
  const programmes = await fetchProgrammes(db, orgId);
  const programmeIds = programmes.map((p) => p.id);
  if (programmeIds.length === 0) return [];

  const [blocksRes, assignRes] = await Promise.all([
    db.from('programme_blocks').select('id, programme_id').in('programme_id', programmeIds),
    db
      .from('programme_assignments')
      .select('programme_id, athlete_id, group_id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .in('programme_id', programmeIds),
  ]);
  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (assignRes.error) throw new Error(assignRes.error.message);

  const blockIds = (blocksRes.data ?? []).map((b) => b.id);
  const blockToProgramme = new Map((blocksRes.data ?? []).map((b) => [b.id, b.programme_id]));

  const sessionsRes =
    blockIds.length === 0
      ? { data: [], error: null }
      : await db.from('programme_sessions').select('id, block_id').in('block_id', blockIds);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);

  const sessionCountByProgramme = new Map<string, number>();
  for (const s of sessionsRes.data ?? []) {
    const pid = blockToProgramme.get(s.block_id);
    if (pid) sessionCountByProgramme.set(pid, (sessionCountByProgramme.get(pid) ?? 0) + 1);
  }

  const groupIds = [...new Set((assignRes.data ?? []).map((a) => a.group_id).filter((g): g is string => g !== null))];
  const membershipRes =
    groupIds.length === 0
      ? { data: [], error: null }
      : await db
          .from('group_memberships')
          .select('group_id, athlete_id')
          .eq('org_id', orgId)
          .in('group_id', groupIds)
          .is('removed_at', null);
  if (membershipRes.error) throw new Error(membershipRes.error.message);

  const athletesByGroup = new Map<string, string[]>();
  for (const m of membershipRes.data ?? []) {
    const list = athletesByGroup.get(m.group_id) ?? [];
    list.push(m.athlete_id);
    athletesByGroup.set(m.group_id, list);
  }

  const athleteSetByProgramme = new Map<string, Set<string>>();
  for (const a of assignRes.data ?? []) {
    const set = athleteSetByProgramme.get(a.programme_id) ?? new Set<string>();
    if (a.athlete_id) set.add(a.athlete_id);
    if (a.group_id) for (const id of athletesByGroup.get(a.group_id) ?? []) set.add(id);
    athleteSetByProgramme.set(a.programme_id, set);
  }

  return programmes.map((p) => ({
    ...p,
    session_count: sessionCountByProgramme.get(p.id) ?? 0,
    assigned_athlete_count: athleteSetByProgramme.get(p.id)?.size ?? 0,
  }));
}

/** Only coach may create a gym/conditioning/nutrition programme; only medical
 *  may create a rehab one — enforced for real by migration 0022's RLS, this
 *  function just picks the right message when the database refuses. */
export async function createProgramme(
  db: Db,
  orgId: string,
  userId: string,
  input: { name: string; programmeType: ProgrammeType; goal: string | null; durationWeeks: number | null },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db
    .from('programmes')
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      programme_type: input.programmeType,
      goal: input.goal,
      duration_weeks: input.durationWeeks,
      status: 'draft',
      created_by: userId,
    })
    .select('id')
    .single();

  if (error) {
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return {
        id: null,
        error:
          input.programmeType === 'rehab'
            ? 'Only medical staff can create a rehab programme.'
            : 'Medical staff can only create rehab programmes, not gym, conditioning or nutrition ones.',
      };
    }
    return { id: null, error: humanizeDbError(error.message, 'staff') };
  }
  return { id: data.id, error: null };
}

/** screens/programme-builder.md "Publishing": "A draft programme is invisible
 *  to athletes... Publish sets status = 'active'". Migration 0043 made that
 *  true for the first time — resolve_my_programme_sessions never checked
 *  programmes.status before it — so this is the write half of a real, live
 *  bug fix, not a new feature layered on working behaviour. No validation
 *  set beyond RLS (name uniqueness, "at least one block" etc. from the fuller
 *  spec are not enforced here — a real, documented cut, see the migration's
 *  own header). 'archived' is reachable the same way; there is no separate
 *  archive affordance in the UI, one control does both directions. */
export async function updateProgrammeStatus(
  db: Db,
  orgId: string,
  programmeId: string,
  status: ProgrammeStatus,
): Promise<{ error: string | null }> {
  /* G-36, and this one already TRIED. It sniffed the error message for "row
     level security" or "policy" and returned a permission sentence, which is a
     hand-rolled version of what mustAffect does. It could never fire: an UPDATE
     that RLS filters does not raise, so there is no message to sniff, and the
     branch only ran for an INSERT-shaped failure that never reaches here. Good
     instinct, wrong mechanism, and it made the function look like it handled
     the case it was actually blind to. */
  return mustAffect(
    db.from('programmes').update({ status }).eq('org_id', orgId).eq('id', programmeId).select('id'),
    {
      refusal: 'You do not have permission to change this programme’s status.',
      onError: (m) => humanizeDbError(m, 'staff'),
    },
  );
}

export type ProgrammeDetail = {
  id: string;
  name: string;
  programme_type: ProgrammeType;
  status: ProgrammeStatus;
  goal: string | null;
  duration_weeks: number | null;
};

export type BlockWithSessions = {
  id: string;
  name: string;
  sequence: number;
  duration_weeks: number;
  focus: string | null;
  sessions: SessionSummary[];
};

export type SessionSummary = {
  id: string;
  name: string;
  week_number: number;
  day_number: number | null;
  md_offset: number | null;
  sequence: number;
  exercise_count: number;
};

export async function fetchProgrammeDetail(
  db: Db,
  orgId: string,
  programmeId: string,
): Promise<{ programme: ProgrammeDetail; blocks: BlockWithSessions[] } | null> {
  const { data: programme, error: progErr } = await db
    .from('programmes')
    .select('id, name, programme_type, status, goal, duration_weeks')
    .eq('org_id', orgId)
    .eq('id', programmeId)
    .maybeSingle();
  if (progErr) throw new Error(progErr.message);
  if (!programme) return null;

  const { data: blocks, error: blockErr } = await db
    .from('programme_blocks')
    .select('id, name, sequence, duration_weeks, focus')
    .eq('org_id', orgId)
    .eq('programme_id', programmeId)
    .order('sequence');
  if (blockErr) throw new Error(blockErr.message);

  const blockIds = (blocks ?? []).map((b) => b.id);
  const { data: sessions, error: sessErr } =
    blockIds.length === 0
      ? { data: [], error: null }
      : await db
          .from('programme_sessions')
          .select('id, block_id, name, week_number, day_number, md_offset, sequence')
          .in('block_id', blockIds)
          .order('week_number')
          .order('sequence');
  if (sessErr) throw new Error(sessErr.message);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: exCounts, error: exErr } =
    sessionIds.length === 0
      ? { data: [], error: null }
      : await db.from('programme_exercises').select('programme_session_id').in('programme_session_id', sessionIds);
  if (exErr) throw new Error(exErr.message);

  const countBySession = new Map<string, number>();
  for (const e of exCounts ?? []) {
    countBySession.set(e.programme_session_id, (countBySession.get(e.programme_session_id) ?? 0) + 1);
  }

  const sessionsByBlock = new Map<string, SessionSummary[]>();
  for (const s of sessions ?? []) {
    const list = sessionsByBlock.get(s.block_id) ?? [];
    list.push({
      id: s.id,
      name: s.name,
      week_number: s.week_number,
      day_number: s.day_number,
      md_offset: s.md_offset,
      sequence: s.sequence,
      exercise_count: countBySession.get(s.id) ?? 0,
    });
    sessionsByBlock.set(s.block_id, list);
  }

  return {
    programme,
    blocks: (blocks ?? []).map((b) => ({ ...b, sessions: sessionsByBlock.get(b.id) ?? [] })),
  };
}

export async function createBlock(
  db: Db,
  orgId: string,
  programmeId: string,
  input: { name: string; sequence: number; durationWeeks: number; focus: string | null },
): Promise<{ error: string | null }> {
  const { error } = await db.from('programme_blocks').insert({
    org_id: orgId,
    programme_id: programmeId,
    name: input.name.trim(),
    sequence: input.sequence,
    duration_weeks: input.durationWeeks,
    focus: input.focus,
  });
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

export async function createSession(
  db: Db,
  orgId: string,
  blockId: string,
  input: { name: string; weekNumber: number; dayNumber: number | null; sequence: number },
): Promise<{ error: string | null }> {
  const { error } = await db.from('programme_sessions').insert({
    org_id: orgId,
    block_id: blockId,
    name: input.name.trim(),
    week_number: input.weekNumber,
    day_number: input.dayNumber,
    sequence: input.sequence,
  });
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

export type PrescriptionInput = {
  exerciseId: string;
  sequence: number;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  loadBasis: LoadBasis;
  loadValue: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export async function addExerciseToSession(
  db: Db,
  orgId: string,
  programmeSessionId: string,
  input: PrescriptionInput,
): Promise<{ error: string | null }> {
  const { error } = await db.from('programme_exercises').insert({
    org_id: orgId,
    programme_session_id: programmeSessionId,
    exercise_id: input.exerciseId,
    sequence: input.sequence,
    sets: input.sets,
    reps_min: input.repsMin,
    reps_max: input.repsMax,
    load_basis: input.loadBasis,
    load_value: input.loadValue,
    rest_seconds: input.restSeconds,
    notes: input.notes,
  });
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

export type Assignee = { athlete_id: string | null; group_id: string | null; athlete_name: string | null; group_name: string | null };

export async function fetchAssignments(db: Db, orgId: string, programmeId: string): Promise<Assignee[]> {
  const { data, error } = await db
    .from('programme_assignments')
    .select('athlete_id, group_id, athletes(first_name, last_name), groups(name)')
    .eq('org_id', orgId)
    .eq('programme_id', programmeId)
    .eq('status', 'active');
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    athlete_id: a.athlete_id,
    group_id: a.group_id,
    athlete_name: a.athletes ? `${a.athletes.first_name} ${a.athletes.last_name}` : null,
    group_name: a.groups?.name ?? null,
  }));
}

export type AssignedAthlete = { id: string; first_name: string; last_name: string };

/** Direct assignments unioned with group assignments expanded through live
 *  membership, de-duplicated — the same shape fetchProgrammeListDetails
 *  already computes for the assigned-count badge, factored out here because
 *  the per-athlete view (audit finding 29: "no per-athlete view exists") needs
 *  the actual athlete rows, not just a count, to build its picker. */
export async function fetchAssignedAthletes(db: Db, orgId: string, programmeId: string): Promise<AssignedAthlete[]> {
  const { data: assignments, error: assignErr } = await db
    .from('programme_assignments')
    .select('athlete_id, group_id')
    .eq('org_id', orgId)
    .eq('programme_id', programmeId)
    .eq('status', 'active');
  if (assignErr) throw new Error(assignErr.message);

  const athleteIds = new Set((assignments ?? []).map((a) => a.athlete_id).filter((id): id is string => id !== null));
  const groupIds = [...new Set((assignments ?? []).map((a) => a.group_id).filter((id): id is string => id !== null))];

  if (groupIds.length > 0) {
    const { data: memberships, error: memErr } = await db
      .from('group_memberships')
      .select('athlete_id')
      .eq('org_id', orgId)
      .in('group_id', groupIds)
      .is('removed_at', null);
    if (memErr) throw new Error(memErr.message);
    for (const m of memberships ?? []) athleteIds.add(m.athlete_id);
  }

  if (athleteIds.size === 0) return [];

  const { data: athletes, error: athErr } = await db
    .from('athletes')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .in('id', [...athleteIds])
    .order('last_name');
  if (athErr) throw new Error(athErr.message);
  return athletes ?? [];
}

/** CLAUDE.md §6, the rehab exception: assigning a rehab programme suspends the
 *  athlete's active gym assignment rather than cancelling it. Only reachable
 *  when assigning to a single athlete — a group-wide rehab assignment does not
 *  exist in this build (rehab groups already handle athlete-level allocation;
 *  see lib/queries/rehabGroups.ts), so the suspend step only ever needs to
 *  consider one athlete's own other assignments, not a group's. */
export async function assignProgramme(
  db: Db,
  orgId: string,
  userId: string,
  input: {
    programmeId: string;
    athleteId: string | null;
    groupId: string | null;
    programmeType: ProgrammeType;
    /* The injury <-> S&C link (migrations 0079-0081). Set only when an S&C is
       assigning to an athlete with an open injury: the assignment is then
       written as a PROPOSAL rather than going live, and only the medic can
       activate it. Null everywhere else, which is every other assignment this
       app makes, and those behave exactly as they did.
    
       Scoped to the S&C on purpose, and it is the one thing about this feature
       left open: a SPORT SCIENTIST assigning to the same injured athlete still
       creates a live assignment with no sign-off. Widening it would mean
       admitting the sport scientist to injury_timeline_event's INSERT policy,
       which is an access-control change and does not belong bundled with this. */
    proposeAgainstInjuryId?: string | null;
    /** Only used to write a readable timeline line. */
    programmeName?: string;
  },
): Promise<{ error: string | null }> {
  if (input.programmeType === 'rehab' && input.athleteId) {
    // suspend_assignments_for_rehab (migration 0050), not a plain client
    // UPDATE: this used to fail RLS outright — programme_assignments_update's
    // WITH CHECK (migration 0022) requires a medical actor's row to resolve
    // to programme_type = 'rehab' via its OWN programme_id, but the row
    // being suspended here is the athlete's EXISTING non-rehab assignment,
    // unchanged by the suspend. That made this the one interaction this
    // feature exists for that never actually worked. See the migration's
    // own header for why a narrow SECURITY DEFINER function, not a looser
    // policy.
    const { error: suspendErr } = await db.rpc('suspend_assignments_for_rehab', {
      p_athlete_id: input.athleteId,
      p_rehab_programme_id: input.programmeId,
    });
    if (suspendErr) return { error: humanizeDbError(suspendErr.message, 'staff') };
  }

  /* Narrowed to a plain string here so the event write below needs no cast:
     a proposal is an injury id AND an athlete, never one without the other. */
  const proposeAgainst = input.athleteId ? (input.proposeAgainstInjuryId ?? null) : null;

  const { data, error } = await db
    .from('programme_assignments')
    .insert({
      org_id: orgId,
      programme_id: input.programmeId,
      athlete_id: input.athleteId,
      group_id: input.groupId,
      assigned_by: userId,
      ...(proposeAgainst
        ? { status: 'proposed' as const, injury_id: proposeAgainst }
        : {}),
    })
    .select('id');
  if (error) {
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return { error: 'Only medical staff can assign a rehab programme.' };
    }
    return { error: humanizeDbError(error.message, 'staff') };
  }
  const created = data?.[0];
  if (!created) {
    return { error: 'Not assigned: nothing was written. Check you still have access to this programme.' };
  }

  if (proposeAgainst) {
    /* The assignment exists and is inert either way, so a failed event write is
       reported rather than rolled back: the S&C's draft is safely NOT live, and
       telling them the log entry is missing is more useful than telling them the
       proposal failed when it did not. */
    const logged = await recordInjuryEvent(db, orgId, userId, 'strength_conditioning', {
      injuryId: proposeAgainst,
      type: 'programme_proposed',
      payload: {
        assignment_id: created.id,
        programme_id: input.programmeId,
        programme: input.programmeName ?? '',
      },
    });
    if (logged.error) return { error: `Proposed, but not recorded on the injury timeline: ${logged.error}` };
  }

  return { error: null };
}

/* ---------------------------------------------------------------------------
 * Athlete side: resolved reads through the two security-definer functions, and
 * self-logged gym work.
 * ------------------------------------------------------------------------- */

export type MyProgrammeSession = {
  programme_id: string;
  programme_name: string;
  programme_type: ProgrammeType;
  block_name: string;
  session_id: string;
  session_name: string;
  week_number: number;
  day_number: number | null;
  md_offset: number | null;
};

export type AssignedWeek = {
  /** Monday of the calendar week, ISO date. */
  week_start: string;
  assigned: number;
};

/** How many gym/rehab sessions were ASSIGNED to this athlete in each calendar
 *  week of a window — the denominator behind "of 14 assigned" on My data ·
 *  Gym (Fydr Athlete App.dc.html 23k, implementation spec §9 rule 2).
 *
 *  An RPC rather than a query because nothing on this path is readable from
 *  the client: an athlete has no select on programmes, programme_blocks or
 *  programme_sessions (migration 0021, by design), and resolve_my_programme_
 *  sessions returns week_number/day_number with no assignment dates, so it
 *  cannot say WHICH calendar week a programme week fell in. Migration 0062
 *  carries the mapping and the same whitelist guard as its neighbour.
 *
 *  Bounded at 400 days in the function itself; this caller asks for four
 *  weeks. */
export async function fetchMyAssignedSessionsByWeek(
  db: Db,
  athleteId: string,
  from: string,
  to: string,
): Promise<AssignedWeek[]> {
  const { data, error } = await db.rpc('resolve_my_assigned_sessions_by_week', {
    p_athlete_id: athleteId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ week_start: r.week_start, assigned: r.assigned }));
}

export async function fetchMyProgrammeSessions(db: Db, athleteId: string): Promise<MyProgrammeSession[]> {
  const { data, error } = await db.rpc('resolve_my_programme_sessions', { p_athlete_id: athleteId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    programme_id: r.programme_id,
    programme_name: r.programme_name,
    programme_type: r.programme_type,
    block_name: r.block_name,
    session_id: r.session_id,
    session_name: r.session_name,
    week_number: r.week_number,
    day_number: r.day_number,
    md_offset: r.md_offset,
  }));
}

export type ResolvedExercise = {
  programme_exercise_id: string;
  sequence: number;
  exercise_id: string;
  exercise_name: string;
  category: ExerciseCategory;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  load_basis: LoadBasis;
  load_value: number | null;
  rest_seconds: number | null;
  notes: string | null;
  /* Added by migration 0043. All five are only ever populated when this was
   * resolved for a specific athlete (fetchSessionExercises's athleteId
   * argument); the squad-generic call (no athlete) leaves is_overridden/
   * is_exempt false and the rest null — "no athlete asked, nothing to say" —
   * per the resolve function's own header comment, not a display bug. */
  is_overridden: boolean;
  override_types: OverrideType[];
  override_reason: string | null;
  /* one_rm_linked is real in BOTH call shapes: whether exercises.one_rm_test_
   * definition_id is set at all, independent of any athlete. resolved_load_kg
   * and one_rm_missing are athlete-specific like the override fields above. */
  one_rm_linked: boolean;
  resolved_load_kg: number | null;
  one_rm_missing: boolean;
  one_rm_test_date: string | null;
};

/** athleteId is optional. Omitted (or undefined), this is the squad-generic
 *  parent view the staff programme list has always shown. Passed, this
 *  resolves that one athlete's active overrides and, for a percent_1rm
 *  prescription, a real kilogram figure from their latest 1RM test result —
 *  audit finding 29 ("gym can't answer 'what is athlete X lifting'"), and the
 *  reason ProgrammeAthleteView exists. An athlete calling this always
 *  resolves themselves regardless of what id is passed — enforced in the
 *  function, not here; see migration 0043. */
export async function fetchSessionExercises(
  db: Db,
  programmeSessionId: string,
  athleteId?: string,
): Promise<ResolvedExercise[]> {
  const { data, error } = await db.rpc('resolve_programme_exercises', {
    p_programme_session_id: programmeSessionId,
    p_athlete_id: athleteId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => ({
      programme_exercise_id: r.programme_exercise_id,
      sequence: r.sequence,
      exercise_id: r.exercise_id,
      exercise_name: r.exercise_name,
      category: r.category,
      sets: r.sets,
      reps_min: r.reps_min,
      reps_max: r.reps_max,
      load_basis: r.load_basis,
      load_value: r.load_value,
      rest_seconds: r.rest_seconds,
      notes: r.notes,
      is_overridden: r.is_overridden ?? false,
      override_types: r.override_types ?? [],
      override_reason: r.override_reason,
      one_rm_linked: r.one_rm_linked ?? false,
      resolved_load_kg: r.resolved_load_kg,
      one_rm_missing: r.one_rm_missing ?? false,
      one_rm_test_date: r.one_rm_test_date,
    }))
    .sort((a, b) => a.sequence - b.sequence);
}

export type NewOverrideInput = {
  programmeExerciseId: string;
  athleteId: string;
  overrideType: OverrideType;
  substituteExerciseId: string | null;
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  loadValue: number | null;
  reason: string | null;
  expiresAt: string | null;
};

/** One row per athlete per element, per the table's unique key — a second
 *  override of the same type on the same exercise for the same athlete is a
 *  humanizeDbError'd conflict, not a silent overwrite; the coach edits the
 *  existing one instead (screens/programme-builder.md "Tailoring": "Creating
 *  a second of the same type edits the existing row and says so" — this pass
 *  surfaces the conflict but does not yet do the auto-merge that sentence
 *  describes; a real, small, documented gap). */
export async function createOverride(
  db: Db,
  orgId: string,
  userId: string,
  input: NewOverrideInput,
): Promise<{ error: string | null }> {
  const { error } = await db.from('exercise_overrides').insert({
    org_id: orgId,
    programme_exercise_id: input.programmeExerciseId,
    athlete_id: input.athleteId,
    override_type: input.overrideType,
    substitute_exercise_id: input.substituteExerciseId,
    sets: input.sets,
    reps_min: input.repsMin,
    reps_max: input.repsMax,
    load_value: input.loadValue,
    reason: input.reason,
    expires_at: input.expiresAt,
    created_by: userId,
  });
  if (error) {
    if (error.message.toLowerCase().includes('duplicate key') || error.message.toLowerCase().includes('unique')) {
      return { error: `This athlete already has a ${enumLikeOverrideLabel(input.overrideType)} override on this exercise.` };
    }
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return { error: 'You do not have permission to tailor this programme.' };
    }
    return { error: humanizeDbError(error.message, 'staff') };
  }
  return { error: null };
}

function enumLikeOverrideLabel(t: OverrideType): string {
  return t.replace('_', ' ');
}

/** Retirement, not deletion — migration 0043's own header explains why there
 *  is no DELETE grant on this table. Setting expires_at to now makes
 *  resolve_programme_exercises stop applying it on its very next call; the
 *  row stays as a record of what once applied and to whom. */
export async function expireOverride(db: Db, orgId: string, overrideId: string): Promise<{ error: string | null }> {
  return mustAffect(
    db
      .from('exercise_overrides')
      .update({ expires_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('id', overrideId)
      .select('id'),
    {
      refusal: 'Not saved: gym programme work belongs to the sport scientist and the S&C.',
      onError: (m) => humanizeDbError(m, 'staff'),
    },
  );
}

export type ProgrammeExerciseOption = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  session_name: string;
};

/** Every prescribed exercise across a set of sessions (a whole programme's
 *  worth, sessionIds taken from fetchProgrammeDetail so this does not have to
 *  re-derive them from programmeId itself), flattened with its exercise and
 *  session name — the picker source for the "Add override" form and for
 *  labelling exercise_overrides rows that only ever carry an id. */
export async function fetchProgrammeExerciseIndex(
  db: Db,
  sessionIds: readonly string[],
): Promise<ProgrammeExerciseOption[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await db
    .from('programme_exercises')
    .select('id, exercise_id, sequence, exercises(name), programme_sessions(name)')
    .in('programme_session_id', sessionIds);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => ({
      id: r.id,
      exercise_id: r.exercise_id,
      exercise_name: r.exercises?.name ?? '(unknown exercise)',
      session_name: r.programme_sessions?.name ?? '',
    }))
    .sort((a, b) => (a.session_name + a.exercise_name).localeCompare(b.session_name + b.exercise_name));
}

export type AthleteOverride = {
  id: string;
  programme_exercise_id: string;
  exercise_name: string;
  session_name: string;
  override_type: OverrideType;
  substitute_exercise_id: string | null;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  load_value: number | null;
  reason: string | null;
  expires_at: string | null;
};

/** Every active override for one athlete across a whole programme — the
 *  "Tailoring for this athlete" card. Includes exempt overrides, unlike
 *  fetchSessionExercises, which filters an exempt row out of the resolved
 *  list entirely (correct for the athlete's own view; this is the staff
 *  view that needs to see what was removed and why, so it reads the raw
 *  table directly rather than going through the resolve function). */
export async function fetchActiveOverridesForAthlete(
  db: Db,
  orgId: string,
  programmeExerciseIds: readonly string[],
  athleteId: string,
): Promise<AthleteOverride[]> {
  if (programmeExerciseIds.length === 0) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('exercise_overrides')
    .select(
      'id, programme_exercise_id, override_type, substitute_exercise_id, sets, reps_min, reps_max, load_value, reason, expires_at, programme_exercises(exercises(name), programme_sessions(name))',
    )
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .in('programme_exercise_id', programmeExerciseIds)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    programme_exercise_id: r.programme_exercise_id,
    exercise_name: r.programme_exercises?.exercises?.name ?? '(unknown exercise)',
    session_name: r.programme_exercises?.programme_sessions?.name ?? '',
    override_type: r.override_type,
    substitute_exercise_id: r.substitute_exercise_id,
    sets: r.sets,
    reps_min: r.reps_min,
    reps_max: r.reps_max,
    load_value: r.load_value,
    reason: r.reason,
    expires_at: r.expires_at,
  }));
}

/** Finds today's open (in_progress) log for this session if one exists, else
 *  creates one. A session log is updated in place through its lifecycle, per
 *  migration 0021's own comment — this is the "open or start" half of that.
 *  Returns started_at too — ATHLETE-APP-SPEC.md §9's head shows a live
 *  clock next to the set progress, and the row already carries the one
 *  real timestamp that clock can honestly count up from. */
export async function startOrGetSessionLog(
  db: Db,
  orgId: string,
  athleteId: string,
  programmeSessionId: string,
  timezone: string,
): Promise<{
  id: string | null;
  status: GymLogStatus | null;
  startedAt: string | null;
  error: string | null;
}> {
  // The org's local today, not the server's UTC one — every sibling write
  // path (submitWellnessEntry, submitTrainingEntry, submitCheckin) takes
  // entry_date from todayIso(timezone) via its caller; this was the one
  // that computed its own date off the server clock. For an org with a
  // positive UTC offset, an early-morning local session logged before the
  // UTC day rolls over would be written under yesterday's date, and could
  // silently create a second in_progress row for the same real session if
  // the athlete reopened this page after the UTC date DID roll over (the
  // .eq('entry_date', today) lookup below would then miss the first row).
  const today = todayIso(timezone);
  const { data: existing, error: findErr } = await db
    .from('gym_session_logs')
    .select('id, status, started_at')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .eq('programme_session_id', programmeSessionId)
    .eq('entry_date', today)
    .neq('status', 'abandoned')
    .maybeSingle();
  if (findErr) return { id: null, status: null, startedAt: null, error: humanizeDbError(findErr.message, 'athlete') };
  if (existing) {
    return { id: existing.id, status: existing.status, startedAt: existing.started_at, error: null };
  }

  const startedAt = new Date().toISOString();
  const { data, error } = await db
    .from('gym_session_logs')
    .insert({
      org_id: orgId,
      athlete_id: athleteId,
      programme_session_id: programmeSessionId,
      entry_date: today,
      started_at: startedAt,
      status: 'in_progress',
      source: 'self_report',
    })
    .select('id, status')
    .single();
  if (error) return { id: null, status: null, startedAt: null, error: humanizeDbError(error.message, 'athlete') };
  return { id: data.id, status: data.status, startedAt, error: null };
}

export type LoggedSet = {
  id: string;
  programme_exercise_id: string | null;
  exercise_id: string;
  set_number: number;
  reps_completed: number | null;
  load_kg: number | null;
  rpe: number | null;
};

/** Reads gym_set_logs_current (migration 0044), not the base table — ADR-005 rule 3: a
 *  corrected set's superseded original must never double-count here, the same discipline
 *  wellness_entries_current/training_entries_current already enforce for their domains. */
export async function fetchLoggedSets(db: Db, gymSessionLogId: string): Promise<LoggedSet[]> {
  const { data, error } = await db
    .from('gym_set_logs_current')
    .select('id, programme_exercise_id, exercise_id, set_number, reps_completed, load_kg, rpe')
    .eq('gym_session_log_id', gymSessionLogId)
    .order('logged_at');
  if (error) throw new Error(error.message);
  return (data ?? []).filter(
    (r): r is LoggedSet =>
      r.id !== null && r.exercise_id !== null && r.set_number !== null,
  );
}

/** The plain insert half of the outbox contract (lib/outbox.ts, blocker B4): id is
 *  client-generated so a queued retry lands once, matching submitWellnessEntry/
 *  submitCheckin exactly — throws the raw driver error rather than humanizing it, because
 *  OutboxFlusher's alreadyDelivered() pattern-matches "duplicate key" in the raw message,
 *  which a humanized sentence no longer contains. Humanizing happens at the display layer,
 *  in the caller's own onError. */
export async function submitGymSetLog(
  db: Db,
  orgId: string,
  input: GymSetLogInput,
): Promise<void> {
  const { error } = await db.from('gym_set_logs').insert({
    id: input.id,
    org_id: orgId,
    gym_session_log_id: input.gym_session_log_id,
    programme_exercise_id: input.programme_exercise_id,
    exercise_id: input.exercise_id,
    set_number: input.set_number,
    reps_completed: input.reps_completed,
    load_kg: input.load_kg,
    rpe: input.rpe,
  });
  if (error) throw new Error(error.message);
}

/** The set that is LIVE in a slot — the identity gym_set_logs_one_live_per_slot
 *  (0045) is built from: the session log, the exercise (the programme exercise
 *  when the set came from a programme, else the library exercise) and the set
 *  number. OutboxFlusher asks this after a duplicate-key error so a queued
 *  set is never assumed to have landed (§0aa). Reads the _current view: a
 *  corrected slot's live row is the correction, which is the row whose numbers
 *  are showing. Null when nothing is live there (RLS: the athlete's own). */
export async function fetchGymSetForSlot(
  db: Db,
  input: Pick<GymSetLogInput, 'gym_session_log_id' | 'programme_exercise_id' | 'exercise_id' | 'set_number'>,
): Promise<{ id: string; reps_completed: number | null; load_kg: number | null; rpe: number | null } | null> {
  let query = db
    .from('gym_set_logs_current')
    .select('id, reps_completed, load_kg, rpe')
    .eq('gym_session_log_id', input.gym_session_log_id)
    .eq('set_number', input.set_number);
  query = input.programme_exercise_id
    ? query.eq('programme_exercise_id', input.programme_exercise_id)
    : query.is('programme_exercise_id', null).eq('exercise_id', input.exercise_id);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.id === null) return null;
  return { id: data.id, reps_completed: data.reps_completed, load_kg: data.load_kg, rpe: data.rpe };
}

/** The two facts the conflict banner names a set by: which exercise, which
 *  day. Read once when the conflict is flagged, stored with it. */
export async function fetchGymSetNaming(
  db: Db,
  exerciseId: string,
  gymSessionLogId: string,
): Promise<{ exercise_name: string | null; entry_date: string | null }> {
  const [ex, log] = await Promise.all([
    db.from('exercises').select('name').eq('id', exerciseId).maybeSingle(),
    db.from('gym_session_logs_current').select('entry_date').eq('id', gymSessionLogId).maybeSingle(),
  ]);
  return { exercise_name: ex.data?.name ?? null, entry_date: log.data?.entry_date ?? null };
}

export type GymSetCorrectionInput = {
  reps_completed: number | null;
  load_kg: number | null;
  rpe: number | null;
};

/** The sanctioned correction path (ADR-005, migration 0044): calls revise_gym_set_log,
 *  which closes the original row and inserts a linked revision in one transaction — same
 *  shape as reviseWellnessEntry/reviseCheckin, same reasoning. Online only, not queued
 *  (lib/outbox.ts's own header explains why no revise_* RPC is). */
export async function reviseGymSetLog(
  db: Db,
  originalId: string,
  payload: GymSetCorrectionInput,
): Promise<{ error: string | null }> {
  const { error } = await db.rpc('revise_gym_set_log', {
    p_original_id: originalId,
    p_new_id: crypto.randomUUID(),
    p_payload: payload,
  });
  if (error) {
    if (error.message.includes('entry_not_revisable')) {
      return {
        error: 'This set has already been corrected once, or no longer exists. Refresh to see the latest.',
      };
    }
    return { error: humanizeDbError(error.message, 'athlete') };
  }
  return { error: null };
}

export type GymSessionCorrectionInput = {
  session_rpe: number | null;
  comment: string | null;
};

/** Corrects session_rpe/comment on a COMPLETE session only — migration 0044's own header
 *  explains why the rest of a gym_session_logs row (status, started_at, completed_at,
 *  total_volume_kg) stays an ordinary in-place update instead. */
export async function reviseGymSessionLog(
  db: Db,
  originalId: string,
  payload: GymSessionCorrectionInput,
): Promise<{ error: string | null }> {
  const { error } = await db.rpc('revise_gym_session_log', {
    p_original_id: originalId,
    p_new_id: crypto.randomUUID(),
    p_payload: payload,
  });
  if (error) {
    if (error.message.includes('entry_not_revisable')) {
      return {
        error: 'This session has already been corrected once, is not complete yet, or no longer exists. Refresh to see the latest.',
      };
    }
    return { error: humanizeDbError(error.message, 'athlete') };
  }
  return { error: null };
}

export async function completeSessionLog(
  db: Db,
  gymSessionLogId: string,
  sessionRpe: number | null,
): Promise<{ error: string | null }> {
  /* G-36. An athlete finishing their own session. gym_session_logs grants
     UPDATE on exactly six columns to the athlete themselves (0045), and the
     policy narrows it further to their own un-superseded row, so zero rows means
     this is not their log. Finishing a session and having it stay open is the
     athlete-side version of the bug this whole gap is about. */
  return mustAffect(
    db
      .from('gym_session_logs')
      .update({ status: 'complete', completed_at: new Date().toISOString(), session_rpe: sessionRpe })
      .eq('id', gymSessionLogId)
      .select('id'),
    { refusal: 'That session was not saved as complete. Open it again and retry.', onError: (m) => humanizeDbError(m, 'athlete') },
  );
}

/* ---------------------------------------------------------------------------
 * My Data, gym tab (my-data/page.tsx). There was no "my gym history" read at all before
 * this — that page's own header comment named it as the one segment still missing. Kept
 * deliberately minimal, matching the wellness/training tabs on the same page: a list of
 * recent sessions, a per-session set breakdown, a "Correct" link. No volume trend chart,
 * no e1RM chart, no PR callouts — those are real, larger, separately scoped features.
 * ------------------------------------------------------------------------- */

export type GymSessionSummary = {
  id: string;
  entry_date: string;
  session_name: string | null;
  status: GymLogStatus;
  session_rpe: number | null;
  total_volume_kg: number | null;
  set_count: number;
};

/** Session names come from resolve_my_programme_sessions (already athlete-safe, security
 *  definer), not a direct read of programme_sessions — an athlete has no select on that
 *  table at all (migration 0021: "Athlete: No access. Athletes see the resolved output").
 *  Only covers the athlete's CURRENTLY active assignment, so a session from an ended or
 *  reassigned programme falls back to the generic "Gym session" label rather than a name
 *  — a real, small, honest gap rather than a wrong or guessed name. */
/* ROW CEILING, and why this one is capped rather than paged.
 *
 * `from`/`to` used to be a fixed 42 days (the My Data page's own constant);
 * that page now drives them from the shared period model (lib/period.ts), so
 * the span can be MAX_WINDOW_DAYS — 730 days. Nothing bounds an athlete to one
 * completed gym session a day, so the session read is unbounded by
 * construction, and the SET read beneath it is worse by an order of magnitude:
 * one row per set logged, which at 25-40 sets a session is tens of thousands of
 * rows over two seasons. PostgREST would have returned 1000 of them and every
 * set count past the first few sessions would have silently read low.
 *
 * Paging both would have been correct and useless: the caller renders one table
 * row per session, and nobody scrolls 700 of them. So the SESSION read is
 * capped in the DATABASE — `.limit()` on a descending order, so the truncation
 * is deterministic, most-recent-first, and known to the caller (ask for
 * limit + 1 and a full page means "there are more", which is what the tab says
 * on screen) — and the set read, now bounded to the ids that survived that cap,
 * is paged for the residue. `.order('id')` on the session read is not
 * decoration: several sessions share one entry_date, and a `.limit()` over a
 * non-unique order cuts an arbitrary one of them.
 *
 * `limit` is defaulted rather than required so the shape of every existing call
 * is unchanged, but there is exactly one caller (the My Data gym tab) and it
 * passes its own. */
export async function fetchRecentGymSessions(
  db: Db,
  athleteId: string,
  from: string,
  to: string,
  limit = 60,
): Promise<GymSessionSummary[]> {
  const { data, error } = await db
    .from('gym_session_logs_current')
    .select('id, entry_date, status, session_rpe, total_volume_kg, programme_session_id')
    .eq('athlete_id', athleteId)
    .eq('status', 'complete')
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: false })
    .order('id')
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter(
    (r): r is typeof r & { id: string; entry_date: string; status: GymLogStatus } =>
      r.id !== null && r.entry_date !== null && r.status !== null,
  );
  if (rows.length === 0) return [];

  const [sets, sessions] = await Promise.all([
    fetchAllPaged<{ gym_session_log_id: string | null }>((pageFrom, pageTo) =>
      db
        .from('gym_set_logs_current')
        .select('gym_session_log_id')
        .in('gym_session_log_id', rows.map((r) => r.id))
        .order('gym_session_log_id')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    fetchMyProgrammeSessions(db, athleteId),
  ]);

  const countByLog = new Map<string, number>();
  for (const s of sets) {
    if (!s.gym_session_log_id) continue;
    countByLog.set(s.gym_session_log_id, (countByLog.get(s.gym_session_log_id) ?? 0) + 1);
  }
  const nameBySessionId = new Map(sessions.map((s) => [s.session_id, s.session_name]));

  return rows.map((r) => ({
    id: r.id,
    entry_date: r.entry_date,
    session_name: r.programme_session_id ? (nameBySessionId.get(r.programme_session_id) ?? null) : null,
    status: r.status,
    session_rpe: r.session_rpe,
    total_volume_kg: r.total_volume_kg,
    set_count: countByLog.get(r.id) ?? 0,
  }));
}

export type GymSessionSetDetail = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps_completed: number | null;
  load_kg: number | null;
  rpe: number | null;
};

/** The per-session set breakdown for the My Data gym detail view — reads
 *  gym_set_logs_current (ADR-005 rule 3) and looks exercise names up separately rather
 *  than embedding, since PostgREST's embedded-join detection is unreliable against a view
 *  with no foreign keys of its own. exercises is a shared, org-wide read (migration 0021:
 *  "a name is not squad data"), so this is a plain in() lookup, not a resolve function. */
export async function fetchGymSessionSetDetails(
  db: Db,
  gymSessionLogId: string,
): Promise<GymSessionSetDetail[]> {
  const { data, error } = await db
    .from('gym_set_logs_current')
    .select('id, exercise_id, set_number, reps_completed, load_kg, rpe')
    .eq('gym_session_log_id', gymSessionLogId)
    .order('set_number');
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter(
    (r): r is typeof r & { id: string; exercise_id: string; set_number: number } =>
      r.id !== null && r.exercise_id !== null && r.set_number !== null,
  );
  if (rows.length === 0) return [];

  const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))];
  const { data: exercisesData, error: exErr } = await db
    .from('exercises')
    .select('id, name')
    .in('id', exerciseIds);
  if (exErr) throw new Error(exErr.message);
  const nameById = new Map((exercisesData ?? []).map((e) => [e.id, e.name]));

  return rows.map((r) => ({
    id: r.id,
    exercise_id: r.exercise_id,
    exercise_name: nameById.get(r.exercise_id) ?? 'Exercise',
    set_number: r.set_number,
    reps_completed: r.reps_completed,
    load_kg: r.load_kg,
    rpe: r.rpe,
  }));
}

/** Just enough about the parent session for the detail page's header — entry_date and
 *  whether it is actually the caller's own row (RLS already guarantees the second part;
 *  this is a maybeSingle so a bad id renders notFound rather than throwing). */
export async function fetchGymSessionLog(
  db: Db,
  gymSessionLogId: string,
): Promise<{ id: string; entry_date: string; session_rpe: number | null; comment: string | null } | null> {
  const { data, error } = await db
    .from('gym_session_logs_current')
    .select('id, entry_date, session_rpe, comment')
    .eq('id', gymSessionLogId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.id === null || data.entry_date === null) return null;
  return { id: data.id, entry_date: data.entry_date, session_rpe: data.session_rpe, comment: data.comment };
}

export type AthleteAssignment = {
  assignmentId: string;
  programmeId: string;
  name: string;
  programmeType: ProgrammeType;
  goal: string | null;
  status: AssignmentStatus;
  startsOn: string;
  endsOn: string | null;
  durationWeeks: number | null;
  /** How the athlete got this programme: named directly, or through a group.
   *  Load-bearing on screen — "you are on this because you are in Forwards" is
   *  a different fact from "somebody assigned this to you", and only the second
   *  can be changed by editing this athlete. */
  via: { kind: 'athlete' } | { kind: 'group'; groupId: string; groupName: string | null };
};

/** Every programme assignment that reaches one athlete, including SUSPENDED
 *  ones and including the ones they hold through a GROUP.
 *
 *  Both inclusions are corrections of what the player profile's own programme
 *  banner does, not embellishments:
 *
 *   GROUP ASSIGNMENTS. An athlete whose gym programme was assigned to
 *   Forwards rather than to them by name must still see it. This performs the
 *   same union fetchAssignedAthletes above already does in the other
 *   direction, per programme. queries/playerProfile.ts's banner used to read
 *   programme_assignments with `.eq('athlete_id', athleteId)` alone and so
 *   showed NO programme for those athletes, with the Gym chip beside it
 *   pointing nowhere; it now calls this function, so the profile and the gym
 *   page agree.
 *
 *   SUSPENDED ROWS. CLAUDE.md §6's rehab exception: assigning a rehab
 *   programme SUSPENDS the athlete's gym assignment rather than cancelling it
 *   (migration 0050). Filtering to status = 'active' would show an athlete in
 *   rehab as having no gym programme at all, when the true and more useful
 *   answer is "suspended, because they are on rehab". The caller decides what
 *   to foreground; this returns the facts.
 *
 *  Not paged, and the row argument for it: one row per assignment per athlete.
 *  An assignment is created by hand by a coach, and this read is bounded to
 *  one athlete's own plus the programmes assigned to the handful of groups
 *  they belong to. That is tens of rows for a club with a long history, not
 *  thousands. */
export async function fetchAthleteProgrammeAssignments(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<AthleteAssignment[]> {
  const { data: memberships, error: memErr } = await db
    .from('group_memberships')
    .select('group_id, groups(name)')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('removed_at', null);
  if (memErr) throw new Error(memErr.message);

  const groupNameById = new Map<string, string | null>();
  for (const m of (memberships ?? []) as unknown as { group_id: string; groups: { name: string } | null }[]) {
    groupNameById.set(m.group_id, m.groups?.name ?? null);
  }
  const groupIds = [...groupNameById.keys()];

  const columns =
    'id, athlete_id, group_id, starts_on, ends_on, status, programmes(id, name, goal, programme_type, duration_weeks)';

  const [direct, viaGroup] = await Promise.all([
    db
      .from('programme_assignments')
      .select(columns)
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .order('starts_on', { ascending: false }),
    groupIds.length > 0
      ? db
          .from('programme_assignments')
          .select(columns)
          .eq('org_id', orgId)
          .in('group_id', groupIds)
          .order('starts_on', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (direct.error) throw new Error(direct.error.message);
  if (viaGroup.error) throw new Error(viaGroup.error.message);

  type Row = {
    id: string;
    athlete_id: string | null;
    group_id: string | null;
    starts_on: string;
    ends_on: string | null;
    status: AssignmentStatus;
    programmes: {
      id: string;
      name: string;
      goal: string | null;
      programme_type: ProgrammeType;
      duration_weeks: number | null;
    } | null;
  };

  /* DE-DUPLICATED BY PROGRAMME, NOT BY ASSIGNMENT ROW, and direct wins.
   *
   * The same programme can legitimately reach one athlete twice — assigned to
   * them by name AND to a group they are in — and those are two different
   * programme_assignments rows with two different ids. Keying the dedupe on the
   * row id would collapse nothing, and the Programme card would list "Strength
   * Block 3" twice, once "assigned to them directly" and once "through the
   * Forwards group", with the primary picked arbitrarily by the sort.
   *
   * The surviving row is chosen by an explicit precedence rather than by which
   * query happened to run first, because "which of the two do we keep" has a
   * right answer and it is not always the direct one:
   *
   *   1. ACTIVE BEFORE SUSPENDED. What is running now outranks what is paused,
   *      whichever route it arrived by. A suspended direct row shadowing an
   *      active group row would tell a coach the athlete is off a programme they
   *      is on.
   *   2. THEN DIRECT BEFORE GROUP. Somebody naming this athlete is the more
   *      specific statement of intent, and the direct row is the one an editor
   *      would go and change.
   *   3. THEN MOST RECENTLY STARTED. */
  const rank: Record<string, number> = { active: 0, suspended: 1 };
  const rows = [
    ...((direct.data ?? []) as unknown as Row[]),
    ...((viaGroup.data ?? []) as unknown as Row[]),
  ].sort(
    (a, b) =>
      (rank[a.status] ?? 2) - (rank[b.status] ?? 2) ||
      Number(a.athlete_id === null) - Number(b.athlete_id === null) ||
      b.starts_on.localeCompare(a.starts_on),
  );
  const out: AthleteAssignment[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.programmes || seen.has(r.programmes.id)) continue;
    seen.add(r.programmes.id);
    out.push({
      assignmentId: r.id,
      programmeId: r.programmes.id,
      name: r.programmes.name,
      programmeType: r.programmes.programme_type,
      goal: r.programmes.goal,
      status: r.status,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      durationWeeks: r.programmes.duration_weeks,
      via:
        r.group_id !== null
          ? { kind: 'group', groupId: r.group_id, groupName: groupNameById.get(r.group_id) ?? null }
          : { kind: 'athlete' },
    });
  }
  /* Already in the caller's order — `rows` was sorted before the dedupe loop
   * and `out` is pushed in that order, so this returns active first, then
   * direct before group, then most recently started. The reader wants what is
   * running now; a suspended row is context beneath it, not a headline, and
   * out[0] is what the Gym page uses as the primary assignment. Deliberately
   * NOT re-sorted here: one ordering, decided in one place, is the reason the
   * dedupe can be trusted to have kept the right row. */
  return out;
}

/** The org's earliest completed gym session, for resolveRange's `earliest`
 *  anchor when /squad/[athleteId]/gym is set to "All on record". Without it
 *  `all` silently degrades to MAX_WINDOW_DAYS with `clipped` false, so the
 *  label promises "all on record" over a window that is not — the exact
 *  failure bodyComposition.ts's fetchEarliestBodyCompositionDate exists to
 *  avoid, written the same way.
 *
 *  `entry_date` is a `date` column and comes back as a plain YYYY-MM-DD, so it
 *  is compared as one and never pushed through dateInTz (CLAUDE.md rule 5
 *  governs instants; a calendar date is not one). */
export async function fetchEarliestGymSessionDate(db: Db, orgId: string): Promise<string | null> {
  const { data, error } = await db
    .from('gym_session_logs_current')
    .select('entry_date')
    .eq('org_id', orgId)
    .eq('status', 'complete')
    .not('entry_date', 'is', null)
    .order('entry_date', { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.entry_date ?? null;
}

export type GymAthleteStats = {
  /** Completed sessions in the window. */
  sessions: number;
  /** Mean total_volume_kg across the sessions that recorded one. Null when
   *  none did — never a zero, which would read as "lifted nothing". */
  meanVolumeKg: number | null;
  /** Sessions that actually carried a volume figure, so a mean over 2 of 40
   *  sessions can be seen for what it is. */
  volumeN: number;
  meanRpe: number | null;
  rpeN: number;
};

/** Per-athlete gym aggregates over a window, for the positional comparison on
 *  /squad/[athleteId]/gym. Returns AGGREGATES per athlete and never the
 *  sessions themselves: the caller is drawing a band, and a function that
 *  handed back a peer's individual sessions would be one refactor away from a
 *  named ranking (see queries/positionalContext.ts's header for why that line
 *  is drawn where it is).
 *
 *  PAGED, and this one is not close. `gym_session_logs_current` has no unique
 *  index bounding an athlete to one session a day — fetchRecentGymSessions's
 *  own header says so and caps itself in the database for that reason. Here
 *  the read is a whole positional unit (tens of athletes) over a period that
 *  reaches MAX_WINDOW_DAYS (730): tens of thousands of rows, of which
 *  PostgREST would silently return the first 1000, and every mean past that
 *  would be computed over an arbitrary early slice of the window with nothing
 *  on screen to say so.
 *
 *  Capping like fetchRecentGymSessions does would be wrong here for the same
 *  reason it is right there: that caller renders one row per session and
 *  nobody scrolls 700 of them, so a most-recent-first cap loses nothing the
 *  reader wanted. THIS caller computes a mean, and a mean over a truncated
 *  set is not a shorter answer, it is a wrong one.
 *
 *  `.order('athlete_id').order('id')` — `id` is the unique tiebreak that makes
 *  the order total. Several sessions share an athlete and a date, and
 *  `.range()` re-runs the query per page, so without it a row can be returned
 *  twice or skipped across a page boundary. For a figure the caller AVERAGES,
 *  that is a silently wrong number with no short page to notice it. */
export async function fetchGymSessionStatsForAthletes(
  db: Db,
  orgId: string,
  athleteIds: readonly string[],
  range: { from: string; to: string },
): Promise<Map<string, GymAthleteStats>> {
  if (athleteIds.length === 0) return new Map();

  type Row = { athlete_id: string | null; total_volume_kg: number | null; session_rpe: number | null };
  const rows = await fetchAllPaged<Row>((from, to) =>
    db
      .from('gym_session_logs_current')
      .select('athlete_id, total_volume_kg, session_rpe')
      .eq('org_id', orgId)
      .eq('status', 'complete')
      .in('athlete_id', [...athleteIds])
      .gte('entry_date', range.from)
      .lte('entry_date', range.to)
      .order('athlete_id')
      .order('id')
      .range(from, to),
  );

  const acc = new Map<string, { sessions: number; vol: number[]; rpe: number[] }>();
  for (const r of rows) {
    if (!r.athlete_id) continue;
    const a = acc.get(r.athlete_id) ?? { sessions: 0, vol: [], rpe: [] };
    a.sessions += 1;
    if (r.total_volume_kg !== null) a.vol.push(r.total_volume_kg);
    if (r.session_rpe !== null) a.rpe.push(r.session_rpe);
    acc.set(r.athlete_id, a);
  }

  const out = new Map<string, GymAthleteStats>();
  for (const [id, a] of acc) {
    out.set(id, {
      sessions: a.sessions,
      meanVolumeKg: a.vol.length > 0 ? a.vol.reduce((s, v) => s + v, 0) / a.vol.length : null,
      volumeN: a.vol.length,
      meanRpe: a.rpe.length > 0 ? a.rpe.reduce((s, v) => s + v, 0) / a.rpe.length : null,
      rpeN: a.rpe.length,
    });
  }
  return out;
}

/* ===========================================================================
 * BEST LOGGED SET LOAD, PER ATHLETE PER EXERCISE
 *
 * The raw material for the strength half of the positional comparison on
 * /squad/[athleteId]/gym. Read this before changing it; three of the four
 * decisions below are correctness, not taste.
 *
 * WHY "HEAVIEST WORKING SET" AND NOT A 1RM. A 1RM would be the standard S&C
 * comparison, and this schema can express one: exercises.one_rm_test_definition_id
 * (migration 0043) links a lift to a test_definitions row and
 * resolve_programme_exercises reads the athlete's latest is_best test_results value
 * off it. That path is real and it is EMPTY — in the seeded orgs, zero of the
 * fifteen exercises carry a link, and no test definition is a barbell lift at all
 * (the seven are sprints, jumps, a Bronco, a Yo-Yo and an IMTP). A 1RM band would
 * therefore render "no data" on every row for every athlete in both organisations.
 *
 * AND FYDR DOES NOT ESTIMATE ONE. Epley or Brzycki off a 5RM would fill that gap
 * and is explicitly not built: open question O-389 (docs/11-open-questions.md,
 * screens/testing.md) is answered by omission in migration 0043's own header —
 * "no estimation from a submaximal set (O-389). Missing means missing". A band
 * computed from an estimator would make this file the first place in the codebase
 * to invent a 1RM, which is a product decision and not this function's to take.
 *
 * So the honest figure is the heaviest single set actually logged. It carries a
 * real caveat the CALLER must state on screen and this function cannot: two
 * athletes' bests can sit at different rep counts, so it is a comparison of load
 * moved, not of maximal strength.
 *
 * WHAT COUNTS AS A WORKING SET. Non-warm-up, load above zero, reps above zero.
 * validation/gym.ts allows `reps_completed: 0` and `load_kg: 0` (both `.min(0)`),
 * so both are real values a logger can write: a zero-rep set is a failed attempt
 * and a zero-kilogram set is bodyweight work. Neither is evidence of a load
 * lifted, and `.gt()` excludes nulls as well, which is the behaviour wanted for
 * both columns.
 *
 * PAGED AND CHUNKED — TWO DIFFERENT LIMITS, BOTH REAL. gym_set_logs is the
 * largest athlete-data table in this app: tens of thousands of rows across two
 * seasons for one club. fetchAllPaged covers PostgREST's silent 1000-row ceiling.
 * The SECOND limit is that gym_set_logs carries no athlete_id and no entry_date —
 * both live on the parent gym_session_logs row — so the only way in is
 * `.in('gym_session_log_id', ...)`, and at `all` over a thirty-athlete unit that
 * list is thousands of uuids in a URL. See SESSION_LOG_ID_CHUNK.
 *
 * IT RETURNS AGGREGATES PER ATHLETE, NEVER SETS. One number per athlete per
 * exercise, the same stance fetchGymSessionStatsForAthletes takes and for the same
 * reason: the caller is drawing a band, and a function that handed back a peer's
 * individual sets would be one refactor away from a named ranking. See
 * queries/positionalContext.ts's header for where that line is and why.
 * ======================================================================== */

/** How many session-log ids go into one `.in()` filter.
 *
 *  NOT paging, and not a substitute for it — fetchAllPaged still wraps each chunk.
 *  This is a URL-length bound: PostgREST puts every filter in the query string, a
 *  uuid costs ~39 bytes inside `in.(...)`, and the gateway in front of PostgREST
 *  rejects an over-long request line. 150 ids is ~5.9 kB, inside the conventional
 *  8 kB request-line budget with the rest of the query and the base URL on top.
 *
 *  Chunks are issued concurrently: they are independent reads and the worst case
 *  (a wide unit at `all`) is otherwise dozens of sequential round trips. */
const SESSION_LOG_ID_CHUNK = 150;

/** athlete id → exercise id → heaviest working-set load in kilograms.
 *
 *  `exerciseIds`, when given, narrows the set read to the lifts the caller will
 *  actually render. On the gym page that is the subject's own lifts, which is what
 *  keeps the peer read proportionate: without it, `all` over a full unit pulls
 *  every set of every exercise the club has ever logged to answer a question about
 *  four barbell movements.
 *
 *  `entry_date` and `measured_on` are `date` columns, so `range.from`/`range.to`
 *  are compared as plain YYYY-MM-DD (CLAUDE.md rule 5 governs instants; a calendar
 *  date is not one). Both `.order()` chains end in `id` because `.range()` re-runs
 *  the query per page and a non-unique sort can duplicate or drop a row across a
 *  page boundary. */
export async function fetchBestSetLoadsForAthletes(
  db: Db,
  orgId: string,
  athleteIds: readonly string[],
  range: { from: string; to: string },
  opts: { exerciseIds?: readonly string[] } = {},
): Promise<Map<string, Map<string, number>>> {
  if (athleteIds.length === 0) return new Map();
  if (opts.exerciseIds !== undefined && opts.exerciseIds.length === 0) return new Map();

  type SessionRow = { id: string | null; athlete_id: string | null };
  const sessions = await fetchAllPaged<SessionRow>((from, to) =>
    db
      .from('gym_session_logs_current')
      .select('id, athlete_id')
      .eq('org_id', orgId)
      .eq('status', 'complete')
      .in('athlete_id', [...athleteIds])
      .gte('entry_date', range.from)
      .lte('entry_date', range.to)
      .order('athlete_id')
      .order('id')
      .range(from, to),
  );

  const athleteByLog = new Map<string, string>();
  for (const s of sessions) {
    if (s.id !== null && s.athlete_id !== null) athleteByLog.set(s.id, s.athlete_id);
  }
  if (athleteByLog.size === 0) return new Map();

  const logIds = [...athleteByLog.keys()];
  const chunks: string[][] = [];
  for (let i = 0; i < logIds.length; i += SESSION_LOG_ID_CHUNK) {
    chunks.push(logIds.slice(i, i + SESSION_LOG_ID_CHUNK));
  }

  type SetRow = { gym_session_log_id: string | null; exercise_id: string | null; load_kg: number | null };
  const perChunk = await Promise.all(
    chunks.map((chunk) =>
      fetchAllPaged<SetRow>((from, to) => {
        let q = db
          .from('gym_set_logs_current')
          .select('gym_session_log_id, exercise_id, load_kg')
          .eq('org_id', orgId)
          .eq('is_warmup', false)
          .gt('load_kg', 0)
          .gt('reps_completed', 0)
          .in('gym_session_log_id', chunk);
        if (opts.exerciseIds !== undefined) q = q.in('exercise_id', [...opts.exerciseIds]);
        return q.order('gym_session_log_id').order('id').range(from, to);
      }),
    ),
  );

  const out = new Map<string, Map<string, number>>();
  for (const rows of perChunk) {
    for (const r of rows) {
      if (r.gym_session_log_id === null || r.exercise_id === null || r.load_kg === null) continue;
      const athleteId = athleteByLog.get(r.gym_session_log_id);
      if (athleteId === undefined) continue;
      const byExercise = out.get(athleteId) ?? new Map<string, number>();
      const prev = byExercise.get(r.exercise_id);
      if (prev === undefined || r.load_kg > prev) byExercise.set(r.exercise_id, r.load_kg);
      out.set(athleteId, byExercise);
    }
  }
  return out;
}

/** Names for a known, short list of exercise ids.
 *
 *  Deliberately NOT fetchExercises(): that reads the whole movement library and
 *  filters `deleted_at is null`, which is right for a picker and wrong here. A
 *  set logged against an exercise the club has since retired is still a set that
 *  happened, and labelling it from a list that excludes retired movements would
 *  leave a real row on screen with no name. Callers here always have the ids in
 *  hand — they came out of the set logs — so this asks for exactly those and
 *  reads soft-deleted rows too. Bounded by the caller's own id list, so no
 *  paging: this is a handful of lifts, not a table scan. */
export async function fetchExerciseNames(
  db: Db,
  orgId: string,
  exerciseIds: readonly string[],
): Promise<Map<string, string>> {
  if (exerciseIds.length === 0) return new Map();
  const { data, error } = await db
    .from('exercises')
    .select('id, name')
    .eq('org_id', orgId)
    .in('id', [...exerciseIds]);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((e): [string, string] => [e.id, e.name]));
}

export type GymLogStatusFilter = GymLogStatus;
export type AssignmentStatusFilter = AssignmentStatus;
