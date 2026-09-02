'use client';

import { MASS_FLAG_PCT_7D, massState, rangeBarMark, trendFlagSentence } from '@/lib/nutritionRules';
import type { ComputedTargets, MacroRule } from '@/lib/nutritionRules';
import type { WorkspaceAthlete } from '@/lib/nutritionWorkspace';

export type AthleteWithTargets = WorkspaceAthlete & {
  resolvedSource: 'athlete' | 'group' | 'org_default' | null;
  targets: ComputedTargets | null;
  /** Finding 42: the raw per-kg rule behind a personal override, non-null only when
   *  resolvedSource is 'athlete'. Lets the row say what the override actually is
   *  instead of a bare "set" pill. */
  overrideRule: MacroRule | null;
};

type UnitGroup = { unit: string; athletes: AthleteWithTargets[] };

type Props = {
  unitGroups: UnitGroup[];
  selectedAthleteId: string | null;
  onSelectAthlete: (id: string) => void;
};

const GRID = 'minmax(168px, 1.2fr) 66px 128px 104px 80px 76px 76px 70px 74px 66px';

/* NUTRITION-SPEC.md §6, "Targets and body mass".
 *
 * TWO RANGE COLUMNS, AND THEY ARE NOT THE SAME THING. This is the correction to what
 * this header used to say. It used to record that the spec's target-weight range was
 * fabricated, that "no such column exists anywhere in this schema", and that the band
 * drawn here was an honest substitute — the athlete's own trailing mean +/- 1 SD.
 * Migration 0060 added body_mass_target_ranges, so half of that is now out of date:
 * the substitute was never wrong, it just was not the only thing available.
 *
 *   "12-wk range"    computeMassBand. WHERE THEY HAVE BEEN. Filled band, accent
 *                    wash, exists for anyone with two weigh-ins, nobody authored it.
 *   "Staff target"   body_mass_target_ranges. WHERE STAFF WANT THEM. Dashed neutral
 *                    bracket, no fill, exists only where a coach or physio set one.
 *
 * They are separate COLUMNS rather than two bands stacked in one, which is the whole
 * point: two unlabelled bands on one track would be worse than one band. Each column
 * carries its own header word, and the two bars are drawn in different ink — fill
 * versus stroke, solid versus dashed, accent versus neutral — so they stay
 * distinguishable in greyscale and under colour-vision deficiency too.
 *
 * The staff target is STAFF ONLY and NEVER RANKED (the client's rules; see migration
 * 0060). This component renders only from (staff)/nutrition, and the table hands an
 * athlete session no rows regardless — do not lift it anywhere else.
 *
 * The "Logged" column is real weigh-in days this week, for the original reason: no
 * daily nutrition log exists to count instead. */
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
      {/* Widened from 940 by the new "Staff target" column's 104px plus its gap. The
        * card already scrolls horizontally, so this sets the point at which it starts
        * rather than allowing the columns to crush. */}
      <div style={{ minWidth: 1054 }}>
        <div className="nutr-table-head" style={{ gridTemplateColumns: GRID }}>
          <div>Athlete</div>
          <div className="nutr-col-num">Mass</div>
          <div className="nutr-col-num" title="Where they have been: mean ± 1 SD of their own trailing weekly weigh-ins. Recomputes on every weigh-in.">
            12-wk range
          </div>
          <div className="nutr-col-num" title="Where staff want them: the range a coach or physio set. Staff only — the athlete never sees this, and it is never ranked.">
            Staff target
          </div>
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
        <span className="nutr-legend-item">
          <span className="nutr-legend-band" aria-hidden="true" /> 12-wk range — where they have
          been, their own mean ± 1 SD, recomputed on every weigh-in
        </span>
        <span className="nutr-legend-item">
          <span className="nutr-legend-bracket" aria-hidden="true" /> Staff target — where staff
          want them, set by a named person, never shown to the athlete and never ranked
        </span>
      </p>
      <p className="nutr-table-caption">
        Targets recompute on the next weigh-in · an athlete override replaces the rule for that
        athlete only · a missing log is never counted as zero · a {MASS_FLAG_PCT_7D}%+ drop in 7 days
        moves an athlete onto the &ldquo;Needs a word&rdquo; chase list · &ldquo;Trending
        above/below&rdquo; means outside their own recent range AND moved {MASS_FLAG_PCT_7D}%+ in
        7 days, visible here only, never to the athlete
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
  /* The -text variants, not the raw fills. --warn/--bad/--accent are the
     colours of a BLOCK of that tone; as text on a card they are only just
     legible in light and fail outright in dark — the neutral state measured
     3.54:1 there. The -text tokens are theme-split and derived for exactly
     this: ink on a plain surface. */
  const stateColour =
    state === 'above' ? 'var(--warn-text)' : state === 'below' ? 'var(--bad-text)' : 'var(--accent-text)';
  const wash = selected
    ? 'rgb(var(--accent-rgb) / 0.07)'
    : athlete.change7d !== null && athlete.change7d <= -2
      ? 'rgb(var(--bad-rgb) / 0.05)'
      : 'transparent';
  const logged = athlete.loggedDatesThisWeek.length;
  const loggedColour = logged <= 3 ? 'var(--bad-text)' : logged <= 5 ? 'var(--warn-text)' : 'var(--text)';

  // Finding 42: "set" alone answered no question a coach would actually ask ("set to
  // what? by whom?"). The pill now reads as a sentence fragment with a subject and an
  // object — "Override — 2.2 g/kg protein" — and the full rule is one hover away.
  const overrideTitle = athlete.overrideRule
    ? `Personal override — ${athlete.overrideRule.proteinGPerKg} g/kg protein · ${athlete.overrideRule.carbGPerKg} g/kg carb · ${athlete.overrideRule.fatGPerKg} g/kg fat · ${athlete.overrideRule.fluidMlPerKg} ml/kg fluid`
    : undefined;

  // Finding 40: the resolved Energy figure was a number with no visible working. This
  // reconstructs the one line of arithmetic that produced it — the same "N kcal
  // because mass x kcal/kg" shape a coach would want to check by hand.
  const energyTitle =
    athlete.targets && athlete.massKg
      ? `${Math.round(athlete.targets.energyKcal).toLocaleString('en-GB')} kcal because ${athlete.massKg.toFixed(1)} kg × ${(athlete.targets.energyKcal / athlete.massKg).toFixed(0)} kcal/kg`
      : undefined;

  return (
    <button
      type="button"
      className="nutr-athlete-row"
      style={{ gridTemplateColumns: GRID, background: wash }}
      onClick={onSelect}
    >
      <span className="nutr-athlete-name" style={{ fontWeight: selected ? 700 : 400 }}>
        {athlete.displayName}
        {athlete.resolvedSource === 'athlete' ? (
          <span className="pill pill-accent nutr-set-pill" title={overrideTitle}>
            Override
          </span>
        ) : null}
        {athlete.trendFlag ? (
          <span
            className={`pill ${athlete.trendFlag.direction === 'above' ? 'pill-warn' : 'pill-bad'} nutr-set-pill`}
            title={trendFlagSentence(athlete.trendFlag)}
          >
            {athlete.trendFlag.direction === 'above' ? 'Trending above' : 'Trending below'}
          </span>
        ) : null}
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
      <span className="nutr-col-num">
        {athlete.targetRange && athlete.massKg !== null ? (
          <TargetBar mass={athlete.massKg} range={athlete.targetRange} />
        ) : (
          <span className="nutr-mono nutr-range-empty">
            {athlete.targetRange ? 'no weigh-in' : 'none set'}
          </span>
        )}
      </span>
      <span className="nutr-mono nutr-col-num" title={energyTitle}>
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

/* The staff-set target range (migration 0060), drawn in DELIBERATELY DIFFERENT INK from
 * RangeBar above.
 *
 * RangeBar's band is a filled accent wash — a cloud of where the athlete has been.
 * This is an unfilled, dashed, neutral BRACKET — a rule somebody drew. That is the
 * distinction the two columns exist to preserve, and it is carried on three independent
 * channels (fill vs stroke, solid vs dashed, accent vs neutral) so it survives
 * greyscale and colour-vision deficiency, plus a fourth in words: the column header
 * says "Staff target" and the caption says whether they are on it.
 *
 * The marker keeps the good/warn/bad status colouring, because "is he on target" is a
 * judgement and this is the column that makes it. RangeBar's marker is coloured by the
 * SAME palette for a DIFFERENT question ("is he away from his own trend"), which is why
 * both bars carry a word as well as a colour. */
function TargetBar({ mass, range }: { mass: number; range: { low: number; high: number } }) {
  const state = massState(mass, range);
  const colour = state === 'above' ? 'var(--warn)' : state === 'below' ? 'var(--bad)' : 'var(--good)';
  const mark = rangeBarMark(mass, range.low, range.high);
  const lowMark = rangeBarMark(range.low, range.low, range.high);
  const highMark = rangeBarMark(range.high, range.low, range.high);
  return (
    <div>
      <div className="nutr-range-track">
        <div
          className="nutr-target-bracket"
          style={{ left: `${lowMark}%`, width: `${Math.max(0, highMark - lowMark)}%` }}
        />
        <div className="nutr-range-marker" style={{ left: `${mark}%`, background: colour }} />
      </div>
      <div className="nutr-mono nutr-range-caption">
        {range.low.toFixed(0)}–{range.high.toFixed(0)} kg ·{' '}
        {state === 'in_range' ? 'on target' : state === 'above' ? 'above' : 'below'}
      </div>
    </div>
  );
}
