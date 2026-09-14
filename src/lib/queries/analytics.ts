import { ACWR_ACUTE_WINDOW_DAYS, ACWR_CHRONIC_WINDOW_DAYS, computeAcwr } from '@/lib/acwr';
import { readiness, rollingBand, zScore, type Band } from '@/lib/stats';
import { addDays, todayIso } from '@/lib/format';
import type { MetricDef, MetricSource } from '@/lib/analyticsBuilder';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchAllPaged } from './paged';

/* Analytics. screens/analytics.md, screen 27, cut down to two of the five shipped
 * presets — ACWR and wellness trend — and to fixed pages rather than a `saved_views`
 * builder. Neither `saved_views` nor either preset's materialised view
 * (`mv_acute_chronic_load`, `mv_wellness_baselines`) exist in this schema, so both
 * presets are computed live from the base tables instead, the same choice already
 * made for the leaderboard ranking. The other three presets are real, documented
 * cuts. Compliance's stated reason is now out of date and kept only as history:
 * it read "needs compliance_expectations rows, and nothing in this build
 * generates them yet". Migration 0044 generates them, hourly, on pg_cron — so
 * the data this preset needs exists, and the preset is simply not built. It is
 * an open piece of work, not a blocked one. (schedule.ts's cancelSession
 * carried the same dead premise and has been corrected; there it was load-
 * bearing, because it meant cancelled sessions never had their expectations
 * waived.) Load-by-MD-n and the nutrition trend are both real screens on their
 * own and are left for a pass with room for them, not folded in half-built here.
 *
 * ---------------------------------------------------------------------------
 * AMENDED. This header used to end "No custom builder, no correlation, no
 * saved/shared views, no tier gate: this is the staff-only presets library,
 * full stop." Three of those five are still true and are still deliberate:
 *
 *   - no correlation, no saved views, no shared views. `saved_views` does not
 *     exist in this schema and correlation needs a second metric slot. Both
 *     stay out. analytics.md's builder is NOT built here in full.
 *
 * Two have changed, on the coach's own instruction:
 *
 *   - THERE IS NOW A BUILDER, of the single-metric shape analytics.md itself
 *     assigns to the Club tier ("single-metric builder, line and bar only").
 *     fetchMetricSeries() below is its whole query surface: one metric, one
 *     population, one window, returned in the two aligned shapes the three
 *     visualisations render. The metric catalogue lives in
 *     lib/analyticsBuilder.ts, deliberately outside this file, so the page and
 *     the charts read the same definitions the query does.
 *   - THERE IS NOW A TIER GATE, and it is narrow: the BAR CHART is Premium,
 *     the screen is not. This query is unchanged by it — the gate is a
 *     rendering decision in the page component, not a filter here, because a
 *     Basic club reads the exact same byAthlete[] rows in the table view. See
 *     the page component for the scope and for what it contradicts in
 *     12-product-tiers.md.
 *
 * The two original presets (fetchAcwr, fetchWellnessTrend) keep their exact
 * signatures and return types and are still exported: they are consumed
 * elsewhere (squadWeeklyReport.ts), so the builder is additive rather than a
 * rewrite of a query other screens depend on.
 *
 * Their ONE change is that they now page, like the builder — see the paging
 * note further down. Nothing they return moved. */

export type AcwrRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  acute: number | null;
  chronic: number | null;
  acwr: number | null;
  suppressed: boolean;
  days_with_data: number;
};

/** The narrow shape fetchAcwr reads out of training_entries_current. Declared
 *  rather than inferred because fetchAllPaged is generic over its row type, and
 *  every column is nullable because a `_current` view types them that way
 *  regardless of the base table's constraints. */
type AcwrEntryRow = {
  athlete_id: string | null;
  entry_date: string | null;
  session_load: number | null;
};

/** Acute:chronic workload ratio — computation, windows and the 21-of-28
 *  suppression guard all from lib/acwr.ts, the one shared definition every
 *  ACWR surface uses (audit S1). */
export async function fetchAcwr(
  db: Db,
  orgId: string,
  timezone: string,
  groupIds: readonly string[],
): Promise<AcwrRow[]> {
  const today = todayIso(timezone);
  const from = addDays(today, -(ACWR_CHRONIC_WINDOW_DAYS - 1));
  const acuteFrom = addDays(today, -(ACWR_ACUTE_WINDOW_DAYS - 1));

  const [athletesRes, scope, entryRows] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club')
    .eq('in_data', true) /* 0120: out of every data denominator — declined, withdrawn, undecided, guardian outstanding */,
    fetchGroupAthleteIds(db, orgId, groupIds),
    /* Paged, with a total order. 28 days across a 40-athlete squad is ~1,120
     * rows — already past the configured `max_rows = 1000`, which returns
     * exactly 1000 rows and no error. See the paging note below for why the
     * three-column order is mandatory and what a truncated fetch would have
     * done to this particular query: silently dropped days out of the trailing
     * 28, which does not produce a wrong-looking ratio — it pushes athletes
     * under computeAcwr's 21-of-28 guard and reports them as "not enough
     * history" when the history exists. */
    fetchAllPaged<AcwrEntryRow>((pageFrom, pageTo) =>
      db
        .from('training_entries_current')
        .select('athlete_id, entry_date, session_load')
        .eq('org_id', orgId)
        .gte('entry_date', from)
        .lte('entry_date', today)
        .order('entry_date')
        .order('athlete_id')
        .order('id')
        .range(pageFrom, pageTo),
    ),
  ]);

  if (athletesRes.error) throw new Error(athletesRes.error.message);

  const inScope = scope ? new Set(scope) : null;
  const athletes = (athletesRes.data ?? []).filter((a) => !inScope || inScope.has(a.id));

  const byAthlete = new Map<string, { date: string; load: number }[]>();
  for (const e of entryRows) {
    // training_entries_current is a view: every column types nullable even
    // though these three are not null in practice for a real row.
    if (e.session_load === null || e.athlete_id === null || e.entry_date === null) continue;
    const list = byAthlete.get(e.athlete_id) ?? [];
    list.push({ date: e.entry_date, load: e.session_load });
    byAthlete.set(e.athlete_id, list);
  }

  return athletes
    .map((a) => {
      const rows = byAthlete.get(a.id) ?? [];
      const loadByDate = new Map<string, number>();
      for (const r of rows) loadByDate.set(r.date, (loadByDate.get(r.date) ?? 0) + r.load);
      const computed = computeAcwr(loadByDate, acuteFrom);

      return {
        athlete_id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        acute: computed.acute,
        chronic: computed.chronic,
        acwr: computed.acwr,
        suppressed: computed.suppressed,
        days_with_data: computed.daysWithData,
      };
    })
    .sort((a, b) => (b.acwr ?? -Infinity) - (a.acwr ?? -Infinity));
}

export type WellnessTrendRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  readiness: number | null;
  band: Band | null;
  z: number | null;
  outlier: boolean;
  observations: number;
};

/** The narrow shape fetchWellnessTrend reads out of wellness_entries_current.
 *  The five scales are exactly lib/stats.ts's readiness() input, so a row goes
 *  to it unmodified rather than being re-projected here. */
type WellnessTrendEntryRow = {
  athlete_id: string | null;
  entry_date: string | null;
  sleep_quality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
};

/** Each athlete's most recent readiness against their own rolling mean, per
 *  screens/analytics.md preset 2 — "the question is never what did they score, it is
 *  whether this is normal for them" (lib/stats.ts's own header, which this reuses
 *  directly rather than re-deriving). z-score suppressed below 10 prior
 *  observations, the spec's own guard; the raw value still shows. */
export async function fetchWellnessTrend(
  db: Db,
  orgId: string,
  timezone: string,
  groupIds: readonly string[],
): Promise<WellnessTrendRow[]> {
  const today = todayIso(timezone);
  const from = addDays(today, -55); // extra runway so a 28-day band has room to fill

  /* `entryRows`, not `entries` — the per-athlete `entries` inside the map
   * below is a different list (one athlete's rows), and two names for two
   * things beats one name shadowed. */
  const [athletesRes, scope, entryRows] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club')
    .eq('in_data', true) /* 0120: out of every data denominator — declined, withdrawn, undecided, guardian outstanding */,
    fetchGroupAthleteIds(db, orgId, groupIds),
    /* Paged, with a total order. 56 days across a 40-athlete squad is ~2,240
     * rows — more than twice the configured `max_rows = 1000` ceiling, so this
     * query was returning under half its answer, with no error to notice.
     *
     * The failure mode here is nastier than a missing number. `.order()`
     * without paging returned the OLDEST 1000 rows, so the truncation landed on
     * the RECENT end of every athlete's series: `latest` was not the latest,
     * rollingBand's trailing 28 was computed off stale days, and the z-score
     * that decides "outlier" was a comparison of the wrong reading against the
     * wrong band. On a squad big enough to truncate, this preset — and the
     * squad weekly report that reads it — was quietly answering a different
     * question than the one on the screen.
     *
     * `.order('entry_date')` still leads, because rollingBand consumes points
     * in order; athlete_id and id follow only to make the order total. */
    fetchAllPaged<WellnessTrendEntryRow>((pageFrom, pageTo) =>
      db
        .from('wellness_entries_current')
        .select('athlete_id, entry_date, sleep_quality, fatigue, soreness, stress, mood')
        .eq('org_id', orgId)
        .gte('entry_date', from)
        .lte('entry_date', today)
        .order('entry_date')
        .order('athlete_id')
        .order('id')
        .range(pageFrom, pageTo),
    ),
  ]);

  if (athletesRes.error) throw new Error(athletesRes.error.message);

  const inScope = scope ? new Set(scope) : null;
  const athletes = (athletesRes.data ?? []).filter((a) => !inScope || inScope.has(a.id));

  const byAthlete = new Map<string, WellnessTrendEntryRow[]>();
  for (const e of entryRows) {
    // wellness_entries_current is a view: every column types nullable even
    // though athlete_id and entry_date are not null in practice for a real row.
    if (e.athlete_id === null || e.entry_date === null) continue;
    const list = byAthlete.get(e.athlete_id) ?? [];
    list.push(e);
    byAthlete.set(e.athlete_id, list);
  }

  return athletes
    .map((a) => {
      const entries = byAthlete.get(a.id) ?? [];
      const points = entries.map((e) => ({
        date: e.entry_date as string,
        value: readiness(e),
      }));
      const bands = rollingBand(points, 28, 10);
      const latest = bands.length > 0 ? bands[bands.length - 1] : null;
      const z = latest ? zScore(latest) : null;

      return {
        athlete_id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        readiness: latest?.value ?? null,
        band: latest ?? null,
        z,
        outlier: z !== null && z <= -1.5,
        observations: points.filter((p) => p.value !== null).length,
      };
    })
    .sort((a, b) => (a.z ?? Infinity) - (b.z ?? Infinity));
}


/* =========================================================================
 * The engine under the analytics panels (PATTERN-S7 C6, 2026-09-14)
 * =========================================================================
 *
 * One metric, one population, one window: fetchPerAthleteDaily() below turns
 * the rows into one daily value per athlete per day — the collapse rule, the
 * ACWR trailing ratio and the in_data denominator in one place — and the
 * panels bucket those maps into bars and the squad's spread themselves
 * (lib/analyticsPanels). This was the builder's query until the builder went
 * (its series-plus-ranking half, fetchMetricSeries, with it); everything
 * above this line is the two original presets, left untouched.
 */

/* ═══ EVERY MULTI-ROW READ IN THIS FILE PAGES. NO EXCEPTIONS ══════════════
 *
 * PostgREST answers with at most `db-max-rows` rows, and this project sets it
 * explicitly (`max_rows = 1000` in supabase/config.toml). A request that hits
 * the ceiling does NOT error and does NOT come back short: it returns exactly
 * 1000 rows and looks like a complete answer. So every query here that is
 * unbounded by construction goes through fetchAllPaged in ./paged.ts.
 *
 * ── What this note used to say, and why it was wrong ──────────────────────
 *
 * It read: "the builder pages explicitly. The two legacy presets above do not,
 * and do not need to: they pull 28 and 56 days." That sentence is what let a
 * real bug survive a review, because it counted DAYS and the ceiling counts
 * ROWS. Multiply by the squad:
 *
 *   fetchAcwr          28 days × 40 athletes ≈ 1,120 rows  → truncated
 *   fetchWellnessTrend 56 days × 40 athletes ≈ 2,240 rows  → less than half
 *   fetchMetricSeries  up to 730 days × squad              → tens of thousands
 *
 * A 40-athlete squad is a small club, not a stress case, and both presets feed
 * squadWeeklyReport.ts, which coaches read. Both now page. Do not re-derive
 * "this window is short so it is safe" — the only safe number is rows, and the
 * only way to know you got them all is to page until a page comes back short.
 *
 * fetchAllPaged used to live in this file; it moved to ./paged.ts unchanged
 * when lib/queries/gpsImport.ts turned out to need the same loop. Its own
 * header carries the paging rule. What stays here is the reason THIS file's
 * calls order the way they do:
 *
 * ═══ THE SORT KEY MUST BE A TOTAL ORDER. THIS IS NOT A STYLE POINT ═══════
 *
 * Every fetchAllPaged call in this file MUST end in an ORDER BY that is unique
 * across the result set — in this file that means
 * `.order('entry_date').order('athlete_id').order('id')`, where `id` is the
 * primary key of the base table behind the `_current` view (migration 0004)
 * and therefore breaks every remaining tie.
 *
 * PostgREST turns `.range(from, to)` into LIMIT/OFFSET, and each page is a
 * SEPARATE execution of the query. Postgres guarantees no stable order among
 * rows that compare equal under ORDER BY, and it is free to choose a different
 * plan for OFFSET 0 and OFFSET 1000. So with `ORDER BY entry_date` alone — and
 * every athlete in a squad shares an entry_date, so ties are the normal case,
 * not an edge case — a row can legitimately be returned on BOTH sides of a page
 * boundary, or on NEITHER.
 *
 * That is not a cosmetic reordering. The caller collapses each athlete-day with
 * `sum` for `load` and for the raw load behind `acwr`, so a duplicated row is
 * ADDED TWICE: inflated training load, inflated acute load, and an ACWR ratio
 * that moves between two loads of the same screen. A dropped row is the same
 * corruption in the other direction. Both are silent — there is no error and no
 * short page to notice.
 *
 * The default view already crosses page boundaries: 28 days visible fetches 82
 * days of runway for ACWR, which for a 40-athlete squad logging most days is
 * ~3,000 rows, three pages.
 */

/** The current season's start date, for the "This season" timeline. Null when
 *  the club has not set one up — the option is then not offered at all rather
 *  than silently meaning something else. schedule.ts already treats a missing
 *  current season as a real, statable condition, not a default. */
export async function fetchCurrentSeasonWindow(
  db: Db,
  orgId: string,
): Promise<{ name: string; starts_on: string } | null> {
  const { data, error } = await db
    .from('seasons')
    .select('name, starts_on')
    .eq('org_id', orgId)
    .eq('is_current', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { name: data.name, starts_on: data.starts_on } : null;
}

/** The earliest date this org has any entry for, in the metric's own source
 *  view, for the "All on record" timeline. One row, ordered — not a scan.
 *  Branched rather than parameterised on a view name: a dynamic table name
 *  loses supabase-js's row typing entirely, and two four-line branches are
 *  cheaper than an `any`. */
export async function fetchEarliestEntryDate(
  db: Db,
  orgId: string,
  source: MetricSource,
): Promise<string | null> {
  if (source === 'gps') {
    const { data, error } = await db
      .from('gps_records')
      .select('record_date')
      .eq('org_id', orgId)
      .not('record_date', 'is', null)
      .order('record_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.record_date ?? null;
  }
  if (source === 'gym') {
    // The parent's date again — gym_set_logs has none of its own.
    const { data, error } = await db
      .from('gym_session_logs_current')
      .select('entry_date')
      .eq('org_id', orgId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.entry_date ?? null;
  }
  if (source === 'training') {
    const { data, error } = await db
      .from('training_entries_current')
      .select('entry_date')
      .eq('org_id', orgId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.entry_date ?? null;
  }
  const { data, error } = await db
    .from('wellness_entries_current')
    .select('entry_date')
    .eq('org_id', orgId)
    .not('entry_date', 'is', null)
    .order('entry_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.entry_date ?? null;
}

export type BuilderAthlete = { id: string; first_name: string; last_name: string; position: string | null };

/** The athletes the picker offers, already narrowed by the group filter — so
 *  the two controls compose rather than contradict: choosing "Forwards" and
 *  then opening the athlete list shows forwards, and an athlete the filter
 *  excludes cannot stay selected (the page clears the selection rather than
 *  showing a name the filter has removed).
 *
 *  `position` is carried only for the option label. It is free text on
 *  `athletes` (migration 0002) and is a roster attribute, NOT a filter
 *  dimension: the positional filter in this app is the group filter, whose
 *  `group_type` enum has 'positional' as its first value. See the page. */
export async function fetchBuilderAthletes(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<BuilderAthlete[]> {
  const [athletesRes, scope] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name, position')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club')
    .eq('in_data', true) /* 0120: out of every data denominator — declined, withdrawn, undecided, guardian outstanding */,
    fetchGroupAthleteIds(db, orgId, groupIds),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);

  const inScope = scope ? new Set(scope) : null;
  return (athletesRes.data ?? [])
    .filter((a) => !inScope || inScope.has(a.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
}

/** How much history to pull BEFORE the visible window starts.
 *
 *  rollingBand's window is 28 observations, so a band on the FIRST visible day
 *  needs the 27 days before it. Without that runway the opening third of every
 *  short window renders with no band at all, which reads as "this athlete has
 *  no norm" when the truth is "we did not ask for the days that would prove
 *  one". ACWR doubles it: the ratio on a given day is itself a 28-day trailing
 *  figure, so the ratio needs 27 days and a band on the ratio needs 27 more. */
const BAND_RUNWAY_DAYS = 27;

/* Fixed column lists, not built from MetricDef.column.
 *
 * supabase-js infers a row type from the LITERAL select string; hand it a
 * variable and the inference collapses. Over-fetching four numeric columns is
 * far cheaper than losing the type that stops this file reading a column the
 * view does not have. Every column here is real (migration 0002/0010 and the
 * `_current` views), and every metric in lib/analyticsBuilder.ts reads one of
 * them or is computed from them. */
const TRAINING_COLS = 'athlete_id, entry_date, session_load, rpe';
/* gps_records dates its rows `record_date`, not `entry_date`. Aliased in the
 * select so the row arrives in the same shape every other source produces and
 * the per-day collapse below needs no branch of its own. Ordering still names
 * the REAL column — an alias is a projection, not a sort key. */
const GPS_COLS = 'athlete_id, entry_date:record_date, total_distance_m';
/* gym_set_logs carries neither athlete_id nor entry_date — both live on the
 * parent session (this is the same shape that forces the chunked read in
 * programmes.ts). An inner embed brings them across in one query instead, and
 * filters on the parent at the same time. volume_kg is a generated stored
 * column (migration 0021, reps x load), so the tonnage is read, not computed
 * here. */
const GYM_COLS = 'volume_kg, gym_session_logs!inner(athlete_id, entry_date, superseded_by)';
const WELLNESS_COLS =
  'athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress, mood, resting_hr';

/** The narrow shape this file reads out of either view. Every field nullable
 *  because a `_current` view types every column nullable, regardless of the
 *  base table's constraints. */
type MetricRow = {
  athlete_id: string | null;
  entry_date: string | null;
  session_load?: number | null;
  rpe?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  fatigue?: number | null;
  soreness?: number | null;
  stress?: number | null;
  mood?: number | null;
  resting_hr?: number | null;
  total_distance_m?: number | null;
  volume_kg?: number | null;
};

/** The one place a MetricDef turns into a number from a row. ACWR returns the
 *  RAW LOAD here — the ratio is a trailing window and cannot be computed from
 *  a single row; fetchMetricSeries derives it per day further down. */
function valueFor(metric: MetricDef, row: MetricRow): number | null {
  if (metric.key === 'readiness') {
    return readiness({
      sleep_quality: row.sleep_quality ?? null,
      fatigue: row.fatigue ?? null,
      soreness: row.soreness ?? null,
      stress: row.stress ?? null,
      mood: row.mood ?? null,
    });
  }
  if (metric.key === 'acwr') return row.session_load ?? null;
  if (metric.column === null) return null;
  const raw = (row as Record<string, number | null | string | undefined>)[metric.column];
  return typeof raw === 'number' ? raw : null;
}

/** One athlete's or the whole scope's DAILY values for a metric, athlete by
 *  athlete, over the visible span plus the band run-up — the engine under
 *  fetchMetricSeries (the builder's series) and the S7 analytics panels (one
 *  athlete's bars against the squad's spread per period). One code path for
 *  the collapse, the ACWR trailing ratio and the in_data denominator, so the
 *  two screens cannot disagree about a day's number. */
export type PerAthleteDaily = {
  athletes: { id: string; first_name: string; last_name: string }[];
  /** athlete id -> date -> the metric's value that day (absent = nothing). */
  perAthlete: Map<string, Map<string, number>>;
  /** ACWR only: athletes suppressed as of the last visible day. */
  suppressedNow: Set<string>;
  /** Every calendar day fetched, run-up included, in order. */
  allDates: string[];
  fetchFrom: string;
};

export async function fetchPerAthleteDaily(
  db: Db,
  orgId: string,
  metric: MetricDef,
  range: { from: string; to: string },
  groupIds: readonly string[],
  athleteId: string | null,
): Promise<PerAthleteDaily> {
  const runway = metric.key === 'acwr' ? BAND_RUNWAY_DAYS * 2 : BAND_RUNWAY_DAYS;
  const fetchFrom = addDays(range.from, -runway);

  const [athletesRes, scope] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club')
    .eq('in_data', true) /* 0120: out of every data denominator — declined, withdrawn, undecided, guardian outstanding */,
    fetchGroupAthleteIds(db, orgId, groupIds),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);

  const groupScope = scope ? new Set(scope) : null;
  const athletes = (athletesRes.data ?? [])
    .filter((a) => !groupScope || groupScope.has(a.id))
    // The athlete picker narrows INSIDE the group filter, never around it. An
    // id the group filter excludes yields an empty population, which the page
    // states plainly rather than falling back to the whole squad — a filter
    // that silently widens is a filter that lies (CLAUDE.md §3).
    .filter((a) => athleteId === null || a.id === athleteId)
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

  const inScope = new Set(athletes.map((a) => a.id));

  /* When ONE athlete is selected, narrow in the database rather than fetching
   * the whole squad and discarding it in the loop below. A 730-day window over
   * a 40-athlete squad is tens of thousands of rows to draw one line.
   *
   * Only for the single-athlete case, deliberately — NOT `.in('athlete_id',
   * [...inScope])` for the group case. supabase-js puts an `in.(...)` list in
   * the query STRING, so a 60-athlete group becomes a ~2.5KB URL and starts
   * meeting proxy header limits. The in-memory `inScope` filter below is the
   * correctness boundary in both cases and is unchanged; this is purely a
   * volume reduction on the one shape where it is free. */
  const single = athleteId !== null && inScope.has(athleteId) ? athleteId : null;

  /* GPS and gym are fetched separately from the two entry views: gps_records
   * dates on record_date, and gym_set_logs has to reach through its parent for
   * an athlete and a date at all. Both normalise to the same MetricRow the
   * collapse below already understands, so nothing downstream branches. */
  const gpsRows = async (): Promise<MetricRow[]> =>
    fetchAllPaged<MetricRow>((from, to) => {
      const q = db
        .from('gps_records')
        .select(GPS_COLS)
        .eq('org_id', orgId)
        .gte('record_date', fetchFrom)
        .lte('record_date', range.to);
      return (single ? q.eq('athlete_id', single) : q)
        .order('record_date')
        .order('athlete_id')
        .order('id')
        .range(from, to);
    });

  type GymSetRow = {
    volume_kg: number | null;
    gym_session_logs: { athlete_id: string | null; entry_date: string | null; superseded_by: string | null } | null;
  };
  const gymRows = async (): Promise<MetricRow[]> => {
    const raw = await fetchAllPaged<GymSetRow>((from, to) => {
      const q = db
        .from('gym_set_logs')
        .select(GYM_COLS)
        .eq('org_id', orgId)
        /* The parent's revision state, filtered through the embed: a corrected
         * session leaves its superseded parent behind, and counting both would
         * double that day's tonnage. This is the embed's equivalent of reading
         * gym_session_logs_current. */
        .is('gym_session_logs.superseded_by', null)
        .gte('gym_session_logs.entry_date', fetchFrom)
        .lte('gym_session_logs.entry_date', range.to)
        /* Warm-ups are not training volume. Excluded here rather than in the
         * metric's note, so the number is right wherever it is read. */
        .eq('is_warmup', false);
      return (single ? q.eq('gym_session_logs.athlete_id', single) : q).order('id').range(from, to);
    });
    return raw.map((r) => ({
      athlete_id: r.gym_session_logs?.athlete_id ?? null,
      entry_date: r.gym_session_logs?.entry_date ?? null,
      volume_kg: r.volume_kg,
    }));
  };

  const rows: MetricRow[] =
    inScope.size === 0
      ? []
      : metric.source === 'gps'
        ? await gpsRows()
        : metric.source === 'gym'
          ? await gymRows()
          : metric.source === 'training'
        ? await fetchAllPaged<MetricRow>((from, to) => {
            const q = db
              .from('training_entries_current')
              .select(TRAINING_COLS)
              .eq('org_id', orgId)
              .gte('entry_date', fetchFrom)
              .lte('entry_date', range.to);
            /* TOTAL ORDER, not a preference. `id` is the base table's primary
             * key (migration 0004) and is what makes this unique; entry_date
             * and athlete_id are in front of it only so the pages arrive in an
             * order a human debugging this can follow. Dropping any of the
             * three re-opens the duplicate/drop corruption this file's own
             * paging note above describes. `id` is ordered but not selected — PostgREST
             * does not require a column in the select list to sort on it, and
             * adding it to TRAINING_COLS would change the inferred row type. */
            return (single ? q.eq('athlete_id', single) : q)
              .order('entry_date')
              .order('athlete_id')
              .order('id')
              .range(from, to);
          })
        : await fetchAllPaged<MetricRow>((from, to) => {
            const q = db
              .from('wellness_entries_current')
              .select(WELLNESS_COLS)
              .eq('org_id', orgId)
              .gte('entry_date', fetchFrom)
              .lte('entry_date', range.to);
            // Same total order as the training branch above, same reason.
            return (single ? q.eq('athlete_id', single) : q)
              .order('entry_date')
              .order('athlete_id')
              .order('id')
              .range(from, to);
          });

  /* athlete -> date -> {sum, n}, before the per-day collapse. A row missing
   * the pieces this metric needs is DROPPED here, once, rather than defended
   * against at every use below. Dropped, not zeroed: an absent entry must
   * never become a number. */
  const daySums = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const row of rows) {
    const athlete = row.athlete_id;
    const date = row.entry_date;
    if (athlete === null || date === null || !inScope.has(athlete)) continue;
    const value = valueFor(metric, row);
    if (value === null) continue;

    const byDate = daySums.get(athlete) ?? new Map<string, { sum: number; n: number }>();
    const cell = byDate.get(date) ?? { sum: 0, n: 0 };
    cell.sum += value;
    cell.n += 1;
    byDate.set(date, cell);
    daySums.set(athlete, byDate);
  }

  // Collapse same-day duplicates per MetricDef.perDay. Load sums (two sessions
  // is a bigger day); a perceived-effort or wellness scale averages. ACWR
  // always sums, because what is being collapsed at this point is raw load.
  const collapse: 'sum' | 'mean' = metric.key === 'acwr' ? 'sum' : metric.perDay;
  const perAthlete = new Map<string, Map<string, number>>();
  for (const [athlete, byDate] of daySums) {
    const out = new Map<string, number>();
    for (const [date, cell] of byDate) out.set(date, collapse === 'sum' ? cell.sum : cell.sum / cell.n);
    perAthlete.set(athlete, out);
  }

  // Every calendar day of the fetched span, runway included, so a gap stays a
  // real gap rather than two adjacent points joined across it.
  const allDates: string[] = [];
  for (let d = fetchFrom; d <= range.to; d = addDays(d, 1)) allDates.push(d);

  /* ACWR: replace each athlete's raw daily load with the trailing ratio ON
   * that day, computed through lib/acwr.ts's computeAcwr — the one shared
   * definition every ACWR surface in this app uses (audit S1). Not re-derived
   * here, and the 21-of-28 suppression guard comes along with it for free. */
  const perAthleteMetric = new Map<string, Map<string, number>>();
  const suppressedNow = new Set<string>();
  if (metric.key === 'acwr') {
    for (const a of athletes) {
      const loadByDate = perAthlete.get(a.id) ?? new Map<string, number>();
      const ratios = new Map<string, number>();
      for (const day of allDates) {
        const windowStart = addDays(day, -(ACWR_CHRONIC_WINDOW_DAYS - 1));
        const window = new Map<string, number>();
        for (const [d, v] of loadByDate) if (d >= windowStart && d <= day) window.set(d, v);
        const computed = computeAcwr(window, addDays(day, -(ACWR_ACUTE_WINDOW_DAYS - 1)));
        if (computed.acwr !== null) ratios.set(day, computed.acwr);
        // "Suppressed" on an athlete row means suppressed AS OF the last day
        // of the visible window — the "where do they stand now" question the
        // original preset answers, not "were they ever suppressed".
        if (day === range.to && computed.suppressed) suppressedNow.add(a.id);
      }
      perAthleteMetric.set(a.id, ratios);
    }
  } else {
    for (const [k, v] of perAthlete) perAthleteMetric.set(k, v);
  }

  return { athletes, perAthlete: perAthleteMetric, suppressedNow, allDates, fetchFrom };
}

/* fetchMetricSeries — the builder's series-plus-ranking query — went with
 * /analytics/build on 2026-09-14 (PATTERN-S7 C6). fetchPerAthleteDaily above
 * is the engine that survived; the panels bucket its daily maps themselves. */
