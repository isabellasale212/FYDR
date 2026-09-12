/* What to do with a gym set that was queued offline and collided with a set
 * already live in the same slot — §0aa, decided by Isabella 2026-09-12.
 *
 * The three plain-submit domains (wellness, RPE, nutrition) look the slot up
 * on a duplicate-key error and ask whose row is live; only gym used to treat
 * every collision as its own replay and dequeue it as sent. Two athletes'
 * tabs, or a phone that logged set 3 twice with different numbers, could
 * therefore lose the athlete's numbers with nothing said.
 *
 * Pure, so it can be tested with rows. Three outcomes:
 *
 *   delivered  the live row IS this write (same id), or carries the SAME
 *              numbers under another id — nothing of the athlete's is lost
 *              either way, and the queued item can go
 *   conflict   a different row with different numbers is live, or nothing
 *              is live for the slot at all (a collision the lookup cannot
 *              explain is surfaced, never guessed away — CLAUDE.md §2 rule 6)
 *
 * 'unknown' (the lookup itself failed) is the caller's, not this function's:
 * a decision needs a row or the certainty there is none.
 */

export type GymSetNumbers = { reps_completed: number | null; load_kg: number | null; rpe: number | null };
export type LiveGymSet = GymSetNumbers & { id: string };

export function classifyGymSetConflict(
  queued: GymSetNumbers & { id: string },
  live: LiveGymSet | null,
): 'delivered' | 'conflict' {
  if (!live) return 'conflict';
  if (live.id === queued.id) return 'delivered';
  const same =
    live.reps_completed === queued.reps_completed &&
    live.load_kg === queued.load_kg &&
    live.rpe === queued.rpe;
  return same ? 'delivered' : 'conflict';
}

/** A set in words, the My data wording (an absent number is words, never a
 *  dash and never a zero). */
export function describeGymSet(v: GymSetNumbers): string {
  if (v.reps_completed === null && v.load_kg === null) return 'nothing logged';
  if (v.load_kg === null) return `${v.reps_completed} reps, load not logged`;
  if (v.reps_completed === null) return `reps not logged at ${v.load_kg} kg`;
  return `${v.reps_completed} reps at ${v.load_kg} kg`;
}
