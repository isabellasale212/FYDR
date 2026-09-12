/* The RPE half of the compliance report's "submitted" — §0ad, decided
 * 2026-09-12. Pure, so the rule can be tested with rows rather than a database.
 *
 * WHAT CHANGED. The report used to mark an RPE expectation submitted whenever
 * ANY training_entries row existed for that athlete on that date, however late
 * — a rating entered a week after the session, when the coach chased, counted
 * identically to one entered that evening. Two things were wrong with that
 * and both are fixed here:
 *
 *   1. No cutoff. A rating now counts only if its original submission was
 *      before rpeClosesAt — the end of the following club-local day, the same
 *      instant the RPE screen refuses and Today's row disappears
 *      (lib/rpeDue.ts). Later is a miss.
 *   2. Matched by day, not by session. Every training_rpe expectation names a
 *      session (0044 generates them from the day's sessions), and an athlete
 *      with a morning and an afternoon session who rated one was credited
 *      with both. The key is now the session.
 *
 * WHAT IT IS HANDED. Originals — training_entries rows with revision_of null —
 * because a staff correction is a new row stamped with the correction's own
 * submitted_at, and judging that would turn an on-time rating corrected a
 * week later into a miss. The report reads the base table for exactly this.
 *
 * TWO CASES THAT INVENT NO MISS. A session the report cannot find (deleted
 * after its expectation was generated) has no window to judge against, so a
 * rating for it counts. An expectation with no session (none is generated
 * today, kept for the row shape) falls back to the old rule: an entry on the
 * day counts.
 */

import { rpeSubmittedInTime } from '@/lib/rpeDue';

export type RpeExpectation = { athlete_id: string; expectation_date: string; session_id: string | null };
export type RpeSubmission = {
  athlete_id: string | null;
  entry_date: string | null;
  session_id: string | null;
  submitted_at: string | null;
};
export type RpeSessionWindow = { id: string; starts_at: string; duration_min: number | null };

/** The key an expectation is counted under: the athlete and the session, or
 *  the athlete and the day when there is no session. */
export function rpeExpectationKey(e: RpeExpectation): string {
  return e.session_id ? `${e.athlete_id}:s:${e.session_id}` : `${e.athlete_id}:d:${e.expectation_date}`;
}

/** Which expectations were met in time (`inTime`) and which have any rating at
 *  all, in time or late (`any`, what "Last entry" reads). */
export function classifyRpeSubmissions(
  expectations: readonly RpeExpectation[],
  submissions: readonly RpeSubmission[],
  sessions: readonly RpeSessionWindow[],
  timezone: string,
): { inTime: Set<string>; any: Set<string> } {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  /* One athlete's originals, by session and by day, so each expectation is a
     lookup rather than a scan. An athlete has one live entry per session per
     day (training_entries' unique index), so the first original is the one. */
  const bySession = new Map<string, RpeSubmission>();
  const byDay = new Map<string, RpeSubmission[]>();
  for (const s of submissions) {
    if (!s.athlete_id) continue;
    if (s.session_id && !bySession.has(`${s.athlete_id}:${s.session_id}`)) {
      bySession.set(`${s.athlete_id}:${s.session_id}`, s);
    }
    if (s.entry_date) {
      const k = `${s.athlete_id}:${s.entry_date}`;
      byDay.set(k, [...(byDay.get(k) ?? []), s]);
    }
  }

  const inTime = new Set<string>();
  const any = new Set<string>();
  for (const e of expectations) {
    const key = rpeExpectationKey(e);
    if (!e.session_id) {
      if ((byDay.get(`${e.athlete_id}:${e.expectation_date}`) ?? []).length > 0) {
        inTime.add(key);
        any.add(key);
      }
      continue;
    }
    const sub = bySession.get(`${e.athlete_id}:${e.session_id}`);
    if (!sub) continue;
    any.add(key);
    const session = sessionById.get(e.session_id);
    if (!session || !sub.submitted_at || rpeSubmittedInTime(session, sub.submitted_at, timezone)) {
      inTime.add(key);
    }
  }
  return { inTime, any };
}
