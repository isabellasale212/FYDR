/* Children's Code, ruled by Isabella 2026-09-13: an under-18 athlete is
 * excluded from ranked boards and streak mechanics, full stop, until the
 * guardian route (S9) exists. The first cut (earlier the same day) let a live
 * leaderboard_visibility consent lift it; the ruling removed that — a
 * sixteen-year-old tapping themselves onto a board while parental_consent_*
 * is written by nothing is consent that is not consent. Migration 0116 holds
 * the same rule for the published boards (compute_leaderboard); this is the
 * staff wall's copy, from the same definition of a minor: no date of birth
 * counts as one, exactly as athlete_is_minor decides it.
 *
 * "Academy" is by age (ruling one): a group name is a club convention. */

export type RankedEligibilityInput = {
  /** Age in whole years today, or null when no date of birth is on file. */
  age: number | null;
};

export function rankedBoardEligible(a: RankedEligibilityInput): boolean {
  return a.age !== null && a.age >= 18;
}

/** The wall's sentence for what it left out — the denominator, in words. */
export function excludedMinorsLine(excluded: number): string | null {
  if (excluded === 0) return null;
  return `${excluded} under-18 athlete${excluded === 1 ? ' is' : 's are'} not ranked. An athlete under 18 is never named on a ranked board; nothing on this screen changes that.`;
}
