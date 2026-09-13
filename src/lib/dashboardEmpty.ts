/* PATTERN-S6 C8, the dashboard (2026-09-13): its three empties in the one
 * grammar the reports use (lib/staffEmpty.ts) — what is empty, why, what would
 * fill it, the nearest thing on record, "Nothing is missing", and one action.
 *
 * The dashboard is one day, so "widen the window" means the nearest day that
 * has something: inside the week strip the action selects that day here,
 * outside it the action opens the schedule on it. The group filter never
 * empties a day — fetchTimetableDay returns every session on the day and the
 * filter narrows who is expected — so the day empty never says "for this
 * filter"; only the session card and the flags panel, whose counts the
 * filter does narrow, use the filter grammar.
 *
 * Pure: exercised with values by scripts/test-dashboard-empty.ts. */

export type NearestSessionDay = {
  date: string; // YYYY-MM-DD in the org's timezone
  label: string; // "Thu 17 Sep"
  title: string;
  direction: 'next' | 'previous';
};

export type DashboardEmptyCopy = {
  title: string;
  body: string;
  action: { href: string; label: string } | null;
};

function withGroups(href: string, groupsQs: string | undefined): string {
  if (!groupsQs) return href;
  return `${href}${href.includes('?') ? '&' : '?'}groups=${encodeURIComponent(groupsQs)}`;
}

/** The day timeline with no session on it. */
export function dayEmptyCopy(o: {
  dayLabel: string;
  nearest: NearestSessionDay | null;
  weekStart: string;
  weekEnd: string;
  groupsQs: string | undefined;
}): DashboardEmptyCopy {
  const onRecord = !o.nearest
    ? 'No session is on record for the club yet.'
    : o.nearest.direction === 'next'
      ? `The next session on record is ${o.nearest.label}, ${o.nearest.title}.`
      : `The most recent session on record was ${o.nearest.label}, ${o.nearest.title}.`;
  const action = !o.nearest
    ? { href: '/schedule', label: 'Open the schedule' }
    : o.nearest.date >= o.weekStart && o.nearest.date <= o.weekEnd
      ? { href: withGroups(`/dashboard?day=${o.nearest.date}`, o.groupsQs), label: `Show ${o.nearest.label}` }
      : { href: withGroups(`/schedule?date=${o.nearest.date}`, o.groupsQs), label: `Open the schedule for ${o.nearest.label}` };
  return {
    title: `Nothing scheduled for ${o.dayLabel}.`,
    body: `Nothing is missing — no session is published for this day. ${onRecord} A session appears here the moment it is published on the schedule.`,
    action,
  };
}

const athletes = (n: number) => `${n} athlete${n === 1 ? '' : 's'}`;

/** A session card with nobody flagged: the count it is clean over. */
export function sessionAllClearLine(o: { expected: number; past: boolean; scopeWords: string }): string {
  if (o.expected === 0) {
    return o.scopeWords === 'the squad'
      ? 'No athlete is expected at this session yet. Nothing is missing — nobody has been added to it.'
      : `Nobody in ${o.scopeWords} is expected at this session. Nothing is missing — the filter is what is empty.`;
  }
  const over = o.expected === 1 ? `the ${athletes(1)} expected` : `any of the ${athletes(o.expected)} expected`;
  return `No flag ${o.past ? 'was raised ' : ''}against ${over}. Nothing is missing.`;
}

/** The flags panel with no open flag: the count it is clear over, and the
 *  threshold it is measured against. */
export function flagsAllClearLine(o: { inScope: number; scopeWords: string }): string {
  if (o.inScope === 0) return `No athlete in ${o.scopeWords}. Nothing is missing — the filter is what is empty.`;
  const over = o.inScope === 1 ? `the ${athletes(1)} in ${o.scopeWords}` : `any of the ${athletes(o.inScope)} in ${o.scopeWords}`;
  return `No open flag on ${over} — none above a club threshold. Nothing is missing.`;
}
