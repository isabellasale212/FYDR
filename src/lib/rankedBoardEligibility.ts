/* Children's Code default 1 (Isabella, 2026-09-13): an under-18 athlete is
 * excluded from ranked boards and streak mechanics by default; a recorded
 * consent for leaderboard_visibility lifts it. The database has held this
 * rule for the staff-published boards since 0016 (compute_leaderboard's
 * population clause, athlete_is_minor); the staff wall did not — it ranked
 * every live athlete. This is the same rule for the wall, in one place, so
 * the two cannot drift: an athlete with no date of birth counts as a minor,
 * exactly as athlete_is_minor decides it.
 *
 * "Academy" (membership of an age-type group) is on the sheet as a
 * question — by age, or by group as well; only the age half is here. */

export type RankedEligibilityInput = {
  /** Age in whole years today, or null when no date of birth is on file. */
  age: number | null;
  /** A live leaderboard_visibility consent (granted, not withdrawn). */
  consented: boolean;
};

export function rankedBoardEligible(a: RankedEligibilityInput): boolean {
  const minor = a.age === null || a.age < 18;
  return !minor || a.consented;
}

/** The wall's sentence for what it left out — the denominator, in words. */
export function excludedMinorsLine(excluded: number): string | null {
  if (excluded === 0) return null;
  return `${excluded} under-18 athlete${excluded === 1 ? ' is' : 's are'} not ranked. An athlete under 18 appears on a ranked board only with a recorded consent; silence means absent.`;
}
