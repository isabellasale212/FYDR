/* PATTERN-S7 catalogue, squad weekly (2026-09-13): "The week Monday to Sunday,
 * club local time." The one rule for which week the squad weekly report is
 * about, shared by the page and both exports.
 *
 * The anchor is any day (the page's ?week=, or an old ?to= link); the week is
 * the Monday-to-Sunday week that contains it, clamped so the current week runs
 * Monday to today and nothing is ever asked about a day that has not
 * happened. Dates are the club's local calendar dates (YYYY-MM-DD); mondayOf
 * is the same Monday rule the schedule, the dashboard strip and the nutrition
 * check-in use.
 *
 * Pure; exercised by scripts/test-squad-week.ts. */

import { addDays } from '@/lib/format';
import { mondayOf } from '@/lib/queries/schedule';

export type SquadWeek = {
  from: string;
  to: string;
  /** The Monday a week earlier — always available. */
  prev: string;
  /** The Monday a week later, or null when this is the current week. */
  next: string | null;
  isCurrent: boolean;
};

export function squadWeek(o: { anchor: string; today: string }): SquadWeek {
  const thisMonday = mondayOf(o.today);
  const anchor = o.anchor > o.today ? o.today : o.anchor;
  const from = mondayOf(anchor);
  const sunday = addDays(from, 6);
  const isCurrent = from === thisMonday;
  return {
    from,
    to: isCurrent ? o.today : sunday,
    prev: addDays(from, -7),
    next: isCurrent ? null : addDays(from, 7),
    isCurrent,
  };
}
