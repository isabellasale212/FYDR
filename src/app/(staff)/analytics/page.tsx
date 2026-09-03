import Link from 'next/link';
import { ComparisonChart, type ChartSeries } from '@/components/ComparisonChart/ComparisonChart';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { METRICS, type MetricDef, type MetricKey } from '@/lib/analyticsBuilder';
import { ACWR_BAND_HIGH, ACWR_BAND_LOW } from '@/lib/acwr';
import { addDays, initials, todayIso } from '@/lib/format';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchBuilderAthletes, fetchMetricSeries } from '@/lib/queries/analytics';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import { PlanGate, PlanGateCard } from '@/components/PlanGate/PlanGate';
import { ReportSelectNav } from '@/components/ReportSelectNav/ReportSelectNav';
import type { Band } from '@/lib/stats';

export const metadata = { title: 'Analytics · Fydr' };

/* ANALYTICS, rebuilt to "Fydr Analytics.dc.html" (8a/8b): four fixed boards,
 * one or two named athletes, compared against a population.
 *
 * This replaced a single-metric builder. That builder still exists, at
 * /analytics/build — see its own header. The design has no builder and no link
 * to one, so this page has neither.
 *
 * THE ONE IDEA THE WHOLE SCREEN IS BUILT ON, from the design's own caption:
 * "Selby solid in the card's own colour · Fox violet and dashed". Athlete A
 * takes each board's own colour, so a card keeps its identity; athlete B is the
 * same violet on all four, so the second athlete is learned once and read
 * everywhere. Every board is the same chart with different data.
 *
 * WHAT IS REAL HERE. All four boards read real tables through the same metric
 * engine: GPS distance from gps_records, readiness from wellness_entries,
 * tonnage from gym_set_logs, and ACWR through lib/acwr.ts's one shared
 * definition, suppression guard included. The GPS and gym sources were added to
 * that engine for this screen; nothing on this page computes a metric of its
 * own.
 *
 * WHAT IS NOT. The design's "compare against" row shows checkboxes for several
 * populations at once (Whole squad AND Forwards). This app's group filter is a
 * single global scope, deliberately — CLAUDE.md §3 makes it one selection that
 * persists across every screen, and a second, screen-local multi-select would
 * be a different filter with the same name. The row therefore renders the real
 * global filter and states the population it resolved to. Named, not faked.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A board is a metric, a window, and how it is drawn. Fixed, not chosen: this
 *  screen answers four questions, and which four is the product decision the
 *  design makes. */
type Board = {
  key: string;
  metric: MetricKey;
  title: string;
  days: number;
  colour: string;
  /** Weekly bars for athlete A behind the lines. The two rate/ratio boards do
   *  not get them — a bar chart of a ratio invites reading area as meaning. */
  bars: boolean;
  /** The 0.8–1.5 convention, drawn only on ACWR. */
  acwrBand?: true;
  /** This board's metric comes from GPS, so the whole board is Premium —
   *  12-product-tiers.md §2.3 row 26 puts GPS behind Premium outright. */
  gpsMetric?: true;
  /** Draw a least-squares trend instead of the raw daily series. The two bar
   *  boards do this — their own subtitles say "a trend line per athlete", and
   *  it is the right call: the bars already carry the week-to-week detail, so a
   *  second jagged daily line over them adds noise, not information. The two
   *  scale boards keep their real series, where every wobble is the point. */
  trend?: true;
};

const BOARDS: Board[] = [
  {
    key: 'load',
    metric: 'gps_distance',
    gpsMetric: true,
    title: 'Training load',
    days: 84,
    colour: 'var(--accent)',
    bars: true,
    trend: true,
  },
  {
    key: 'wellness',
    metric: 'readiness',
    title: 'Wellness',
    days: 28,
    colour: 'var(--good)',
    bars: false,
  },
  {
    key: 'gym',
    metric: 'gym_volume',
    title: 'Gym volume',
    days: 56,
    colour: 'var(--domain-gym)',
    bars: true,
    trend: true,
  },
  {
    key: 'acwr',
    metric: 'acwr',
    /* The BOARD is titled in full; only the metric dropdown is abbreviated,
       where 128px has to hold it. */
    title: 'Acute:chronic ratio',
    days: 84,
    colour: 'var(--accent)',
    bars: false,
    acwrBand: true,
  },
];

/* The timeframe choices. Days, not months, because every series here is built
 * per-day and a "month" would have to pick a length anyway. 28 is the shortest
 * a trailing band means anything over; 182 is where a daily line stops being
 * readable at this width and the weekly bars carry it instead. */
const WINDOWS: readonly { days: number; label: string }[] = [
  { days: 28, label: '28 days' },
  { days: 56, label: '8 weeks' },
  { days: 84, label: '12 weeks' },
  { days: 182, label: '26 weeks' },
];

function metricFor(key: MetricKey): MetricDef {
  const m = METRICS.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown metric ${key}`);
  return m;
}

/** Weekly totals from a daily series, for the bars. Sums only real days: a week
 *  with no data at all is null and is not drawn, rather than a zero-height bar
 *  that reads as "they did nothing". */
function weekly(series: readonly Band[]): { label: string; value: number | null }[] {
  const out: { label: string; value: number | null }[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    const real = chunk.filter((p) => p.value !== null);
    out.push({
      label: chunk[0]?.date ?? '',
      value: real.length === 0 ? null : real.reduce((s, p) => s + (p.value ?? 0), 0),
    });
  }
  return out;
}

/** Axis bounds from the data, with the metric's own fixed scale winning when it
 *  has one (the 1–5 wellness scales, ACWR). Never starts a bounded scale at the
 *  data's minimum: two athletes on the same board must share an axis or the
 *  comparison is a lie. */
function bounds(metric: MetricDef, all: readonly (number | null)[]): { min: number; max: number; ticks: number[] } {
  if (metric.axis) {
    const [lo, hi] = metric.axis;
    return { min: lo, max: hi, ticks: metric.ticks ? [...metric.ticks] : [lo, hi] };
  }
  const vals = all.filter((v): v is number => v !== null);
  if (vals.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.15 || 1;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const step = (max - min) / 4;
  return { min, max, ticks: [0, 1, 2, 3, 4].map((i) => min + i * step) };
}

/** Least-squares fit over the real points, returned in the same Band shape so
 *  the chart needs no second code path. Every day gets a value, so the line is
 *  continuous across gaps — which is correct for a trend and wrong for a
 *  series, and is exactly why only the bar boards use it. Fewer than two real
 *  points is not a trend, and returns the series untouched. */
function trendLine(series: readonly Band[]): Band[] {
  const pts = series.map((p, i) => ({ i, v: p.value })).filter((p): p is { i: number; v: number } => p.v !== null);
  if (pts.length < 2) return [...series];
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.i, 0);
  const sy = pts.reduce((s, p) => s + p.v, 0);
  const sxy = pts.reduce((s, p) => s + p.i * p.v, 0);
  const sxx = pts.reduce((s, p) => s + p.i * p.i, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return [...series];
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const first = pts[0]!.i;
  const last = pts[pts.length - 1]!.i;
  // Drawn only across the span that has data: extrapolating a trend into days
  // nobody logged would invent the very thing this app refuses to invent.
  return series.map((p, i) => ({
    ...p,
    value: i < first || i > last ? null : intercept + slope * i,
  }));
}

function xLabelsFor(series: readonly Band[]): string[] {
  if (series.length === 0) return [];
  const pick = [0, Math.floor(series.length / 3), Math.floor((2 * series.length) / 3), series.length - 1];
  return [...new Set(pick)].map((i) => {
    const d = series[i]?.date;
    if (!d) return '';
    const dt = new Date(`${d}T12:00:00Z`);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  });
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, timezone, tier } = await requireStaff();
  /* Read from requireStaff(), which has already resolved the Basic-plan
   * preview through effectiveTier() — so this screen shows a previewing admin
   * exactly what a Basic club sees, and effectiveTier() guarantees a preview
   * can only ever resolve DOWNWARD. Two separate entitlements live on this
   * page and they are not the same rule:
   *   - the Training load board's metric IS GPS, so on Basic the board is
   *     replaced by a locked panel (§2.3 row 26);
   *   - the bar chart is Premium on its own (§3.3, "the bar chart is Premium,
   *     the builder is not"), so the Gym volume board stays — gym volume is a
   *     Both-tier metric — and loses only its bars, keeping the trend line.
   * Getting that second one wrong in the other direction is what §3.3 was
   * written to correct, so it is spelled out here rather than inferred. */
  const premium = isPremium(tier);

  /* WHOLE SCREEN, NOT JUST THE BAR CHART, ON BASIC. 12-product-tiers.md §2.3
   * row 27 and §3.3 both say the Analytics screen is on both plans and only
   * the bar-chart view is Premium; the club has since asked for the screen
   * itself to be Premium, and this is that decision. The doc is amended
   * alongside rather than left to contradict the code (CLAUDE.md §5).
   *
   * Gated at the ROUTE, not only hidden from the sidebar: a hidden link is a
   * decoration, and /analytics typed into the address bar has to refuse too. */
  if (!premium) {
    return (
      <PlanGate
        featureName="Analytics"
        body="Per-athlete trends and comparisons across wellness, load and gym volume, including the bar chart that ranks a metric across the squad."
        metadata="Premium · analytics · trend and bar views"
      />
    );
  }

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [groups, athletes] = await Promise.all([
    fetchGroups(db, orgId),
    fetchBuilderAthletes(db, orgId, groupIds),
  ]);
  const scopeLabel = groupScopeLabel(groups, groupIds);

  /* Athlete A defaults to the first in scope so the screen is never empty on
   * arrival. Athlete B is opt-in: `compare` off is one athlete, which is the
   * honest default when nobody has asked for a comparison. */
  const aId = typeof params.a === 'string' && athletes.some((x) => x.id === params.a) ? params.a : (athletes[0]?.id ?? null);
  const comparing = params.compare === '1';
  const bId =
    comparing && typeof params.b === 'string' && athletes.some((x) => x.id === params.b) && params.b !== aId
      ? params.b
      : comparing
        ? (athletes.find((x) => x.id !== aId)?.id ?? null)
        : null;

  const a = athletes.find((x) => x.id === aId) ?? null;
  const b = athletes.find((x) => x.id === bId) ?? null;

  const today = todayIso(timezone);
  const qs = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const groupsQs = Array.isArray(params.groups) ? params.groups.join(',') : params.groups;
    if (groupsQs) sp.set('groups', groupsQs);
    if (aId) sp.set('a', aId);
    if (bId) sp.set('b', bId);
    if (comparing) sp.set('compare', '1');
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) sp.delete(k);
      else sp.set(k, v);
    }
    const q = sp.toString();
    return q ? `?${q}` : '';
  };

  /* Per-board metric and window, each on its own URL key so one board's choice
   * never moves another's. Both are clamped server-side against the same lists
   * the dropdowns are built from — a metric arriving in the URL is untrusted
   * input, and on Basic that matters: honouring `?mwellness=gps_distance` would
   * put GPS in front of a club that has not bought it, which is the entitlement
   * leak this screen already had once. Falls back to the board's own default,
   * so a stale or hand-edited link degrades to the designed view. */
  const metricOptions = METRICS.filter((m) => premium || m.source !== 'gps');
  const resolveMetric = (board: Board): MetricDef => {
    const raw = params[`m${board.key}`];
    const picked = typeof raw === 'string' ? metricOptions.find((m) => m.key === raw) : undefined;
    return picked ?? metricFor(board.metric);
  };
  const resolveDays = (board: Board): number => {
    const raw = params[`w${board.key}`];
    const picked = typeof raw === 'string' ? WINDOWS.find((w) => String(w.days) === raw) : undefined;
    return picked?.days ?? board.days;
  };

  const boardData = a
    ? await Promise.all(
        BOARDS.filter((board) => premium || !board.gpsMetric).map(async (board) => {
          const metric = resolveMetric(board);
          const days = resolveDays(board);
          const range = { from: addDays(today, -(days - 1)), to: today };
          const [ra, rb] = await Promise.all([
            fetchMetricSeries(db, orgId, metric, range, groupIds, a.id),
            b ? fetchMetricSeries(db, orgId, metric, range, groupIds, b.id) : Promise.resolve(null),
          ]);
          return { board, metric, days, seriesA: ra.series, seriesB: rb?.series ?? null, daysWithData: ra.daysWithData };
        }),
      )
    : [];

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            {scopeLabel.toUpperCase()} · {orgName.toUpperCase()}
          </p>
          <h1>Analytics</h1>
        </div>
        <div className="cmp-athletes">
          {a ? (
            <div className="cmp-picker">
              <span className="dash-avatar" aria-hidden="true">
                {initials(a)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="cmp-picker-name" style={{ display: 'block' }}>
                  {a.last_name}, {a.first_name}
                </span>
                <span className="cmp-picker-meta">{a.position ?? 'no position on file'}</span>
              </span>
            </div>
          ) : null}
          {b ? (
            <div className="cmp-picker" data-secondary="true">
              <span className="dash-avatar" aria-hidden="true">
                {initials(b)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="cmp-picker-name" style={{ display: 'block' }}>
                  {b.last_name}, {b.first_name}
                </span>
                <span className="cmp-picker-meta">{b.position ?? 'no position on file'}</span>
              </span>
            </div>
          ) : null}
          {/* A link, not a switch: this page is server-rendered and the whole
              comparison is a URL. Reloadable, shareable, back-button-safe. */}
          <Link
            href={`/analytics${qs({ compare: comparing ? undefined : '1' })}`}
            className="squad-chip"
            aria-pressed={comparing}
          >
            Compare two
          </Link>
        </div>
      </div>

      <div className="cmp-against" style={{ marginBottom: 14 }}>
        <span className="cmp-against-label">Compare against</span>
        <GroupFilter groups={groups} selected={groupIds} />
        <span className="cmp-against-n">
          n = {athletes.length} · {scopeLabel.toLowerCase()}
        </span>
      </div>

      {!a ? (
        <div className="empty">
          <h2>Nobody in scope</h2>
          <p>
            The group filter resolves to no athletes, so there is nothing to chart. Widen it
            and the four boards return.
          </p>
        </div>
      ) : (
        <div className="cmp-grid">
          {/* Where the Training load board sits on Premium. Named, not simply
              absent: a coach who has seen this screen on another club's plan
              and finds a board missing needs to know it is their plan, not a
              fault or a data gap. */}
          {premium ? null : (
            <PlanGateCard
              heading="Training load is a Premium board"
              body="Weekly GPS distance per athlete, as bars with a trend line over them. It reads from GPS records, which arrive through the Premium import. Everything else on this screen is on your plan: wellness against each athlete's own baseline, gym volume, and the acute:chronic ratio — which your plan computes from RPE and session duration."
              metadata="Premium · GPS distance · 12 weeks"
              style={{ marginBottom: 14 }}
            />
          )}
          {boardData.map(({ board, metric, days, seriesA, seriesB }) => {
            const all = [...seriesA.map((p) => p.value), ...(seriesB ?? []).map((p) => p.value)];
            const scale = board.acwrBand
              ? { min: 0.5, max: 2, ticks: [0.5, 1.0, 1.5, 2.0] }
              : bounds(metric, all);
            // Bars are the Premium capability; the trend line over them is not.
            const showBars = board.bars && premium;
            const lineA = board.trend ? trendLine(seriesA) : seriesA;
            const lineB = seriesB ? (board.trend ? trendLine(seriesB) : seriesB) : null;
            const primary: ChartSeries = { points: lineA, label: a.last_name, colour: board.colour };
            const secondary: ChartSeries | null = lineB
              ? { points: lineB, label: b!.last_name, colour: 'var(--cmp-b)', dashed: true }
              : null;
            /* The wellness band is the PRIMARY athlete's own trailing ±1SD,
             * which is what the card's own subtitle promises — "each against
             * his own baseline, never the squad average". Taken from the last
             * day that has one rather than averaged, so it is a real band. */
            const lastBand = [...seriesA].reverse().find((p) => p.mean !== null && p.sd !== null);
            const shaded = board.acwrBand
              ? { from: ACWR_BAND_LOW, to: ACWR_BAND_HIGH }
              : board.key === 'wellness' && lastBand?.mean != null && lastBand.sd != null
                ? { from: lastBand.mean - lastBand.sd, to: lastBand.mean + lastBand.sd }
                : null;

            return (
              <section key={board.key} className="card" aria-labelledby={`b-${board.key}`}>
                <div className="cmp-card-head">
                  {/* The title stands alone. The subtitle under it restated
                      what the chart's own axes and legend already showed, on
                      every one of the four cards, and cost the plot the height
                      it took. */}
                  <h2 className="cmp-card-title" id={`b-${board.key}`}>
                    {board.title}
                  </h2>
                  <div className="cmp-card-controls">
                    <ReportSelectNav
                      stacked
                      label="Metric"
                      paramKey={`m${board.key}`}
                      value={metric.key}
                      options={metricOptions.map((m) => ({ value: m.key, label: m.label }))}
                      clearValue={board.metric}
                      ariaLabel={`Metric for the ${board.title} chart`}
                    />
                    <ReportSelectNav
                      stacked
                      label="Window"
                      paramKey={`w${board.key}`}
                      value={String(days)}
                      options={WINDOWS.map((w) => ({ value: String(w.days), label: w.label }))}
                      clearValue={String(board.days)}
                      ariaLabel={`Timeframe for the ${board.title} chart`}
                    />
                  </div>
                </div>

                <ComparisonChart
                  primary={primary}
                  secondary={secondary}
                  bars={showBars ? weekly(seriesA) : undefined}
                  min={scale.min}
                  max={scale.max}
                  ticks={scale.ticks}
                  shaded={shaded}
                  thresholds={board.acwrBand ? [ACWR_BAND_LOW, ACWR_BAND_HIGH] : undefined}
                  decimals={metric.decimals}
                  xLabels={xLabelsFor(seriesA)}
                />

                <div className="cmp-legend">
                  <span className="cmp-legend-item">
                    <span className="cmp-legend-key" style={{ borderTopColor: board.colour }} />
                    {a.last_name}
                  </span>
                  {b ? (
                    <span className="cmp-legend-item">
                      <span
                        className="cmp-legend-key"
                        style={{ borderTopColor: 'var(--cmp-b)', borderTopStyle: 'dashed' }}
                      />
                      {b.last_name}
                    </span>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

    </>
  );
}
