/* Pure composition helpers for the /nutrition workspace: turning already-fetched real
 * rows (athletes, rules, body composition history, checkins) into the shapes the page
 * and its client components render. No I/O — see nutritionRules.ts's header for why
 * that split matters here (server render and client re-render must agree exactly). */

import {
  computeMassBand,
  massState,
  massTrendFlag,
  MASS_FLAG_PCT_7D,
  pctChange,
  positionToUnit,
  UNIT_ORDER,
  type MassBand,
  type MassTrendFlag,
} from './nutritionRules';

export type MassPoint = { date: string; kg: number };

export type WorkspaceAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string; // "Palmer, George" — NUTRITION-SPEC.md §8's own SQUAD name format
  position: string | null;
  unit: string;
  groupIds: string[];
  /** The athlete's CURRENT body mass: their latest weigh-in, full stop.
   *
   *  NOT windowed, and that is load-bearing rather than an oversight — this
   *  drives computeTargets(), the meal plan's portion scaling, inRangeCount()
   *  and each plan's "Reference mass", none of which are views of a period.
   *  /nutrition's own header states the period control "does not touch the
   *  plans, the targets table or the meal card"; clipping this at the trend
   *  window broke that promise silently, and a club weighing in monthly lost
   *  every target it had the day a weigh-in aged past 28 days. Null only when
   *  the athlete has never been weighed inside the page's fetch window. */
  massKg: number | null;
  massHistory: MassPoint[]; // ascending by date, the selected trend window only
  /** WHERE THEY HAVE BEEN: mean +/- 1 SD of their own trailing weekly weigh-ins.
   *  Descriptive, authorless, recomputes on every weigh-in. NOT the staff target —
   *  that is `targetRange` below, and the two must never be drawn as one band. */
  massBand: MassBand | null;
  /** WHERE STAFF WANT THEM: the live row from body_mass_target_ranges (migration
   *  0060), or null if nobody has set one.
   *
   *  STAFF ONLY. The athlete never sees this, on any screen — the table grants an
   *  athlete session no rows at all, and every renderer of this field is under
   *  src/app/(staff)/. It is also never ranked. Both are the client's own rules; see
   *  lib/queries/bodyMassTargetRange.ts's header before adding a caller.
   *
   *  Deliberately narrowed to the two bounds rather than carrying the whole row: the
   *  workspace draws a band, it does not need who set it or when, and a type that
   *  cannot carry the rationale text cannot leak the rationale text. */
  targetRange: { low: number; high: number } | null;
  change7d: number | null; // %, real, from body_composition
  change12wk: number | null; // %, real
  loggedDatesThisWeek: string[]; // ISO dates with a weigh-in in the current Mon-Sun week
  recentCheckins: { weekStart: string; answer: 'yes' | 'roughly' | 'no' }[]; // newest first
  hasPersonalTargetOverride: boolean;
  /** Nutrition-staff-only weight-trend indicator (nutritionRules.ts's own header
   *  explains the formula and why it is deliberately separate from the chase
   *  list below). Null means "nothing worth saying", not "no data".
   *
   *  Computed over MASS_TREND_FLAG_WINDOW_DAYS, NEVER over the selected trend
   *  window — see `flagFrom` below. */
  trendFlag: MassTrendFlag | null;
};

export function buildWorkspaceAthlete(input: {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  groupIds: string[];
  history: { measured_on: string; body_mass_kg: number | null }[]; // newest first, as fetched
  /* THE FETCH IS WIDER THAN THE TREND, ON PURPOSE, so this has to be told
   * where the trend actually starts.
   *
   * /nutrition has two independent time controls: `?period=` for the mass
   * trend and `?week=` for the week strip. They share one body_composition
   * read, whose lower bound is the EARLIER of the two — otherwise stepping the
   * week navigator back past the trend window would report "0 of 7 days
   * weighed in" for a week that was fully logged.
   *
   * The consequence is that `history` can reach further back than the trend
   * the coach asked for. Everything TREND-SHAPED below — the sparkline, the
   * mean ± 1 SD band, the 7-day and 12-week changes — is therefore computed
   * from `history` clipped at `trendFrom`, because without the clip the
   * sparkline would silently draw a wider window than its own caption claims.
   *
   * THREE THINGS ARE NOT TREND-SHAPED AND MUST NOT BE CLIPPED HERE, and each
   * one was, or would have been, a real bug:
   *   - `massKg` (the latest weigh-in) — see its own doc on WorkspaceAthlete.
   *     Clipping it took a club's nutrition targets away for the crime of not
   *     weighing in this month.
   *   - `loggedDatesThisWeek` — answers to `?week=`, not to `?period=`.
   *   - `trendFlag` — answers to neither; see `flagFrom`. */
  trendFrom: string; // inclusive YYYY-MM-DD; the mass trend's first day
  /* THE TREND FLAG'S OWN WINDOW, and the reason it is a separate argument
   * rather than reusing `trendFrom`.
   *
   * `trendFlag` is a fact about the athlete, not a view of a window, and it is
   * rendered on two screens with different controls: /nutrition has a mass-trend
   * period selector, /nutrition/new has none. Keying its band off `trendFrom`
   * let those two disagree about who is flagged whenever a coach had narrowed
   * the sparkline — which is exactly what /nutrition/new's own comment ("reused
   * here, not reimplemented, so the two screens can never disagree about who is
   * flagged or why") promises cannot happen. Sharing the FUNCTION is not enough
   * if the two callers feed it different windows.
   *
   * Pass addDays(today, -MASS_TREND_FLAG_WINDOW_DAYS) (nutritionRules.ts) on
   * every screen, and make sure the fetch reaches at least that far back. */
  flagFrom: string; // inclusive YYYY-MM-DD; the trend indicator's first day
  weekStart: string; // Monday of the viewed week, inclusive
  weekEnd: string; // Sunday of the viewed week, inclusive
  checkins: { week_start: string; answer: 'yes' | 'roughly' | 'no' }[]; // newest first
  hasPersonalTargetOverride: boolean;
  /* The live staff-set range, or null. Passed straight through untouched — unlike
   * massBand it is NOT computed from anything and NOT clipped to any window: a target
   * range is a standing instruction, not a view of a period, so narrowing the mass
   * trend to a week must not make the target disappear. Same reasoning as `massKg`
   * above, which had exactly that bug. */
  targetRange: { low: number; high: number } | null;
}): WorkspaceAthlete {
  const withMass = input.history.filter(
    (h): h is { measured_on: string; body_mass_kg: number } => h.body_mass_kg !== null,
  );

  /* CURRENT MASS — the latest reading in hand, taken from the UNCLIPPED set.
   * `history` is newest-first (fetchBodyCompositionForAthletes orders
   * `measured_on desc, id desc` and its own header names this read), so [0] is
   * it. Reading `inTrend[0]` here instead was the bug: a window is a lower
   * bound, so this differs from the trend's latest ONLY when the athlete has no
   * weigh-in inside the selected window at all — and in that case the honest
   * answer is their last known mass, not null. Null-ing it silently deleted
   * their protein/carb/fat/fluid targets, their scaled portions and their
   * plan's reference mass. */
  const latest = withMass[0] ?? null;
  const massKg = latest?.body_mass_kg ?? null;

  // The trend's own rows. `measured_on` is a `date` column, so this is a
  // calendar-date compare on plain YYYY-MM-DD strings, not an instant compare.
  const inTrend = withMass.filter((h) => h.measured_on >= input.trendFrom);
  const ascending = [...inTrend].reverse();
  const massHistory: MassPoint[] = ascending.map((h) => ({ date: h.measured_on, kg: h.body_mass_kg }));
  const massBand = computeMassBand(weeklyMasses(massHistory));

  // 7-day and 12-week change, over the TREND window: a comparison must not
  // silently reach outside the window the coach selected just because the
  // shared fetch pulled older rows for the week strip. Both are null when the
  // latest reading is itself outside that window, which is right — there is no
  // change to state inside a window with nothing in it.
  const change7d = latest ? changeOver(inTrend, latest, 7) : null;
  const change12wk = latest ? changeOver(inTrend, latest, 84) : null;

  /* THE TREND FLAG, over its own FIXED window — never `trendFrom`. See
   * `flagFrom` on the input type: this must be identical on every screen that
   * renders the indicator, and one of them (/nutrition/new) has no period
   * control to be identical to. */
  const inFlagWindow = withMass.filter((h) => h.measured_on >= input.flagFrom);
  const flagBand = computeMassBand(
    weeklyMasses([...inFlagWindow].reverse().map((h) => ({ date: h.measured_on, kg: h.body_mass_kg }))),
  );
  const flagChange7d = latest ? changeOver(inFlagWindow, latest, 7) : null;

  // The UNCLIPPED set — this is the one thing on this card that answers to the
  // week navigator rather than to the trend window (see `trendFrom` above).
  const loggedDatesThisWeek = withMass
    .filter((h) => h.measured_on >= input.weekStart && h.measured_on <= input.weekEnd)
    .map((h) => h.measured_on);

  return {
    id: input.id,
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: `${input.lastName}, ${input.firstName}`,
    position: input.position,
    unit: positionToUnit(input.position),
    groupIds: input.groupIds,
    massKg,
    massHistory,
    massBand,
    targetRange: input.targetRange,
    change7d,
    change12wk,
    loggedDatesThisWeek,
    recentCheckins: input.checkins.map((c) => ({ weekStart: c.week_start, answer: c.answer })),
    hasPersonalTargetOverride: input.hasPersonalTargetOverride,
    /* THE FLAG'S OWN BAND AND ITS OWN 7-DAY CHANGE, never the trend's. Passing
     * `massBand`/`change7d` here is the bug this pair of variables exists to
     * fix: both are computed over `trendFrom`, which /nutrition lets a coach
     * change and /nutrition/new does not have at all, so the same athlete could
     * be flagged on one screen and not the other purely because a sparkline had
     * been narrowed somewhere else. `massKg` is shared because it is not
     * windowed on either screen — it is the latest weigh-in, full stop. */
    trendFlag: massTrendFlag(massKg, flagBand, flagChange7d),
  };
}

/** One weigh-in per ISO week — the latest reading in that week — which is the
 *  unit computeMassBand's mean and SD are defined over (nutritionRules.ts).
 *  Takes ASCENDING points, so the last write per week is that week's latest.
 *
 *  A named helper rather than an inline loop because TWO windows now need it
 *  and they must not be the same window: the displayed trend's band answers to
 *  `trendFrom`, the indicator's band to `flagFrom`. */
function weeklyMasses(ascending: readonly MassPoint[]): number[] {
  const byWeek = new Map<string, number>();
  for (const p of ascending) byWeek.set(mondayOfLocal(p.date), p.kg);
  return [...byWeek.values()];
}

type MassRow = { measured_on: string; body_mass_kg: number };

/** Percentage change from the nearest reading at or before `days` before
 *  `latest` up to `latest` itself — "nearest available, not an exact day
 *  count", the same approach playerProfile.ts uses for its own weight-trend
 *  delta. Null when nothing in `rows` is old enough, which is the honest
 *  answer: there is no change to state without an earlier reading.
 *
 *  `rows` must be NEWEST-FIRST, and it is the CALLER'S window rather than the
 *  whole history — the trend's rows for the displayed 7-day and 12-week
 *  changes, the flag's fixed 90-day rows for the indicator. Same reason
 *  weeklyMasses takes its points as an argument.
 *
 *  `measured_on` is a `date` column. The midday-UTC parse here is day
 *  arithmetic on a plain calendar date, not a timezone being applied to it
 *  (CLAUDE.md rule 5 governs instants), and midday is chosen so no DST offset
 *  can move the day. */
function changeOver(rows: readonly MassRow[], latest: MassRow, days: number): number | null {
  const target = Date.parse(`${latest.measured_on}T12:00:00Z`) - days * 86_400_000;
  // Newest-first, so the FIRST row at or before the target is the nearest one
  // to it.
  const prior = rows.find((h) => Date.parse(`${h.measured_on}T12:00:00Z`) <= target);
  return prior ? pctChange(latest.body_mass_kg, prior.body_mass_kg) : null;
}

function mondayOfLocal(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------------
 * "Needs a word" chase list. NUTRITION-SPEC.md §3's own severity order, with the
 * third tier reframed onto something real (see nutritionRules.ts and this repo's
 * broader note on why "eating {n}% of the energy target" has no real backing —
 * CLAUDE.md rule 8, nutrition-plans.md's own "Daily intake aggregation, not
 * applicable and not to be built"). The weekly check-in answer is the real thing
 * closest to what that reason was trying to say: not "how much did they eat" (never
 * measured) but "did they think they hit it" (asked, once a week, for real).
 * ------------------------------------------------------------------------- */

export type ChaseReason = 'mass_down' | 'under_logging' | 'checkin_miss';

export type ChaseRow = {
  athleteId: string;
  name: string;
  reason: ChaseReason;
  label: string;
  value: string;
  colour: 'bad' | 'warn';
};

export function buildChaseList(athletes: readonly WorkspaceAthlete[]): ChaseRow[] {
  const rows: ChaseRow[] = [];

  for (const a of athletes) {
    if (a.change7d !== null && a.change7d <= -MASS_FLAG_PCT_7D) {
      rows.push({
        athleteId: a.id,
        name: a.displayName,
        reason: 'mass_down',
        // Finding 40: state the rule, not just its output — a bare "Body mass down"
        // next to a percentage forced a coach to guess why THIS number was the one
        // that got flagged.
        label: `Mass down ${MASS_FLAG_PCT_7D}%+ in 7 days`,
        value: `${a.change7d.toFixed(1)}%`,
        colour: 'bad',
      });
      continue;
    }
    if (a.loggedDatesThisWeek.length <= 3) {
      rows.push({
        athleteId: a.id,
        name: a.displayName,
        reason: 'under_logging',
        label: 'Weighed in',
        value: `${a.loggedDatesThisWeek.length}/7`,
        colour: 'bad',
      });
      continue;
    }
    const lastCheckin = a.recentCheckins[0];
    if (lastCheckin && (lastCheckin.answer === 'no' || lastCheckin.answer === 'roughly')) {
      rows.push({
        athleteId: a.id,
        name: a.displayName,
        reason: 'checkin_miss',
        label: 'Weekly check-in',
        value: lastCheckin.answer === 'no' ? 'No' : 'Roughly',
        colour: 'warn',
      });
    }
  }

  return rows
    .sort((a, b) => {
      const tier = (r: ChaseRow) => (r.reason === 'mass_down' ? 0 : r.reason === 'under_logging' ? 1 : 2);
      const t = tier(a) - tier(b);
      if (t !== 0) return t;
      if (a.reason === 'mass_down') return Number(a.value.replace('%', '')) - Number(b.value.replace('%', ''));
      return 0;
    })
    .slice(0, 5);
}

/* ---------------------------------------------------------------------------
 * Group rows for the targets table: one per real positional unit present in the
 * filtered population, in NUTRITION-SPEC.md's own reading order.
 * ------------------------------------------------------------------------- */

export type UnitGroup = {
  unit: string;
  athletes: WorkspaceAthlete[];
};

export function groupByUnit(athletes: readonly WorkspaceAthlete[]): UnitGroup[] {
  const byUnit = new Map<string, WorkspaceAthlete[]>();
  for (const a of athletes) {
    const list = byUnit.get(a.unit) ?? [];
    list.push(a);
    byUnit.set(a.unit, list);
  }
  return UNIT_ORDER.filter((u) => byUnit.has(u)).map((unit) => ({ unit, athletes: byUnit.get(unit)! }));
}

export function inRangeCount(athletes: readonly WorkspaceAthlete[]): number {
  return athletes.filter((a) => a.massKg !== null && massState(a.massKg, a.massBand) === 'in_range').length;
}

/** The real substitute for NUTRITION-SPEC.md §3's authored "Reference mass" column
 *  (110 kg / 90 kg / 105 kg, invented editorial numbers): the real mean current mass
 *  of whichever athletes the plan actually, really resolves to. Null when nobody in
 *  scope has a recorded weigh-in yet, rendered as an honest "no weigh-ins yet" rather
 *  than a fabricated placeholder. */
export function meanMass(athletes: readonly WorkspaceAthlete[]): number | null {
  const withMass = athletes.filter((a): a is WorkspaceAthlete & { massKg: number } => a.massKg !== null);
  if (withMass.length === 0) return null;
  return withMass.reduce((sum, a) => sum + a.massKg, 0) / withMass.length;
}
