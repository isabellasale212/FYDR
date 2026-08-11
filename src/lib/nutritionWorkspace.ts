/* Pure composition helpers for the /nutrition workspace: turning already-fetched real
 * rows (athletes, rules, body composition history, checkins) into the shapes the page
 * and its client components render. No I/O — see nutritionRules.ts's header for why
 * that split matters here (server render and client re-render must agree exactly). */

import { computeMassBand, massState, pctChange, positionToUnit, UNIT_ORDER, type MassBand } from './nutritionRules';

export type MassPoint = { date: string; kg: number };

export type WorkspaceAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string; // "Palmer, George" — NUTRITION-SPEC.md §8's own SQUAD name format
  position: string | null;
  unit: string;
  groupIds: string[];
  massKg: number | null;
  massHistory: MassPoint[]; // ascending by date, trailing ~12 weeks
  massBand: MassBand | null; // real substitute for the spec's fabricated target range
  change7d: number | null; // %, real, from body_composition
  change12wk: number | null; // %, real
  loggedDatesThisWeek: string[]; // ISO dates with a weigh-in in the current Mon-Sun week
  recentCheckins: { weekStart: string; answer: 'yes' | 'roughly' | 'no' }[]; // newest first
  hasPersonalTargetOverride: boolean;
};

export function buildWorkspaceAthlete(input: {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  groupIds: string[];
  history: { measured_on: string; body_mass_kg: number | null }[]; // newest first, as fetched
  weekStart: string; // Monday of the current week, inclusive
  weekEnd: string; // Sunday of the current week, inclusive
  checkins: { week_start: string; answer: 'yes' | 'roughly' | 'no' }[]; // newest first
  hasPersonalTargetOverride: boolean;
}): WorkspaceAthlete {
  const withMass = input.history.filter(
    (h): h is { measured_on: string; body_mass_kg: number } => h.body_mass_kg !== null,
  );
  const ascending = [...withMass].reverse();
  const massHistory: MassPoint[] = ascending.map((h) => ({ date: h.measured_on, kg: h.body_mass_kg }));
  const latest = withMass[0] ?? null;
  const massKg = latest?.body_mass_kg ?? null;

  // 7-day change: the nearest reading at or before 7 days prior to the latest one,
  // same "nearest available, not an exact day count" approach playerProfile.ts already
  // uses for its own weight-trend delta.
  let change7d: number | null = null;
  let change12wk: number | null = null;
  if (latest) {
    const latestDate = new Date(`${latest.measured_on}T12:00:00Z`).getTime();
    const findNearestBefore = (days: number) => {
      const targetTime = latestDate - days * 86400000;
      const candidates = withMass.filter(
        (h) => new Date(`${h.measured_on}T12:00:00Z`).getTime() <= targetTime,
      );
      return candidates[0] ?? null; // withMass is newest-first, so [0] is nearest to target
    };
    const prior7 = findNearestBefore(7);
    if (prior7) change7d = pctChange(latest.body_mass_kg, prior7.body_mass_kg);
    const prior12wk = findNearestBefore(84);
    if (prior12wk) change12wk = pctChange(latest.body_mass_kg, prior12wk.body_mass_kg);
  }

  // Weekly weigh-ins for the band: one per ISO week, latest reading in that week.
  const byWeek = new Map<string, number>();
  for (const h of massHistory) {
    const wk = mondayOfLocal(h.date);
    byWeek.set(wk, h.kg); // massHistory is ascending, so the last write per week is the latest in that week
  }
  const weeklyMasses = [...byWeek.values()];
  const massBand = computeMassBand(weeklyMasses);

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
    change7d,
    change12wk,
    loggedDatesThisWeek,
    recentCheckins: input.checkins.map((c) => ({ weekStart: c.week_start, answer: c.answer })),
    hasPersonalTargetOverride: input.hasPersonalTargetOverride,
  };
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
    if (a.change7d !== null && a.change7d <= -2) {
      rows.push({
        athleteId: a.id,
        name: a.displayName,
        reason: 'mass_down',
        label: 'Body mass down',
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
