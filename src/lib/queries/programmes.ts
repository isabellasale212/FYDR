import type {
  AssignmentStatus,
  ExerciseCategory,
  GymLogStatus,
  LoadBasis,
  ProgrammeStatus,
  ProgrammeType,
} from '@/lib/types/database';
import type { Db } from './groups';

/* screens/gym-programmes.md, screens/programme-builder.md, screens/my-programme.md
 * and screens/gym-logging.md, cut down hard. Migration 0021's own header has the
 * full list of what this pass does not build (exercise_overrides, the
 * change-events/divergence-tracking system, 1RM-based load resolution) and why.
 * This file covers: an exercise library, a programme built from blocks of
 * sessions of prescribed exercises, assigning it to an athlete or a group, an
 * athlete's own resolved session list and its exercises, and athlete-logged sets
 * against them. No staff-entered logging, no drag-and-drop reordering — sequence
 * is a plain integer set at creation time, reordering is a documented gap. */

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  primary_muscle: string | null;
  equipment: string[] | null;
  cues: string | null;
};

export async function fetchExercises(db: Db, orgId: string): Promise<Exercise[]> {
  const { data, error } = await db
    .from('exercises')
    .select('id, name, category, primary_muscle, equipment, cues')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createExercise(
  db: Db,
  orgId: string,
  input: { name: string; category: ExerciseCategory; primaryMuscle: string | null; cues: string | null },
): Promise<{ error: string | null }> {
  const { error } = await db.from('exercises').insert({
    org_id: orgId,
    name: input.name.trim(),
    category: input.category,
    primary_muscle: input.primaryMuscle,
    cues: input.cues,
  });
  return { error: error?.message ?? null };
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
    return { id: null, error: error.message };
  }
  return { id: data.id, error: null };
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
  return { error: error?.message ?? null };
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
  return { error: error?.message ?? null };
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
  return { error: error?.message ?? null };
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
    const { error: suspendErr } = await db
      .from('programme_assignments')
      .update({ status: 'suspended', suspended_reason: 'Rehab programme assigned' })
      .eq('org_id', orgId)
      .eq('athlete_id', input.athleteId)
      .eq('status', 'active')
      .neq('programme_id', input.programmeId);
    if (suspendErr) return { error: suspendErr.message };
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
    return { error: error.message };
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
};

export async function fetchSessionExercises(db: Db, programmeSessionId: string): Promise<ResolvedExercise[]> {
  const { data, error } = await db.rpc('resolve_programme_exercises', {
    p_programme_session_id: programmeSessionId,
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
    }))
    .sort((a, b) => a.sequence - b.sequence);
}

/** Finds today's open (in_progress) log for this session if one exists, else
 *  creates one. A session log is updated in place through its lifecycle, per
 *  migration 0021's own comment — this is the "open or start" half of that. */
export async function startOrGetSessionLog(
  db: Db,
  orgId: string,
  athleteId: string,
  programmeSessionId: string,
): Promise<{ id: string | null; status: GymLogStatus | null; error: string | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing, error: findErr } = await db
    .from('gym_session_logs')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .eq('programme_session_id', programmeSessionId)
    .eq('entry_date', today)
    .neq('status', 'abandoned')
    .maybeSingle();
  if (findErr) return { id: null, status: null, error: findErr.message };
  if (existing) return { id: existing.id, status: existing.status, error: null };

  const { data, error } = await db
    .from('gym_session_logs')
    .insert({
      org_id: orgId,
      athlete_id: athleteId,
      programme_session_id: programmeSessionId,
      entry_date: today,
      started_at: new Date().toISOString(),
      status: 'in_progress',
      source: 'self_report',
    })
    .select('id, status')
    .single();
  if (error) return { id: null, status: null, error: error.message };
  return { id: data.id, status: data.status, error: null };
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

export async function fetchLoggedSets(db: Db, gymSessionLogId: string): Promise<LoggedSet[]> {
  const { data, error } = await db
    .from('gym_set_logs')
    .select('id, programme_exercise_id, exercise_id, set_number, reps_completed, load_kg, rpe')
    .eq('gym_session_log_id', gymSessionLogId)
    .order('logged_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logSet(
  db: Db,
  orgId: string,
  input: {
    gymSessionLogId: string;
    programmeExerciseId: string;
    exerciseId: string;
    setNumber: number;
    repsCompleted: number | null;
    loadKg: number | null;
    rpe: number | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await db.from('gym_set_logs').insert({
    org_id: orgId,
    gym_session_log_id: input.gymSessionLogId,
    programme_exercise_id: input.programmeExerciseId,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    reps_completed: input.repsCompleted,
    load_kg: input.loadKg,
    rpe: input.rpe,
  });
  return { error: error?.message ?? null };
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
  return { error: error?.message ?? null };
}

export type GymLogStatusFilter = GymLogStatus;
export type AssignmentStatusFilter = AssignmentStatus;
