import { fetchWellnessForAthletes, type WellnessEntry } from './wellness';
import { fetchBodyCompositionForAthletes } from './bodyComposition';
import { fetchCheckinsForAthletes, type NutritionCheckin } from './nutrition';
import { fetchGroupAthleteIds, type Db } from './groups';

/* screens/exports.md job 1, the staff bulk export builder. See
 * lib/exportDomains.ts for which six domains this covers and why the rest
 * of the spec's content table isn't offered.
 *
 * Every fetcher here takes the same shape — a resolved list of athlete ids
 * (never a group id: the group filter is resolved to concrete athletes once,
 * by fetchExportAthletes below, exactly the way every other report/export in
 * this codebase resolves it via fetchGroupAthleteIds) and a from/to date
 * range — so the route calling these can loop over the six in a uniform way.
 * Two of the six (wellness, and the body-composition/nutrition-checkin pair)
 * reuse an existing squad-wide fetcher rather than re-querying: wellness.ts's
 * fetchWellnessForAthletes already takes an exact {from, to} range and needs
 * nothing added; bodyComposition.ts's and nutrition.ts's squad fetchers only
 * take a lower bound, so the upper bound is applied in memory after the call
 * rather than duplicating a second, bounded version of each query. The other
 * three (training RPE, gym, test results) have no existing squad-wide,
 * date-ranged fetcher anywhere in this codebase, so they're new here,
 * written the same way every other direct-query file in lib/queries/ already
 * does it (see reports.ts's fetchComplianceReport for the pattern this
 * follows). */

export type ExportAthlete = { id: string; first_name: string; last_name: string };

/** The roster in scope: current squad only (excludes deleted_at and
 *  left_club), narrowed to the active group filter exactly the way every
 *  other multi-athlete screen resolves it (fetchGroupAthleteIds — null means
 *  no filter, "whole squad"). "Include athletes who have left" from the
 *  spec's own Interactions section is a real, small, stated cut: this pass
 *  always excludes them, the same default every other report and settings
 *  count in this app already uses. */
export async function fetchExportAthletes(db: Db, orgId: string, groupIds: readonly string[]): Promise<ExportAthlete[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  let query = db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club');
  if (scope) query = query.in('id', scope);
  const { data, error } = await query.order('last_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchWellnessExportRows(db: Db, athleteIds: string[], from: string, to: string): Promise<WellnessEntry[]> {
  if (athleteIds.length === 0) return [];
  return fetchWellnessForAthletes(db, athleteIds, { from, to });
}

export type TrainingExportRow = {
  athlete_id: string;
  entry_date: string;
  session_title: string | null;
  rpe: number;
  duration_min: number;
  session_load: number | null;
  submitted_at: string | null;
};

export async function fetchTrainingExportRows(db: Db, athleteIds: string[], from: string, to: string): Promise<TrainingExportRow[]> {
  if (athleteIds.length === 0) return [];
  const { data, error } = await db
    .from('training_entries_current')
    .select('athlete_id, session_id, entry_date, rpe, duration_min, session_load, submitted_at')
    .in('athlete_id', athleteIds)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date');
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter(
    (r): r is typeof r & { athlete_id: string; entry_date: string; rpe: number; duration_min: number } =>
      r.athlete_id !== null && r.entry_date !== null && r.rpe !== null && r.duration_min !== null,
  );
  if (rows.length === 0) return [];

  const sessionIds = [...new Set(rows.map((r) => r.session_id).filter((id): id is string => id !== null))];
  const sessionsRes = sessionIds.length > 0 ? await db.from('sessions').select('id, title').in('id', sessionIds) : { data: [], error: null };
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  const titleById = new Map((sessionsRes.data ?? []).map((s) => [s.id, s.title]));

  return rows.map((r) => ({
    athlete_id: r.athlete_id,
    entry_date: r.entry_date,
    session_title: r.session_id ? (titleById.get(r.session_id) ?? null) : null,
    rpe: r.rpe,
    duration_min: r.duration_min,
    session_load: r.session_load,
    submitted_at: r.submitted_at,
  }));
}

export type GymSessionExportRow = {
  athlete_id: string;
  id: string;
  entry_date: string;
  session_rpe: number | null;
  total_volume_kg: number | null;
};

export type GymSetExportRow = {
  athlete_id: string;
  entry_date: string;
  exercise_name: string;
  set_number: number;
  reps_completed: number | null;
  load_kg: number | null;
  rpe: number | null;
  side: string | null;
};

/** Completed sessions only (status = 'complete'), the same filter
 *  fetchRecentGymSessions (programmes.ts) and squadWeeklyReport.ts already
 *  apply — an in-progress log is not yet a real record of what happened.
 *  Sessions and sets come back as two arrays rather than joined rows,
 *  because they render as two sections of one CSV file (a session has many
 *  sets), the same one-file-two-sections shape reports/squad/export/route.ts
 *  already uses for its own four sections. */
export async function fetchGymExportRows(
  db: Db,
  athleteIds: string[],
  from: string,
  to: string,
): Promise<{ sessions: GymSessionExportRow[]; sets: GymSetExportRow[] }> {
  if (athleteIds.length === 0) return { sessions: [], sets: [] };

  const { data, error } = await db
    .from('gym_session_logs_current')
    .select('id, athlete_id, entry_date, status, session_rpe, total_volume_kg')
    .in('athlete_id', athleteIds)
    .eq('status', 'complete')
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date');
  if (error) throw new Error(error.message);

  const sessionRows = (data ?? []).filter(
    (r): r is typeof r & { id: string; athlete_id: string; entry_date: string } => r.id !== null && r.athlete_id !== null && r.entry_date !== null,
  );
  if (sessionRows.length === 0) return { sessions: [], sets: [] };

  const logIds = sessionRows.map((r) => r.id);
  const entryDateByLog = new Map(sessionRows.map((r) => [r.id, r.entry_date]));
  const athleteByLog = new Map(sessionRows.map((r) => [r.id, r.athlete_id]));

  const setsRes = await db
    .from('gym_set_logs_current')
    .select('gym_session_log_id, exercise_id, set_number, reps_completed, load_kg, rpe, side')
    .in('gym_session_log_id', logIds)
    .order('set_number');
  if (setsRes.error) throw new Error(setsRes.error.message);

  const setRows = (setsRes.data ?? []).filter(
    (r): r is typeof r & { gym_session_log_id: string; exercise_id: string; set_number: number } =>
      r.gym_session_log_id !== null && r.exercise_id !== null && r.set_number !== null,
  );

  const exerciseIds = [...new Set(setRows.map((r) => r.exercise_id))];
  const exercisesRes = exerciseIds.length > 0 ? await db.from('exercises').select('id, name').in('id', exerciseIds) : { data: [], error: null };
  if (exercisesRes.error) throw new Error(exercisesRes.error.message);
  const nameById = new Map((exercisesRes.data ?? []).map((e) => [e.id, e.name]));

  return {
    sessions: sessionRows.map((r) => ({
      athlete_id: r.athlete_id,
      id: r.id,
      entry_date: r.entry_date,
      session_rpe: r.session_rpe,
      total_volume_kg: r.total_volume_kg,
    })),
    sets: setRows.map((r) => ({
      athlete_id: athleteByLog.get(r.gym_session_log_id) ?? '',
      entry_date: entryDateByLog.get(r.gym_session_log_id) ?? '',
      exercise_name: nameById.get(r.exercise_id) ?? 'Exercise',
      set_number: r.set_number,
      reps_completed: r.reps_completed,
      load_kg: r.load_kg,
      rpe: r.rpe,
      side: r.side,
    })),
  };
}

export type TestResultExportRow = {
  athlete_id: string;
  test_date: string;
  test_name: string;
  unit: string;
  value: number;
  attempt_number: number;
  side: string | null;
  is_best: boolean;
  conditions: string | null;
};

export async function fetchTestResultExportRows(db: Db, orgId: string, athleteIds: string[], from: string, to: string): Promise<TestResultExportRow[]> {
  if (athleteIds.length === 0) return [];
  const { data, error } = await db
    .from('test_results')
    .select('athlete_id, test_definition_id, test_date, value, attempt_number, side, is_best, conditions')
    .eq('org_id', orgId)
    .in('athlete_id', athleteIds)
    .is('deleted_at', null)
    .gte('test_date', from)
    .lte('test_date', to)
    .order('test_date');
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const defIds = [...new Set(rows.map((r) => r.test_definition_id))];
  const defsRes = defIds.length > 0 ? await db.from('test_definitions').select('id, name, unit').in('id', defIds) : { data: [], error: null };
  if (defsRes.error) throw new Error(defsRes.error.message);
  const defById = new Map((defsRes.data ?? []).map((d) => [d.id, d]));

  return rows.map((r) => {
    const def = defById.get(r.test_definition_id);
    return {
      athlete_id: r.athlete_id,
      test_date: r.test_date,
      test_name: def?.name ?? 'Unknown test',
      unit: def?.unit ?? '',
      value: r.value,
      attempt_number: r.attempt_number,
      side: r.side,
      is_best: r.is_best,
      conditions: r.conditions,
    };
  });
}

export type BodyCompositionExportRow = {
  athlete_id: string;
  measured_on: string;
  body_mass_kg: number | null;
  body_fat_pct: number | null;
  method: string | null;
};

/** Reuses bodyComposition.ts's own squad fetcher (lower-bound only) and
 *  applies the upper bound in memory — see this file's header for why that's
 *  preferred over a second, bounded copy of the same query. */
export async function fetchBodyCompositionExportRows(db: Db, orgId: string, athleteIds: string[], from: string, to: string): Promise<BodyCompositionExportRow[]> {
  if (athleteIds.length === 0) return [];
  const byAthlete = await fetchBodyCompositionForAthletes(db, orgId, athleteIds, from);
  const rows: BodyCompositionExportRow[] = [];
  for (const [athleteId, entries] of byAthlete) {
    for (const e of entries) {
      if (e.measured_on > to) continue;
      rows.push({ athlete_id: athleteId, measured_on: e.measured_on, body_mass_kg: e.body_mass_kg, body_fat_pct: e.body_fat_pct, method: e.method });
    }
  }
  return rows.sort((a, b) => a.measured_on.localeCompare(b.measured_on));
}

export type NutritionCheckinExportRow = NutritionCheckin & { athlete_id: string };

/** Same in-memory-upper-bound technique as body composition, reusing
 *  nutrition.ts's fetchCheckinsForAthletes. */
export async function fetchNutritionCheckinExportRows(db: Db, orgId: string, athleteIds: string[], from: string, to: string): Promise<NutritionCheckinExportRow[]> {
  if (athleteIds.length === 0) return [];
  const byAthlete = await fetchCheckinsForAthletes(db, orgId, athleteIds, from);
  const rows: NutritionCheckinExportRow[] = [];
  for (const [athleteId, entries] of byAthlete) {
    for (const e of entries) {
      if (e.week_start > to) continue;
      rows.push({ ...e, athlete_id: athleteId });
    }
  }
  return rows.sort((a, b) => a.week_start.localeCompare(b.week_start));
}
