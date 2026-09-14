/* The gym half of the outbox retry — one function, two callers.
 *
 * ATH-ADULT-09 C4 (decided 2026-09-12): a set that could not send stays
 * queued on the phone (lib/outbox.ts) and used to be retried only by
 * OutboxFlusher on Today. An athlete who lost signal in the gym basement
 * and got it back mid-session had to leave the logger to see their sets
 * land. Now the logger retries its own session's sets on mount and on the
 * browser's `online` event, and says what is still waiting; Today's
 * flusher keeps retrying everything, including the sets of a session the
 * athlete closed. Both call this, so §0aa's rule travels with it:
 *
 *   a duplicate-key hit is NEVER read as "delivered" without asking. The
 *   slot is looked up in gym_set_logs_current; the athlete's own id live
 *   means an earlier attempt landed (dequeue); a different id with
 *   different numbers is a conflict the athlete must see (marked, kept);
 *   no answer (still no signal) stays queued for next time.
 *
 * Nothing here is React. It reads and writes the outbox in localStorage
 * through lib/outbox.ts and talks to the database through the client the
 * caller hands over.
 */
import {
  dequeueGymSetLog,
  markGymSetClosed,
  markGymSetConflict,
  pendingGymSetLogs,
  type PendingGymSetLog,
} from '@/lib/outbox';
import { fetchGymSetForSlot, fetchGymSetNaming, submitGymSetLog } from '@/lib/queries/programmes';
import { classifyGymSetConflict } from '@/lib/gymSetConflict';
import type { Db } from '@/lib/queries/groups';

export type ConflictOutcome = 'delivered' | 'conflict' | 'unknown';

/** See OutboxFlusher's note on the two causes of a duplicate-key error. */
export function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('duplicate key');
}

/** A refusal by row-level security (42501, "new row violates row-level
 *  security policy") — the database's answer to a row its policy will never
 *  admit. Not a signal failure and not a slot conflict: retrying repeats it.
 *  PATTERN-S6 C10 (batch A20): the weekly check-in's week window is the one
 *  policy an athlete's queued write can age out of. */
export function isPolicyRefusal(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes('row-level security') || (err as { code?: string }).code === '42501';
}

/** §0bc (migration 0110, 2026-09-13): a complete session refuses a NEW set at
 *  the database, and the trigger names itself in the message. Not a signal
 *  failure, not a conflict with a live row — retrying can never succeed. */
export function isClosedLogError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('session_log_closed');
}

/** §0bc: flag a refused set so Today shows it once — numbers kept, never
 *  retried. Names it while the connection is there; a failed lookup still
 *  flags it, with "this exercise" as the fallback on Today. Shared by the
 *  logger's onError and the flush below. */
export async function flagClosedGymSet(db: Db, item: PendingGymSetLog): Promise<void> {
  let naming: NonNullable<PendingGymSetLog['closedLog']> = { exercise_name: null, entry_date: null };
  try {
    naming = await fetchGymSetNaming(db, item.input.exercise_id, item.input.gym_session_log_id);
  } catch {
    /* no signal for the lookup — the flag is what matters */
  }
  markGymSetClosed(item.input.id, naming);
}

/** §0aa, decided 2026-09-12. Gym is the domain where "another row is live"
 *  can still mean the athlete's numbers are safe (a second tab logged the
 *  SAME set), and where a different row is a loss of their numbers, not just
 *  a duplicate. So the lookup returns the row's values, the decision compares
 *  them (lib/gymSetConflict.ts), and a real conflict stores what is live so
 *  Today can show both sets of numbers. */
export async function resolveGymSetConflict(
  db: Db,
  athleteId: string,
  item: PendingGymSetLog,
): Promise<ConflictOutcome> {
  void athleteId; // RLS scopes gym_set_logs_current to the athlete's own rows
  try {
    const live = await fetchGymSetForSlot(db, item.input);
    if (classifyGymSetConflict(item.input, live) === 'delivered') return 'delivered';
    const naming = await fetchGymSetNaming(db, item.input.exercise_id, item.input.gym_session_log_id);
    markGymSetConflict(item.input.id, live ? { ...live, ...naming } : null);
    return 'conflict';
  } catch {
    return 'unknown';
  }
}

/** How many of one session's sets are queued and not flagged — what the
 *  logger's progress row calls "waiting to send". */
export function queuedGymSets(sessionLogId: string): number {
  return pendingGymSetLogs().filter((item) => !item.conflictAt && item.input.gym_session_log_id === sessionLogId).length;
}

/** Retry every queued gym set — or, with `sessionLogId`, one session's.
 *  Items already flagged as a conflict are excluded: retrying would repeat
 *  the same collision every flush until the athlete discards it. A set the
 *  database refuses because its session is complete (§0bc) is flagged the
 *  same way on the spot — the next flush would only be refused again. Returns
 *  what was sent and what is still waiting (conflicts not counted). */
export async function flushGymSets(
  db: Db,
  orgId: string,
  athleteId: string,
  opts: { sessionLogId?: string } = {},
): Promise<{ sent: number; queued: number }> {
  const items = pendingGymSetLogs().filter(
    (item) => !item.conflictAt && (opts.sessionLogId === undefined || item.input.gym_session_log_id === opts.sessionLogId),
  );
  let sent = 0;
  for (const item of items) {
    try {
      await submitGymSetLog(db, orgId, item.input);
      dequeueGymSetLog(item.input.id);
      sent += 1;
    } catch (err) {
      if (isClosedLogError(err)) {
        await flagClosedGymSet(db, item);
        continue;
      }
      if (isDuplicateKeyError(err)) {
        const outcome = await resolveGymSetConflict(db, athleteId, item);
        if (outcome === 'delivered') {
          dequeueGymSetLog(item.input.id);
          sent += 1;
        }
        /* 'conflict' is already marked by the resolver; 'unknown' stays
           queued for the next flush, like any other no-signal failure. */
      }
      /* Otherwise: still no signal. It stays queued and is tried again. */
    }
  }
  const queued = pendingGymSetLogs().filter(
    (item) => !item.conflictAt && (opts.sessionLogId === undefined || item.input.gym_session_log_id === opts.sessionLogId),
  ).length;
  return { sent, queued };
}
