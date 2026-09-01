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
  sub: string;
  days: number;
  windowLabel: string;
  colour: string;
  /** Weekly bars for athlete A behind the lines. The two rate/ratio boards do
   *  not get them — a bar chart of a ratio invites reading area as meaning. */
  bars: boolean;
  /** The 0.8–1.5 convention, drawn only on ACWR. */
  acwrBand?: true;
};

const BOARDS: Board[] = [
  {
    key: 'load',
    metric: 'gps_distance',
    title: 'Training load',
    sub: 'weeks as bars, a trend line per athlete',
    days: 84,
    windowLabel: '12 weeks',
    colour: 'var(--accent)',
    bars: true,
  },
  {
    key: 'wellness',
    metric: 'readiness',
    title: 'Wellness',
    sub: 'each against his own baseline, never the squad average',
    days: 28,
    windowLabel: '28 days',
    colour: 'var(--good)',
    bars: false,
  },
  {
    key: 'gym',
    metric: 'gym_volume',
    title: 'Gym volume',
    sub: 'tonnage lifted per week',
    days: 56,
    windowLabel: '8 weeks',
    colour: 'var(--domain-gym)',
    bars: true,
  },
  {
    key: 'acwr',
    metric: 'acwr',
    title: 'Acute:chronic ratio',
    sub: '7-day load over the 28-day weekly mean',
    days: 84,
    windowLabel: '12 weeks',
    colour: 'var(--accent)',
    bars: false,
    acwrBand: true,
  },
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
  const { db, orgId, orgName, timezone } = await requireStaff();
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

  const boardData = a
    ? await Promise.all(
        BOARDS.map(async (board) => {
          const metric = metricFor(board.metric);
          const range = { from: addDays(today, -(board.days - 1)), to: today };
          const [ra, rb] = await Promise.all([
            fetchMetricSeries(db, orgId, metric, range, groupIds, a.id),
            b ? fetchMetricSeries(db, orgId, metric, range, groupIds, b.id) : Promise.resolve(null),
          ]);
          return { board, metric, seriesA: ra.series, seriesB: rb?.series ?? null, daysWithData: ra.daysWithData };
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
          {boardData.map(({ board, metric, seriesA, seriesB, daysWithData }) => {
            const all = [...seriesA.map((p) => p.value), ...(seriesB ?? []).map((p) => p.value)];
            const scale = board.acwrBand
              ? { min: 0.5, max: 2, ticks: [0.5, 1.0, 1.5, 2.0] }
              : bounds(metric, all);
            const primary: ChartSeries = { points: seriesA, label: a.last_name, colour: board.colour };
            const secondary: ChartSeries | null = seriesB
              ? { points: seriesB, label: b!.last_name, colour: 'var(--cmp-b)', dashed: true }
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
                  <div style={{ minWidth: 0 }}>
                    <h2 className="cmp-card-title" id={`b-${board.key}`}>
                      {board.title}
                    </h2>
                    <p className="cmp-card-sub">{board.sub}</p>
                  </div>
                  <div className="cmp-card-controls">
                    <span className="chip-static">{metric.label}</span>
                    <span className="chip-static">{board.windowLabel}</span>
                  </div>
                </div>

                <ComparisonChart
                  primary={primary}
                  secondary={secondary}
                  bars={board.bars ? weekly(seriesA) : undefined}
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
                  <span className="cmp-legend-note">
                    {board.acwrBand
                      ? `shaded ${ACWR_BAND_LOW}–${ACWR_BAND_HIGH} is a convention, not a threshold · n = ${daysWithData} days with data`
                      : board.key === 'wellness'
                        ? `band is ±1 SD of ${a.last_name}'s norm · n = ${daysWithData} of ${board.days} days`
                        : `bars are ${a.last_name}'s weekly total · n = ${daysWithData} days with data`}
                  </span>
                </div>
              </section>
            );
          })}
        </div>
      )}

    </>
  );
}
