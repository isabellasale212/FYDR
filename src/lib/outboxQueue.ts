/* PATTERN-S6 C1 (2026-09-13): the "Waiting to send" queue screen's rows,
 * header and empty line, from the four localStorage queues (lib/outbox.ts).
 *
 * The board's words: oldest first; each row is what the athlete did, its own
 * denominator ("six answers of six", "2 sets of 12 logged"), and the local
 * time it was saved; the header carries the count and its unit split, "4
 * entries · 5 writes", because a gym entry can hold several sets; no
 * progress bars, no spinners, no per-item retry — the send is not the
 * athlete's job. A flagged conflict is not "waiting": it is on Today's
 * notice with its Discard, and is left out here.
 *
 * Pure: no window, no fetch. Exercised by scripts/test-outbox-queue.ts. */

import { clockHM, dateInTz, formatDate } from '@/lib/format';
import type { PendingGymSetLog, PendingNutritionCheckin, PendingTraining, PendingWellness } from '@/lib/outbox';

export type QueueRow = {
  key: string;
  /** What the athlete did — "Morning check-in · Sun 13 Sept". */
  what: string;
  /** Its own denominator — "seven answers of seven", "2 sets of 12 logged". */
  denominator: string;
  /** ISO instant it was saved on this phone (the oldest set, for a gym entry). */
  savedAt: string;
  /** "07:42" when saved today in the org's timezone, else "Sat 12 Sept 20:05". */
  savedLabel: string;
  /** Rows this entry will write — 1, or the number of sets for a gym entry. */
  writes: number;
};

export type Queues = {
  wellness: readonly PendingWellness[];
  training: readonly PendingTraining[];
  nutrition: readonly PendingNutritionCheckin[];
  gym: readonly PendingGymSetLog[];
};

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const words = (n: number): string => SMALL[n] ?? String(n);

function timeIn(iso: string, timezone: string): string {
  return clockHM(iso, timezone);
}

/** "07:42" for today, "Sat 12 Sept 20:05" for any other day. */
export function savedLabel(iso: string, timezone: string, nowIso: string): string {
  const day = dateInTz(new Date(iso), timezone);
  const today = dateInTz(new Date(nowIso), timezone);
  const time = timeIn(iso, timezone);
  return day === today ? time : `${formatDate(day, timezone)} ${time}`;
}

/** The check-in's answers over its answers: the six it always carries plus
 *  each optional one that was given. What is in it, not what could have been. */
function wellnessAnswers(input: PendingWellness['input']): number {
  return 6 + (input.resting_hr !== null && input.resting_hr !== undefined ? 1 : 0) + (input.body_mass_kg !== null && input.body_mass_kg !== undefined ? 1 : 0);
}

export function queueRows(q: Queues, timezone: string, nowIso: string): QueueRow[] {
  const rows: QueueRow[] = [];

  for (const item of q.wellness) {
    if (item.conflictAt) continue;
    const n = wellnessAnswers(item.input);
    rows.push({
      key: `wellness-${item.input.id}`,
      what: `Morning check-in · ${formatDate(item.input.entry_date, timezone)}`,
      denominator: `${words(n)} answers of ${words(n)}`,
      savedAt: item.queuedAt,
      savedLabel: savedLabel(item.queuedAt, timezone, nowIso),
      writes: 1,
    });
  }

  for (const item of q.training) {
    if (item.conflictAt) continue;
    rows.push({
      key: `training-${item.input.id}`,
      what: `Session rating · ${formatDate(item.input.entry_date, timezone)}`,
      denominator: `rated ${item.input.rpe} of 10 · ${item.input.duration_min} min`,
      savedAt: item.queuedAt,
      savedLabel: savedLabel(item.queuedAt, timezone, nowIso),
      writes: 1,
    });
  }

  for (const item of q.nutrition) {
    if (item.conflictAt) continue;
    rows.push({
      key: `nutrition-${item.input.id}`,
      what: `Weekly nutrition check-in · week of ${formatDate(item.input.week_start, timezone)}`,
      denominator: 'one answer of one',
      savedAt: item.queuedAt,
      savedLabel: savedLabel(item.queuedAt, timezone, nowIso),
      writes: 1,
    });
  }

  /* A gym entry is one row for the session, however many sets are queued for
     it: the sets are the writes. Named from the context the logger queued
     with the set (the session's name, total sets and date); a set queued
     before that context existed is named plainly and counted without a total. */
  const bySession = new Map<string, PendingGymSetLog[]>();
  for (const item of q.gym) {
    if (item.conflictAt) continue;
    const list = bySession.get(item.input.gym_session_log_id) ?? [];
    list.push(item);
    bySession.set(item.input.gym_session_log_id, list);
  }
  for (const [logId, sets] of bySession) {
    const oldest = sets.map((s) => s.queuedAt).sort()[0]!;
    const ctx = sets.find((s) => s.session)?.session ?? null;
    const n = sets.length;
    rows.push({
      key: `gym-${logId}`,
      what: ctx ? `Gym · ${ctx.name} · ${formatDate(ctx.entry_date, timezone)}` : 'Gym session',
      denominator: ctx ? `${n} set${n === 1 ? '' : 's'} of ${ctx.total_sets} logged` : `${n} set${n === 1 ? '' : 's'} logged`,
      savedAt: oldest,
      savedLabel: savedLabel(oldest, timezone, nowIso),
      writes: n,
    });
  }

  return rows.sort((a, b) => (a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : 0));
}

/** "4 entries · 5 writes". */
export function queueHeader(rows: readonly QueueRow[]): string {
  const entries = rows.length;
  const writes = rows.reduce((s, r) => s + r.writes, 0);
  return `${entries} entr${entries === 1 ? 'y' : 'ies'} · ${writes} write${writes === 1 ? '' : 's'}`;
}

/** The empty screen: nothing waiting, and when this phone last sent. */
export function waitingEmptyLine(last: { count: number; at: string } | null, timezone: string, nowIso: string): string {
  if (!last) return 'Nothing is waiting. Nothing has been sent from this phone yet.';
  const day = dateInTz(new Date(last.at), timezone);
  const today = dateInTz(new Date(nowIso), timezone);
  const when = day === today ? `at ${timeIn(last.at, timezone)} today` : `${formatDate(day, timezone)} ${timeIn(last.at, timezone)}`;
  return `Nothing is waiting. Last sent ${when} — ${last.count} entr${last.count === 1 ? 'y' : 'ies'}.`;
}
