/* PATTERN-S7 C9 (2026-09-13): "The period control explains why the narrow
 * choice is usually wrong; navigation both ways." The compliance report is
 * the one report with a day anchor (`?to=`) beside its window length
 * (`?period=`), so it is where a window can be walked. Pure. */
import { addDays } from '@/lib/format';
import type { RangeKey } from '@/lib/period';

/** The windows that can be walked: fixed lengths. A season, a year and
 *  "all" are anchored to the calendar or the data, not to a day. */
const WALKABLE: readonly RangeKey[] = ['day', 'week', 'month'];

export function periodNav(o: {
  key: RangeKey;
  from: string;
  to: string;
  days: number;
  realToday: string;
}): { previous: { to: string; label: string } | null; next: { to: string; label: string } | null } {
  if (!WALKABLE.includes(o.key) || o.days <= 0) return { previous: null, next: null };
  const unit = o.days === 1 ? 'day' : `${o.days} days`;
  const previous = { to: addDays(o.from, -1), label: `Previous ${unit}` };
  const nextTo = addDays(o.to, o.days);
  /* Never past real today: a window ending in the future would report on
     mornings that have not happened. The last step lands on today. */
  const next =
    o.to >= o.realToday
      ? null
      : { to: nextTo > o.realToday ? o.realToday : nextTo, label: `Next ${unit}` };
  return { previous, next };
}

/** Why the narrow window is usually the wrong read, said with the number it
 *  rests on: over N expected mornings one miss moves the rate by 100/N. */
export function narrowWindowNote(days: number): string | null {
  if (days > 14) return null;
  const swing = Math.round(100 / days);
  return `Over ${days} days one missed morning moves an athlete's rate by ${swing} points — read four weeks for the habit, ${days} days for this ${days === 7 ? 'week' : 'window'}.`;
}
