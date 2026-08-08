import type { BodySide, SideMode, TestCategory } from '@/lib/types/database';
import { fetchGroupAthleteIds, type Db } from './groups';

/* screens/testing.md, cut down hard — see migration 0024's header for the
 * full list of what this pass does and does not build (no batteries, no
 * session scheduling, no CSV import, no global standard library). This file
 * covers: the test definitions library, logging attempts directly against a
 * definition and a date, history and personal bests, and the manual
 * best-attempt override.
 *
 * markBestManual does two statements in one call, not one — see migration
 * 0025's header and 090_testing_test.sql: the mark_best_attempt trigger only
 * fires on a change to value or deleted_at, by design, so a write that only
 * touches is_best/is_best_manual (this one) has to clear every sibling
 * attempt's is_best itself rather than relying on the trigger to notice. */

export type TestDefinition = {
  id: string;
  name: string;
  test_category: TestCategory;
  unit: string;
  higher_is_better: boolean;
  side_mode: SideMode;
  default_attempts: number;
  decimal_places: number;
  leaderboard_eligible: boolean;
};

export async function fetchTestDefinitions(db: Db, orgId: string): Promise<TestDefinition[]> {
  const { data, error } = await db
    .from('test_definitions')
    .select('id, name, test_category, unit, higher_is_better, side_mode, default_attempts, decimal_places, leaderboard_eligible')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('sort_order')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTestDefinition(
  db: Db,
  orgId: string,
  input: {
    name: string;
    testCategory: TestCategory;
    unit: string;
    higherIsBetter: boolean;
    sideMode: SideMode;
    defaultAttempts: number;
  },
): Promise<{ error: string | null }> {
  // test_definitions.sort_order defaults to 0 at the table level (migration
  // 0024), same shape as groups.sort_order, which this session found left
  // every new group tied at 0 (lib/queries/groups.ts's createGroup, since
  // fixed). No reorder UI exists for test definitions — fetchTestDefinitions
  // orders by sort_order then name, and with every row tied at 0 that's
  // functionally name-only ordering today — so this isn't a broken control
  // the way the groups one was, only a latent inconsistency with the one
  // other place this exact pattern lives in this codebase. Fixed the same
  // way, for the same reason: if a reorder control is ever added here,
  // "every existing row already collides at 0" shouldn't be what it inherits.
  const { data: siblings, error: siblingsError } = await db
    .from('test_definitions')
    .select('sort_order')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (siblingsError) return { error: siblingsError.message };
  const nextSortOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

  const { error } = await db.from('test_definitions').insert({
    org_id: orgId,
    name: input.name.trim(),
    test_category: input.testCategory,
    unit: input.unit.trim(),
    higher_is_better: input.higherIsBetter,
    side_mode: input.sideMode,
    default_attempts: input.defaultAttempts,
    // A body-composition test can never be leaderboard eligible — the check
    // constraint enforces this regardless, this just avoids a round trip
    // that is always going to fail for that one category.
    leaderboard_eligible: input.testCategory !== 'body_comp',
    sort_order: nextSortOrder,
  });
  return { error: error?.message ?? null };
}

export type AthleteForLogging = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  squad_number: number | null;
  attempts: { attempt_number: number; side: BodySide | null; value: number; is_best: boolean; id: string }[];
  pbValue: number | null;
};

/* CLAUDE.md §3: every screen showing more than one athlete is filterable by
 * group, and screens/testing.md's own query-key spec for this exact grid —
 * `qk.testing.grid(orgId, sessionId, testDefinitionId, groupIds)` — names
 * groupIds as one of its parameters. This was the one real gap in an
 * otherwise-honestly-cut file: not a documented simplification (the header
 * above lists what this pass cut, and group filtering isn't among them),
 * just missing. groupIds defaults to [] (no filter) so every existing
 * caller keeps working unchanged. */
export async function fetchResultsForLogging(
  db: Db,
  orgId: string,
  testDefinitionId: string,
  testDate: string,
  groupIds: readonly string[] = [],
): Promise<AthleteForLogging[]> {
  const [athletesRes, scope, todayRes, pbRes, defRes] = await Promise.all([
    db.from('athletes').select('id, first_name, last_name, squad_number').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club'),
    fetchGroupAthleteIds(db, orgId, groupIds),
    db
      .from('test_results')
      .select('id, athlete_id, attempt_number, side, value, is_best')
      .eq('org_id', orgId)
      .eq('test_definition_id', testDefinitionId)
      .eq('test_date', testDate)
      .is('deleted_at', null),
    db
      .from('test_results')
      .select('athlete_id, value')
      .eq('org_id', orgId)
      .eq('test_definition_id', testDefinitionId)
      .eq('is_best', true)
      .is('deleted_at', null),
    db.from('test_definitions').select('higher_is_better').eq('id', testDefinitionId).single(),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (todayRes.error) throw new Error(todayRes.error.message);
  if (pbRes.error) throw new Error(pbRes.error.message);
  if (defRes.error) throw new Error(defRes.error.message);

  const inScope = scope ? new Set(scope) : null;
  const scopedAthletes = (athletesRes.data ?? []).filter((a) => !inScope || inScope.has(a.id));

  const higherIsBetter = defRes.data.higher_is_better;
  const pbByAthlete = new Map<string, number>();
  for (const r of pbRes.data ?? []) {
    const cur = pbByAthlete.get(r.athlete_id);
    if (cur === undefined || (higherIsBetter ? r.value > cur : r.value < cur)) pbByAthlete.set(r.athlete_id, r.value);
  }

  const attemptsByAthlete = new Map<string, AthleteForLogging['attempts']>();
  for (const r of todayRes.data ?? []) {
    const list = attemptsByAthlete.get(r.athlete_id) ?? [];
    list.push({ attempt_number: r.attempt_number, side: r.side, value: r.value, is_best: r.is_best, id: r.id });
    attemptsByAthlete.set(r.athlete_id, list);
  }

  return scopedAthletes
    .map((a) => ({
      athlete_id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      squad_number: a.squad_number,
      attempts: (attemptsByAthlete.get(a.id) ?? []).sort((x, y) => x.attempt_number - y.attempt_number),
      pbValue: pbByAthlete.get(a.id) ?? null,
    }))
    .sort((a, b) => (a.squad_number ?? 999) - (b.squad_number ?? 999) || a.last_name.localeCompare(b.last_name));
}

export async function logAttempt(
  db: Db,
  orgId: string,
  userId: string,
  input: { athleteId: string; testDefinitionId: string; testDate: string; attemptNumber: number; value: number; side: BodySide | null },
): Promise<{ error: string | null }> {
  const { error } = await db.from('test_results').upsert(
    {
      org_id: orgId,
      athlete_id: input.athleteId,
      test_definition_id: input.testDefinitionId,
      test_date: input.testDate,
      attempt_number: input.attemptNumber,
      value: input.value,
      side: input.side,
      recorded_by: userId,
      source: 'staff_entered',
    },
    { onConflict: 'athlete_id,test_definition_id,test_date,attempt_number,side' },
  );
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteResult(db: Db, orgId: string, resultId: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('test_results')
    .update({ deleted_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', resultId);
  return { error: error?.message ?? null };
}

/** Two statements, not one — see this file's header. */
export async function markBestManual(
  db: Db,
  orgId: string,
  input: { resultId: string; athleteId: string; testDefinitionId: string; testDate: string; side: BodySide | null; conditions: string },
): Promise<{ error: string | null }> {
  let clearQuery = db
    .from('test_results')
    .update({ is_best: false })
    .eq('org_id', orgId)
    .eq('athlete_id', input.athleteId)
    .eq('test_definition_id', input.testDefinitionId)
    .eq('test_date', input.testDate)
    .neq('id', input.resultId);
  clearQuery = input.side === null ? clearQuery.is('side', null) : clearQuery.eq('side', input.side);
  const { error: clearErr } = await clearQuery;
  if (clearErr) return { error: clearErr.message };

  const { error: setErr } = await db
    .from('test_results')
    .update({ is_best: true, is_best_manual: true, conditions: input.conditions })
    .eq('org_id', orgId)
    .eq('id', input.resultId);
  if (setErr) return { error: setErr.message };
  return { error: null };
}

export type HistoryRow = {
  id: string;
  test_date: string;
  value: number;
  attempt_number: number;
  side: BodySide | null;
  is_best: boolean;
  is_best_manual: boolean;
  conditions: string | null;
};

export async function fetchHistory(db: Db, orgId: string, athleteId: string, testDefinitionId: string): Promise<HistoryRow[]> {
  const { data, error } = await db
    .from('test_results')
    .select('id, test_date, value, attempt_number, side, is_best, is_best_manual, conditions')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .eq('test_definition_id', testDefinitionId)
    .is('deleted_at', null)
    .order('test_date', { ascending: false })
    .order('attempt_number');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type MyTestSummary = {
  test_definition_id: string;
  name: string;
  unit: string;
  decimal_places: number;
  pbValue: number | null;
  pbDate: string | null;
  latestValue: number | null;
  latestDate: string | null;
};

/** An athlete's own results only, across every test they have a result for —
 *  screens/testing.md's role table: "Own results only: history, personal
 *  bests." RLS already scopes test_results to their own rows; this just
 *  shapes it per test. */
export async function fetchMyTestSummary(db: Db, athleteId: string): Promise<MyTestSummary[]> {
  const { data, error } = await db
    .from('test_results')
    .select('test_definition_id, value, test_date, is_best, test_definitions(name, unit, decimal_places, higher_is_better)')
    .eq('athlete_id', athleteId)
    .is('deleted_at', null)
    .order('test_date', { ascending: false });
  if (error) throw new Error(error.message);

  const byTest = new Map<string, MyTestSummary>();
  for (const r of data ?? []) {
    if (!r.test_definitions) continue;
    const cur = byTest.get(r.test_definition_id) ?? {
      test_definition_id: r.test_definition_id,
      name: r.test_definitions.name,
      unit: r.test_definitions.unit,
      decimal_places: r.test_definitions.decimal_places,
      pbValue: null,
      pbDate: null,
      latestValue: null,
      latestDate: null,
    };
    if (cur.latestDate === null || r.test_date > cur.latestDate) {
      cur.latestValue = r.value;
      cur.latestDate = r.test_date;
    }
    if (r.is_best && (cur.pbValue === null || cur.pbDate === null || r.test_date >= cur.pbDate)) {
      cur.pbValue = r.value;
      cur.pbDate = r.test_date;
    }
    byTest.set(r.test_definition_id, cur);
  }
  return [...byTest.values()].sort((a, b) => a.name.localeCompare(b.name));
}
