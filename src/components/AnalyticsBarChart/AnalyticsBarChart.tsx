import { formatNumber } from '@/lib/format';

export type AnalyticsBar = {
  key: string;
  label: string;
  value: number | null;
  /** The athlete has too little history for this metric to exist (ACWR's
   *  21-of-28 guard). Drawn as a hatched stub with the word, never as a short
   *  bar — a short bar is a low number, and "we do not know" is not a low
   *  number. Same rule WeekLoadChart already keeps for an unscored day. */
  suppressed: boolean;
  /** Colour channel, resolved by the caller from the metric's own band rules
   *  (lib/acwr.ts's acwrBandTone for ACWR). 'neutral' for every metric that
   *  has no band — this component invents no thresholds of its own. */
  tone: 'good' | 'warn' | 'bad' | 'neutral';
};

type Props = {
  bars: readonly AnalyticsBar[];
  unit: string;
  decimals: number;
  /** A shaded reference band in metric units, drawn behind the bars. Only
   *  passed for a metric that HAS a published band (ACWR's 0.8–1.5). */
  band?: readonly [number, number] | null;
  /** The metric's own upper bound where one exists, so a 1-to-5 scale is not
   *  redrawn to a different width every time the squad's best score changes.
   *  The axis still stretches past it if a real value exceeds it. */
  suggestedMax?: number | null;
  /** Read out to a screen reader in place of the drawing. */
  title: string;
};

const W = 880;
const ML = 168; // room for "A. Very-Long-Hyphenated-Name"
const MR = 62; // room for the value printed at the end of each bar
const MT = 6;
const MB = 22;
const ROW = 22;
const BAR = 12;

/**
 * A horizontal bar per athlete. Hand-rolled inline SVG, the same approach as
 * WeekLoadChart, TrainingScatter, TestTrendChart and WellnessChart — there is
 * no charting library anywhere in this app and this does not introduce one.
 *
 * Horizontal, not vertical, for one reason: the category is a person's name.
 * Thirty vertical columns force thirty rotated labels; thirty horizontal rows
 * put the names in a left-aligned column that reads like a list, which is how
 * a coach actually scans a squad.
 *
 * THE AXIS ALWAYS STARTS AT ZERO, even for a metric whose trend chart is
 * drawn on a tighter axis (the 1-to-5 wellness scales are plotted 1–5 as a
 * line, because the interesting movement lives in that range). Bar length
 * encodes magnitude, so a truncated baseline makes a 4.2 look twice a 3.6.
 * A line's position does not encode magnitude the same way, so the two charts
 * legitimately take different axes for the same numbers, and this comment is
 * here so the difference reads as deliberate rather than as a bug.
 */
export function AnalyticsBarChart({ bars, unit, decimals, band = null, suggestedMax = null, title }: Props) {
  /* Every athlete in scope gets a row, including one with no value at all.
     Filtering them out would quietly shorten the squad to whoever happened to
     submit, and "who is missing" is a real answer to a coach's question — the
     stub below says which kind of missing it is. */
  const drawable = bars;
  if (drawable.length === 0) return null;

  const values = bars.map((b) => b.value).filter((v): v is number => v !== null);
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
  // Never zero-width: an all-zero squad still needs an axis to draw against.
  const max = Math.max(0.0001, dataMax, suggestedMax ?? 0, band ? band[1] : 0);

  const H = MT + drawable.length * ROW + MB;
  const x = (v: number) => ML + ((W - ML - MR) * v) / max;

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Bar chart, ${drawable.length} athletes, axis 0 to ${max.toFixed(decimals)}. The same numbers are available as a table from the chart-type control.`}
      >
        {/* The reference band, behind everything, so a bar reads against it
            rather than being coloured in isolation. */}
        {band ? (
          <rect
            x={x(band[0])}
            y={MT}
            width={Math.max(0, x(band[1]) - x(band[0]))}
            height={H - MT - MB}
            fill="rgb(var(--accent-rgb) / 0.10)"
          />
        ) : null}

        <line x1={ML} y1={MT} x2={ML} y2={H - MB} stroke="var(--border)" strokeWidth={1} />

        {drawable.map((b, i) => {
          const cy = MT + i * ROW + ROW / 2;
          const tone =
            b.tone === 'good'
              ? 'var(--good)'
              : b.tone === 'warn'
                ? 'var(--warn)'
                : b.tone === 'bad'
                  ? 'var(--bad)'
                  : 'var(--accent)';
          return (
            <g key={b.key}>
              <text
                x={ML - 8}
                y={cy + 3.5}
                textAnchor="end"
                fontSize={11.5}
                fill="var(--text)"
              >
                {b.label}
              </text>

              {b.suppressed || b.value === null ? (
                <>
                  {/* Hatched stub — a stated absence, not a small value. */}
                  <rect
                    x={ML}
                    y={cy - BAR / 2}
                    width={14}
                    height={BAR}
                    rx={2}
                    fill="var(--track)"
                    stroke="var(--border-strong)"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
                  <text x={ML + 20} y={cy + 3.5} fontSize={10.5} fill="var(--faint)">
                    {b.suppressed ? 'not enough history' : 'no entry in this window'}
                  </text>
                </>
              ) : (
                <>
                  <rect
                    x={ML}
                    y={cy - BAR / 2}
                    width={Math.max(1, x(b.value) - ML)}
                    height={BAR}
                    rx={2}
                    fill={tone}
                  />
                  <text
                    x={Math.min(x(b.value) + 6, W - 4)}
                    y={cy + 3.5}
                    fontFamily="var(--font-sans)"
                    fontSize={10.5}
                    fill="var(--muted)"
                  >
                    {formatNumber(b.value, decimals)}
                    {unit}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Two axis labels only: zero and the top. More gridlines on a
            ranked bar chart is chart-junk — the printed value at the end of
            every bar is the precise read. */}
        <line x1={ML} y1={H - MB} x2={W - MR} y2={H - MB} stroke="var(--border)" strokeWidth={1} />
        <text x={ML} y={H - MB + 14} fontFamily="var(--font-sans)" fontSize={10} fill="var(--faint)">
          0
        </text>
        <text
          x={W - MR}
          y={H - MB + 14}
          textAnchor="end"
          fontFamily="var(--font-sans)"
          fontSize={10}
          fill="var(--faint)"
        >
          {formatNumber(max, decimals)}
          {unit}
        </text>
      </svg>
    </div>
  );
}
