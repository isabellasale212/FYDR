/* Programme dates — docs/decisions/programme-dates.md (Isabella, 15 September
 * 2026), migration 0132. A programme is a template; the assignment carries
 * the start date; there is no end date, the end falls out of the start plus
 * the programme's length; week 1 day 1 is the start. The same arithmetic as
 * the database's programme_length_weeks / programme_assignment_ends_on, kept
 * here for the screens that already hold the blocks and the start and would
 * otherwise round-trip for a subtraction — and pinned equal by the guard, so
 * the two can never disagree by a day.
 *
 * An assignment with no start date is UNMAPPED (every assignment made before
 * dates existed was left so, never given an invented date): every function
 * here answers null for it, and a screen says "no start date" rather than
 * counting weeks from nothing. */

import { addDays } from '@/lib/format';

/** The programme's length in weeks: the sum of its blocks, or its own
 *  duration_weeks when it has no blocks. Null when neither says. */
export function programmeLengthWeeks(
  blocks: readonly { duration_weeks: number }[],
  fallbackWeeks: number | null,
): number | null {
  if (blocks.length > 0) return blocks.reduce((n, b) => n + b.duration_weeks, 0);
  return fallbackWeeks;
}

/** The last day of an assignment: start + weeks·7 − 1 (the database's
 *  programme_assignment_ends_on). Null when unmapped, or when the length is
 *  unknown. */
export function assignmentEndsOn(startsOn: string | null, lengthWeeks: number | null): string | null {
  if (startsOn === null || lengthWeeks === null) return null;
  return addDays(startsOn, lengthWeeks * 7 - 1);
}

/** Which week of the block `today` falls in, clamped to the programme's
 *  length; null when unmapped. Before the start it is week 1 (the block is
 *  assigned, not yet begun); after the end it is the last week. */
export function assignmentWeekNow(startsOn: string | null, today: string, lengthWeeks: number | null): number | null {
  if (startsOn === null) return null;
  const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / 86400000);
  const week = Math.floor(elapsed / 7) + 1;
  const floored = Math.max(week, 1);
  return lengthWeeks === null ? floored : Math.min(floored, lengthWeeks);
}

/** Over: the weeks have run out. Never true for an unmapped assignment. */
export function assignmentFinished(startsOn: string | null, today: string, lengthWeeks: number | null): boolean {
  const end = assignmentEndsOn(startsOn, lengthWeeks);
  return end !== null && end < today;
}

/** Not yet begun: the start is after today. */
export function assignmentNotStarted(startsOn: string | null, today: string): boolean {
  return startsOn !== null && startsOn > today;
}
