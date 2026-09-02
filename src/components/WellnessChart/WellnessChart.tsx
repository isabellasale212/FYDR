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
  /** IANA zone used to format the date labels on the x-axis. */
  timezone: string;
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
  timezone,
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

  /* The athlete's own daily values, joined up.
   *
   * These used to be drawn only as isolated dots while the ROLLING MEAN got
   * the one solid line — so the most prominent shape on an athlete's own
   * chart was a smoothed average, and their actual day-to-day story was
   * scattered specks. That inversion is the main reason this read as "too
   * complex": the eye follows the line, and the line was the wrong series.
   * Now the value is the line and the mean is the quiet reference behind it.
   *
   * Split into segments at every missing day rather than drawn as one path,
   * so a gap stays a visible break. Interpolating across a day the athlete
   * did not submit would invent a reading, which rule 7 forbids and which
   * would also quietly flatter their consistency. */
  const valueSegments: string[] = [];
  let current: string[] = [];
  series.forEach((b, i) => {
    if (b.value === null) {
      if (current.length > 1) valueSegments.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(clamp(b.value)).toFixed(1)}`);
  });
  if (current.length > 1) valueSegments.push(current.join(' '));

  // "Where am I now" is the question an athlete opens this chart to answer,
  // so the latest real reading gets a ring and its number, and nothing else
  // competes with it.
  const lastWithValue = [...series].reverse().find((b) => b.value !== null);
  const lastIndex = lastWithValue ? series.findIndex((b) => b.date === lastWithValue.date) : -1;

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
              fontFamily="var(--font-sora)"
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

        {/* The mean, demoted to a quiet dashed reference — it is context for
            the band, not the story. */}
        {meanPath ? (
          <path
            d={meanPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.25}
            strokeDasharray="3,4"
            opacity={0.5}
            strokeLinejoin="round"
          />
        ) : null}

        {/* The athlete's own readings, now the most prominent line. */}
        {valueSegments.map((d) => (
          <path
            key={d.slice(0, 24)}
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {series.map((b, i) => {
          if (b.value === null) return null;
          const position = bandPosition(b);
          const cx = x(i);
          const cy = y(clamp(b.value));
          const isLast = i === lastIndex;

          // Outside-the-band days keep their own colour, but as dots rather
          // than up/down triangles: the triangle direction duplicated what
          // the dot's own height already says, and read as a third symbol to
          // decode. Colour alone is not the only channel — the caption below
          // the chart counts these in words too.
          const fill =
            position === 'above' ? 'var(--warn)' : position === 'below' ? 'var(--bad)' : 'var(--accent)';

          return (
            <g key={b.date}>
              {isLast ? (
                <circle cx={cx} cy={cy} r={7} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.45} />
              ) : null}
              <circle cx={cx} cy={cy} r={isLast ? 4.5 : 3.2} fill={fill} />
            </g>
          );
        })}

        {/* Today's number, spelled out — the one value most athletes open
            this chart to read, rather than estimating it off the axis. */}
        {lastWithValue && lastIndex >= 0 ? (
          <text
            x={Math.min(x(lastIndex) + 10, W - MR)}
            y={y(clamp(lastWithValue.value!)) - 10}
            textAnchor={lastIndex > series.length - 3 ? 'end' : 'start'}
            fontFamily="var(--font-sora)"
            fontSize={13}
            fontWeight={700}
            fill="var(--text)"
          >
            {lastWithValue.value!.toFixed(decimals)}
          </text>
        ) : null}

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
              fontFamily="var(--font-sora)"
              fontSize={10}
              fill="var(--faint)"
            >
              {formatDate(point.date, timezone)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
