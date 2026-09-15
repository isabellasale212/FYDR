/* THE THREE STATUS CARDS ON TODAY — Isabella, 16 September 2026 (the
 * overnight queue, 1.1): check-in, gym and the weekly nutrition check-in are
 * three cards that STAY IN PLACE and carry a state — done, to do, overdue —
 * as a colour and, always, as a word. They do not vanish when done; a done
 * card is not a control. Overdue means the day's window has closed and it
 * was not done. Pure, so the guard can hold every branch.
 *
 * THE WINDOWS, and where each comes from:
 *   - the morning check-in closes at 09:00 club time — the figure the staff
 *     dashboard has always stated ("window closes 09:00", the Wellness-in
 *     tile). The form still accepts the day's entry after that, so an
 *     overdue check-in stays tappable: late is better than never, and the
 *     word says which it is. Not expected today (no expectation row) is a
 *     fourth, neutral state, so the card still stands.
 *   - a gym session's window is the scheduled session itself (session_type
 *     gym on the day's schedule): to do until the last of the day's gym
 *     sessions has ended, overdue after it if nothing was logged complete,
 *     done once a session log is complete today. A session under way is to
 *     do, with its count. No gym on the schedule and nothing logged is the
 *     neutral state.
 *   - the weekly nutrition check-in asks about LAST week and is open all of
 *     this week (04-weekly-nutrition-check-in.md), so on Today it is done or
 *     to do and never overdue inside its own window. Recorded on the sheet.
 */
export type TodoState = 'done' | 'todo' | 'overdue' | 'none';

export const CHECKIN_WINDOW_CLOSES = '09:00';

export const STATE_WORD: Record<TodoState, string> = {
  done: 'Done',
  todo: 'To do',
  overdue: 'Overdue',
  none: 'Nothing today',
};

export function checkinState(o: { done: boolean; expected: boolean; clockHm: string }): TodoState {
  if (o.done) return 'done';
  if (!o.expected) return 'none';
  return o.clockHm >= CHECKIN_WINDOW_CLOSES ? 'overdue' : 'todo';
}

export function gymState(o: {
  doneToday: boolean;
  underWay: boolean;
  /** The day's scheduled gym sessions: when each ends, ms since the epoch. */
  gymEndsAtMs: readonly number[];
  nowMs: number;
}): TodoState {
  /* A session under way is still to do, even beside one finished today: a
     day can hold two, and the card is the way back into the open one. */
  if (o.underWay) return 'todo';
  if (o.doneToday) return 'done';
  if (o.gymEndsAtMs.length === 0) return 'none';
  return o.gymEndsAtMs.every((end) => end < o.nowMs) ? 'overdue' : 'todo';
}

export function nutritionState(o: { done: boolean }): TodoState {
  return o.done ? 'done' : 'todo';
}
