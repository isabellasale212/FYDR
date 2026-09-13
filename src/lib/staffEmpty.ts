/* PATTERN-S6 C8 (2026-09-13): staff empty states in the one grammar — what is
 * empty with its window, why, what would fill it, where the data actually is,
 * and one action that widens the window. "Not in this period" is never
 * written as "never": when data exists outside the window the copy names the
 * most recent record and its date, and the action widens to the smallest
 * period that holds it. Only with nothing on record does it say so, and then
 * that the record is not broken: "Nothing is missing."
 *
 * The athlete's own version is lib/myDataEmpty.ts (ATH-ADULT-12 C6); this
 * is the third-person twin for the staff app, one screen a commit. Pure. */
import type { RangeKey } from '@/lib/period';
import { agoLabel, daysAgo, emptyTitle, widenTo } from '@/lib/myDataEmpty';

export type StaffEmptyDomain = 'wellness' | 'gym' | 'training' | 'nutrition' | 'testing' | 'gps';

const NOUN: Record<StaffEmptyDomain, string> = {
  wellness: 'morning check-in',
  gym: 'gym session',
  training: 'rated session',
  nutrition: 'weekly check-in',
  testing: 'test result',
  gps: 'GPS record',
};

/** What would fill it, in the staff reader's terms. */
const FILLS: Record<StaffEmptyDomain, string> = {
  wellness: 'A morning check-in appears here the day it is submitted.',
  gym: 'A gym session appears here once it is finished.',
  training: 'A rated session appears here once the athlete is named in one and rates it.',
  nutrition: 'A weekly check-in appears here the week it is answered.',
  testing: 'A test result appears here once a member of staff enters one.',
  gps: 'A GPS record appears here once a session file is imported for them.',
};

export type StaffEmptyCopy = {
  title: string;
  body: string;
  /** The one action: widen to the smallest period that holds the latest record. */
  action: { label: string; period: RangeKey } | null;
};

export function staffEmptyCopy(input: {
  domain: StaffEmptyDomain;
  /** The athlete's first name, for "Dan's last morning check-in was …". */
  firstName: string;
  periodKey: RangeKey;
  rangeLabel: string;
  /** The most recent record in this domain, any period; null = nothing on record. */
  latest: string | null;
  latestLabel: string | null;
  seasonStart: string | null;
  today: string;
}): StaffEmptyCopy {
  const { domain, firstName, periodKey, rangeLabel, latest, latestLabel, seasonStart, today } = input;
  if (latest === null || periodKey === 'all') {
    return {
      title: `No ${NOUN[domain]} on record for ${firstName}.`,
      body: `Nothing is missing — none has been recorded yet. ${FILLS[domain]}`,
      action: null,
    };
  }
  const when = domain === 'nutrition' ? `for the week of ${latestLabel ?? latest}` : `${latestLabel ?? latest}, ${agoLabel(daysAgo(latest, today))}`;
  const whose = `${firstName}'s`;
  return {
    title: emptyTitle(rangeLabel),
    /* A sentence starts with a capital, whoever it is about — "The squad's". */
    body: `${whose.charAt(0).toUpperCase()}${whose.slice(1)} last ${NOUN[domain]} was ${when}. It is still on record, just before the period chosen. ${FILLS[domain]}`,
    action: widenTo(periodKey, latest, seasonStart),
  };
}

/** A filter that leaves nothing: what is empty with its denominator and the
 *  filter's name, why, and the one action — widen the filter to the whole
 *  squad. The scope label is the chip's own words ("Academy"). */
export function filterEmptyCopy(o: { what: string; inScope: number; scopeLabel: string; why: string }): StaffEmptyCopy & { clearsFilter: true } {
  return {
    title: `No ${o.what} for ${o.scopeLabel}.`,
    body: `None of the ${o.inScope} athlete${o.inScope === 1 ? '' : 's'} in ${o.scopeLabel} ${o.why}. Nothing is missing — the filter is what is empty.`,
    action: { label: 'Show the whole squad', period: 'all' },
    clearsFilter: true,
  };
}

/** Nothing on record for the club at all: said as such, with what would fill
 *  it and where the data enters. No action — there is no window to widen. */
export function clubEmptyCopy(o: { what: string; fills: string }): StaffEmptyCopy {
  return {
    title: `No ${o.what} on record for the club.`,
    body: `Nothing is missing — none has been recorded yet. ${o.fills}`,
    action: null,
  };
}
