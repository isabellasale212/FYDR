import type { HistoryRow } from '@/lib/queries/testing';
import { formatDate } from '@/lib/format';

type Props = {
  rows: readonly HistoryRow[];
  unit: string;
  decimalPlaces: number;
  higherIsBetter: boolean;
};

const W = 700;
const H = 200;
const ML = 44;
const MR = 16;
const MT = 16;
const MB = 30;

type SeriesPoint = { date: string; value: number };

/** Audit finding 38: an athlete's test history rendered as a flat list of
 *  numbers with no trend visualisation at all. Same hand-rolled inline-SVG
 *  approach as WeekLoadChart and TrainingScatter (screens/md-planner.md,
 *  screens/training-report.md §8) — no charting library exists anywhere in
 *  this app, and this doesn't introduce one.
 *
 *  One point per session per side: the day's *best* attempt only
 *  (`is_best`), the same value the grid and the PB badge already use as
 *  "the result" for that date — plotting every raw attempt would draw a
 *  trend through warm-up throws and foul jumps, not performance. A
 *  per-side test (side_mode = 'per_side') draws Left and Right as two
 *  separate lines rather than collapsing them, because averaging a left
 *  and a right result together is exactly the kind of asymmetry-hiding
 *  screens/testing.md warns against for bilateral tests.
 *
 *  Per the audit's own S-report finding on this same build (34, "median
 *  over time draws a trend through n=1 points"): a side with fewer than
 *  two dated results renders no line at all, only if every side is that
 *  short does the whole component render nothing and the page falls back
 *  to the plain list below it. */
export function TestTrendChart({ rows, unit, decimalPlaces, higherIsBetter }: Props) {
  const bySide = new Map<string, SeriesPoint[]>();
  for (const r of rows) {
    if (!r.is_best) continue;
    const key = r.side ?? 'bilateral';
    const list = bySide.get(key) ?? [];
    list.push({ date: r.test_date, value: r.value });
    bySide.set(key, list);
  }
  for (const list of bySide.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const chartable = [...bySide.entries()].filter(([, points]) => points.length >= 2);
  if (chartable.length === 0) return null;

  const allDates = [...new Set(chartable.flatMap(([, points]) => points.map((p) => p.date)))].sort((a, b) => a.localeCompare(b));
  const xForDate = new Map(allDates.map((d, i) => [d, i]));

  const allValues = chartable.flatMap(([, points]) => points.map((p) => p.value));
  const rawLo = Math.min(...allValues);
  const rawHi = Math.max(...allValues);
  const pad = (rawHi - rawLo || rawHi * 0.1 || 1) * 0.15;
  const yLo = rawLo - pad;
  const yHi = rawHi + pad;

  const x = (d: string) => ML + (allDates.length <= 1 ? (W - ML - MR) / 2 : ((xForDate.get(d) ?? 0) / (allDates.length - 1)) * (W - ML - MR));
  const y = (v: number) => MT + (H - MT - MB) * (1 - (v - yLo) / (yHi - yLo || 1));

  const COLORS: Record<string, string> = { bilateral: 'var(--accent)', left: 'var(--accent)', right: 'var(--accent2)' };
  const SIDE_LABEL: Record<string, string> = { bilateral: 'Result', left: 'Left', right: 'Right' };

  const yTicks = [yHi, yLo + (yHi - yLo) * 0.5, yLo];
  const dateTicks = allDates.filter((_, i) => i === 0 || i === allDates.length - 1 || i === Math.floor((allDates.length - 1) / 2));

  const rangeDescription = chartable
    .map(([side, points]) => {
      const first = points[0];
      const last = points[points.length - 1];
      return `${SIDE_LABEL[side] ?? side}: ${first?.value.toFixed(decimalPlaces)} to ${last?.value.toFixed(decimalPlaces)} ${unit}`;
    })
    .join('; ');

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <p className="label">Trend</p>
        <p className="tiny" style={{ color: 'var(--muted)' }}>
          {higherIsBetter ? 'higher is better' : 'lower is better'} · best attempt per session
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Line chart of best result per testing session, in ${unit}, ${higherIsBetter ? 'higher is better' : 'lower is better'}. ${rangeDescription}.`}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={ML} y1={y(t)} x2={W - MR} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={ML - 8} y={y(t) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize={9.5} fill="var(--faint)">
              {t.toFixed(decimalPlaces)}
            </text>
          </g>
        ))}
        {dateTicks.map((d) => (
          <text key={d} x={x(d)} y={H - MB + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9.5} fill="var(--faint)">
            {formatDate(d)}
          </text>
        ))}

        {chartable.map(([side, points]) => {
          const color = COLORS[side] ?? 'var(--accent)';
          const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.date)} ${y(p.value)}`).join(' ');
          return (
            <g key={side}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} />
              {points.map((p) => (
                <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={3.5} fill={color} />
              ))}
            </g>
          );
        })}
      </svg>
      {chartable.length > 1 ? (
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          {chartable.map(([side]) => (
            <span key={side} className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: COLORS[side] ?? 'var(--accent)', display: 'inline-block' }} />
              {SIDE_LABEL[side] ?? side}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
