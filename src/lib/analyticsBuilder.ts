import { ACWR_BAND_TEXT, ACWR_CHRONIC_WINDOW_DAYS, ACWR_MIN_DAYS_WITH_DATA } from '@/lib/acwr';
// `RangeKey` is imported as well as re-exported below: a bare `export { type X }
// from` is a pass-through and does NOT put the name in this module's scope,
// and chartUnavailableReason() below still needs it in scope. `addDays` was
// only ever used by resolveRange and left with it.
import type { RangeKey } from '@/lib/period';

/* The analytics builder's vocabulary — metrics, timelines, chart types — and
 * nothing else. Pure: no database, no React, no `Db`. It exists so the page,
 * the query layer and the chart components all read the same catalogue rather
 * than three drifting copies of "what is a metric", which is the exact failure
 * lib/acwr.ts was created to undo for ACWR (see its header, audit S1).
 *
 * WHAT THIS IS NOT. `docs/screens/analytics.md` specifies a much larger
 * builder: multi-slot metrics, cross-domain correlation with a lag, scatter
 * and heatmap visualisations, and saved/shared views persisted in a
 * `saved_views` table. None of that is here and none of it is half-here.
 * `saved_views` does not exist in this schema, correlation is explicitly out
 * of scope for this pass, and a scatter/heatmap needs a second metric or a
 * second categorical dimension that this single-slot builder never produces.
 * What IS here is the spec's own Club-tier shape — "single-metric builder,
 * line and bar only" (analytics.md §Role-specific) — plus a table of the same
 * numbers, driven by four composed controls.
 *
 * Every metric below is a real column on a real view. Nothing here derives a
 * number the schema cannot supply, and nothing is scaled, imputed or
 * back-filled: a day an athlete did not submit is absent, never zero. */

/* Where a metric's numbers come from. 'gps' and 'gym' were added for the four
 * fixed boards the Analytics design specifies — Training load reads
 * gps_records, Gym volume reads gym_set_logs — and the builder gained both
 * metrics for free, since it runs the same engine. */
export type MetricSource = 'training' | 'wellness' | 'gps' | 'gym';

/** How several entries for ONE athlete on ONE day collapse to that day's
 *  value. Session load is additive — two sessions in a day is a bigger day.
 *  A wellness scale is not: an athlete does not submit twice, and if a
 *  correction revision exists the `_current` view has already resolved it
 *  (CLAUDE.md rule 6), so `mean` here is a defensive tie-break, not a
 *  modelling choice. */
export type PerDay = 'sum' | 'mean';

/** How a day-series collapses to one number per athlete over the whole
 *  range, for the bar chart and the athlete table.
 *   - `mean`: the average of the days that have a value. Days without one are
 *     not counted as zero and not interpolated.
 *   - `trailing`: the metric is ALREADY a trailing window (ACWR is a ratio of
 *     the last 7 days to the last 28), so averaging it over a range would be
 *     an average of overlapping averages. The value is the ratio as it stands
 *     on the last day of the range. */
export type Aggregate = 'mean' | 'trailing';

export type MetricDef = {
  key: MetricKey;
  label: string;
  /** Which view the numbers come from. */
  source: MetricSource;
  /** The column read, or null when the metric is computed (ACWR, readiness). */
  column: string | null;
  /** Printed after the number, including any leading space. */
  unit: string;
  decimals: number;
  /** A bounded scale gets a fixed axis so two ranges of the same metric are
   *  visually comparable; an unbounded one (load, HR) gets null and the chart
   *  derives the axis from the data, which is the only honest option. */
  axis: readonly [number, number] | null;
  ticks: readonly number[] | null;
  perDay: PerDay;
  aggregate: Aggregate;
  /** The one-line caveat printed under the result. Every metric has one:
   *  a number on this screen is quoted in meetings, and the thing that makes
   *  it safe to quote is knowing what it counts. */
  note: string;
};

export type MetricKey =
  | 'acwr'
  | 'readiness'
  | 'gps_distance'
  | 'gym_volume'
  | 'load'
  | 'rpe'
  | 'sleep_hours'
  | 'sleep_quality'
  | 'fatigue'
  | 'soreness'
  | 'stress'
  | 'mood'
  | 'resting_hr';

/* The 1-to-5 wellness scales share an axis definition; declared once so a
 * "soreness" chart and a "mood" chart are read against identical gridlines. */
const SCALE_1_5 = { axis: [1, 5] as const, ticks: [1, 2, 3, 4, 5] as const, decimals: 1 };

export const METRICS: readonly MetricDef[] = [
  {
    key: 'acwr',
    label: 'Acute:chronic workload ratio',
    source: 'training',
    column: null,
    unit: '',
    decimals: 2,
    axis: [0, 2.5],
    ticks: [0, 0.5, 0.8, 1.5, 2, 2.5],
    perDay: 'sum',
    aggregate: 'trailing',
    note: `A descriptive ratio, not a risk score. The ${ACWR_BAND_TEXT} band is a convention; the rule that actually raises a flag lives on the Thresholds screen. Suppressed entirely for an athlete with fewer than ${ACWR_MIN_DAYS_WITH_DATA} of the trailing ${ACWR_CHRONIC_WINDOW_DAYS} days on record — never estimated from less.`,
  },
  {
    key: 'readiness',
    label: 'Wellness readiness',
    source: 'wellness',
    column: null,
    unit: '',
    decimals: 0,
    axis: [0, 100],
    ticks: [0, 25, 50, 75, 100],
    perDay: 'mean',
    aggregate: 'mean',
    note: 'The five 1-to-5 wellness scales averaged onto 0–100, matching public.wellness_compute_readiness. A day missing any one of the five scales has no readiness value at all rather than a partial one.',
  },
  {
    key: 'gps_distance',
    label: 'Total distance',
    source: 'gps',
    column: 'total_distance_m',
    unit: ' m',
    decimals: 0,
    axis: null,
    ticks: null,
    /* Summed across a day: two sessions is genuinely a bigger day's running,
     * the same reasoning session load uses directly below. */
    perDay: 'sum',
    aggregate: 'mean',
    note: 'Metres covered, from the GPS unit. Summed across every session an athlete wore one that day; a session with no unit is absent, not zero.',
  },
  {
    key: 'gym_volume',
    label: 'Volume load',
    source: 'gym',
    column: 'volume_kg',
    unit: ' kg',
    decimals: 0,
    axis: null,
    ticks: null,
    perDay: 'sum',
    aggregate: 'mean',
    note: 'Tonnage lifted: reps × load, summed across every working set that day. Warm-up sets are excluded — they are not training volume. Corrected sessions count once, through the current-revision view.',
  },
  {
    key: 'load',
    label: 'Training load',
    source: 'training',
    column: 'session_load',
    unit: ' AU',
    decimals: 0,
    axis: null,
    ticks: null,
    perDay: 'sum',
    aggregate: 'mean',
    note: 'Session RPE × duration, summed across every session an athlete logged that day. A day with no logged session is absent from the average, not counted as a rest day worth zero.',
  },
  {
    key: 'rpe',
    label: 'Session RPE',
    source: 'training',
    column: 'rpe',
    unit: '',
    decimals: 1,
    axis: [0, 10],
    ticks: [0, 2, 4, 6, 8, 10],
    perDay: 'mean',
    aggregate: 'mean',
    note: 'The athlete’s own CR10 rating of how hard the session felt. Averaged, not summed, across two sessions in a day: perceived effort is not additive.',
  },
  {
    key: 'sleep_hours',
    label: 'Sleep',
    source: 'wellness',
    column: 'sleep_hours',
    unit: ' h',
    decimals: 1,
    axis: [0, 12],
    ticks: [0, 3, 6, 9, 12],
    perDay: 'mean',
    aggregate: 'mean',
    note: 'Self-reported hours slept, from the daily wellness check-in. Optional on that form, so an athlete can have a readiness score for a day and no sleep figure.',
  },
  { ...SCALE_1_5, key: 'sleep_quality', label: 'Sleep quality', source: 'wellness', column: 'sleep_quality', unit: ' / 5', perDay: 'mean', aggregate: 'mean', note: 'One of the five readiness inputs, on its own. 5 is best.' },
  { ...SCALE_1_5, key: 'fatigue', label: 'Fatigue', source: 'wellness', column: 'fatigue', unit: ' / 5', perDay: 'mean', aggregate: 'mean', note: 'One of the five readiness inputs, on its own. 5 is best (fresh), matching migration 0010 — this scale is NOT inverted, so a falling line is a worsening athlete.' },
  { ...SCALE_1_5, key: 'soreness', label: 'Soreness', source: 'wellness', column: 'soreness', unit: ' / 5', perDay: 'mean', aggregate: 'mean', note: 'One of the five readiness inputs, on its own. 5 is best (no soreness) — this scale is NOT inverted. Soreness is a wellness answer, never a clinical one: it is not an injury record and carries no diagnosis.' },
  { ...SCALE_1_5, key: 'stress', label: 'Stress', source: 'wellness', column: 'stress', unit: ' / 5', perDay: 'mean', aggregate: 'mean', note: 'One of the five readiness inputs, on its own. 5 is best (unstressed) — this scale is NOT inverted.' },
  { ...SCALE_1_5, key: 'mood', label: 'Mood', source: 'wellness', column: 'mood', unit: ' / 5', perDay: 'mean', aggregate: 'mean', note: 'One of the five readiness inputs, on its own. 5 is best.' },
  {
    key: 'resting_hr',
    label: 'Resting heart rate',
    source: 'wellness',
    column: 'resting_hr',
    unit: ' bpm',
    decimals: 0,
    axis: null,
    ticks: null,
    perDay: 'mean',
    aggregate: 'mean',
    note: 'Optional on the wellness check-in and sparsely filled unless a club collects it deliberately. Read it against the athlete’s own band, never against a squad number: resting HR varies enormously between individuals.',
  },
];

const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

export const DEFAULT_METRIC: MetricKey = 'acwr';

/** Resolve a raw `?metric=` value. An unknown value falls back to the default
 *  rather than throwing — a URL is user input and a stale bookmark should
 *  render a screen, not a 500. */
export function resolveMetric(raw: string | string[] | undefined): MetricDef {
  const key = typeof raw === 'string' ? raw : undefined;
  return (key && METRIC_BY_KEY.get(key as MetricKey)) || METRIC_BY_KEY.get(DEFAULT_METRIC)!;
}

/* ------------------------------------------------------------------ *
 * Timelines
 * ------------------------------------------------------------------ */

/* MOVED, NOT CHANGED. The whole range model — RangeKey, RANGE_OPTIONS,
 * DEFAULT_RANGE, isRangeKey, resolveRange, inclusiveDays, MAX_WINDOW_DAYS,
 * ResolvedRange — now lives in lib/period.ts, byte for byte, comments
 * included. Nothing about the logic changed.
 *
 * WHY IT LEFT. The client asked to adjust the period of ANY data, not just
 * analytics ("from the day to the week to the season to the year to all" —
 * exactly these six keys). Every other screen that wants them would have had
 * to import this file, and this file also carries METRICS, CHART_OPTIONS and
 * the analytics tier gate — so a compliance report asking "what is a week"
 * would have pulled the entire analytics catalogue in with it.
 *
 * WHY THE RE-EXPORT STAYS. /analytics imports all seven of these from HERE
 * (analytics/page.tsx:15-26). Re-exporting keeps that call site untouched, so
 * the move is provably behaviour-neutral for the one screen already using it.
 * New code should import from '@/lib/period' directly; this line is a bridge,
 * not the address. */
export {
  DEFAULT_RANGE,
  MAX_WINDOW_DAYS,
  RANGE_OPTIONS,
  inclusiveDays,
  isRangeKey,
  resolveRange,
  type RangeKey,
  type ResolvedRange,
} from '@/lib/period';

/* ------------------------------------------------------------------ *
 * Chart types
 * ------------------------------------------------------------------ */

export type ChartKey = 'line' | 'bar' | 'table';

export const CHART_OPTIONS: readonly { key: ChartKey; label: string }[] = [
  { key: 'line', label: 'Trend over time' },
  { key: 'bar', label: 'Bar, by athlete' },
  { key: 'table', label: 'Table' },
];

export const DEFAULT_CHART: ChartKey = 'line';

export function isChartKey(raw: unknown): raw is ChartKey {
  return typeof raw === 'string' && CHART_OPTIONS.some((c) => c.key === raw);
}

/**
 * analytics.md's rule that an illegal visualisation is "disabled with the
 * reason, not hidden". One day is one point, and a single point is not a
 * trend — the chart would render an axis and nothing on it. Rather than draw
 * that, the trend option is disabled for the `day` range and the page
 * substitutes another view, saying why.
 *
 * Returns null when the combination is legal.
 *
 * NOT the place for the tier lock. An illegal combination and a locked one are
 * different facts and are rendered differently: illegal is DISABLED in the
 * control (no amount of money makes a single day a trend), locked is CHOOSABLE
 * and shows what it would buy (see chartIsPremium below). Folding the two into
 * one function is how a purchasable feature ends up looking broken.
 */
export function chartUnavailableReason(chart: ChartKey, range: RangeKey): string | null {
  if (chart === 'line' && range === 'day') {
    return 'A single day is one point, not a trend — widen the timeline for a line.';
  }
  return null;
}

/**
 * Which visualisations are Premium, in the one place the chart catalogue lives.
 *
 * The client's instruction was, verbatim: *"for the setting page move the
 * analytics bar chart and apple health connection onto the premium plan side"*.
 * This is the analytics half of it, scoped to what the sentence actually names:
 * the BAR CHART. The Analytics screen itself stays on both plans, so a Basic
 * club keeps the metric builder, the trend chart and the athlete table it
 * already has — and the byAthlete numbers the bar chart draws stay readable in
 * the table view, which is the same query and the same figures.
 *
 * Gating the whole route instead was considered and reverted: it deleted a
 * live, working screen from every existing `core` organisation, which
 * `docs/12-product-tiers.md` §3.3 names as "the highest-regret" kind of change
 * ("reversing it later is a downgrade for existing customers"), and it is
 * strictly wider than the sentence that authorised it. The Apple Health half of
 * that same sentence was implemented narrowly — a plan-card column move plus a
 * Locked state on one Settings row, no route gated — and the two halves of one
 * instruction should not have been read at two different scopes.
 */
export function chartIsPremium(chart: ChartKey): boolean {
  return chart === 'bar';
}
