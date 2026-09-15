/* The rated-session rule's one sentence — PATTERN-S4 C4 (Isabella, 13 Sept
 * 2026, batch B6), built on the session screen 14 Sept and on the schedule
 * grid 15 Sept (decision-batch-2026-09-15.md #6: "a rule that holds on one
 * screen and not the other is worse than no rule … Same rule, same wording").
 *
 * A session with at least one rating is read-only: the rating is tied to
 * the session's date and duration, and neither follows an edit nor
 * detaches from one, so the edit is not offered anywhere. Cancelling stays
 * available (the session screen's Cancel; the grid's Remove, which cancels
 * a session carrying data when the week is published), and a new session
 * is the way to change the details. Both screens read this so they cannot
 * drift apart by a word. */
export function ratedSessionSentence(ratingCount: number): string {
  return `This session has been rated by ${ratingCount} ${ratingCount === 1 ? 'athlete' : 'athletes'}. Ratings are tied to its date and duration, so it cannot be changed. Cancel it and create a new one if the details are wrong.`;
}
