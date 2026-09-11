/* Today's rows, as pure functions of the data — ATH-ADULT-02, 2026-09-11.
 *
 * Everything here takes the clock as an argument so the tests can set it,
 * and every string an athlete reads on Today's to-do and session rows is
 * built here rather than in the page, so the two lists cannot disagree
 * about what a session is called or when it was.
 */
import { addDays, dateInTz, formatTime } from '@/lib/format';
import { rpeIsDue, sessionEndsAt, type RpeSession } from '@/lib/rpeDue';

export type OutstandingRpeSession = RpeSession & {
  id: string;
  title: string | null;
  /** The compliance expectation's date — the session's own day, club-local. */
  entry_date: string;
};

/** The RPE tasks an athlete owes right now, oldest first.
 *
 *  A task exists once its rating is due (rpeDueAt — end plus thirty minutes,
 *  the RPE screen's own gate) and not before, so a row never opens a screen
 *  that says "Not quite yet". It stays until the end of the FOLLOWING day in
 *  club time: the caller passes the expectations for yesterday and today,
 *  which is exactly that window, and matches the staff dashboard's "RPE,
 *  yesterday" track, which looks at a day's sessions on the day after and
 *  no later. Oldest first because the oldest is the one most at risk of
 *  being forgotten. */
export function outstandingRpe(
  expectations: readonly { session_id: string | null; is_required: boolean; waived_reason: string | null }[],
  sessions: readonly OutstandingRpeSession[],
  rated: ReadonlySet<string>,
  now: number,
): OutstandingRpeSession[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const out: OutstandingRpeSession[] = [];
  for (const e of expectations) {
    if (!e.session_id || !e.is_required || e.waived_reason !== null) continue;
    if (rated.has(e.session_id)) continue;
    const s = byId.get(e.session_id);
    if (!s) continue;
    if (!rpeIsDue(s, now)) continue;
    out.push(s);
  }
  return out.sort((a, b) => sessionEndsAt(a) - sessionEndsAt(b));
}

/** "Rate {session name}" — the row's name and the RPE screen's heading are
 *  the same string built the same way, which is what lets the exact-name
 *  guard hold. "Training" when the session has no title, as before. */
export function rpeRowName(title: string | null | undefined): string {
  return `Rate ${title?.trim() || 'Training'}`;
}

/** When the session was, for the row's subtitle: "Today 11:15", "Yesterday",
 *  or "{Day} 11:15" — the day names only reach the screen if the carry-over
 *  window is ever widened; with yesterday-and-today it is the first two. The
 *  time is the session's END, which is the thing "when was it" means for a
 *  rating. Tabular figures are the row's job (CSS), not this string's. */
export function rpeWhen(session: RpeSession, today: string, timezone: string): string {
  const ends = new Date(sessionEndsAt(session));
  const day = dateInTz(ends, timezone);
  if (day === today) return `Today ${formatTime(ends.toISOString(), timezone)}`;
  if (day === addDays(today, -1)) return 'Yesterday';
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: timezone }).format(ends);
  return `${weekday} ${formatTime(ends.toISOString(), timezone)}`;
}

/** The day's session line: "10:00 · Main pitch · finished 11:15", "… ·
 *  starts in 40 min", "… · in progress", or a plain start time when the
 *  session is more than two hours off — "starts in 540 min" is a number
 *  nobody wants. */
export function sessionMeta(
  session: RpeSession & { location: string | null },
  now: number,
  timezone: string,
): string {
  const start = new Date(session.starts_at).getTime();
  const end = sessionEndsAt(session);
  const parts = [formatTime(session.starts_at, timezone), session.location ?? 'Location not set'];
  if (now >= end) parts.push(`finished ${formatTime(new Date(end).toISOString(), timezone)}`);
  else if (now >= start) parts.push('in progress');
  else {
    const mins = Math.ceil((start - now) / 60_000);
    if (mins <= 120) parts.push(`starts in ${mins} min`);
  }
  return parts.join(' · ');
}

/** The one-line banner above To do when the athlete is not fully available:
 *  the status word, then what they may do, in the words the card uses. */
export function availabilityLine(
  label: string,
  restrictions: readonly string[],
  reasonLabel: string | null,
  enumLabel: (v: string) => string,
): string {
  const what = restrictions.length > 0 ? restrictions.map(enumLabel).join(' · ') : reasonLabel ?? 'No restriction recorded.';
  return `${label} · ${what}`;
}
