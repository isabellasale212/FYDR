import type { Db } from './groups';
import { fetchRecentCheckins, type NutritionCheckin } from './nutrition';

/* 09-security-and-compliance.md, Article 20 ("right to data portability"):
 * "an athlete-initiated 'export my data' action in the Me tab, producing
 * structured JSON plus CSV." Built as CSV only — see
 * lib/csv.ts's header for why every export in this build is CSV rather than
 * a second, JSON, code path: it is a real, honestly-named cut, not a
 * silent one, and CSV alone already answers the right this feature exists
 * to serve.
 *
 * Scope is the portability set the spec's own table draws, not everything
 * Article 15 access would return: data the athlete *provided*, processed by
 * automated means. In practice for this schema that's wellness entries as
 * submitted, training RPE and duration, gym set logs, nutrition check-ins,
 * and their own profile fields — never readiness_score (derived), flags,
 * ACWR, coach notes, or test results recorded by staff. Those are Article
 * 15 territory (the SAR pack an admin generates), which this build does not
 * have — see the note in the Me export route for why that one stays cut.
 *
 * Every read resolves to the live revision only (wellness_entries_current,
 * training_entries_current), matching the immutability/rectification rule
 * this whole schema already follows — a superseded value that was corrected
 * is not part of what the athlete would recognise as "my data" today. Full
 * revision history is a real, smaller cut, not included here.
 */

export type MyWellnessRow = {
  entry_date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
  resting_hr: number | null;
  body_mass_kg: number | null;
  submitted_at: string | null;
};

export type MyTrainingRow = {
  entry_date: string;
  session_title: string | null;
  rpe: number;
  duration_min: number;
  submitted_at: string | null;
};

export type MyGymSetRow = {
  entry_date: string;
  exercise_name: string;
  set_number: number;
  reps_completed: number | null;
  load_kg: number | null;
  rpe: number | null;
  side: string | null;
};

export type MyNutritionTargetRow = {
  effective_from: string;
  effective_to: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fluid_ml: number | null;
};

export type MyDataExport = {
  profile: {
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    date_of_birth: string | null;
    position: string | null;
    squad_number: number | null;
    dominant_side: string | null;
    height_cm: number | null;
  } | null;
  wellness: MyWellnessRow[];
  training: MyTrainingRow[];
  gymSets: MyGymSetRow[];
  nutritionCheckins: NutritionCheckin[];
  nutritionTargets: MyNutritionTargetRow[];
};

export async function fetchMyDataExport(db: Db, orgId: string, athleteId: string): Promise<MyDataExport> {
  const [profileRes, wellnessRes, trainingRes, gymSessionLogsRes, checkins, targetsRes] = await Promise.all([
    db
      .from('athletes')
      .select('first_name, last_name, preferred_name, date_of_birth, position, squad_number, dominant_side, height_cm')
      .eq('id', athleteId)
      .maybeSingle(),
    db
      .from('wellness_entries_current')
      .select('entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress, mood, resting_hr, body_mass_kg, submitted_at')
      .eq('athlete_id', athleteId)
      .order('entry_date'),
    db
      .from('training_entries_current')
      .select('session_id, entry_date, rpe, duration_min, submitted_at')
      .eq('athlete_id', athleteId)
      .order('entry_date'),
    // The _current view, matching the two reads above it — 0045:239, "Read
    // this, never the base table." A session the athlete corrected would
    // otherwise appear in their own portability export twice, once as the
    // superseded row and once as the correction that replaced it.
    db
      .from('gym_session_logs_current')
      .select('id, entry_date')
      .eq('athlete_id', athleteId)
      .order('entry_date'),
    fetchRecentCheckins(db, athleteId, '2000-01-01', '2100-01-01'),
    db
      .from('nutrition_targets')
      .select('effective_from, effective_to, energy_kcal, protein_g, carbs_g, fat_g, fluid_ml')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .order('effective_from'),
  ]);

  if (wellnessRes.error) throw new Error(wellnessRes.error.message);
  if (trainingRes.error) throw new Error(trainingRes.error.message);
  if (gymSessionLogsRes.error) throw new Error(gymSessionLogsRes.error.message);
  if (targetsRes.error) throw new Error(targetsRes.error.message);

  const sessionIds = [...new Set((trainingRes.data ?? []).map((r) => r.session_id).filter((id): id is string => id !== null))];
  const sessionsRes = sessionIds.length > 0 ? await db.from('sessions').select('id, title').in('id', sessionIds) : { data: [], error: null };
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  const sessionTitleById = new Map((sessionsRes.data ?? []).map((s) => [s.id, s.title]));

  // gym_set_logs_current (ADR-005 rule 3), not the base table — a corrected
  // set's superseded original must never appear alongside its live
  // revision, the same discipline wellness/training already get from their
  // own _current views. Looked up as gym_session_logs -> gym_set_logs_current
  // -> exercises in three plain steps, not one embedded query: the view has
  // no foreign keys of its own, so PostgREST's embedded-join detection
  // against it is unreliable (same reasoning, same pattern, as
  // programmes.ts's fetchGymSessionSetDetails).
  const gymSessionLogIds = (gymSessionLogsRes.data ?? []).map((r) => r.id);
  const entryDateByLogId = new Map((gymSessionLogsRes.data ?? []).map((r) => [r.id, r.entry_date]));

  let gymSetLogRows: {
    gym_session_log_id: string | null;
    exercise_id: string | null;
    set_number: number | null;
    reps_completed: number | null;
    load_kg: number | null;
    rpe: number | null;
    side: string | null;
  }[] = [];
  if (gymSessionLogIds.length > 0) {
    const { data, error } = await db
      .from('gym_set_logs_current')
      .select('gym_session_log_id, exercise_id, set_number, reps_completed, load_kg, rpe, side, logged_at')
      .in('gym_session_log_id', gymSessionLogIds)
      .order('logged_at');
    if (error) throw new Error(error.message);
    gymSetLogRows = data ?? [];
  }

  const exerciseIds = [...new Set(gymSetLogRows.map((r) => r.exercise_id).filter((id): id is string => id !== null))];
  let exerciseNameById = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const { data, error } = await db.from('exercises').select('id, name').in('id', exerciseIds);
    if (error) throw new Error(error.message);
    exerciseNameById = new Map((data ?? []).map((e) => [e.id, e.name]));
  }

  const wellness: MyWellnessRow[] = (wellnessRes.data ?? [])
    .filter((r): r is typeof r & { entry_date: string } => r.entry_date !== null)
    .map((r) => ({
      entry_date: r.entry_date,
      sleep_hours: r.sleep_hours,
      sleep_quality: r.sleep_quality,
      fatigue: r.fatigue,
      soreness: r.soreness,
      stress: r.stress,
      mood: r.mood,
      resting_hr: r.resting_hr,
      body_mass_kg: r.body_mass_kg,
      submitted_at: r.submitted_at,
    }));

  const training: MyTrainingRow[] = (trainingRes.data ?? [])
    .filter((r): r is typeof r & { entry_date: string; rpe: number; duration_min: number } => r.entry_date !== null && r.rpe !== null && r.duration_min !== null)
    .map((r) => ({
      entry_date: r.entry_date,
      session_title: (r.session_id && sessionTitleById.get(r.session_id)) ?? null,
      rpe: r.rpe,
      duration_min: r.duration_min,
      submitted_at: r.submitted_at,
    }));

  const gymSets: MyGymSetRow[] = gymSetLogRows
    .filter((r): r is typeof r & { gym_session_log_id: string; set_number: number } => r.gym_session_log_id !== null && r.set_number !== null)
    .map((r) => ({
      entry_date: entryDateByLogId.get(r.gym_session_log_id) ?? '',
      exercise_name: (r.exercise_id && exerciseNameById.get(r.exercise_id)) ?? 'Unknown exercise',
      set_number: r.set_number,
      reps_completed: r.reps_completed,
      load_kg: r.load_kg,
      rpe: r.rpe,
      side: r.side,
    }));

  const nutritionTargets: MyNutritionTargetRow[] = targetsRes.data ?? [];

  return {
    profile: profileRes.data ?? null,
    wellness,
    training,
    gymSets,
    nutritionCheckins: checkins,
    nutritionTargets,
  };
}
