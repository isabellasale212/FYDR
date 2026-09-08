import type { Band } from '@/lib/stats';

export type ChartSeries = {
  /** One entry per calendar day, in order. A null value is a real gap and is
   *  drawn as one — the line breaks rather than joining across it. */
  points: readonly Band[];
  label: string;
  colour: string;
  dashed?: boolean;
};

type Props = {
  /** Athlete A, always present. Solid, in the card's own colour. */
  primary: ChartSeries;
  /** Athlete B, only while comparing. Violet and dashed, per the design's own
   *  caption: "Selby solid in the card's own colour · Fox violet and dashed". */
  secondary?: ChartSeries | null;
  /** Weekly bars behind the lines. Training load and Gym volume draw them; the
   *  two ratio/scale boards do not. Bars belong to the PRIMARY athlete only —
   *  two overlaid bar sets would be unreadable, which is why the design shows
   *  bars for one athlete and a trend line for each. */
  bars?: readonly { label: string; value: number | null; tone?: 'normal' | 'bad' }[];
  min: number;
  max: number;
  ticks: readonly number[];
  /** Shaded horizontal band: ±1SD of the primary athlete's own norm (Wellness),
   *  or the 0.8–1.5 convention (ACWR). */
  shaded?: { from: number; to: number } | null;
  /** Dashed horizontal rules, drawn on top of the shaded band's edges. */
  thresholds?: readonly number[];
  decimals?: number;
  /** x-axis labels, evenly spaced. Fewer than the data points on purpose. */
  xLabels: readonly string[];
  height?: number;
  /** The rgb triple the bars and the shaded band tint from, as a var()
   *  reference — e.g. 'var(--chart-load-rgb)'.
   *
   *  IT USED TO BE --accent-rgb, HARDCODED. That was invisible while every
   *  board's line was also the accent, and became wrong the moment the four
   *  boards took the chart spec's own colours: Training load drew product-blue
   *  bars behind a chart-blue trend line, and Wellness drew a blue ±1SD band
   *  behind a cyan line. Defaults to the accent so nothing that does not pass
   *  it changes. */
  tintRgb?: string;
};

const W = 560;
const PAD_L = 46;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 26;

function fmt(v: number, d: number): string {
  return v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/* The four Analytics boards share one chart. It is server-rendered SVG with no
 * client JS, like every other chart in this app: these are read, not
 * interrogated, and a coach opening the screen at 07:00 should not wait for a
 * charting bundle.
 *
 * Everything it draws is a real value or is absent. A null day breaks the line
 * rather than interpolating across it, and a bar with no value is simply not
 * drawn — the design system's own data rule 1 ("a missing entry is never
 * zero"), which on a chart is the difference between a rest day and a day an
 * athlete did not log. */
export function ComparisonChart({
  primary,
  secondary,
  bars,
  min,
  max,
  ticks,
  shaded,
  tintRgb = 'var(--accent-rgb)',
  thresholds,
  decimals = 0,
  xLabels,
  height = 210,
}: Props) {
  const H = height;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const span = max - min || 1;
  const y = (v: number) => PAD_T + innerH - ((v - min) / span) * innerH;

  const pathFor = (s: ChartSeries): string[] => {
    const n = s.points.length;
    if (n === 0) return [];
    const x = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    // Segments, not one path: a null day ends the current run and the next
    // real value starts a new one, so a gap reads as a gap.
    const segments: string[] = [];
    let current: string[] = [];
    s.points.forEach((p, i) => {
      if (p.value === null) {
        if (current.length > 1) segments.push(current.join(' '));
        current = [];
        return;
      }
      const clamped = Math.min(max, Math.max(min, p.value));
      current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(clamped).toFixed(1)}`);
    });
    if (current.length > 1) segments.push(current.join(' '));
    return segments;
  };

  const barMax = bars && bars.length > 0 ? Math.max(...bars.map((b) => b.value ?? 0), 1) : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="cmp-chart"
      role="img"
      /* The bar denominator lives here now. The footnote under each chart was
         removed in the design review, and with it went "n = N days with data" —
         which on a sparse board is the difference between a flat stretch and an
         empty one. A week with no record draws no bar, and a missing bar and a
         zero bar look identical, so the count says which. */
      aria-label={`${primary.label}${secondary ? ` compared with ${secondary.label}` : ''}${
        bars && bars.length > 0
          ? `. ${bars.filter((b) => b.value !== null).length} of ${bars.length} weeks have a record; a week with none draws no bar.`
          : ''
      }`}
    >
      {shaded ? (
        <rect
          x={PAD_L}
          y={y(Math.min(max, shaded.to))}
          width={innerW}
          height={Math.max(0, y(Math.max(min, shaded.from)) - y(Math.min(max, shaded.to)))}
          fill={`rgb(${tintRgb} / 0.10)`}
        />
      ) : null}

      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--hair)" strokeWidth={1} />
          <text x={PAD_L - 8} y={y(t) + 3.5} textAnchor="end" className="cmp-chart-axis">
            {fmt(t, decimals)}
          </text>
        </g>
      ))}

      {/* Bars sit behind the lines: they are the primary athlete's own weekly
          totals, context for the trend drawn over them. */}
      {bars?.map((b, i) => {
        if (b.value === null) return null;
        const bw = innerW / bars.length;
        const h = (b.value / barMax) * innerH * 0.9;
        return (
          <rect
            key={`${b.label}-${i}`}
            x={PAD_L + i * bw + bw * 0.18}
            y={PAD_T + innerH - h}
            width={bw * 0.64}
            height={Math.max(0, h)}
            rx={3}
            fill={b.tone === 'bad' ? 'rgb(var(--bad-rgb) / 0.45)' : `rgb(${tintRgb} / 0.22)`}
          >
            {/* Each bar names its own week and total on hover, so the card can
                carry the fact without a caption line restating it for every
                bar at once. */}
            <title>{`${b.label}: ${fmt(b.value, decimals)}`}</title>
          </rect>
        );
      })}

      {thresholds?.map((t) => (
        <line
          key={t}
          x1={PAD_L}
          x2={W - PAD_R}
          y1={y(t)}
          y2={y(t)}
          stroke="var(--warn)"
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />
      ))}

      {secondary
        ? pathFor(secondary).map((d, i) => (
            <path
              key={`s-${i}`}
              d={d}
              fill="none"
              stroke={secondary.colour}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          ))
        : null}

      {pathFor(primary).map((d, i) => (
        <path key={`p-${i}`} d={d} fill="none" stroke={primary.colour} strokeWidth={2.4} strokeLinecap="round" />
      ))}

      {xLabels.map((l, i) => (
        <text
          key={`${l}-${i}`}
          x={PAD_L + (xLabels.length === 1 ? innerW / 2 : (i / (xLabels.length - 1)) * innerW)}
          y={H - 8}
          textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          className="cmp-chart-axis"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}
