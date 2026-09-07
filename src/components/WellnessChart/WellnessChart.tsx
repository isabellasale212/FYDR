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
  /** 23e's shape: line, band and end dot only — no axis, no date labels, no
   *  callout. Not a taste setting. This SVG has a fixed 880-unit viewBox, so
   *  every length inside it scales with the rendered width, TEXT INCLUDED: in
   *  the athlete's My data card the chart renders 320px wide, a scale of
   *  0.364, and `fontSize={10}` painted at 3.6px (measured render height
   *  4.5px). Those labels were not small, they were unreadable — texture where
   *  text was intended. Widening them would need ~27 user units each and a
   *  44px gutter, on a chart 320px across.
   *
   *  Nothing is lost by dropping them here: the card's own headline states the
   *  latest score, and the caption underneath states the window in words. The
   *  three staff pages that use this chart render it far wider and keep the
   *  full axis. */
  compact?: boolean;
  /** Draw the daily value as a BAR per day instead of a joined line.
   *
   *  The staff athlete report reads one athlete's readiness day by day, and a
   *  line invites the eye to read the slope between two points as a rate —
   *  which for a self-reported daily score it is not. Bars say "these are
   *  seven separate answers", and a day with no submission is then an obvious
   *  gap in a row of bars rather than a slightly longer line segment that a
   *  reader can miss entirely.
   *
   *  What does NOT change with it: the athlete's own +/-1SD band and rolling
   *  mean still draw behind the bars, out-of-band days still take their own
   *  colour, and a missing day still draws nothing at all. The band is the
   *  reason a 62 is readable as low FOR THIS ATHLETE, and dropping it to fit
   *  the bars would have made the chart simpler by making it say less.
   *
   *  Not available with `compact` — the athlete's own card is 320px across
   *  and 62px tall, where 28 bars would be sub-pixel columns. */
  bars?: boolean;
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
  compact = false,
  bars = false,
}: Props) {
  // Bars need room per day; the compact box has none. Compact wins.
  const asBars = bars && !compact;
  /* SPEC §7.3. The compact chart is drawn in a box the size it is rendered at,
     not scaled down from an 880-unit one: viewBox "-6 0 352 92" in a fixed
     62px wrapper, with preserveAspectRatio="none" and
     vector-effect="non-scaling-stroke" on every stroked path.

     That replaces a mark-scale multiplier that stood here. The multiplier was
     a correct reading of a real defect — an 880-unit box rendered 320px wide
     paints strokeWidth={2.5} at 0.9px and r={3.2} at a 1.16px radius, measured
     — but non-scaling-stroke is the actual mechanism for it: a stroke width in
     device pixels regardless of what the viewBox does. Radii still scale, so
     the compact box is sized close to its render instead.

     The viewBox starts at -6, not 0, and the spec is explicit about why: an end
     marker at cx=340 with r=5 inside a "0 0 340" box has half its circle
     outside the viewport. Pad the box, do not move the point. */
  const w = compact ? 340 : W;
  const h = compact ? 92 : H;
  const viewBox = compact ? `-6 0 352 ${h}` : `0 0 ${W} ${h}`;
  const ml = compact ? 0 : ML;
  const mr = compact ? 0 : MR;
  /* The staff-note triangle hangs in the strip above the plot and is 9 units
     tall, so the strip has to be deeper than the mark it holds. */
  const mt = compact ? 14 : MT;
  const mb = compact ? 6 : MB;
  if (series.length < 2) {
    return (
      <p className="cap">
        Not enough history to draw a band. A rolling mean needs several
        observations before it says anything.
      </p>
    );
  }

  const step = (w - ml - mr) / (series.length - 1);
  const x = (i: number) => ml + i * step;
  const y = (v: number) =>
    mt + (h - mt - mb) - ((v - min) / (max - min)) * (h - mt - mb);

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

  // Flag markers sit in the empty strip above the plot (0 to mt), a different vertical
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
    <div className="chart" data-compact={compact ? '' : undefined}>
      <svg
        viewBox={viewBox}
        preserveAspectRatio={compact ? 'none' : undefined}
        role="img"
        aria-label={`${title}. ${series.filter((s) => s.value !== null).length} of ${series.length} days submitted.${flagMarkers.length > 0 ? ` ${flagMarkers.length} day${flagMarkers.length === 1 ? '' : 's'} with a note from staff, listed below the chart.` : ''}`}
      >
        {/* Gridlines and their labels travel together: a gridline with no
            number on it is a line, not a scale. Both go in compact. */}
        {(compact ? [] : ticks).map((t) => (
          <g key={t}>
            <line
              x1={ml}
              y1={y(t)}
              x2={w - mr}
              y2={y(t)}
              stroke="var(--hair)"
              strokeWidth={1}
            />
            <text
              x={ml - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontFamily="var(--font-sans)"
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
            vectorEffect="non-scaling-stroke"
            opacity={0.5}
            strokeLinejoin="round"
          />
        ) : null}

        {/* The athlete's own readings, now the most prominent line. Bars mode
            draws them as columns below instead. */}
        {(asBars ? [] : valueSegments).map((d) => (
          <path
            key={d.slice(0, 24)}
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={compact ? 2.6 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* One bar per day. Width is the day's own share of the plot less a
            gap, floored so a long window still paints something rather than
            thinning to nothing: 28 days across 820 units is 29.3 each, 182
            days is 4.5. The bar sits on the axis, not on `min`, because a
            readiness scale that starts at 0 is the one case where the two are
            the same and a bar that floats would be a lie about its own
            baseline. */}
        {asBars
          ? series.map((b, i) => {
              if (b.value === null) return null;
              const position = bandPosition(b);
              const isLast = i === lastIndex;
              const bw = Math.max(2, Math.min(26, step * 0.66));
              /* The x scale places the first point AT the left margin and the
                 last AT the right one, which is right for a line and wrong for
                 a bar: centring on those two puts half a column outside the
                 plot. The end bars are nudged inside instead of the scale
                 being changed, so bar centres still line up with the band and
                 mean drawn on the same scale behind them. */
              const bx = Math.max(ml, Math.min(w - mr - bw, x(i) - bw / 2));
              const top = y(clamp(b.value));
              const base = y(min);
              const fill =
                position === 'above'
                  ? 'var(--warn)'
                  : position === 'below'
                    ? 'var(--bad)'
                    : 'var(--accent)';
              return (
                <rect
                  key={b.date}
                  x={bx}
                  y={top}
                  width={bw}
                  height={Math.max(1, base - top)}
                  rx={Math.min(2.5, bw / 3)}
                  fill={fill}
                  /* The most recent day is the one the report is opened to
                     read. Every other bar is dimmed rather than the last one
                     being brightened, so an out-of-band colour keeps its full
                     strength on the day it applies to. */
                  opacity={isLast ? 1 : 0.55}
                >
                  {/* Native tooltip. A hover-only affordance is never the only
                      surface for a fact here — the axis and the printed latest
                      value carry it too — so a touch device loses nothing. */}
                  <title>
                    {formatDate(b.date, timezone)}: {b.value.toFixed(decimals)}
                  </title>
                </rect>
              );
            })
          : null}

        {(asBars ? [] : series).map((b, i) => {
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
                <circle cx={cx} cy={cy} r={compact ? 8 : 7} fill="none" stroke={fill} strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.45} />
              ) : null}
              <circle cx={cx} cy={cy} r={compact ? (isLast ? 5 : 3.4) : isLast ? 4.5 : 3.2} fill={fill} />
            </g>
          );
        })}

        {/* Today's number, spelled out — the one value most athletes open
            this chart to read, rather than estimating it off the axis. Not in
            compact: there the card's own headline is already showing it at
            40px, and printing it twice on one card is not emphasis. */}
        {!compact && lastWithValue && lastIndex >= 0 ? (
          <text
            x={Math.min(x(lastIndex) + 10, w - mr)}
            y={y(clamp(lastWithValue.value!)) - 10}
            textAnchor={lastIndex > series.length - 3 ? 'end' : 'start'}
            fontFamily="var(--font-sans)"
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
                y1={mt}
                x2={cx}
                y2={h - mb + 6}
                stroke="var(--accent2)"
                strokeWidth={1}
                strokeDasharray="2,3"
                vectorEffect="non-scaling-stroke"
                opacity={0.45}
              />
              <polygon
                points={`${cx},${mt - 1} ${cx - 4.5},${mt - 9} ${cx + 4.5},${mt - 9}`}
                fill="var(--accent2)"
              >
                <title>{f.tooltip}</title>
              </polygon>
            </g>
          );
        })}

        {compact ? null : (
          <line
            x1={ml}
            y1={h - mb + 6}
            x2={w - mr}
            y2={h - mb + 6}
            stroke="var(--border)"
            strokeWidth={1}
          />
        )}

        {/* The window is stated in words in the caption under this card, so in
            compact these three are a second, less legible copy of it. */}
        {(compact
          ? []
          : [
              { point: first, i: 0, anchor: 'start' as const },
              {
                point: mid,
                i: Math.floor(series.length / 2),
                anchor: 'middle' as const,
              },
              { point: last, i: series.length - 1, anchor: 'end' as const },
            ]
        ).map(({ point, i, anchor }) =>
          point ? (
            <text
              key={`${point.date}-${anchor}`}
              x={x(i)}
              y={h - 8}
              textAnchor={anchor}
              fontFamily="var(--font-sans)"
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
