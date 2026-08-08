import type { SparklinePoint } from '@/lib/queries/trainingReport';

type Props = {
  points: readonly SparklinePoint[];
  endTone: string; // a var(--token) reference, matching the athlete's band colour
};

/** TRAINING-REPORT-SPEC.md §8's selected-athlete sparkline, hand-built SVG
 *  per this app's own no-chart-library convention (WellnessChart.tsx is the
 *  precedent). 14 points at x = round(i/13 × 600); y padded 8%/6% off the
 *  real min/max in the series, not a fixed scale — the spec's own formula,
 *  ported directly. Fewer than 2 real points can't draw a line at all. */
export function TrainingSparkline({ points, endTone }: Props) {
  if (points.length < 2) {
    return <p className="tiny">Not enough session history yet to draw a trend.</p>;
  }

  const values = points.map((p) => p.hsr);
  const lo = Math.min(...values) * 0.92;
  const hi = Math.max(...values) * 1.06;
  const span = hi - lo || 1;

  const coords = points.map((p, i) => ({
    x: Math.round((i / (points.length - 1)) * 600),
    y: 82 - ((p.hsr - lo) / span) * 74,
  }));

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y.toFixed(1)}`).join(' ');
  const fill = `${line} L600 90 L0 90 Z`;
  const last = coords[coords.length - 1]!;

  return (
    <div className="tr-sparkline-wrap">
      <svg viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
        <path d={fill} fill="rgb(var(--accent2-rgb) / 0.14)" />
        <path d={line} fill="none" stroke="var(--accent2)" strokeWidth={2.4} strokeLinejoin="round" />
        <circle cx={600} cy={last.y} r={5} fill={endTone} />
      </svg>
    </div>
  );
}
