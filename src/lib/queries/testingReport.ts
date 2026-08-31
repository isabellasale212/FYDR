import type { Db } from './groups';
import { fetchGroupAthleteIds } from './groups';
import { fetchAllPaged } from './paged';
import { beatsBest, fetchTestDefinitions, type TestDefinition } from './testing';

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
 *   - No "individual trajectories on request" on the longitudinal series —
 *     squad median per date only.
 *   - "Change against previous" on the By athlete grid compares an
 *     athlete's two most recent test dates for that test, not a fixed
 *     period-over-period window.
 *
 * ---------------------------------------------------------------------------
 * EVERY READ HERE IS BOUNDED. IT DID NOT USED TO BE.
 * ---------------------------------------------------------------------------
 *
 * This header used to say the longitudinal series was unbounded because
 * "there is no season table in this schema to bound it against". That was
 * simply wrong, and is corrected rather than deleted so the next reader does
 * not re-derive the same mistake: `seasons` has existed since migration 0003
 * with starts_on/ends_on and a one-current-per-org PARTIAL unique index, and
 * 0016_leaderboards.sql already resolves a season window off it in SQL.
 * fetchCurrentSeason (lib/queries/schedule.ts) is the TypeScript-side lookup,
 * and it is the one to use — never fetchCurrentSeasonId, whose missing
 * `deleted_at` filter is a documented latent bug against that partial index.
 *
 * The unboundedness itself was then a real defect, not a choice. Every one of
 * the three functions below took (db, orgId, groupIds, testDefinitionId) and
 * no dates, so a squad three seasons deep drew a trend dominated by athletes
 * who had left the club, and the "personal best" grid ranked a leaver's 2023
 * number against a current athlete's. All three now take a `window`, resolved
 * once per request by lib/reportPeriod.server.ts and shared by the page, the
 * CSV and the PDF so the three cannot disagree about what they cover.
 *
 * TWO CONSEQUENCES WORTH STATING OUT LOUD:
 *
 *  1. "Personal best" is now "best IN THE WINDOW". At the report's default
 *     (`season`) that is the season's best, which is the figure
 *     fetchCurrentSeason was added for in the first place — see its own
 *     header. `all` is the all-time reading, capped at MAX_WINDOW_DAYS. The
 *     screen's copy says which, rather than printing "personal best" over a
 *     bounded number.
 *  2. WIDENING A WINDOW MULTIPLIES ROWS, and PostgREST caps an unpaginated
 *     read at max_rows (1000, supabase/config.toml) WITHOUT ERRORING. These
 *     reads were already unbounded and therefore already exposed; making the
 *     window a user-facing control makes it routine. All three page via
 *     fetchAllPaged, and every one of their orders ends in `id` — `.range()`
 *     re-runs the query per page, so a tie in the sort key can be broken
 *     differently on each page and a row silently duplicated or skipped.
 *
 * `test_results.test_date` is a `date` column. The window's from/to are
 * compared to it as plain YYYY-MM-DD strings and must NOT be pushed through
 * dateInTz — CLAUDE.md rule 5 governs instants, and a calendar date that is
 * already stored date-typed has no timezone to convert.
 */

/** The resolved reporting window, as plain calendar dates. Built by
 *  resolveReportPeriod (lib/reportPeriod.server.ts), never by a query file. */
export type TestingWindow = { from: string; to: string };

export type TestingByAthleteCell = {
  test_definition_id: string;
  value: number | null;
  date: string | null;
  /** "This is the best reading in the REPORTING WINDOW", which is only an
   *  all-time personal best at `?period=all`. Named `isPb` from when this file
   *  had no window at all; kept rather than renamed because nothing renders it
   *  today, but do not start rendering it as "PB" without narrowing it against
   *  the athlete's real all-time best (computeTestBests, queries/testing.ts). */
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

/** The narrow shape the three readers below pull out of test_results.
 *  Declared rather than inferred because fetchAllPaged is generic over its row
 *  type — same reason analytics.ts declares AcwrEntryRow. `id` is selected
 *  purely so the paging order can end in a unique key. */
type TestResultRow = {
  id: string;
  athlete_id: string;
  test_definition_id: string;
  value: number;
  test_date: string;
  side: string | null;
};

export async function fetchTestingByAthlete(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  reportWindow: TestingWindow,
): Promise<TestingByAthleteReport> {
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

  const athleteIds = athletes.map((a) => a.id);
  // Paged: athletes × tests × sessions inside the window. Fine at 28 days,
  // past PostgREST's silent 1000-row ceiling well before a season is out.
  const results = await fetchAllPaged<TestResultRow>((pageFrom, pageTo) =>
    db
      .from('test_results')
      .select('id, athlete_id, test_definition_id, value, test_date, side')
      .eq('org_id', orgId)
      .eq('is_best', true)
      .is('deleted_at', null)
      .in('athlete_id', athleteIds)
      // test_date is a `date` column; reportWindow.from/to are YYYY-MM-DD and
      // are compared as strings (CLAUDE.md rule 5 — no dateInTz here).
      .gte('test_date', reportWindow.from)
      .lte('test_date', reportWindow.to)
      .order('test_date')
      .order('id')
      .range(pageFrom, pageTo),
  );

  const higherIsBetterByDef = new Map(definitions.map((d) => [d.id, d.higher_is_better]));

  const cellByAthleteTest = new Map<string, TestingByAthleteCell>();
  for (const r of results) {
    const key = `${r.athlete_id}:${r.test_definition_id}`;
    const existing = cellByAthleteTest.get(key);
    // is_best marks the best attempt WITHIN a session, so an athlete has one
    // is_best row per session (and per side). The grid's header says "best in
    // this period", so the winner across the sessions IN THE WINDOW must be
    // picked by the test's own direction — this previously kept the most RECENT
    // session's best instead, which showed phantom PB regressions the
    // moment anyone posted a result worse than their true best (a real,
    // verified audit finding: an athlete with a 41.6 all-time best showed
    // 31.0 because that was the latest session).
    // beatsBest() from lib/queries/testing.ts, not a local copy of the same
    // ternary. The rule is identical and always was — this call site is where
    // it was first fixed — but it was written out by hand in four places
    // (here, fetchTestByTest below, fetchMyTestSummary, computeTestBests),
    // which is how the "phantom PB regression" bug survived in three of them
    // after being fixed in the fourth. One function, one definition of best,
    // so a future correction cannot land in some of them and not the others.
    // beatsBest treats a null incumbent as beaten, which covers both the
    // no-existing-cell and null-valued-cell cases this used to check itself.
    const higherIsBetter = higherIsBetterByDef.get(r.test_definition_id) ?? true;
    if (beatsBest(r.value, existing?.value ?? null, higherIsBetter)) {
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

export async function fetchTestByTest(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  testDefinitionId: string,
  reportWindow: TestingWindow,
): Promise<TestByTestReport | null> {
  const definitions = await fetchTestDefinitions(db, orgId);
  const definition = definitions.find((d) => d.id === testDefinitionId);
  if (!definition) return null;

  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club');
  if (scope) athleteQuery = athleteQuery.in('id', scope);
  const athletesRes = await athleteQuery;
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  const nameById = new Map((athletesRes.data ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`]));
  const athleteIds = (athletesRes.data ?? []).map((a) => a.id);
  if (athleteIds.length === 0) return { definition, rows: [], median: null, q1: null, q3: null };

  // The group scope is applied IN the query rather than by filtering the
  // result set afterwards, which is what this used to do. Post-filtering is
  // wrong the moment the read is paged: the 1000-row ceiling would be spent on
  // out-of-scope athletes and the in-scope ones silently truncated behind them.
  const filtered = await fetchAllPaged<TestResultRow>((pageFrom, pageTo) =>
    db
      .from('test_results')
      .select('id, athlete_id, test_definition_id, value, side, test_date')
      .eq('org_id', orgId)
      .eq('test_definition_id', testDefinitionId)
      .eq('is_best', true)
      .is('deleted_at', null)
      .in('athlete_id', athleteIds)
      .gte('test_date', reportWindow.from)
      .lte('test_date', reportWindow.to)
      .order('test_date')
      .order('id')
      .range(pageFrom, pageTo),
  );

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
    // Shared beatsBest(), same reason as fetchTestingByAthlete above.
    if (beatsBest(r.value, existing?.value ?? null, definition.higher_is_better)) bestBySlot.set(key, r);
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

export async function fetchTestLongitudinal(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  testDefinitionId: string,
  reportWindow: TestingWindow,
): Promise<LongitudinalPoint[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db.from('athletes').select('id').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club');
  if (scope) athleteQuery = athleteQuery.in('id', scope);
  const athletesRes = await athleteQuery;
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  const athleteIds = (athletesRes.data ?? []).map((a) => a.id);
  if (athleteIds.length === 0) return [];

  // THE READ THIS WHOLE CHANGE IS ABOUT. `.order('test_date')` with no bound
  // plotted every result the club had ever recorded, so a squad three seasons
  // deep drew a trend dominated by athletes who have left — and, past 1000
  // rows, a trend that PostgREST had silently cut off at an arbitrary date
  // with no error and no short page to notice it. Bounded and paged, with the
  // group scope pushed into the query for the same reason as fetchTestByTest.
  const results = await fetchAllPaged<TestResultRow>((pageFrom, pageTo) =>
    db
      .from('test_results')
      .select('id, athlete_id, test_definition_id, value, side, test_date')
      .eq('org_id', orgId)
      .eq('test_definition_id', testDefinitionId)
      .eq('is_best', true)
      .is('deleted_at', null)
      .in('athlete_id', athleteIds)
      .gte('test_date', reportWindow.from)
      .lte('test_date', reportWindow.to)
      .order('test_date')
      .order('id')
      .range(pageFrom, pageTo),
  );

  const byDate = new Map<string, number[]>();
  for (const r of results) {
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

/** The first test result this club ever recorded, for resolveRange's `all`.
 *
 *  Org-wide rather than group-scoped ON PURPOSE. An org-wide earliest date is
 *  never LATER than a group-scoped one, so the window it produces can only be
 *  wider — and a window that is wider than it needs to be shows the coach data
 *  they can see is extra, while a window that is too narrow hides data
 *  silently. That is the same "never narrower" rule periodFromLegacyDays
 *  applies in lib/period.ts, for the same reason.
 *
 *  Null for a club with no results at all; resolveRange then degrades `all` to
 *  the MAX_WINDOW_DAYS floor rather than inventing a start date. Called only
 *  when the resolved key IS `all` — see ReportPeriodOptions.earliest. */
export async function fetchEarliestTestDate(db: Db, orgId: string): Promise<string | null> {
  const { data, error } = await db
    .from('test_results')
    .select('test_date')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('test_date', { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.test_date ?? null;
}
