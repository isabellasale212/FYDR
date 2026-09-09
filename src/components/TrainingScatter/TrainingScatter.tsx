import Link from 'next/link';
import type { ScatterPoint } from '@/lib/queries/trainingReport';

type Props = {
  points: readonly ScatterPoint[];
  selectedAthleteId: string | null;
  lens: 'self' | 'position';
  hrefFor: (athleteId: string) => string;
};

const BAND_STYLE: Record<ScatterPoint['band'], { fill: string; stroke: string }> = {
  far: { fill: 'rgba(241,90,74,0.32)', stroke: 'var(--bad)' },
  near: { fill: 'rgba(246,171,47,0.32)', stroke: 'var(--warn)' },
  mid: { fill: 'rgb(var(--accent-rgb) / 0.2)', stroke: 'rgb(var(--accent-rgb) / 0.55)' },
  low: { fill: 'rgba(51,182,255,0.3)', stroke: 'var(--accent2)' },
};

const LABELS: Record<'self' | 'position', Record<ScatterPoint['band'], string>> = {
  self: { far: 'Well above their normal', near: 'Above their normal', mid: 'Normal for them', low: 'Below their normal' },
  position: { far: 'Well above the unit', near: 'Above the unit', mid: 'In line with the unit', low: 'Below the unit' },
};

/** TRAINING-REPORT-SPEC.md §8. Axes follow the data (an MD-1 and a matchday
 *  sit at very different volumes) — floor/ceil the real min/max with the
 *  spec's own padding, never a fixed scale. Every dot is a real Link to
 *  ?athlete=<id>, not a client click handler — the same URL-driven
 *  selection pattern already used across this app's other master-detail
 *  screens (gym programme, leaderboard detail). */
export function TrainingScatter({ points, selectedAthleteId, lens, hrefFor }: Props) {
  if (points.length === 0) {
    return <p className="tiny">No athletes in this filter have a result for this session.</p>;
  }

  const tdValues = points.map((p) => p.td);
  const hsrValues = points.map((p) => p.hsr);
  const xLo = Math.floor((Math.min(...tdValues) * 0.9) / 100) * 100;
  const xHi = Math.ceil((Math.max(...tdValues) * 1.08) / 100) * 100;
  const yLo = Math.floor((Math.min(...hsrValues) * 0.85) / 10) * 10;
  const yHi = Math.ceil((Math.max(...hsrValues) * 1.1) / 10) * 10;

  const px = (v: number) => Math.min(98, Math.max(2, ((v - xLo) / (xHi - xLo || 1)) * 100));
  const py = (v: number) => Math.min(96, Math.max(2, ((v - yLo) / (yHi - yLo || 1)) * 100));

  const sortedTd = [...tdValues].sort((a, b) => a - b);
  const sortedHsr = [...hsrValues].sort((a, b) => a - b);
  const medianTd = sortedTd[Math.floor(sortedTd.length / 2)] ?? 0;
  const medianHsr = sortedHsr[Math.floor(sortedHsr.length / 2)] ?? 0;

  // Label the four furthest from "normal" (band far/near, ranked by how
  // far past their own band threshold they sit) — not just the four
  // largest dots, which would just be the four highest HIE counts.
  const ranked = [...points]
    .map((p) => ({ p, deviation: p.band === 'far' ? 3 : p.band === 'near' ? 2 : p.band === 'low' ? 1 : 0 }))
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 4)
    .map((r) => r.p.athleteId);
  const labelSet = new Set(ranked);

  const yTicks = [yHi, yHi - (yHi - yLo) * 0.25, yHi - (yHi - yLo) * 0.5, yHi - (yHi - yLo) * 0.75, yLo];
  const xTicks = [xLo, xLo + (xHi - xLo) * 0.25, xLo + (xHi - xLo) * 0.5, xLo + (xHi - xLo) * 0.75, xHi];

  /* Gameplan 4.2 / audit S8: the y-axis had tick numbers but no name or
   * unit, and there was no x-axis at all — a coach could read relative
   * position but not what either axis measured. Real tick values (already
   * computed above from the real min/max, TRAINING-REPORT-SPEC.md §8) plus
   * one caption naming both axes and their unit, matching how
   * WeekLoadChart/TestTrendChart state a chart's meaning once in text
   * around the chart rather than as a rotated axis title — additive only,
   * the plot's own layout and colour logic are untouched. */
  return (
    <div>
      <p className="tiny" style={{ marginBottom: 'var(--sp-8)', color: 'var(--faint)' }}>
        Y-axis: high speed running (HSR), metres. X-axis: total distance (TD), metres.
      </p>
      <div className="tr-scatter-grid">
        <div className="tr-scatter-yaxis">
          {yTicks.map((t) => (
            <span key={t}>{Math.round(t)}</span>
          ))}
        </div>
        <div>
          <div className="tr-scatter-plot">
            <div
              style={{ position: 'absolute', left: `${px(medianTd)}%`, top: 0, bottom: 0, width: 1, background: 'rgba(16,18,23,0.22)' }}
              aria-hidden="true"
            />
            <div
              style={{ position: 'absolute', bottom: `${py(medianHsr)}%`, left: 0, right: 0, height: 1, background: 'rgba(16,18,23,0.22)' }}
              aria-hidden="true"
            />
            <span
              className="tiny num"
              style={{
                position: 'absolute',
                left: `${px(medianTd)}%`,
                bottom: `${py(medianHsr)}%`,
                transform: 'translate(6px, 6px)',
                background: 'var(--surf)',
                padding: '1px 6px',
                borderRadius: 'var(--r-control)',
                border: '1px solid var(--border)',
              }}
            >
              squad median
            </span>

            {points.map((p) => {
              const size = 12 + Math.min(20, p.hie / 9);
              const style = BAND_STYLE[p.band];
              const isSelected = p.athleteId === selectedAthleteId;
              const leftPct = px(p.td);
              return (
                <Link
                  key={p.athleteId}
                  href={hrefFor(p.athleteId)}
                  className={`tr-scatter-dot${isSelected ? ' selected' : ''}`}
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${py(p.hsr)}%`,
                    width: size,
                    height: size,
                    background: style.fill,
                    borderColor: style.stroke,
                  }}
                  aria-label={`${p.name}, ${p.unit}. Total distance ${Math.round(p.td)}m, high speed running ${Math.round(p.hsr)}m.`}
                  title={p.name}
                >
                  {labelSet.has(p.athleteId) ? (
                    <span
                      className="tr-scatter-label"
                      style={{
                        color: style.stroke,
                        left: leftPct > 70 ? undefined : 14,
                        right: leftPct > 70 ? 'calc(100% + 14px)' : undefined,
                      }}
                    >
                      {p.name.split(',')[0]}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
          <div className="tr-scatter-xaxis">
            {xTicks.map((t) => (
              <span key={t}>{Math.round(t).toLocaleString()}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="tr-scatter-legend">
        {(['far', 'near', 'mid', 'low'] as const).map((band) => (
          <span key={band}>
            <span className="tr-scatter-legend-dot" style={{ background: BAND_STYLE[band].stroke }} />
            {LABELS[lens][band]}
          </span>
        ))}
      </div>
    </div>
  );
}
