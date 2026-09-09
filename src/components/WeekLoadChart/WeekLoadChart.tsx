import { mdLabel } from '@/lib/format';

type Bar = { mdOffset: number; total: number; unscored: boolean };

type Props = {
  bars: readonly Bar[];
  title?: string;
};

const W = 700;
const H = 200;
const ML = 40;
const MR = 10;
const MT = 10;
const MB = 28;

/** screens/md-planner.md's WeekLoadChart, reduced: no live drag redraw (no
 *  drag exists in this build), no squad-reference dashed line (needs
 *  mv_acute_chronic_load, out of scope for this pass), no monotony/strain
 *  annotation (O-289, a sports-science threshold this build doesn't
 *  invent). What's kept, because it's the one thing that makes this
 *  screen worth having over a form: MD-n ordered columns, zero-based axis,
 *  unscored days hatched rather than drawn as a false zero — missing is
 *  not zero, the same rule this app's other charts already keep. */
export function WeekLoadChart({ bars, title = 'Weekly load' }: Props) {
  if (bars.length === 0) {
    return <p className="tiny">No positions in this template yet.</p>;
  }
  const max = Math.max(1, ...bars.map((b) => b.total));
  const colWidth = (W - ML - MR) / bars.length;
  const barWidth = Math.min(48, colWidth * 0.6);

  const y = (v: number) => MT + (H - MT - MB) * (1 - v / max);

  return (
    <div>
      <p className="tiny" style={{ marginBottom: 'var(--sp-4)', fontWeight: 600 }}>
        {title} <span className="num" style={{ fontWeight: 400, color: 'var(--muted)' }}>total {bars.reduce((s, b) => s + b.total, 0).toLocaleString()}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Column chart. Planned load by MD-n position, ranging 0 to ${max}.`}>
        <line x1={ML} y1={H - MB} x2={W - MR} y2={H - MB} stroke="var(--border)" strokeWidth={1} />
        {bars.map((b, i) => {
          const cx = ML + colWidth * i + colWidth / 2;
          const barH = b.unscored ? 18 : (H - MT - MB) * (b.total / max);
          const barY = b.unscored ? H - MB - 18 : y(b.total);
          return (
            <g key={b.mdOffset}>
              <rect
                x={cx - barWidth / 2}
                y={barY}
                width={barWidth}
                height={Math.max(1, barH)}
                fill={b.unscored ? 'var(--track)' : 'var(--accent)'}
                stroke={b.unscored ? 'var(--border-strong)' : 'none'}
                strokeDasharray={b.unscored ? '3 2' : undefined}
                rx={3}
              />
              <text x={cx} y={H - MB + 14} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={10} fill="var(--faint)">
                {mdLabel(b.mdOffset) ?? 'off'}
              </text>
              <text x={cx} y={barY - 4} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={9.5} fill="var(--muted)">
                {b.unscored ? 'unscored' : b.total}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
