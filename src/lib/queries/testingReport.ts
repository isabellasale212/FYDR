import type { Db } from './groups';
import { fetchGroupAthleteIds } from './groups';
import { fetchTestDefinitions, type TestDefinition } from './testing';

/* screens/reports.md, report 5 of 5 ("Testing report"), the last of the
 * five to get built — see reports.ts's own header for why it was the one
 * left standing after the Athlete report and Squad weekly both landed: it
 * needed nothing new, just hadn't been written yet.
 *
 * Cut down hard against the spec, every cut real:
 *   - No "battery" or session concept. testing.ts's own header already cut
 *     that: results are logged against a test and a date directly, not a
 *     named, scheduled battery. "Session summary" (battery, participation,
 *     completion) has no battery to summarise, so this report has no
 *     equivalent page — By athlete and By test, the two pages with real
 *     content once batteries are gone, are what's built.
 *   - "By test" distribution is every in-scope athlete's current best
 *     attempt, no separate split for a per-side test — a grip-strength test
 *     contributes one row per side, both counted in the same distribution.
 *     Asymmetry (the spec's own "where the test is per-side") is a real,
 *     separate statistic (comparing an athlete's own left against their own
 *     right) this pass doesn't compute.
 *   - Longitudinal is the test's whole result history in this scope, not a
 *     season boundary — there is no season table in this schema to bound it
 *     against, the same gap MD-n scheduling has elsewhere in this build.
 *     No "individual trajectories on request" — squad median per date only.
 *   - "Change against previous" on the By athlete grid compares an
 *     athlete's two most recent test dates for that test, not a fixed
 *     period-over-period window — there's no report period selector here,
 *     unlike Athlete report or Squad weekly, because a testing history
 *     naturally spans irregular dates rather than a daily series.
 */

export type TestingByAthleteCell = {
  test_definition_id: string;
  value: number | null;
  date: string | null;
  isPb: boolean;
};

export type TestingByAthleteRow = {
  athlete_id: string;
  name: string;
  cells: Map<string, TestingByAthleteCell>;
};

export type TestingByAthleteReport = {
  definitions: TestDefinition[];
  rows: TestingByAthleteRow[];
};

export async function fetchTestingByAthlete(db: Db, orgId: string, groupIds: readonly string[]): Promise<TestingByAthleteReport> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  const [definitions, athletesRes] = await Promise.all([
    fetchTestDefinitions(db, orgId),
    (() => {
      let q = db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club');
      if (scope) q = q.in('id', scope);
      return q.order('last_name');
    })(),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  const athletes = athletesRes.data ?? [];
  if (athletes.length === 0) return { definitions, rows: [] };

  const resultsQuery = db
    .from('test_results')
    .select('athlete_id, test_definition_id, value, test_date, is_best')
    .eq('org_id', orgId)
    .eq('is_best', true)
    .is('deleted_at', null)
    .in(
      'athlete_id',
      athletes.map((a) => a.id),
    );
  const { data: results, error } = await resultsQuery;
  if (error) throw new Error(error.message);

  const higherIsBetterByDef = new Map(definitions.map((d) => [d.id, d.higher_is_better]));

  const cellByAthleteTest = new Map<string, TestingByAthleteCell>();
  for (const r of results ?? []) {
    const key = `${r.athlete_id}:${r.test_definition_id}`;
    const existing = cellByAthleteTest.get(key);
    // is_best marks the best attempt WITHIN a session, so an athlete has one
    // is_best row per session (and per side). The grid's header says
    // "current personal best", so the winner across sessions must be picked
    // by the test's own direction — this previously kept the most RECENT
    // session's best instead, which showed phantom PB regressions the
    // moment anyone posted a result worse than their true best (a real,
    // verified audit finding: an athlete with a 41.6 all-time best showed
    // 31.0 because that was the latest session).
    const higherIsBetter = higherIsBetterByDef.get(r.test_definition_id) ?? true;
    const beatsExisting =
      !existing ||
      existing.value === null ||
      (higherIsBetter ? r.value > existing.value : r.value < existing.value);
    if (beatsExisting) {
      cellByAthleteTest.set(key, { test_definition_id: r.test_definition_id, value: r.value, date: r.test_date, isPb: true });
    }
  }

  const rows: TestingByAthleteRow[] = athletes.map((a) => {
    const cells = new Map<string, TestingByAthleteCell>();
    for (const d of definitions) {
      cells.set(d.id, cellByAthleteTest.get(`${a.id}:${d.id}`) ?? { test_definition_id: d.id, value: null, date: null, isPb: false });
    }
    return { athlete_id: a.id, name: `${a.first_name} ${a.last_name}`, cells };
  });

  return { definitions, rows };
}

export type TestByTestRow = {
  athlete_id: string;
  name: string;
  value: number;
  side: string | null;
  date: string;
  rank: number;
};

export type TestByTestReport = {
  definition: TestDefinition;
  rows: TestByTestRow[];
  median: number | null;
  q1: number | null;
  q3: number | null;
};

function quartile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sorted[base];
  if (a === undefined) return null;
  const b = sorted[base + 1];
  return b === undefined ? a : a + rest * (b - a);
}

export async function fetchTestByTest(db: Db, orgId: string, groupIds: readonly string[], testDefinitionId: string): Promise<TestByTestReport | null> {
  const definitions = await fetchTestDefinitions(db, orgId);
  const definition = definitions.find((d) => d.id === testDefinitionId);
  if (!definition) return null;

  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club');
  if (scope) athleteQuery = athleteQuery.in('id', scope);
  const athletesRes = await athleteQuery;
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  const nameById = new Map((athletesRes.data ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`]));
  const scopedIds = new Set((athletesRes.data ?? []).map((a) => a.id));

  const { data: results, error } = await db
    .from('test_results')
    .select('athlete_id, value, side, test_date')
    .eq('org_id', orgId)
    .eq('test_definition_id', testDefinitionId)
    .eq('is_best', true)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);

  const filtered = (results ?? []).filter((r) => scopedIds.has(r.athlete_id));

  // is_best marks the best attempt WITHIN a session (the same fact
  // fetchTestingByAthlete's own header documents and fixes for the "By
  // athlete" grid, just above) — an athlete who has tested more than once
  // has one is_best row per session, not one true personal best, so this
  // used to rank and list the same athlete multiple times. Collapsed to
  // one row per (athlete, side): side, not just athlete, because this
  // file's own header says a per-side test (grip strength) is meant to
  // contribute one row per side, both counted — a same-side/no-side test
  // collapses to the athlete's single true best, decided by the same
  // higher_is_better direction fetchTestingByAthlete uses.
  const bestBySlot = new Map<string, (typeof filtered)[number]>();
  for (const r of filtered) {
    const key = `${r.athlete_id}:${r.side ?? ''}`;
    const existing = bestBySlot.get(key);
    const beatsExisting = !existing || (definition.higher_is_better ? r.value > existing.value : r.value < existing.value);
    if (beatsExisting) bestBySlot.set(key, r);
  }
  const deduped = [...bestBySlot.values()];

  const sortDir = definition.higher_is_better ? -1 : 1;
  const sorted = [...deduped].sort((a, b) => sortDir * (a.value - b.value));

  const rows: TestByTestRow[] = sorted.map((r, i) => ({
    athlete_id: r.athlete_id,
    name: nameById.get(r.athlete_id) ?? 'Unknown',
    value: r.value,
    side: r.side,
    date: r.test_date,
    rank: i + 1,
  }));

  const values = deduped.map((r) => r.value).sort((a, b) => a - b);
  const median = quartile(values, 0.5);
  const q1 = quartile(values, 0.25);
  const q3 = quartile(values, 0.75);

  return { definition, rows, median, q1, q3 };
}

export type LongitudinalPoint = { date: string; median: number | null; n: number };

export async function fetchTestLongitudinal(db: Db, orgId: string, groupIds: readonly string[], testDefinitionId: string): Promise<LongitudinalPoint[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db.from('athletes').select('id').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club');
  if (scope) athleteQuery = athleteQuery.in('id', scope);
  const athletesRes = await athleteQuery;
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  const scopedIds = new Set((athletesRes.data ?? []).map((a) => a.id));

  const { data: results, error } = await db
    .from('test_results')
    .select('athlete_id, value, test_date')
    .eq('org_id', orgId)
    .eq('test_definition_id', testDefinitionId)
    .eq('is_best', true)
    .is('deleted_at', null)
    .order('test_date');
  if (error) throw new Error(error.message);

  const byDate = new Map<string, number[]>();
  for (const r of results ?? []) {
    if (!scopedIds.has(r.athlete_id)) continue;
    const list = byDate.get(r.test_date) ?? [];
    list.push(r.value);
    byDate.set(r.test_date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      median: quartile([...values].sort((a, b) => a - b), 0.5),
      n: values.length,
    }));
}
