import type { ComplianceDomain } from '@/lib/types/database';
import { addDays } from '@/lib/format';
import { outstandingRpe, rpeRowName, type OutstandingRpeSession } from '@/lib/todayRows';
import { fetchGroupAthleteIds, type Db } from './groups';

/* Compliance is whether an expected entry was actually submitted.
 *
 * compliance_expectations is the stored half; the entry tables are the other
 * half. A nutrition expectation is never generated and is never counted:
 * CLAUDE.md rule 8, and the comment on the table says so too. */

export type ComplianceToday = {
  expected: number;
  submitted: number;
  outstanding: number;
  missingNames: string[];
};

export async function fetchWellnessComplianceForDay(
  db: Db,
  orgId: string,
  date: string,
  groupIds: readonly string[],
): Promise<ComplianceToday> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let expectations = db
    .from('compliance_expectations')
    .select('athlete_id, is_required, waived_reason')
    .eq('org_id', orgId)
    .eq('expectation_date', date)
    .eq('domain', 'wellness')
    .eq('is_required', true);

  if (scope) expectations = expectations.in('athlete_id', scope);

  const { data: expected, error } = await expectations;
  if (error) throw new Error(error.message);

  const expectedIds = (expected ?? []).map((e) => e.athlete_id);
  if (expectedIds.length === 0) {
    return { expected: 0, submitted: 0, outstanding: 0, missingNames: [] };
  }

  const [entries, athletes] = await Promise.all([
    db
      .from('wellness_entries_current')
      .select('athlete_id')
      .eq('entry_date', date)
      .in('athlete_id', expectedIds),
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .in('id', expectedIds),
  ]);

  if (entries.error) throw new Error(entries.error.message);
  if (athletes.error) throw new Error(athletes.error.message);

  const submittedIds = new Set((entries.data ?? []).map((e) => e.athlete_id));
  const missing = (athletes.data ?? [])
    .filter((a) => !submittedIds.has(a.id))
    .map((a) => a.last_name)
    .sort();

  return {
    expected: expectedIds.length,
    submitted: submittedIds.size,
    outstanding: expectedIds.length - submittedIds.size,
    missingNames: missing,
  };
}

export type OutstandingItem = {
  domain: ComplianceDomain;
  session_id: string | null;
  label: string;
  href: string;
  /** The session an RPE task is for — its time is the row's subtitle. */
  session: OutstandingRpeSession | null;
};

/** What one athlete still owes. Wellness first: it is the entry the whole
 *  morning depends on. Then every session rating that is DUE and not yet
 *  given, oldest first.
 *
 *  TWO DAYS, NOT ONE, since 2026-09-11 (ATH-ADULT-02). A rating is wanted
 *  from thirty minutes after the session ends until the end of the following
 *  day in club time, so yesterday's expectations are read alongside today's —
 *  that pair IS the window. Before this the list showed today's sessions
 *  from midnight (an athlete could tap a session that had not started and be
 *  told "Not quite yet") and never showed yesterday's at all. The time rule
 *  lives in lib/rpeDue.ts, where the RPE screen reads the same one. */
export async function fetchMyOutstanding(
  db: Db,
  athleteId: string,
  date: string,
  now: number = Date.now(),
): Promise<OutstandingItem[]> {
  const yesterday = addDays(date, -1);
  const { data: expectations, error } = await db
    .from('compliance_expectations')
    .select('expectation_date, domain, session_id, is_required, waived_reason')
    .eq('athlete_id', athleteId)
    .in('expectation_date', [yesterday, date])
    .eq('is_required', true);

  if (error) throw new Error(error.message);

  const rows = (expectations ?? []).filter((e) => e.domain !== 'nutrition');
  if (rows.length === 0) return [];

  const wellnessOwed = rows.some((r) => r.domain === 'wellness' && r.expectation_date === date);
  const rpeRows = rows.filter((r) => r.domain === 'training_rpe' && r.session_id);
  const sessionIds = rpeRows.map((r) => r.session_id as string);

  const [wellness, training, sessions] = await Promise.all([
    wellnessOwed
      ? db
          .from('wellness_entries_current')
          .select('id')
          .eq('athlete_id', athleteId)
          .eq('entry_date', date)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sessionIds.length > 0
      ? db
          .from('training_entries_current')
          .select('session_id')
          .eq('athlete_id', athleteId)
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length > 0
      ? db.from('sessions').select('id, title, starts_at, duration_min').in('id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (wellness.error) throw new Error(wellness.error.message);
  if (training.error) throw new Error(training.error.message);
  if (sessions.error) throw new Error(sessions.error.message);

  const out: OutstandingItem[] = [];

  if (wellnessOwed && !wellness.data) {
    out.push({ domain: 'wellness', session_id: null, label: 'Morning check-in', href: '/check-in', session: null });
  }

  const dateBySession = new Map(rpeRows.map((r) => [r.session_id as string, r.expectation_date]));
  const candidates: OutstandingRpeSession[] = (sessions.data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    starts_at: s.starts_at,
    duration_min: s.duration_min,
    entry_date: dateBySession.get(s.id) ?? date,
  }));
  const rated = new Set((training.data ?? []).map((t) => t.session_id ?? ''));

  for (const session of outstandingRpe(rpeRows, candidates, rated, now)) {
    out.push({
      domain: 'training_rpe',
      session_id: session.id,
      /* The row and the RPE screen's heading are one function of one title,
         which is what lets test-control-names-resolve.ts hold them to the
         same string. "How hard was it?" was the screen's old title; two
         sessions to rate produced two identical rows (review F3). */
      label: rpeRowName(session.title),
      href: `/rpe/${session.id}`,
      session,
    });
  }

  return out;
}

/** The count behind every tab header's status pill, ATHLETE-APP-SPEC.md
 *  §4: "{n} to do" in the warn tint, "Up to date" in the good tint. Same
 *  wellness/RPE-outstanding count Today's own to-do list uses, plus the
 *  weekly nutrition check-in if the athlete hasn't answered it yet — mirrors
 *  §14's own rule ("wellness + rpe + nutrition not done"), minus gym for
 *  the same reason Today's to-do list leaves it out (see that page's own
 *  header comment). */
export async function fetchOutstandingCount(
  db: Db,
  athleteId: string,
  today: string,
  nutritionAnswered: boolean,
): Promise<number> {
  const outstanding = await fetchMyOutstanding(db, athleteId, today);
  return outstanding.length + (nutritionAnswered ? 0 : 1);
}
