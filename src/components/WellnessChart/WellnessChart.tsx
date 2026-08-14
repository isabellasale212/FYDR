import type { Band } from '@/lib/stats';
import { bandPosition } from '@/lib/stats';
import { formatDate } from '@/lib/format';

/** One dated marker — integration-audit major finding, my-data.md line ~241: "flags
 *  | ... | Dated markers on the chart with the staff note." `date` must match a
 *  `series[].date` exactly (both are plain YYYY-MM-DD strings) or the marker is silently
 *  skipped, same defensive behaviour as the rest of this component around a missing
 *  point. `tooltip` carries the full sentence for the native SVG <title> a mouse hover
 *  reveals; it is deliberately not the only place that text appears — see the caller
 *  (WellnessTab, my-data/page.tsx) for the always-visible FlagNotice list underneath,
 *  which is what actually makes this legible on a touch device. Native <title> tooltips
 *  do not reveal on tap, and this component stays a plain server-rendered SVG with no
 *  chart library and no client JS (this file's own top comment), so a hover-only
 *  affordance can never be this feature's only surface. */
export type FlagMarker = {
  date: string;
  tooltip: string;
};

type Props = {
  series: readonly Band[];
  min: number;
  max: number;
  /** Gridline values, in the units of the series. */
  ticks: readonly number[];
  title: string;
  decimals?: number;
  flags?: readonly FlagMarker[];
};

const W = 880;
const H = 260;
const ML = 44;
const MR = 16;
const MT = 14;
const MB = 30;

/**
 * The wellness chart, hand built in SVG. No chart library, per CONTRACT.md.
 *
 * What it draws, in the order it draws it:
 *   1. the athlete's own +/-1SD band, as an area
 *   2. the athlete's own rolling mean, as a line
 *   3. the daily value, as a dot, with a triangle where it falls outside
 *      his own band
 *
 * A day with no submission has no dot and breaks the value path. It is never
 * drawn as zero and it is never interpolated across, because a missing entry
 * and a bad entry are different facts. CONTRACT.md rule 7.
 */
export function WellnessChart({
  series,
  min,
  max,
  ticks,
  title,
  decimals = 0,
  flags = [],
}: Props) {
  if (series.length < 2) {
    return (
      <p className="cap">
        Not enough history to draw a band. A rolling mean needs several
        observations before it says anything.
      </p>
    );
  }

  const step = (W - ML - MR) / (series.length - 1);
  const x = (i: number) => ML + i * step;
  const y = (v: number) =>
    MT + (H - MT - MB) - ((v - min) / (max - min)) * (H - MT - MB);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const banded = series
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.mean !== null && b.sd !== null);

  const upper = banded
    .map(({ b, i }) => `${x(i).toFixed(1)} ${y(clamp(b.mean! + b.sd!)).toFixed(1)}`)
    .join(' L ');
  const lower = [...banded]
    .reverse()
    .map(({ b, i }) => `${x(i).toFixed(1)} ${y(clamp(b.mean! - b.sd!)).toFixed(1)}`)
    .join(' L ');

  const bandPath = banded.length > 1 ? `M ${upper} L ${lower} Z` : '';

  const meanPath = banded
    .map(
      ({ b, i }, n) =>
        `${n === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(clamp(b.mean!)).toFixed(1)}`,
    )
    .join(' ');

  // Flag markers sit in the empty strip above the plot (0 to MT), a different vertical
  // zone from the per-point above/below-band triangles drawn at the data value itself
  // below, and a different colour (--accent2, never used elsewhere in this chart) — two
  // channels an athlete could otherwise conflate: "this reading was outside your own
  // range" versus "staff looked at something on this date". A date with no matching
  // series entry (should not happen — the caller always passes flag_date values drawn
  // from the same window) is dropped rather than thrown.
  const dateIndex = new Map(series.map((b, i) => [b.date, i]));
  const flagMarkers = flags
    .map((f) => ({ ...f, i: dateIndex.get(f.date) }))
    .filter((f): f is FlagMarker & { i: number } => f.i !== undefined);

  const first = series[0];
  const last = series[series.length - 1];
  const mid = series[Math.floor(series.length / 2)];

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${series.filter((s) => s.value !== null).length} of ${series.length} days submitted.${flagMarkers.length > 0 ? ` ${flagMarkers.length} day${flagMarkers.length === 1 ? '' : 's'} with a note from staff, listed below the chart.` : ''}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={ML}
              y1={y(t)}
              x2={W - MR}
              y2={y(t)}
              stroke="var(--hair)"
              strokeWidth={1}
            />
            <text
              x={ML - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--faint)"
            >
              {t.toFixed(decimals)}
            </text>
          </g>
        ))}

        {bandPath ? (
          <path d={bandPath} fill="rgb(var(--accent-rgb) / 0.14)" stroke="none" />
        ) : null}

        {meanPath ? (
          <path
            d={meanPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : null}

        {series.map((b, i) => {
          if (b.value === null) return null;
          const position = bandPosition(b);
          const cx = x(i);
          const cy = y(clamp(b.value));

          if (position === 'above') {
            return (
              <polygon
                key={b.date}
                points={`${cx},${cy - 5} ${cx - 4.6},${cy + 3.4} ${cx + 4.6},${cy + 3.4}`}
                fill="var(--warn)"
              />
            );
          }
          if (position === 'below') {
            return (
              <polygon
                key={b.date}
                points={`${cx},${cy + 5} ${cx - 4.6},${cy - 3.4} ${cx + 4.6},${cy - 3.4}`}
                fill="var(--bad)"
              />
            );
          }
          return (
            <circle key={b.date} cx={cx} cy={cy} r={2.6} fill="var(--muted)" />
          );
        })}

        {flagMarkers.map((f) => {
          const cx = x(f.i);
          return (
            <g key={`flag-${f.date}`}>
              <line
                x1={cx}
                y1={MT}
                x2={cx}
                y2={H - MB + 6}
                stroke="var(--accent2)"
                strokeWidth={1}
                strokeDasharray="2,3"
                opacity={0.45}
              />
              <polygon
                points={`${cx},${MT - 1} ${cx - 4.5},${MT - 9} ${cx + 4.5},${MT - 9}`}
                fill="var(--accent2)"
              >
                <title>{f.tooltip}</title>
              </polygon>
            </g>
          );
        })}

        <line
          x1={ML}
          y1={H - MB + 6}
          x2={W - MR}
          y2={H - MB + 6}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {[
          { point: first, i: 0, anchor: 'start' as const },
          {
            point: mid,
            i: Math.floor(series.length / 2),
            anchor: 'middle' as const,
          },
          { point: last, i: series.length - 1, anchor: 'end' as const },
        ].map(({ point, i, anchor }) =>
          point ? (
            <text
              key={`${point.date}-${anchor}`}
              x={x(i)}
              y={H - 8}
              textAnchor={anchor}
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--faint)"
            >
              {formatDate(point.date)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
