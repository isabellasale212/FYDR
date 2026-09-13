import type { BodySide, SideMode, TestCategory } from '@/lib/types/database';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchAllPaged } from './paged';
import { mustAffect } from '@/lib/write';

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
  protocol: string | null;
};

export async function fetchTestDefinitions(db: Db, orgId: string): Promise<TestDefinition[]> {
  const { data, error } = await db
    .from('test_definitions')
    .select('id, name, test_category, unit, higher_is_better, side_mode, default_attempts, decimal_places, leaderboard_eligible, protocol')
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
    decimalPlaces: number;
    protocol: string;
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
    decimal_places: input.decimalPlaces,
    protocol: input.protocol.trim() || null,
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
    /* PAGED. mark_best_attempt (0024:127) sets is_best per (athlete,
     * definition, date, side), NOT one row per athlete — so this is athletes ×
     * test dates × sides, squad-wide and all-time. A per-side test run eight
     * times a season for 40 athletes is 640 rows, over PostgREST's 1000-row
     * ceiling in its second season, and truncation is silent. pbByAthlete
     * would then be built from an arbitrary subset and TestLogGrid's "PB" pill
     * would show a wrong or missing personal best while a coach logs against
     * it — the same phantom-PB regression fetchMyTestSummary below was paged
     * for; this sibling was missed at the time. With no ORDER BY at all, which
     * rows survived was planner-dependent and could differ between loads. */
    fetchAllPaged<{ athlete_id: string; value: number }>((pageFrom, pageTo) =>
      db
        .from('test_results')
        .select('athlete_id, value')
        .eq('org_id', orgId)
        .eq('test_definition_id', testDefinitionId)
        .eq('is_best', true)
        .is('deleted_at', null)
        .order('athlete_id')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    db.from('test_definitions').select('higher_is_better').eq('id', testDefinitionId).single(),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (todayRes.error) throw new Error(todayRes.error.message);
  if (defRes.error) throw new Error(defRes.error.message);

  const inScope = scope ? new Set(scope) : null;
  const scopedAthletes = (athletesRes.data ?? []).filter((a) => !inScope || inScope.has(a.id));

  const higherIsBetter = defRes.data.higher_is_better;
  const pbByAthlete = new Map<string, number>();
  for (const r of pbRes) {
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

export type TestSessionDate = { date: string; resultCount: number };

/** Audit finding 36: the logging grid only offered "Previous day / Next
 *  day" — arrow-by-arrow through the calendar, ~25 clicks to reach an old
 *  session. This returns the actual dates this test has results on (most
 *  recent first) so the page can offer a direct jump instead of a walk.
 *  Org-wide, not group-filtered: a testing *session* happened on a date
 *  regardless of which group is currently selected, and the list is for
 *  navigation, not a scoped report. */
export async function fetchTestDates(db: Db, orgId: string, testDefinitionId: string): Promise<TestSessionDate[]> {
  /* PAGED, same unbounded shape as the PB read above: every result this test
   * has ever recorded, org-wide. A silent cap would remove whole dates from
   * the session-jump navigator — a date the coach knows exists simply not
   * being offered — and understate resultCount on the ones that remain. */
  const data = await fetchAllPaged<{ test_date: string }>((pageFrom, pageTo) =>
    db
      .from('test_results')
      .select('test_date')
      .eq('org_id', orgId)
      .eq('test_definition_id', testDefinitionId)
      .is('deleted_at', null)
      .order('test_date')
      .order('id')
      .range(pageFrom, pageTo),
  );

  const counts = new Map<string, number>();
  for (const r of data) counts.set(r.test_date, (counts.get(r.test_date) ?? 0) + 1);
  return [...counts.entries()]
    .map(([date, resultCount]) => ({ date, resultCount }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export type NextTestingSession = {
  id: string;
  title: string;
  starts_at: string;
  md_offset: number | null;
};

/** Audit finding 36: nothing on this screen pointed at the Schedule's
 *  `session_type = 'testing'` sessions, so a coach had no way to see a
 *  testing session was already booked without leaving Testing entirely.
 *  Mirrors fetchNextFixture in lib/queries/schedule.ts: nearest upcoming,
 *  not-cancelled session of the type, org-scoped. Kept deliberately small
 *  per the gameplan — a pointer into the existing Schedule, not a new
 *  surface. */
export async function fetchNextTestingSession(db: Db, orgId: string, fromIso: string): Promise<NextTestingSession | null> {
  const { data, error } = await db
    .from('sessions')
    .select('id, title, starts_at, md_offset')
    .eq('org_id', orgId)
    .eq('session_type', 'testing')
    .eq('status', 'planned')
    .gte('starts_at', fromIso)
    .is('deleted_at', null)
    .order('starts_at')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
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
  return mustAffect(
    db
    .from('test_results')
    .update({ deleted_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', resultId)
      .select('id'),
    { refusal: 'Not saved: test results belong to the coach, the S&C and the sport scientist.' },
  );
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

/** True when `candidate` is a better result than `incumbent` for a test
 *  running in `higherIsBetter`'s direction. A null incumbent is always beaten.
 *
 *  This is THE comparison the rest of this feature is built on, extracted so
 *  that "best" has exactly one definition. The rule it encodes is the one
 *  already established (and separately fixed) in fetchMyTestSummary below and
 *  in testingReport.ts's fetchTestingByAthlete: a best is picked by the
 *  test's own direction, never by date recency, because is_best only marks
 *  the best attempt WITHIN one session/day. */
export function beatsBest(candidate: number, incumbent: number | null, higherIsBetter: boolean): boolean {
  if (incumbent === null) return true;
  return higherIsBetter ? candidate > incumbent : candidate < incumbent;
}

export type TestBests = {
  allTimeValue: number | null;
  /** The date the all-time best was FIRST set, not the last date it was
   *  matched. See considerBest. */
  allTimeDate: string | null;
  seasonValue: number | null;
  /** The date the season's best was first set inside the season window. */
  seasonDate: string | null;
  /** Best from strictly BEFORE the current season began. The trend baseline. */
  priorValue: number | null;
  /** Signed % improvement of seasonValue against priorValue. See computeTestBests. */
  trendPct: number | null;
  /** True only when this season's best STRICTLY beats every result the athlete
   *  has from outside the season window — i.e. they really did set a new
   *  lifetime mark this season. Equalling an older best is deliberately FALSE:
   *  matching a two-year-old jump is not setting a PB, and a UI that announces
   *  it as one is stating something untrue next to a 0.0% trend.
   *
   *  Computed here rather than in the component because it needs the rows, not
   *  just the two summary figures. The component used to infer it from
   *  `seasonValue === allTimeValue && seasonDate === allTimeDate`, which was
   *  wrong for exactly the equalled-best case it claimed to exclude: on a tie
   *  the all-time date was whichever equal row came first, and fetchHistory
   *  sorts newest-first, so an equalled mark made allTimeDate the recent
   *  (in-season) date and the two pairs matched. Direction is handled by
   *  beatsBest, so a sprint time that merely equals an old best is likewise
   *  not a PB. */
  seasonIsNewAllTimeBest: boolean;
};

type BestSlot = { value: number | null; date: string | null };

/** Applies one result to a running best. A strictly better mark (by the test's
 *  own direction) wins outright. An EQUAL mark keeps the EARLIEST date, because
 *  the date printed beside a best answers "when was this set", not "when was it
 *  last matched".
 *
 *  Making the tie rule explicit also makes computeTestBests independent of the
 *  order rows arrive in. It previously kept whichever equal row it saw first,
 *  which was the most recent one only because fetchHistory happens to sort
 *  descending — a pure function silently depending on its caller's ORDER BY. */
function considerBest(slot: BestSlot, value: number, date: string, higherIsBetter: boolean): void {
  if (beatsBest(value, slot.value, higherIsBetter)) {
    slot.value = value;
    slot.date = date;
    return;
  }
  if (value === slot.value && (slot.date === null || date < slot.date)) slot.date = date;
}

/** Season's best, all-time best, and the trend between them, for ONE athlete
 *  on ONE test. Pure — it derives everything from the history rows the page
 *  has already fetched, so there is no second query that could drift from the
 *  history list rendered directly underneath it.
 *
 *  ONLY is_best rows are considered, exactly as fetchMyTestSummary and
 *  fetchTestingByAthlete do. This is load-bearing, not incidental: taking the
 *  max over ALL attempts instead would silently disagree with every other
 *  "best" in the app the moment a coach uses the manual override. Migration
 *  0025's own worked example is the case — attempt 2 marked best by hand
 *  while attempt 4 holds a higher raw value. The canonical best is attempt 2;
 *  a naive max over all rows would report attempt 4 here and nowhere else.
 *
 *  THE TREND PERCENTAGE, defined precisely, because an unstated percentage on
 *  a report is worse than no percentage:
 *
 *    trendPct = the current season's best measured against the athlete's best
 *    from strictly BEFORE this season started (test_date < season.starts_on).
 *
 *    It answers one question — "has this athlete got better this season than
 *    they had ever been before it?" — and it is signed so that POSITIVE ALWAYS
 *    MEANS IMPROVEMENT, in both directions:
 *      higher_is_better (a jump):   (season - prior) / |prior| * 100
 *      lower_is_better  (a sprint): (prior - season) / |prior| * 100
 *    so shaving 4.10s to 3.95s reads +3.7%, an improvement, NOT -3.7%.
 *
 *  Why this pairing and not "season's best vs all-time best": the all-time
 *  window CONTAINS the season, so season-vs-all-time can never be positive —
 *  it would be a gauge pinned at or below zero, which reads as a permanent
 *  regression and is useless as a trend. Measuring against the pre-season
 *  best makes the number genuinely two-sided.
 *
 *  It is NOT, however, safe to read "trendPct > 0" as "new lifetime PB" and it
 *  never was: the two use different baselines (prior = before the season only,
 *  the PB check = outside the season in either direction), and trendPct is null
 *  for an athlete's first season even though a first result is a lifetime best.
 *  The PB question has its own field, seasonIsNewAllTimeBest, computed below.
 *
 *  Returns null (not 0) for trendPct whenever the comparison is not defined —
 *  no season configured, no result inside the season, no result before it
 *  (an athlete's first season has nothing to trend against, and rendering
 *  that as 0% would assert "no change" about a measurement never taken), or
 *  a prior best of exactly 0, which has no meaningful percentage base.
 *
 *  ONE SIDE ONLY. `rows` must already be a single side's results — a left hand
 *  and a right hand are two different measurements and mixing them produces a
 *  best that belongs to neither and a trend between two unrelated limbs. This
 *  function does not partition; computeTestBestsBySide does, and is what the
 *  report, the CSV and the PDF all call. Calling this directly with a per-side
 *  test's full history is the bug that partitioning exists to prevent. */
export function computeTestBests(
  rows: readonly HistoryRow[],
  higherIsBetter: boolean,
  season: { starts_on: string; ends_on: string } | null,
): TestBests {
  const allTime: BestSlot = { value: null, date: null };
  const inSeasonBest: BestSlot = { value: null, date: null };
  let priorValue: number | null = null;
  /* Best from anywhere OUTSIDE the season window — before it or after it. The
   * badge's baseline, and deliberately wider than `priorValue`: a stray
   * future-dated result is not "prior" to the season (so it cannot be the
   * trend baseline) but it IS a mark the athlete has already put down, so it
   * must still block a "new lifetime best this season" claim. */
  let outsideValue: number | null = null;

  for (const r of rows) {
    if (!r.is_best) continue;

    considerBest(allTime, r.value, r.test_date, higherIsBetter);

    if (season) {
      // Plain string compare on two `date` columns in ISO YYYY-MM-DD form —
      // lexicographic order is chronological order for that format. Inclusive
      // of both season endpoints, matching how a coach reads "the season".
      const inSeason = r.test_date >= season.starts_on && r.test_date <= season.ends_on;
      if (inSeason) {
        considerBest(inSeasonBest, r.value, r.test_date, higherIsBetter);
      } else {
        if (beatsBest(r.value, outsideValue, higherIsBetter)) outsideValue = r.value;
        if (r.test_date < season.starts_on) {
          // Strictly before the season. A result AFTER ends_on (a stray future
          // date, or a season that has rolled over without is_current being
          // moved) is deliberately counted in neither the season nor the
          // baseline: it is not this season's, and it cannot be "prior" to it.
          if (beatsBest(r.value, priorValue, higherIsBetter)) priorValue = r.value;
        }
      }
    }
  }

  const out: TestBests = {
    allTimeValue: allTime.value,
    allTimeDate: allTime.date,
    seasonValue: inSeasonBest.value,
    seasonDate: inSeasonBest.date,
    priorValue,
    trendPct: null,
    // beatsBest, not `>=` and not a date comparison: strict by construction, so
    // equalling an older mark is not a new PB, and the direction inverts for a
    // lower-is-better test without a second copy of that ternary.
    seasonIsNewAllTimeBest: inSeasonBest.value !== null && beatsBest(inSeasonBest.value, outsideValue, higherIsBetter),
  };

  if (out.seasonValue !== null && out.priorValue !== null && out.priorValue !== 0) {
    const delta = higherIsBetter ? out.seasonValue - out.priorValue : out.priorValue - out.seasonValue;
    out.trendPct = (delta / Math.abs(out.priorValue)) * 100;
  }

  return out;
}

export type TestBestsForSide = {
  /** The side these figures belong to. Null on a bilateral test, where there
   *  is only ever one set of numbers and nothing to distinguish. */
  side: BodySide | null;
  /** The label the UI must print next to these numbers, or null when the test
   *  is bilateral and a side label would be noise. Non-null means "these
   *  numbers are meaningless without this word next to them". */
  label: string | null;
  bests: TestBests;
};

/** Canonical display order. Left then right reads the way a coach says it; a
 *  'bilateral' or side-less row on a per_side test is unexpected data rather
 *  than a normal case, so it sorts last instead of being dropped. */
const SIDE_ORDER: readonly (BodySide | null)[] = ['left', 'right', 'bilateral', null];

function sideLabel(side: BodySide | null): string {
  if (side === 'left') return 'Left';
  if (side === 'right') return 'Right';
  if (side === 'bilateral') return 'Bilateral';
  return 'Side not recorded';
}

/** Bests and trend for one athlete on one test, PARTITIONED BY SIDE.
 *
 *  test_definitions.side_mode is 'bilateral' or 'per_side', and test_results
 *  carries the matching `side`. A per_side test (grip strength, single-leg
 *  hop, isometric hamstring) measures two independent things, and rolling them
 *  into one best is wrong twice over: the value belongs to a limb nobody is
 *  told about, and the trend can compare this season's LEFT against last
 *  season's RIGHT. Worked case, grip strength, higher is better: prior season
 *  right 50 kg / left 38 kg, this season only the left tested at 42 kg. Mixed,
 *  that reads "50 kg all-time" and a −16.0% regression; split, it reads
 *  "Left: 42 kg, +10.5%" and "Right: 50 kg, not tested this season", which is
 *  what actually happened.
 *
 *  This is the convention the rest of the testing domain already uses, not a
 *  new one: TestTrendChart draws Left and Right as two labelled series keyed
 *  on `r.side ?? 'bilateral'`, and testingReport.ts's fetchTestByTest keys its
 *  bests by `${athlete_id}:${side ?? ''}` for the same reason.
 *
 *  It partitions and delegates — every number still comes from the one
 *  computeTestBests/beatsBest pair, so there is no second definition of "best"
 *  that could drift from the squad grid or the athlete's own PB pill.
 *
 *  Always returns at least one entry, so a caller can render without a
 *  special case for "no results yet". */
export function computeTestBestsBySide(
  rows: readonly HistoryRow[],
  definition: { higher_is_better: boolean; side_mode: SideMode },
  season: { starts_on: string; ends_on: string } | null,
): TestBestsForSide[] {
  const higherIsBetter = definition.higher_is_better;

  if (definition.side_mode !== 'per_side') {
    // A bilateral test has one result per session by definition. Every row is
    // used regardless of what `side` happens to hold, so no data is dropped if
    // a definition was switched from per_side to bilateral after logging.
    return [{ side: null, label: null, bests: computeTestBests(rows, higherIsBetter, season) }];
  }

  const bySide = new Map<BodySide | null, HistoryRow[]>();
  for (const r of rows) {
    const list = bySide.get(r.side) ?? [];
    list.push(r);
    bySide.set(r.side, list);
  }
  if (bySide.size === 0) {
    return [{ side: null, label: null, bests: computeTestBests([], higherIsBetter, season) }];
  }

  return SIDE_ORDER.filter((side) => bySide.has(side)).map((side) => ({
    side,
    label: sideLabel(side),
    bests: computeTestBests(bySide.get(side) ?? [], higherIsBetter, season),
  }));
}

export type MyTestSummary = {
  test_definition_id: string;
  name: string;
  unit: string;
  decimal_places: number;
  /** Carried through, not re-derived: a "vs PB" figure is meaningless without
   *  it. For a sprint, lower is better, so a LARGER latest value is a loss —
   *  a consumer that assumes higher-is-better would print a slower time as a
   *  gain. The query already selects this column to pick the PB correctly;
   *  it just was not reaching callers. */
  higher_is_better: boolean;
  pbValue: number | null;
  pbDate: string | null;
  latestValue: number | null;
  latestDate: string | null;
};

/** An athlete's own results only, across every test they have a result for —
 *  screens/testing.md's role table: "Own results only: history, personal
 *  bests." RLS already scopes test_results to their own rows; this just
 *  shapes it per test.
 *
 *  pbValue picks the true all-time best by the test's own higher_is_better
 *  direction, not the most recent is_best row — the same "phantom PB
 *  regression" bug testingReport.ts's fetchTestingByAthlete found and fixed
 *  (verified live: an athlete with a 41.6 all-time best showed 31.0 because
 *  that was their latest session). is_best only marks the best attempt
 *  WITHIN one session/day; the winner ACROSS every session still has to be
 *  picked here, by comparing every is_best row against the current champion
 *  rather than trusting date order. This was the one real place that fix
 *  hadn't been applied yet — the athlete's own PB pill was still wrong. */
export async function fetchMyTestSummary(
  db: Db,
  athleteId: string,
  opts: { includeUnlogged?: boolean } = {},
): Promise<MyTestSummary[]> {
  /* ATH-ADULT-12 C7 (2026-09-12), for the athlete's own My data
     (`includeUnlogged`): the list is the club's tests, not the athlete's
     results. Every live definition is a row, in the club's own order
     (sort_order, then name); one the athlete has no result for reads "Not
     logged" rather than being absent — a test the club measures and has
     not measured on this athlete is a fact about the athlete. There is no
     per-athlete assignment of tests in this schema (test_definitions is
     org-wide; results carry the session), so "assigned" is the club's set;
     if a narrower assignment is ever wanted it is a migration, recorded on
     the decision sheet. Read through test_definitions_org_select. The
     staff athlete report keeps the old shape — tests with a result only —
     by leaving the option off. */
  const { data: defs, error: defsError } = opts.includeUnlogged
    ? await db
        .from('test_definitions')
        .select('id, name, unit, decimal_places, higher_is_better')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
    : { data: [], error: null };
  if (defsError) throw new Error(defsError.message);

  /* PAGED, and this one has no window to widen — it is ALL TIME by design and
   * always has been (there is no gte on test_date, deliberately: a personal
   * best is all-time or it is not a personal best). That makes it unbounded by
   * construction, which is precisely the shape paged.ts exists for, and it was
   * already exposed before /my-data grew a period control rather than because
   * of it. A club testing a squad fortnightly across a dozen definitions puts
   * one athlete past 1000 rows in a few seasons, and the failure would be
   * silent AND wrong in the worst direction: `.order('test_date', desc)` means
   * the rows that fall off the end are the OLDEST, so an athlete's real
   * all-time PB — usually not their most recent result — would quietly become
   * their best recent one. That is the same "phantom PB regression" this
   * function's header describes being fixed once already, arriving by a
   * different route. `id` is the unique tiebreak: a whole squad's results share
   * one test_date by construction. */
  const data = await fetchAllPaged<{
    test_definition_id: string;
    value: number;
    test_date: string;
    is_best: boolean;
    test_definitions: { name: string; unit: string; decimal_places: number; higher_is_better: boolean } | null;
  }>((pageFrom, pageTo) =>
    db
      .from('test_results')
      .select('test_definition_id, value, test_date, is_best, test_definitions(name, unit, decimal_places, higher_is_better)')
      .eq('athlete_id', athleteId)
      .is('deleted_at', null)
      .order('test_date', { ascending: false })
      .order('id')
      .range(pageFrom, pageTo),
  );

  const byTest = new Map<string, MyTestSummary>();
  for (const d of defs ?? []) {
    byTest.set(d.id, {
      test_definition_id: d.id,
      name: d.name,
      unit: d.unit,
      decimal_places: d.decimal_places,
      higher_is_better: d.higher_is_better,
      pbValue: null,
      pbDate: null,
      latestValue: null,
      latestDate: null,
    });
  }
  for (const r of data) {
    if (!r.test_definitions) continue;
    /* A result against a definition the club has since retired still
       happened: it keeps its row, after the live ones. */
    const cur = byTest.get(r.test_definition_id) ?? {
      test_definition_id: r.test_definition_id,
      name: r.test_definitions.name,
      unit: r.test_definitions.unit,
      decimal_places: r.test_definitions.decimal_places,
      higher_is_better: r.test_definitions.higher_is_better,
      pbValue: null,
      pbDate: null,
      latestValue: null,
      latestDate: null,
    };
    if (cur.latestDate === null || r.test_date > cur.latestDate) {
      cur.latestValue = r.value;
      cur.latestDate = r.test_date;
    }
    if (r.is_best) {
      // Shared beatsBest() rather than an inline copy of the same ternary —
      // see that function's header. This comparison existed here in longhand
      // and was duplicated in three other places; routing all four through
      // one function is what stops them drifting apart again.
      if (beatsBest(r.value, cur.pbValue, r.test_definitions.higher_is_better)) {
        cur.pbValue = r.value;
        cur.pbDate = r.test_date;
      }
    }
    byTest.set(r.test_definition_id, cur);
  }
  /* The club's order when the club's list was read; by name otherwise, as
     the staff report has always had it. */
  return opts.includeUnlogged ? [...byTest.values()] : [...byTest.values()].sort((a, b) => a.name.localeCompare(b.name));
}
