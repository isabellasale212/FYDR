/* The empty period on My data — ATH-ADULT-12 C6 (decided 2026-09-12), written
 * to PATTERN-S6's one grammar for an empty state: what is empty, with its
 * window; why; what would fill it; where the data actually is; one action
 * that changes the window. Never a zero, never "never" when the truth is
 * "not in this period".
 *
 * Two states, and they are different states:
 *
 *   NOTHING IN THIS PERIOD — data exists on record, outside the window. The
 *   copy names the most recent entry and its date, says it is still there,
 *   and offers ONE action that widens the window to the smallest period that
 *   contains it (this season, or all on record). The period never widens on
 *   its own.
 *
 *   NOTHING ON RECORD YET — a brand-new athlete. No action, no fabricated
 *   zero; the sentence says what would fill it.
 *
 * Pure: the page passes the period, the latest date it read, the season
 * start and today; the copy comes back. Registry-free — no number here.
 */
import type { RangeKey } from '@/lib/period';

export type EmptyDomain = 'wellness' | 'gym' | 'training' | 'nutrition';

const NOUN: Record<EmptyDomain, string> = {
  wellness: 'morning check-in',
  gym: 'gym session',
  training: 'rated session',
  nutrition: 'weekly check-in',
};

/** What would fill it — the domain's own sentence, in the athlete's terms. */
const FILLS: Record<EmptyDomain, string> = {
  wellness: 'Your morning check-ins appear here once you start submitting them.',
  gym: 'Gym sessions appear here once you finish one.',
  training: 'Sessions appear here once you are named in one and rate it.',
  nutrition: 'Your weekly check-ins appear here once you start answering them.',
};

export type EmptyPeriodCopy = {
  title: string;
  body: string;
  /** The one action: widen to the smallest period that holds the latest entry. */
  action: { label: string; period: RangeKey } | null;
};

/** "Nothing in the last 28 days." from the control's own label — the same
 *  words the select shows, never the raw key. */
export function emptyTitle(rangeLabel: string): string {
  const l = rangeLabel.trim();
  if (/^last /i.test(l)) return `Nothing in the ${l.charAt(0).toLowerCase()}${l.slice(1)}.`;
  if (/^this /i.test(l)) return `Nothing ${l.charAt(0).toLowerCase()}${l.slice(1)}.`;
  return `Nothing in this period.`;
}

/** Whole days between two YYYY-MM-DD dates, today − then. */
export function daysAgo(then: string, today: string): number {
  const a = Date.UTC(Number(then.slice(0, 4)), Number(then.slice(5, 7)) - 1, Number(then.slice(8, 10)));
  const b = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return Math.round((b - a) / 86400000);
}

export function agoLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** The smallest period that contains the latest entry: this season when the
 *  entry is on or after the season start, otherwise all on record. Null when
 *  the current period already contains it (then the tab is not empty for
 *  this reason) or when there is no wider period to offer. */
export function widenTo(
  periodKey: RangeKey,
  latest: string,
  seasonStart: string | null,
): { label: string; period: RangeKey } | null {
  if (periodKey === 'all') return null;
  const inSeason = seasonStart !== null && latest >= seasonStart;
  if (inSeason && periodKey !== 'season' && periodKey !== 'year') return { label: 'Show this season', period: 'season' };
  return { label: 'Show all on record', period: 'all' };
}

export function emptyPeriodCopy(input: {
  domain: EmptyDomain;
  periodKey: RangeKey;
  rangeLabel: string;
  /** The athlete's most recent entry in this domain, any period; null = nothing on record. */
  latest: string | null;
  latestLabel: string | null;
  seasonStart: string | null;
  today: string;
}): EmptyPeriodCopy {
  const { domain, periodKey, rangeLabel, latest, latestLabel, seasonStart, today } = input;
  if (latest === null || periodKey === 'all') {
    return { title: 'Nothing on record yet.', body: FILLS[domain], action: null };
  }
  const when = domain === 'nutrition' ? `for the week of ${latestLabel ?? latest}` : `${latestLabel ?? latest}, ${agoLabel(daysAgo(latest, today))}`;
  return {
    title: emptyTitle(rangeLabel),
    body: `Your last ${NOUN[domain]} was ${when}. It is still on record, just before the period you have chosen. ${FILLS[domain]}`,
    action: widenTo(periodKey, latest, seasonStart),
  };
}
