/* Pure calculation helpers for the staff /nutrition workspace. NUTRITION-SPEC.md.
 *
 * No I/O here on purpose — this module is imported by both the server component
 * (initial render) and the client workspace (every stepper click), so the exact same
 * arithmetic runs in both places. See migration 0039_nutrition_rules.sql's header for
 * why a per-kilogram RULE is real, additive storage now, distinct from
 * nutrition_targets (the resolved absolute numbers the athlete app reads). */

export type MacroRule = {
  proteinGPerKg: number;
  /* One carbohydrate number per day type, and no shared rate between them.
     Replaced a single carbGPerKg plus a fixed per-day multiplier (training x1,
     match x1.25, rest x0.58) on 2026-09-07. Under that model the editor divided
     an entered value back into the shared field, so setting a match-day number
     moved training and rest too, and "match 7.5, rest 3.0" was unrepresentable
     unless the ratio happened to be 1.25 : 0.58. Deliberately a removal: there
     is nothing shared left for a later simplification to re-derive them from. */
  carbGPerKgByDay: Record<DayTypeId, number>;
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
 *    carb    = mass * rule.carbByDay[dayType]   (no multiplier: see MacroRule)
 *    fat     = mass * rule.fat
 *    kcal    = protein*4 + carb*4 + fat*9, clamped by an explicit cap only
 *    fluid   = mass * rule.fluid   (this build stores/returns millilitres, not litres —
 *              the spec's own demo divides by 1000 only because it is displaying litres
 *              directly; nutrition_targets.fluid_ml is the real column and wants ml)
 * Energy is always derived, never an independent input — that is the one property this
 * function exists to guarantee, per the spec: "a target can never contradict its own
 * macros." */
export function computeTargets(rule: MacroRule, massKg: number, dayType: DayTypeId): ComputedTargets {
  const proteinG = massKg * rule.proteinGPerKg;
  const carbsG = massKg * rule.carbGPerKgByDay[dayType];
  const fatG = massKg * rule.fatGPerKg;
  let energyKcal = proteinG * 4 + carbsG * 4 + fatG * 9;
  if (rule.energyKcalCap !== null) energyKcal = Math.min(energyKcal, rule.energyKcalCap);
  const fluidMl = massKg * rule.fluidMlPerKg;
  return { energyKcal, proteinG, carbsG, fatG, fluidMl };
}

/** NUTRITION-SPEC.md §3's three day types. Still an application constant rather than a
 *  table — there is no affordance anywhere for adding a fourth.
 *
 *  `guideline` is a PRINTED REFERENCE and nothing else: shown beside the field so a
 *  nutritionist has a starting point, never written, never defaulted onto an existing
 *  rule, and nothing clamps or validates against it. It is the number the old fixed
 *  multipliers produced from a 6.0 g/kg rule, kept because it was a reasonable
 *  suggestion, not because anything depends on it. */
export type DayTypeId = 'training' | 'match' | 'rest';

export const DAY_TYPES: { id: DayTypeId; label: string; guideline: number }[] = [
  { id: 'training', label: 'Training day', guideline: 6.0 },
  { id: 'match', label: 'Match day', guideline: 7.5 },
  { id: 'rest', label: 'Rest day', guideline: 3.5 },
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
  /* One bound for all three day types. `default` is only the starting value for a
     brand-new rule; each day type is entered and stored on its own. */
  carb: { min: 2, max: 12.5, step: 0.5, default: 6.0, unit: 'g per kg', footnote: 'set per day type' },
  fat: { min: 0.6, max: 1.8, step: 0.1, default: 1.0, unit: 'g per kg', footnote: 'fills the remainder' },
  fluid: { min: 25, max: 60, step: 5, default: 40, unit: 'ml per kg', footnote: 'raised in hot weather' },
} as const;

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
 * Body mass trailing band — the athlete's OWN recent range. NOT the staff target.
 *
 * CORRECTED, MIGRATION 0060. This comment used to open "real substitute for the
 * spec's fabricated target band" and assert "there is no target_weight_kg column
 * anywhere in this schema", citing the identical cut made in BodyWeightPanel.tsx and
 * squad/[athleteId]/page.tsx. That was accurate when written and is now WRONG:
 * migration 0060 added body_mass_target_ranges, a staff-only table, read through
 * lib/queries/bodyMassTargetRange.ts. All three stale notes are corrected together,
 * because a comment saying "we cut this, no column exists" is precisely how the next
 * person re-cuts a feature that now exists — this codebase lost the feature twice that
 * way already.
 *
 * computeMassBand IS NOT SUPERSEDED, and must not be replaced by the target range.
 * They answer different questions and both belong on screen:
 *
 *   computeMassBand (here)  WHERE THEY HAVE BEEN. Mean +/- 1 SD of the athlete's own
 *     trailing weekly weigh-ins, real and self-updating from body_composition.
 *     Descriptive, authorless, recomputes on every weigh-in. Exists for every athlete
 *     with two weigh-ins, needs nobody to have decided anything.
 *
 *   body_mass_target_ranges  WHERE STAFF WANT THEM. Prescriptive, authored by a named
 *     person on a date, changes only when staff change it, and NEVER visible to the
 *     athlete or rankable on a leaderboard (the client's own four rules — see 0060).
 *
 * A chart drawing both MUST distinguish them by fill-versus-stroke, by hue, and in
 * words. Two unlabelled bands on one chart is worse than one. TargetsTable.tsx and
 * SelectedAthleteCard.tsx are the two places that draw both; follow what they do.
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

/** Takes anything with a low and a high, not MassBand specifically, so the SAME
 *  arithmetic serves both the trailing band and the staff target range (0060) and the
 *  two can never drift into disagreeing about what "above" means. The two callers
 *  differ in their WORDS, not their maths: "trending above" for the self-referential
 *  band, "above target" for the staff one. Do not merge that copy. */
export function massState(value: number, band: { low: number; high: number } | null): MassState {
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

/** Audit finding 40: this number existed only as prose in the comment above and as a
 *  bare `-2` literal at the one call site (lib/nutritionWorkspace.ts's buildChaseList)
 *  — a coach had no way to see the rule that put an athlete on the chase list, only its
 *  output. Exported so the UI can say "flags at 2%+ in 7 days" instead of just showing
 *  a percentage with no stated threshold. This is a magnitude — buildChaseList decides
 *  the direction (currently a fall only, not a rise; a rapid rise reads as normal
 *  growth or hydration/food timing far more often than a rapid fall does for a growing
 *  16-25 year old, which is why the asymmetry is real rather than an oversight — but it
 *  is a product call, not a schema constraint, and someone should confirm it). No UI to
 *  retune this yet: it is a code constant, not a column, on any table. */
export const MASS_FLAG_PCT_7D = 2;

/** Audit finding 43: the "day, as food" preview claims a plan is "close enough to
 *  publish" within this tolerance (NutritionWorkspace.tsx's own caption) and the bar
 *  colouring already keys off it — this just gives that number one real name instead of
 *  a literal `5` repeated at each call site, so the claim and the enforcement can't
 *  drift apart. */
export const MACRO_TOLERANCE_PCT = 5;

/* ---------------------------------------------------------------------------
 * Weight-trend indicator, nutrition-staff-only. Coach request (2026-08-28):
 * "a flag to show the nutritionist who needs more and who needs less". Built
 * deliberately as a calm, symmetric, two-way FACT about a real number moving,
 * never as a squad-wide "at risk" list and never using a stigmatising word like
 * "overweight"/"underweight" — see supabase/migrations/0016_leaderboards.sql's
 * comment and docs/screens/leaderboards.md's "Why body composition must never
 * be leaderboarded" for exactly the harm this must not become. It is looked up
 * per athlete, inline, in a list nutrition staff already have open (the
 * `/nutrition` squad grid, the `/nutrition/new` athlete picker) — never sorted
 * by "most over" or "most under", never rendered to an athlete, never a badge
 * on a squad-wide board.
 *
 * Deliberately a SEPARATE, calmer signal from buildChaseList's "Needs a word"
 * mass_down reason (nutritionWorkspace.ts). That list is intentionally
 * ASYMMETRIC (a fall only, not a rise) and intentionally urgent — its own
 * comment explains why a rapid rise reads as normal growth far more often than
 * a rapid fall does for a growing 16-25 year old, and this function does not
 * reopen that call. This is a plain, symmetric, non-urgent fact for a
 * nutritionist deciding whether a plan needs more energy or less.
 * ------------------------------------------------------------------------- */

/** The trailing window the trend indicator's band is built over, on EVERY
 *  screen that shows it. FIXED, and deliberately not the `?period=` control.
 *
 *  This flag is a fact about an athlete — "moved outside their own recent
 *  normal range" — not a view of a window, and two screens showing the same
 *  athlete must agree about whether it is set. `/nutrition` has a mass-trend
 *  period selector and `/nutrition/new` has no control at all, so keying the
 *  band off the selected window would let one screen flag an athlete the other
 *  does not, purely because a coach had narrowed a sparkline somewhere else.
 *  buildWorkspaceAthlete (lib/nutritionWorkspace.ts) therefore takes this
 *  window separately from the trend's, and every caller must reach at least
 *  this far back in its own fetch.
 *
 *  90 days ≈ 13 weekly weigh-ins: enough for a mean and SD that mean something
 *  (computeMassBand needs 2 and is noisy near that), short enough that a change
 *  of season or a deliberate mass programme is not still dragging the mean
 *  around. It is also the window /nutrition/new was already hardcoding. */
export const MASS_TREND_FLAG_WINDOW_DAYS = 90;

export type TrendDirection = 'above' | 'below';

export type MassTrendFlag = {
  direction: TrendDirection;
  massKg: number;
  band: MassBand;
  /** The real trailing-7-day % change (same pctChange() the mass_down chase-list
   *  reason uses), same sign as direction. */
  changePct: number;
};

/** THE TREND FLAG IS KEYED TO THE ATHLETE'S OWN BAND, NEVER TO THE STAFF TARGET
 *  RANGE. Migration 0060 added body_mass_target_ranges and this function was
 *  deliberately NOT switched over to it. "They have moved away from where they have been"
 *  is a fact about the athlete that this flag can assert on its own; "they are outside
 *  where staff want them" is staff already knowing, and flagging it would tell a
 *  nutritionist their own opinion back. It would also make the flag appear and vanish
 *  when somebody edited a target rather than when the athlete's mass moved. Keep this
 *  self-referential.
 *
 *  Fires only when BOTH of two independently-real signals agree:
 *   1. massState() already says the latest weigh-in sits outside this athlete's
 *      OWN mean +/- 1 SD band (computeMassBand — self-referential, built from
 *      their own trailing weigh-ins, not an external ideal, a population norm,
 *      or the staff target range).
 *   2. The trailing 7-day % change is at least MASS_FLAG_PCT_7D in magnitude,
 *      in the SAME direction as (1) — the exact real threshold this codebase
 *      already uses and documents (above, "2% of body mass in seven days is
 *      the flag threshold"), just applied symmetrically here instead of
 *      one-directionally.
 * Requiring both is deliberate: (1) alone is noisy (a tight band, e.g. a very
 * flat trend, can sit a fraction of a kilo outside itself with no real recent
 * movement at all — computeMassBand's own 0.5%-of-mean floor exists for
 * exactly this reason but does not eliminate it), and (2) alone says nothing
 * about direction relative to where this athlete actually sits. Together they
 * are: "moved by a real, non-trivial amount, AND that movement has actually
 * carried them outside their own recent normal range." Returns null on
 * insufficient data (no massKg, no band, no 7-day figure) or when neither
 * condition is met — there is nothing to say, so nothing is shown. */
export function massTrendFlag(
  massKg: number | null,
  band: MassBand | null,
  change7d: number | null,
): MassTrendFlag | null {
  if (massKg === null || band === null || change7d === null) return null;
  const state = massState(massKg, band);
  if (state === 'above' && change7d >= MASS_FLAG_PCT_7D) {
    return { direction: 'above', massKg, band, changePct: change7d };
  }
  if (state === 'below' && change7d <= -MASS_FLAG_PCT_7D) {
    return { direction: 'below', massKg, band, changePct: change7d };
  }
  return null;
}

/** The one short label, identical everywhere this renders, so "trending above"
 *  and "trending below" never drift into different wording (or into the word
 *  this feature must never use) on different screens. */
export function trendFlagLabel(direction: TrendDirection): string {
  return direction === 'above' ? 'Trending above target range' : 'Trending below target range';
}

/** The one long sentence, real numbers included, for a title/tooltip or a
 *  helper line under a picker — never shown to an athlete, never squad-wide. */
export function trendFlagSentence(flag: MassTrendFlag): string {
  const { direction, massKg, band, changePct } = flag;
  const verb = direction === 'above' ? '+' : '';
  return (
    `${trendFlagLabel(direction)} — ${massKg.toFixed(1)} kg vs ${band.low.toFixed(1)}–${band.high.toFixed(1)} kg ` +
    `(their own trailing mean ± 1 SD), ${verb}${changePct.toFixed(1)}% over the last 7 days. ` +
    `Visible to nutrition staff only.`
  );
}
