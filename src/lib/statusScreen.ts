/* PATTERN-S3 C2: the athlete's status screen answers three questions as
 * sentences — can I train today, what can I do and not do, when am I back.
 * Pure, so the guard can hold the words. No pills, no judgement words;
 * "Not known yet" where the medic has set nothing; the cleared state after
 * an injury. */
import type { AvailabilityReason, AvailabilityStatus } from '@/lib/types/database';

export type StatusAnswer = { heading: string; sentence: string; sub: string | null };

const REASON_WORDS: Record<string, string> = {
  injury: 'an injury',
  illness: 'illness',
  personal: 'a personal reason',
  suspension: 'a suspension',
  load_management: 'load management',
  academic: 'an academic commitment',
  representative: 'a representative call-up',
  other: 'a reason the club has recorded',
};

export function canITrainToday(o: { status: AvailabilityStatus | null; reason: AvailabilityReason | null; restrictions: readonly string[]; note?: string | null }): StatusAnswer {
  if (o.status === null) return { heading: 'Can I train today?', sentence: 'Not known yet.', sub: 'The club has not set your availability. Until they do, nothing is restricting you.' };
  if (o.status === 'available') return { heading: 'Can I train today?', sentence: 'Yes.', sub: 'Nothing is restricting you.' };
  if (o.status === 'modified') return { heading: 'Can I train today?', sentence: 'Yes, with limits.', sub: o.restrictions.length > 0 || o.note ? 'What you can and cannot do is listed below.' : 'The club has marked you modified but recorded no restriction — ask them what they mean.' };
  const why = o.reason ? REASON_WORDS[o.reason] ?? null : null;
  return { heading: 'Can I train today?', sentence: 'Not today.', sub: why ? `You are unavailable because of ${why}.` : 'You are unavailable. The club has not recorded why.' };
}

/** The restrictions as rows; when none is recorded, the club's coach-visible
 *  note is the row — it is the restriction in words ("Describe the restriction,
 *  not the injury" is what the form asks for). */
export function whatCanIDo(o: { status: AvailabilityStatus | null; restrictions: readonly string[]; note?: string | null; label: (v: string) => string }): { heading: string; rows: string[]; sentence: string | null } {
  const rows = o.restrictions.map(o.label);
  const note = o.note?.trim() ? [o.note.trim()] : [];
  if (o.status === null) return { heading: 'What can I do and not do', rows: [], sentence: 'Not known yet.' };
  if (o.status === 'available') return { heading: 'What can I do and not do', rows: [], sentence: 'Everything. No restriction is recorded.' };
  if (rows.length === 0 && note.length === 0) return { heading: 'What can I do and not do', rows: [], sentence: o.status === 'unavailable' ? 'Nothing with the squad while you are unavailable.' : 'No restriction is recorded.' };
  return { heading: 'What can I do and not do', rows: rows.length > 0 ? rows : note, sentence: null };
}

export function whenAmIBack(o: { status: AvailabilityStatus | null; expectedReturn: string | null; today: string; clearedOn: string | null; format: (d: string) => string }): StatusAnswer {
  if (o.status === 'available' || o.status === null) {
    if (o.clearedOn) return { heading: 'When am I back', sentence: 'You are back.', sub: `Cleared on ${o.format(o.clearedOn)}.` };
    return { heading: 'When am I back', sentence: 'You are not away.', sub: null };
  }
  if (o.expectedReturn && o.expectedReturn >= o.today) return { heading: 'When am I back', sentence: `Expected back ${o.format(o.expectedReturn)}.`, sub: 'The medic updates this as you go. It is an expectation, not a promise.' };
  if (o.expectedReturn && o.expectedReturn < o.today) return { heading: 'When am I back', sentence: 'The expected date has passed.', sub: `It was ${o.format(o.expectedReturn)}. The medic has not set a new one yet.` };
  return { heading: 'When am I back', sentence: 'No date yet.', sub: 'The medic has not set an expected return.' };
}

/** The stage ladder's state words — Done, Now, Next, Later, Cleared — with
 *  no invented stage names. `total` null means no protocol is open. */
export type LadderRung = { n: number; state: 'done' | 'now' | 'next' | 'later' | 'cleared' };
export function stageLadder(current: number | null, total: number | null, cleared: boolean): LadderRung[] {
  if (total === null || total <= 0) return [];
  const rungs: LadderRung[] = [];
  for (let n = 1; n <= total; n += 1) {
    const state: LadderRung['state'] = cleared ? 'cleared' : current === null ? (n === 1 ? 'next' : 'later') : n < current ? 'done' : n === current ? 'now' : n === current + 1 ? 'next' : 'later';
    rungs.push({ n, state });
  }
  return rungs;
}
