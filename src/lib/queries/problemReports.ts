import type { ProblemReportInput } from '@/lib/validation/problemReport';
import type { Db } from './groups';

/* migration 0040, problem_reports — 03-flows.md §6 ("Athlete reports a problem
 * from Today tab -> notification to Medical") and 01-roles-and-permissions.md
 * §1 ("Report a problem or injury concern to medical staff"). See that
 * migration's own header for the full visibility reasoning: athlete inserts
 * and reads their own; medical reads org-wide and owns the status walk;
 * coach and admin have NO access at all, not even existence or status —
 * this is the one athlete-facing domain in the app with zero coach
 * visibility, matching the capability's own wording ("to medical staff"). */

export type ProblemReportCategory = 'injury_or_pain' | 'wellbeing' | 'other';
export type ProblemReportStatus = 'open' | 'acknowledged' | 'closed';

export type ProblemReport = {
  id: string;
  category: ProblemReportCategory | null;
  body: string;
  status: ProblemReportStatus;
  created_at: string;
  acknowledged_at: string | null;
  closed_at: string | null;
};

const OWN_COLUMNS = 'id, category, body, status, created_at, acknowledged_at, closed_at';

/** The athlete's own "what I've sent and what happened to it" list — the
 *  visible status is the trust loop this screen exists to close: an athlete
 *  who reports something should be able to see a person looked at it, not
 *  wonder whether it went anywhere. */
export async function fetchMyProblemReports(db: Db, athleteId: string): Promise<ProblemReport[]> {
  const { data, error } = await db
    .from('problem_reports')
    .select(OWN_COLUMNS)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function submitProblemReport(
  db: Db,
  input: ProblemReportInput,
  identity: { orgId: string; athleteId: string; userId: string },
): Promise<{ error: string | null }> {
  const { error } = await db.from('problem_reports').insert({
    id: input.id,
    org_id: identity.orgId,
    athlete_id: identity.athleteId,
    category: input.category ?? null,
    body: input.body,
    created_by: identity.userId,
  });
  return { error: error?.message ?? null };
}

/** Medical's inbox row, staff-side. Only reachable at all because
 *  problem_reports_medical_select is medical-only — this is the one query
 *  in this file a coach can call and it will simply return nothing, RLS
 *  doing the actual denying rather than an application-level role check. */
export type OpenProblemReport = {
  id: string;
  athlete_id: string;
  first_name: string;
  last_name: string;
  category: ProblemReportCategory | null;
  body: string;
  status: ProblemReportStatus;
  created_at: string;
};

export async function fetchOpenProblemReports(db: Db, orgId: string): Promise<OpenProblemReport[]> {
  const { data, error } = await db
    .from('problem_reports')
    .select('id, athlete_id, category, body, status, created_at, athletes!inner(first_name, last_name)')
    .eq('org_id', orgId)
    .in('status', ['open', 'acknowledged'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    athlete_id: r.athlete_id,
    first_name: r.athletes.first_name,
    last_name: r.athletes.last_name,
    category: r.category,
    body: r.body,
    status: r.status,
    created_at: r.created_at,
  }));
}

/** Migration 0040's trigger enforces the transition and the acting-user
 *  stamp; this just performs the update the trigger will accept. */
export async function acknowledgeProblemReport(
  db: Db,
  reportId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('problem_reports')
    .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
    .eq('id', reportId);
  return { error: error?.message ?? null };
}

export async function closeProblemReport(
  db: Db,
  reportId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('problem_reports')
    .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: userId })
    .eq('id', reportId);
  return { error: error?.message ?? null };
}
