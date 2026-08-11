/* Pure calculation helpers for the staff /nutrition workspace. NUTRITION-SPEC.md.
 *
 * No I/O here on purpose — this module is imported by both the server component
 * (initial render) and the client workspace (every stepper click), so the exact same
 * arithmetic runs in both places. See migration 0039_nutrition_rules.sql's header for
 * why a per-kilogram RULE is real, additive storage now, distinct from
 * nutrition_targets (the resolved absolute numbers the athlete app reads). */

export type MacroRule = {
  proteinGPerKg: number;
  carbGPerKg: number;
  fatGPerKg: number;
  fluidMlPerKg: number;
  /** NUTRITION-SPEC.md §8 OVERRIDE.kcalCap: clamps the derived total, never sets it. */
  energyKcalCap: number | null;
};

export type ComputedTargets = {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fluidMl: number;
};

/** NUTRITION-SPEC.md §4's own targets() function, unchanged:
 *    protein = mass * rule.protein
 *    carb    = mass * rule.carb * dayMultiplier
 *    fat     = mass * rule.fat
 *    kcal    = protein*4 + carb*4 + fat*9, clamped by an explicit cap only
 *    fluid   = mass * rule.fluid   (this build stores/returns millilitres, not litres —
 *              the spec's own demo divides by 1000 only because it is displaying litres
 *              directly; nutrition_targets.fluid_ml is the real column and wants ml)
 * Energy is always derived, never an independent input — that is the one property this
 * function exists to guarantee, per the spec: "a target can never contradict its own
 * macros." */
export function computeTargets(rule: MacroRule, massKg: number, dayMultiplier: number): ComputedTargets {
  const proteinG = massKg * rule.proteinGPerKg;
  const carbsG = massKg * rule.carbGPerKg * dayMultiplier;
  const fatG = massKg * rule.fatGPerKg;
  let energyKcal = proteinG * 4 + carbsG * 4 + fatG * 9;
  if (rule.energyKcalCap !== null) energyKcal = Math.min(energyKcal, rule.energyKcalCap);
  const fluidMl = massKg * rule.fluidMlPerKg;
  return { energyKcal, proteinG, carbsG, fatG, fluidMl };
}

/** NUTRITION-SPEC.md §3's three fixed day types. Not a table (see migration 0039's
 *  header, "What is NOT stored here") — there is no edit affordance on these three rows
 *  anywhere in the spec, so they are an application constant. The `carb` field is the
 *  reference number the Day type list itself displays (rule.carb x multiplier at the
 *  default 6.0 g/kg rule); the multiplier is the number targets() actually uses. */
export type DayTypeId = 'training' | 'match' | 'rest';

export const DAY_TYPES: { id: DayTypeId; label: string; multiplier: number; referenceCarb: number }[] = [
  { id: 'training', label: 'Training day', multiplier: 1, referenceCarb: 6.0 },
  { id: 'match', label: 'Match day', multiplier: 1.25, referenceCarb: 7.5 },
  { id: 'rest', label: 'Rest day', multiplier: 0.58, referenceCarb: 3.5 },
];

/** Touchpoint 6: day types map onto the real md_offset column, imperfectly.
 *  Match day is real and exact — md_offset = 0 is the schema's own definition of
 *  matchday (docs/04-data-model.md, "MD is matchday itself"). Training day and Rest
 *  day both fall to md_offset = null ("any day") when a computed target is written
 *  into nutrition_targets: there is no real schema concept of "rest day" distinct
 *  from "a training day with no match" (docs/04-data-model.md's own md_offset column
 *  only encodes distance from a fixture), so the two are not separately queryable by
 *  md_offset. The distinction is not silently lost, though — reasonPrefix below is
 *  folded into nutrition_targets.reason so a coach reading the row afterwards can see
 *  which day type actually produced the number. */
export function mdOffsetForDayType(dayType: DayTypeId): number | null {
  return dayType === 'match' ? 0 : null;
}

/** Stepper bounds, NUTRITION-SPEC.md §4's own table. */
export const RULE_BOUNDS = {
  protein: { min: 1.2, max: 2.6, step: 0.1, default: 1.9, unit: 'g per kg', footnote: 'held on every day type' },
  carb: { min: 2, max: 10, step: 0.5, default: 6.0, unit: 'g per kg', footnote: 'periodised' },
  fat: { min: 0.6, max: 1.8, step: 0.1, default: 1.0, unit: 'g per kg', footnote: 'fills the remainder' },
  fluid: { min: 25, max: 60, step: 5, default: 40, unit: 'ml per kg', footnote: 'raised in hot weather' },
} as const;

export const DEFAULT_RULE: MacroRule = {
  proteinGPerKg: RULE_BOUNDS.protein.default,
  carbGPerKg: RULE_BOUNDS.carb.default,
  fatGPerKg: RULE_BOUNDS.fat.default,
  fluidMlPerKg: RULE_BOUNDS.fluid.default,
  energyKcalCap: null,
};

export function clampRule(step: keyof typeof RULE_BOUNDS, value: number): number {
  const b = RULE_BOUNDS[step];
  const rounded = Math.round(value / b.step) * b.step;
  return Math.min(b.max, Math.max(b.min, Math.round(rounded * 100) / 100));
}

/* ---------------------------------------------------------------------------
 * Real rugby position -> positional unit mapping.
 *
 * Touchpoint (investigation): athletes.position is free text (docs/04-data-model.md,
 * confirmed against the live schema — no enum, no lookup table). NUTRITION-SPEC.md's
 * "Group rows" in the targets table want six positional units (Front row, Second row,
 * Back row, Half backs, Centres, Back three). That taxonomy is not stored anywhere as
 * data, but the org's real seeded positions (supabase/seed.sql's _squad table:
 * Loosehead prop, Hooker, Tighthead prop, Lock, Flanker, Number 8, Scrum-half,
 * Fly-half, Centre, Wing, Full-back) map onto exactly those six units with no
 * ambiguity, because they are standard rugby union position names. This is a display
 * convenience computed here, never written to the database — a position typed outside
 * this list (a club using different terms, or a different sport entirely) falls to
 * "Other" rather than being silently mis-grouped.
 * ------------------------------------------------------------------------- */

const POSITION_TO_UNIT: Record<string, string> = {
  'loosehead prop': 'Front row',
  'tighthead prop': 'Front row',
  prop: 'Front row',
  hooker: 'Front row',
  lock: 'Second row',
  'second row': 'Second row',
  flanker: 'Back row',
  'number 8': 'Back row',
  'no. 8': 'Back row',
  'no.8': 'Back row',
  'scrum-half': 'Half backs',
  'scrum half': 'Half backs',
  'fly-half': 'Half backs',
  'fly half': 'Half backs',
  centre: 'Centres',
  center: 'Centres',
  wing: 'Back three',
  winger: 'Back three',
  'full-back': 'Back three',
  fullback: 'Back three',
  'full back': 'Back three',
};

export const UNIT_ORDER = ['Front row', 'Second row', 'Back row', 'Half backs', 'Centres', 'Back three', 'Other'];

export function positionToUnit(position: string | null): string {
  if (!position) return 'Other';
  return POSITION_TO_UNIT[position.trim().toLowerCase()] ?? 'Other';
}

/* ---------------------------------------------------------------------------
 * Body mass "range" — real substitute for the spec's fabricated target band.
 *
 * Touchpoint (investigation): there is no target_weight_kg column anywhere in this
 * schema. src/components/BodyWeightPanel/BodyWeightPanel.tsx and
 * src/app/(staff)/squad/[athleteId]/page.tsx already made this exact cut for the
 * player-profile Body weight card ("No target range on record — there is no
 * target-weight column in this schema") — this screen makes the same real cut rather
 * than reintroducing a fabricated column through the back door.
 *
 * What renders in the band's place: mean +/- 1 standard deviation of the athlete's
 * trailing weekly weigh-ins, real and self-updating from body_composition. "In range"
 * becomes "within a standard deviation of their own recent trend" — same visual
 * mechanic (a band, a marker, the spec's own 40%-headroom axis padding), truthful
 * content.
 * ------------------------------------------------------------------------- */

export type MassBand = { low: number; high: number; mean: number };

export function computeMassBand(weeklyMasses: readonly number[]): MassBand | null {
  if (weeklyMasses.length < 2) return null;
  const mean = weeklyMasses.reduce((a, b) => a + b, 0) / weeklyMasses.length;
  const variance = weeklyMasses.reduce((a, b) => a + (b - mean) ** 2, 0) / weeklyMasses.length;
  const sd = Math.sqrt(variance);
  // A near-zero spread (an athlete weighed twice on the same day, or a genuinely flat
  // trend) would otherwise collapse the band to a hairline the marker always sits on
  // the edge of. 0.5% of body mass is a sensible floor: small enough to still flag a
  // real swing, wide enough to render.
  const floor = mean * 0.005;
  const half = Math.max(sd, floor);
  return { low: mean - half, high: mean + half, mean };
}

/** NUTRITION-SPEC.md §6's own axis formula, unchanged: the band plus 40% of its own
 *  width as headroom either side, so a marker outside the band still lands on screen. */
export function rangeBarMark(value: number, low: number, high: number): number {
  const span = high - low;
  const lo = low - span * 0.4;
  const hi = high + span * 0.4;
  const total = hi - lo || 1;
  return Math.min(99, Math.max(1, ((value - lo) / total) * 100));
}

export type MassState = 'in_range' | 'above' | 'below';

export function massState(value: number, band: MassBand | null): MassState {
  if (!band) return 'in_range';
  if (value > band.high) return 'above';
  if (value < band.low) return 'below';
  return 'in_range';
}

/** Data rule 7: "2% of body mass in seven days is the flag threshold." Real, computed
 *  from two real body_composition readings — used by both the range-bar colouring and
 *  the "Needs a word" chase list's first, most severe reason. */
export function pctChange(current: number, prior: number): number {
  if (prior === 0) return 0;
  return ((current - prior) / prior) * 100;
}
