/* When a session's RPE is wanted, stated once.
 *
 * The RPE screen has always refused a rating until thirty minutes after the
 * session ended — "an RPE taken immediately after a session is biased by the
 * final drill" (screens/training-entry.md, 04-data-model.md §5). Today's to-do
 * list, until 2026-09-11, listed the session from midnight: an athlete could
 * tap the row before the session had even started and land on "Not quite
 * yet". Two rules for one question. This is the one, and both read it.
 *
 * A session with no duration is treated as ending when it starts. That is
 * new for the RPE screen, which used to skip its gate entirely for such a
 * session; thirty minutes after the start is the closest the rule can get
 * when the end is unknown, and it is the same answer on both screens.
 */

import { addDays, dateInTz, zonedTimeToUtcIso } from '@/lib/format';

export const DUE_DELAY_MIN = 30;

export type RpeSession = { starts_at: string; duration_min: number | null };

/** The instant the session ends, in ms since the epoch. */
export function sessionEndsAt(session: RpeSession): number {
  return new Date(session.starts_at).getTime() + (session.duration_min ?? 0) * 60_000;
}

/** The instant a rating is first accepted. */
export function rpeDueAt(session: RpeSession): number {
  return sessionEndsAt(session) + DUE_DELAY_MIN * 60_000;
}

export function rpeIsDue(session: RpeSession, now: number = Date.now()): boolean {
  return now >= rpeDueAt(session);
}

/** The instant a rating stops being accepted: the end of the FOLLOWING day
 *  in club time — the moment Today's row disappears (decided 2026-09-11,
 *  with the carry-over window). Computed from the session's own club-local
 *  day, so a session that ends at 23:50 closes a full day later, not ten
 *  minutes later.
 *
 *  Only the screen and the list read this. Nothing in the database refuses a
 *  late row: an athlete's own offline rating, made in time and flushed late
 *  by the outbox, still lands, and revise_training_entry (staff only) needs
 *  an existing row and never creates one, so no staff path depends on the
 *  screen accepting a late entry. */
export function rpeClosesAt(session: RpeSession, timezone: string): number {
  const sessionDay = dateInTz(new Date(sessionEndsAt(session)), timezone);
  const nextMidnight = zonedTimeToUtcIso(addDays(sessionDay, 2), '00:00', timezone);
  return new Date(nextMidnight).getTime();
}

export function rpeIsClosed(session: RpeSession, timezone: string, now: number = Date.now()): boolean {
  return now >= rpeClosesAt(session, timezone);
}
