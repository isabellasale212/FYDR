/* The weekly check-in's question, naming its week — §0u, decided by Isabella
 * 2026-09-10: "fix the copy, keep the default". The screen asks about the
 * last COMPLETED week (you cannot answer "most days" about a week still
 * running), and the question used to say "this week" over a week line that
 * said otherwise — an athlete reading the question and not the small line
 * above it answered about the wrong week. The rule: name the dates in the
 * question itself; in the correction flow, where the week can be months old
 * and "last week" alone would be wrong, the date range carries the meaning.
 */

import { addDays } from '@/lib/format';

/** "24 to 30 Aug", or "31 Aug to 6 Sept" across a month end. */
export function shortWeekRange(weekStart: string, timezone: string): string {
  const weekEnd = addDays(weekStart, 6);
  const day = (iso: string, withMonth: boolean) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', ...(withMonth ? { month: 'short' } : {}), timeZone: timezone }).format(
      new Date(`${iso}T12:00:00Z`),
    );
  const sameMonth = weekStart.slice(0, 7) === weekEnd.slice(0, 7);
  return sameMonth ? `${day(weekStart, false)} to ${day(weekEnd, true)}` : `${day(weekStart, true)} to ${day(weekEnd, true)}`;
}

export function weekQuestion(weekStart: string, lastCompletedWeek: string, timezone: string): string {
  const range = shortWeekRange(weekStart, timezone);
  return weekStart === lastCompletedWeek
    ? `Did you hit your protein target most days last week (${range})?`
    : `Did you hit your protein target most days in the week of ${range}?`;
}
