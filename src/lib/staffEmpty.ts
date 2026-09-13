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

export type StaffEmptyDomain = 'wellness' | 'gym' | 'training' | 'nutrition' | 'testing';

const NOUN: Record<StaffEmptyDomain, string> = {
  wellness: 'morning check-in',
  gym: 'gym session',
  training: 'rated session',
  nutrition: 'weekly check-in',
  testing: 'test result',
};

/** What would fill it, in the staff reader's terms. */
const FILLS: Record<StaffEmptyDomain, string> = {
  wellness: 'A morning check-in appears here the day it is submitted.',
  gym: 'A gym session appears here once it is finished.',
  training: 'A rated session appears here once the athlete is named in one and rates it.',
  nutrition: 'A weekly check-in appears here the week it is answered.',
  testing: 'A test result appears here once a member of staff enters one.',
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
  return {
    title: emptyTitle(rangeLabel),
    body: `${firstName}'s last ${NOUN[domain]} was ${when}. It is still on record, just before the period chosen. ${FILLS[domain]}`,
    action: widenTo(periodKey, latest, seasonStart),
  };
}
