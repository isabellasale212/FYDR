/* PATTERN-S8 C10 (2026-09-13): subject access on one pattern across the
 * staff side (/settings/subject-access) and the athlete side (/me/privacy):
 * the same stage words, the same due line, the same "waiting on whom", and
 * the same list of what the pack holds — SAR_CATEGORIES, the pack's own
 * manifest — so what a sport scientist sees in the queue is what the
 * athlete reads about their own request. Pure. */

import { SAR_CATEGORIES } from '@/lib/subjectAccess/manifest';

export type SarStatus = 'pending_review' | 'reviewed' | 'released';

/** Whole days until the due date, negative once past. */
export function daysUntil(dueAtIso: string, nowMs = Date.now()): number {
  return Math.ceil((new Date(dueAtIso).getTime() - nowMs) / 86_400_000);
}

/** "19 days left", "due today", "3 days overdue" — and its tone. */
export function sarDueWords(dueAtIso: string, status: SarStatus, nowMs = Date.now()): { text: string; tone: 'bad' | 'warn' | 'neutral' } | null {
  if (status === 'released') return null;
  const d = daysUntil(dueAtIso, nowMs);
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, tone: 'bad' };
  if (d === 0) return { text: 'due today', tone: 'bad' };
  return { text: `${d} day${d === 1 ? '' : 's'} left`, tone: d <= 7 ? 'bad' : d <= 14 ? 'warn' : 'neutral' };
}

/** Who acts next, said the same way to staff and to the athlete. */
export function sarNextStep(status: SarStatus): string {
  switch (status) {
    case 'pending_review':
      return 'Waiting on the medic to review the clinical notes';
    case 'reviewed':
      return 'Reviewed — waiting on the sport scientist to release the pack';
    case 'released':
      return 'Released';
  }
}

/** The athlete's own sentence about a request that concerns them. */
export function sarAthleteLine(o: { status: SarStatus; requestedAt: string; requestedBy: string | null; dueAt: string; releasedAt: string | null; formatDate: (iso: string) => string; nowMs?: number }): string {
  const by = o.requestedBy ? ` by ${o.requestedBy}` : '';
  if (o.status === 'released') {
    return `A copy of your data was released${o.releasedAt ? ` on ${o.formatDate(o.releasedAt)}` : ''}, from a request opened on ${o.formatDate(o.requestedAt)}${by}. Ask the person who opened it if you have not received it.`;
  }
  const due = sarDueWords(o.dueAt, o.status, o.nowMs);
  return `A request for a copy of your data was opened on ${o.formatDate(o.requestedAt)}${by}. It is due by ${o.formatDate(o.dueAt)}${due ? ` (${due.text})` : ''}. ${sarNextStep(o.status)}.`;
}

/** What the pack holds — the manifest's categories, in its order. One list
 *  for the staff review screen and the athlete's page. */
export function sarPackContents(): { category: string; source: string; retention: string }[] {
  return SAR_CATEGORIES.map((c) => ({ category: c.category, source: c.source, retention: c.retention }));
}

/** How an athlete gets a copy, now that the self-export is gone
 *  (2026-09-13): they ask the club, out of band; the club opens the
 *  request; the clock is one month. */
export const SAR_HOW_TO_ASK = [
  'Ask your club — the sport scientist, or a medic — in person, by message or by email. Any form of asking counts.',
  'They open a request here, which starts a one-month clock the club can see counting down.',
  'A medic reviews any clinical notes first. A note can be withheld only under the serious-harm test, and the pack says so where one is.',
  'The sport scientist releases the pack and hands it to you. Every release is written to the audit log.',
] as const;
