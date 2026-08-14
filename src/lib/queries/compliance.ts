import type { ComplianceDomain } from '@/lib/types/database';
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
};

/** What one athlete still owes today. Wellness first: it is the entry the whole
 *  morning depends on. */
export async function fetchMyOutstanding(
  db: Db,
  athleteId: string,
  date: string,
): Promise<OutstandingItem[]> {
  const { data: expectations, error } = await db
    .from('compliance_expectations')
    .select('domain, session_id, is_required, waived_reason')
    .eq('athlete_id', athleteId)
    .eq('expectation_date', date)
    .eq('is_required', true);

  if (error) throw new Error(error.message);

  const rows = (expectations ?? []).filter((e) => e.domain !== 'nutrition');
  if (rows.length === 0) return [];

  const [wellness, training] = await Promise.all([
    db
      .from('wellness_entries_current')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('entry_date', date)
      .maybeSingle(),
    db
      .from('training_entries_current')
      .select('session_id')
      .eq('athlete_id', athleteId)
      .eq('entry_date', date),
  ]);

  if (wellness.error) throw new Error(wellness.error.message);
  if (training.error) throw new Error(training.error.message);

  const ratedSessions = new Set(
    (training.data ?? []).map((t) => t.session_id ?? ''),
  );

  const out: OutstandingItem[] = [];

  for (const row of rows) {
    if (row.domain === 'wellness') {
      if (!wellness.data) {
        out.push({
          domain: 'wellness',
          session_id: null,
          label: 'Morning check-in',
          href: '/check-in',
        });
      }
      continue;
    }
    if (row.domain === 'training_rpe' && row.session_id) {
      if (!ratedSessions.has(row.session_id)) {
        out.push({
          domain: 'training_rpe',
          session_id: row.session_id,
          label: 'How hard was it',
          href: `/rpe/${row.session_id}`,
        });
      }
    }
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
