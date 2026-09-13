/* PATTERN-S7 C8 (2026-09-13): ONE floor for every squad aggregate — a
 * median, a band, a mean, a heat ramp — on every report and panel. Five
 * athletes with data. Below it the aggregate is not shown and the notice
 * says so, and that the individual numbers are unchanged.
 *
 * Five, not the leaderboard's three: migration 0016's floor guards a RANK,
 * which leaks only an ordering; an aggregate leaks magnitudes — with n = 3 a
 * median IS one athlete's exact value, and a coach who knows the other two
 * knows whose. Five is the smallest n at which a median is interpolated away
 * from any single reading and the quartiles span more than one person each
 * (positionalContext.ts's own reasoning, now the one rule). The rules with a
 * different KIND of floor — an ACWR needs 21 of 28 days for one athlete,
 * a rolling band needs 10 observations of one series — are about one
 * person's history, not the squad, and stay their own. */
export const MIN_ATHLETES_WITH_DATA = 5;

/** True when an aggregate over `n` athletes must not be shown. */
export function belowSquadFloor(n: number): boolean {
  return n < MIN_ATHLETES_WITH_DATA;
}

/** The one notice, in words: what is off, how many have data, and that the
 *  individual numbers are unchanged. `what` is the aggregate's name — "Shading",
 *  "The squad median", "The squad mean". */
export function squadFloorNote(what: string, n: number): string {
  const have = n === 0 ? 'no athletes have' : n === 1 ? '1 athlete has' : `${n} athletes have`;
  return `${what} is off — ${have} data, fewer than ${MIN_ATHLETES_WITH_DATA}. The individual numbers are unchanged.`;
}
