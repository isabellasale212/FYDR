'use client';

import { massState, rangeBarMark } from '@/lib/nutritionRules';
import type { ComputedTargets } from '@/lib/nutritionRules';
import type { WorkspaceAthlete } from '@/lib/nutritionWorkspace';

export type AthleteWithTargets = WorkspaceAthlete & {
  resolvedSource: 'athlete' | 'group' | 'org_default' | null;
  targets: ComputedTargets | null;
};

type UnitGroup = { unit: string; athletes: AthleteWithTargets[] };

type Props = {
  unitGroups: UnitGroup[];
  selectedAthleteId: string | null;
  onSelectAthlete: (id: string) => void;
};

const GRID = 'minmax(168px, 1.2fr) 66px 128px 80px 76px 76px 70px 74px 66px';

/* NUTRITION-SPEC.md §6, "Targets and body mass". One real deviation, documented in
 * full in lib/nutritionRules.ts: the "vs target range" column and its band render a
 * real mean +/- 1SD of the athlete's own trailing weigh-ins rather than the spec's
 * fabricated target-weight range (no such column exists anywhere in this schema —
 * confirmed by this session's own earlier, identical cut on the player-profile Body
 * weight card). Same axis-padding formula, same band-and-marker mechanic, honest
 * content. The "Logged" column is real weigh-in days this week, for the same reason
 * (no daily nutrition log exists to count instead). */
export function TargetsTable({ unitGroups, selectedAthleteId, onSelectAthlete }: Props) {
  if (unitGroups.length === 0) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <p className="tiny">No athletes in the current group filter.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
      <div style={{ minWidth: 940 }}>
        <div className="nutr-table-head" style={{ gridTemplateColumns: GRID }}>
          <div>Athlete</div>
          <div className="nutr-col-num">Mass</div>
          <div className="nutr-col-num">12-wk range</div>
          <div className="nutr-col-num">Energy</div>
          <div className="nutr-col-num">Protein</div>
          <div className="nutr-col-num">Carbs</div>
          <div className="nutr-col-num">Fat</div>
          <div className="nutr-col-num">Fluid</div>
          <div className="nutr-col-num">Weighed in</div>
        </div>

        {unitGroups.map((group) => {
          const withTargets = group.athletes.filter((a) => a.targets !== null);
          const meanEnergy =
            withTargets.length > 0
              ? Math.round(withTargets.reduce((s, a) => s + (a.targets?.energyKcal ?? 0), 0) / withTargets.length)
              : null;
          const inRange = group.athletes.filter(
            (a) => a.massKg !== null && massState(a.massKg, a.massBand) === 'in_range',
          ).length;

          return (
            <div key={group.unit}>
              <div className="nutr-group-row">
                <span className="nutr-group-name">
                  {group.unit} · {group.athletes.length}
                </span>
                <span className="nutr-group-meta">
                  {meanEnergy !== null ? `mean ${meanEnergy.toLocaleString('en-GB')} kcal · ` : ''}
                  {inRange} of {group.athletes.length} in range
                </span>
              </div>
              {group.athletes.map((a) => (
                <AthleteRow
                  key={a.id}
                  athlete={a}
                  selected={a.id === selectedAthleteId}
                  onSelect={() => onSelectAthlete(a.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
      <p className="nutr-table-caption">
        Targets recompute on the next weigh-in · an athlete override replaces the rule for that
        athlete only · a missing log is never counted as zero
      </p>
    </div>
  );
}

function AthleteRow({
  athlete,
  selected,
  onSelect,
}: {
  athlete: AthleteWithTargets;
  selected: boolean;
  onSelect: () => void;
}) {
  const state = athlete.massKg !== null ? massState(athlete.massKg, athlete.massBand) : 'in_range';
  const stateColour = state === 'above' ? 'var(--warn)' : state === 'below' ? 'var(--bad)' : 'var(--accent)';
  const wash = selected
    ? 'rgb(var(--accent-rgb) / 0.07)'
    : athlete.change7d !== null && athlete.change7d <= -2
      ? 'rgb(var(--bad-rgb) / 0.05)'
      : 'transparent';
  const logged = athlete.loggedDatesThisWeek.length;
  const loggedColour = logged <= 3 ? 'var(--bad-text)' : logged <= 5 ? 'var(--warn-text)' : 'var(--text)';

  return (
    <button
      type="button"
      className="nutr-athlete-row"
      style={{ gridTemplateColumns: GRID, background: wash }}
      onClick={onSelect}
    >
      <span className="nutr-athlete-name" style={{ fontWeight: selected ? 700 : 400 }}>
        {athlete.displayName}
        {athlete.resolvedSource === 'athlete' ? <span className="pill pill-accent nutr-set-pill">set</span> : null}
      </span>
      <span className="nutr-mono nutr-col-num" style={{ color: stateColour }}>
        {athlete.massKg !== null ? athlete.massKg.toFixed(1) : '·'}
      </span>
      <span className="nutr-col-num">
        {athlete.massBand && athlete.massKg !== null ? (
          <RangeBar mass={athlete.massKg} band={athlete.massBand} colour={stateColour} change7d={athlete.change7d} />
        ) : (
          <span className="nutr-mono nutr-range-empty">no history yet</span>
        )}
      </span>
      <span className="nutr-mono nutr-col-num">
        {athlete.targets ? Math.round(athlete.targets.energyKcal).toLocaleString('en-GB') : '·'}
      </span>
      <span className="nutr-mono nutr-col-num">{athlete.targets ? Math.round(athlete.targets.proteinG) : '·'}</span>
      <span className="nutr-mono nutr-col-num">{athlete.targets ? Math.round(athlete.targets.carbsG) : '·'}</span>
      <span className="nutr-mono nutr-col-num">{athlete.targets ? Math.round(athlete.targets.fatG) : '·'}</span>
      <span className="nutr-mono nutr-col-num">
        {athlete.targets ? `${(athlete.targets.fluidMl / 1000).toFixed(1)}L` : '·'}
      </span>
      <span className="nutr-mono nutr-col-num" style={{ color: loggedColour }}>
        {logged} / 7
      </span>
    </button>
  );
}

function RangeBar({
  mass,
  band,
  colour,
  change7d,
}: {
  mass: number;
  band: { low: number; high: number };
  colour: string;
  change7d: number | null;
}) {
  const mark = rangeBarMark(mass, band.low, band.high);
  const lowMark = rangeBarMark(band.low, band.low, band.high);
  const highMark = rangeBarMark(band.high, band.low, band.high);
  return (
    <div>
      <div className="nutr-range-track">
        <div
          className="nutr-range-band"
          style={{ left: `${lowMark}%`, width: `${Math.max(0, highMark - lowMark)}%` }}
        />
        <div className="nutr-range-marker" style={{ left: `${mark}%`, background: colour }} />
      </div>
      <div className="nutr-mono nutr-range-caption">
        {band.low.toFixed(0)}–{band.high.toFixed(0)} kg
        {change7d !== null ? ` · ${change7d >= 0 ? '+' : ''}${change7d.toFixed(1)}% 7d` : ''}
      </div>
    </div>
  );
}
