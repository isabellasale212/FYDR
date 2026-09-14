'use client';

import { useId, useState, type CSSProperties } from 'react';
import { fmt } from '@/lib/analyticsPanels';

/** PATTERN-S7 C6: one panel's plot. Bars for one athlete (two for a
 *  comparison, both `--accent`, each named at the end of its own bars); the
 *  ground behind them — the squad's spread as two dashed `--tick` edges, or
 *  the club's zone as a `--track` fill; a 2px dashed stub where a period has
 *  nothing; and the readout — hover shows, leaving hides, a tap pins the same
 *  chip until the next tap on a bar or anywhere else in the plot. Nothing
 *  else moves: no crosshair, no animation, no reflow. Every value is also
 *  in the visually-hidden table beneath, so nothing is on hover alone. */

export type PanelSeries = { label: string; values: readonly (number | null)[] };
export type PanelBucket = { label: string; long: string };
export type PanelBand = { lo: number; hi: number } | null;

type Props = {
  title: string;
  unit: string;
  decimals: number;
  missingWord: string;
  buckets: readonly PanelBucket[];
  a: PanelSeries;
  b: PanelSeries | null;
  /** Per bucket; null where the squad floor withholds it. Null altogether when a zone is drawn instead. */
  band: readonly PanelBand[] | null;
  zone: { lo: number | null; hi: number | null } | null;
  top: number;
  axisLine: string;
};

const H = 220;
const W = 1000;
const PAD_TOP = 30;
const BASE = H - 24;

export function AnalyticsPanel({ title, unit, decimals, missingWord, buckets, a, b, band, zone, top, axisLine }: Props) {
  const [readout, setReadout] = useState<{ i: number; pinned: boolean } | null>(null);
  const tableId = useId();
  const n = buckets.length;
  const slot = W / Math.max(1, n);
  const gap = Math.min(slot * 0.25, 14);
  const barsPer = b ? 2 : 1;
  const barW = (slot - gap) / barsPer;
  const y = (v: number) => BASE - (Math.min(v, top) / top) * (BASE - PAD_TOP);
  const xOf = (i: number, series: 0 | 1) => i * slot + gap / 2 + series * barW;
  const centre = (i: number) => i * slot + slot / 2;

  const show = (i: number) => setReadout((cur) => (cur?.pinned ? cur : { i, pinned: false }));
  const hide = () => setReadout((cur) => (cur?.pinned ? cur : null));
  const tap = (i: number) => setReadout((cur) => (cur?.pinned && cur.i === i ? null : { i, pinned: true }));

  const words = (v: number | null) => (v === null ? missingWord : `${fmt(v, decimals)}${unit}`);
  const chip = readout
    ? b
      ? `${buckets[readout.i]!.long} · ${a.label} ${words(a.values[readout.i] ?? null)} · ${b.label} ${words(b.values[readout.i] ?? null)}`
      : `${buckets[readout.i]!.long} · ${words(a.values[readout.i] ?? null)}`
    : null;

  /* The band's two edges as step paths, broken where a bucket is withheld. */
  const edgePath = (pick: (e: { lo: number; hi: number }) => number): string => {
    if (!band) return '';
    let d = '';
    let open = false;
    band.forEach((e, i) => {
      if (!e) { open = false; return; }
      const yy = y(pick(e));
      const x0 = i * slot;
      const x1 = x0 + slot;
      d += open ? ` L${x0} ${yy} L${x1} ${yy}` : ` M${x0} ${yy} L${x1} ${yy}`;
      open = true;
    });
    return d.trim();
  };

  const lastIndex = (s: PanelSeries) => { for (let i = s.values.length - 1; i >= 0; i -= 1) if (s.values[i] !== null) return i; return -1; };
  const labelFor = (s: PanelSeries, series: 0 | 1) => {
    const i = lastIndex(s);
    if (i < 0) return null;
    const v = s.values[i]!;
    return { top: `${(y(v) / H) * 100}%`, left: `${((xOf(i, series) + barW / 2) / W) * 100}%`, label: s.label };
  };

  return (
    <div className="ap-plot" onClick={() => setReadout((cur) => (cur?.pinned ? null : cur))} data-readout={readout ? (readout.pinned ? 'pinned' : 'hover') : 'none'}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} role="img" aria-labelledby={`${tableId}-cap`} style={{ display: 'block', overflow: 'visible' }}>
        {zone ? (
          <>
            <rect x={0} y={y(zone.hi ?? top)} width={W} height={Math.max(0, y(zone.lo ?? 0) - y(zone.hi ?? top))} fill="var(--track)" data-zone />
            {zone.hi !== null ? <line x1={0} x2={W} y1={y(zone.hi)} y2={y(zone.hi)} stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" /> : null}
            {zone.lo !== null ? <line x1={0} x2={W} y1={y(zone.lo)} y2={y(zone.lo)} stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" /> : null}
          </>
        ) : band ? (
          <>
            <path d={edgePath((e) => e.hi)} fill="none" stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" data-band-edge="hi" />
            <path d={edgePath((e) => e.lo)} fill="none" stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" data-band-edge="lo" />
          </>
        ) : null}
        <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {buckets.map((bk, i) => {
          const series: [PanelSeries, 0 | 1][] = b ? [[a, 0], [b, 1]] : [[a, 0]];
          return (
            <g
              key={bk.label + i}
              onMouseEnter={() => show(i)}
              onMouseLeave={hide}
              onClick={(e) => { e.stopPropagation(); tap(i); }}
              style={{ cursor: 'pointer' }}
              data-bucket={i}
            >
              {/* The hit area is the whole slot so a stub is as tappable as a bar. */}
              <rect x={i * slot} y={PAD_TOP} width={slot} height={BASE - PAD_TOP + 8} fill="transparent" />
              {series.map(([s, k]) => {
                const v = s.values[i] ?? null;
                if (v === null) {
                  return <line key={k} x1={xOf(i, k) + 1} x2={xOf(i, k) + barW - 1} y1={BASE - 1} y2={BASE - 1} stroke="var(--tick)" strokeWidth={2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" data-stub />;
                }
                return <rect key={k} x={xOf(i, k)} y={y(v)} width={barW} height={Math.max(1, BASE - y(v))} fill="var(--accent)" opacity={readout && readout.i !== i ? 0.55 : 1} data-bar={k} />;
              })}
            </g>
          );
        })}
      </svg>
      {b ? (
        [labelFor(a, 0), labelFor(b, 1)].map((l, k) =>
          l ? (
            <span key={k} className="ap-series-label" style={{ top: l.top, left: l.left } as CSSProperties} data-series-label={k}>
              {l.label}
            </span>
          ) : null,
        )
      ) : null}
      {chip && readout ? (
        <span className="ap-readout" role="status" style={{ left: `${(centre(readout.i) / W) * 100}%` } as CSSProperties} data-readout-chip>
          {chip}
        </span>
      ) : null}
      {/* The periods, printed: the first bar, the middle and the last, so a
          bar's place in the window is readable without a pointer. */}
      <div className="ap-x" aria-hidden="true">
        <span>{buckets[0]?.label}</span>
        {n > 2 ? <span>{buckets[Math.floor((n - 1) / 2)]?.label}</span> : null}
        {n > 1 ? <span>{buckets[n - 1]?.label}</span> : null}
      </div>
      <p className="ap-axis" data-axis-line>{axisLine}</p>
      <table className="visually-hidden" id={tableId}>
        <caption id={`${tableId}-cap`}>{title}: every bar&rsquo;s value</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{a.label}</th>
            {b ? <th scope="col">{b.label}</th> : null}
            {band ? <th scope="col">Squad band</th> : null}
          </tr>
        </thead>
        <tbody>
          {buckets.map((bk, i) => (
            <tr key={bk.label + i}>
              <td>{bk.long}</td>
              <td>{words(a.values[i] ?? null)}</td>
              {b ? <td>{words(b.values[i] ?? null)}</td> : null}
              {band ? <td>{band[i] ? `${fmt(band[i]!.lo, decimals)} to ${fmt(band[i]!.hi, decimals)}${unit}` : 'Withheld'}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
