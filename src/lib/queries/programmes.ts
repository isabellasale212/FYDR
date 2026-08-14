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
  const { error } = await db
    .from('programmes')
    .update({ status })
    .eq('org_id', orgId)
    .eq('id', programmeId);
  if (error) {
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return { error: 'You do not have permission to change this programme’s status.' };
    }
    return { error: humanizeDbError(error.message, 'staff') };
  }
  return { error: null };
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
  input: { programmeId: string; athleteId: string | null; groupId: string | null; programmeType: ProgrammeType },
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

  const { error } = await db.from('programme_assignments').insert({
    org_id: orgId,
    programme_id: input.programmeId,
    athlete_id: input.athleteId,
    group_id: input.groupId,
    assigned_by: userId,
  });
  if (error) {
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return { error: 'Only medical staff can assign a rehab programme.' };
    }
    return { error: humanizeDbError(error.message, 'staff') };
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
  const { error } = await db
    .from('exercise_overrides')
    .update({ expires_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', overrideId);
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
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
  const { error } = await db
    .from('gym_session_logs')
    .update({ status: 'complete', completed_at: new Date().toISOString(), session_rpe: sessionRpe })
    .eq('id', gymSessionLogId);
  return { error: error ? humanizeDbError(error.message, 'athlete') : null };
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
export async function fetchRecentGymSessions(
  db: Db,
  athleteId: string,
  from: string,
  to: string,
): Promise<GymSessionSummary[]> {
  const { data, error } = await db
    .from('gym_session_logs_current')
    .select('id, entry_date, status, session_rpe, total_volume_kg, programme_session_id')
    .eq('athlete_id', athleteId)
    .eq('status', 'complete')
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter(
    (r): r is typeof r & { id: string; entry_date: string; status: GymLogStatus } =>
      r.id !== null && r.entry_date !== null && r.status !== null,
  );
  if (rows.length === 0) return [];

  const [setsRes, sessions] = await Promise.all([
    db
      .from('gym_set_logs_current')
      .select('gym_session_log_id')
      .in('gym_session_log_id', rows.map((r) => r.id)),
    fetchMyProgrammeSessions(db, athleteId),
  ]);
  if (setsRes.error) throw new Error(setsRes.error.message);

  const countByLog = new Map<string, number>();
  for (const s of setsRes.data ?? []) {
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

export type GymLogStatusFilter = GymLogStatus;
export type AssignmentStatusFilter = AssignmentStatus;
