import type { ProblemReportInput } from '@/lib/validation/problemReport';
import type { Db } from './groups';
import { mustAffect } from '@/lib/write';

/* migration 0040, problem_reports — 03-flows.md §6 ("Athlete reports a problem
 * from Today tab -> notification to Medical") and 01-roles-and-permissions.md (superseded)
 * §1 ("Report a problem or injury concern to medical staff"). See that
 * migration's own header for the full visibility reasoning: athlete inserts
 * and reads their own; medical reads org-wide and owns the status walk;
 * coach and admin have NO access at all, not even existence or status —
 * this is the one athlete-facing domain in the app with zero coach
 * visibility, matching the capability's own wording ("to medical staff"). */

export type ProblemReportCategory = 'injury_or_pain' | 'wellbeing' | 'other';
export type ProblemReportStatus = 'open' | 'acknowledged' | 'closed';

/** Shared between the athlete's own report-problem page and medical's triage
 *  view — used to be defined twice, byte-for-byte identical, a real drift
 *  risk (audit polish finding). One copy here instead. */
export const PROBLEM_REPORT_CATEGORY_LABEL: Record<ProblemReportCategory, string> = {
  injury_or_pain: 'Injury or pain',
  wellbeing: 'Wellbeing',
  other: 'Other',
};

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

/* -------------------------------------------------------------------------
 * Medical's triage notes on a report — migration 0055, problem_report_notes.
 *
 * A SEPARATE TABLE, not a column on problem_reports, and the distinction
 * matters when reading this file: OWN_COLUMNS above is the athlete's own view
 * of their report, and problem_reports_athlete_select (migration 0040) grants
 * the athlete that whole ROW. Postgres RLS is row-level, so a note column on
 * problem_reports would be readable by the athlete it is written about
 * through one direct column select, whatever OWN_COLUMNS happened to list.
 * Nothing below is ever added to OWN_COLUMNS, and nothing below is reachable
 * from the athlete surface at all: problem_report_notes has a single select
 * policy and it is medical-only. Same structural split as
 * injuries/injury_clinical (CLAUDE.md rule 3).
 * ---------------------------------------------------------------------- */

export type ProblemReportNote = {
  id: string;
  report_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
};

/** Every note on the reports currently in the medic's inbox, oldest first —
 *  these are an append log, read in the order they were written. Batched over
 *  the whole page's report ids rather than one request per row, and matching
 *  migration 0055's (report_id, created_at) index. Medical-only by RLS: any
 *  other role calling this gets an empty array, the policy doing the denying
 *  rather than an application-level role check. */
export async function fetchProblemReportNotes(
  db: Db,
  reportIds: string[],
): Promise<ProblemReportNote[]> {
  if (reportIds.length === 0) return [];
  const { data, error } = await db
    .from('problem_report_notes')
    .select('id, report_id, body, created_at, users!problem_report_notes_created_by_fkey(full_name)')
    .in('report_id', reportIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => ({
    id: n.id,
    report_id: n.report_id,
    body: n.body,
    created_at: n.created_at,
    author_name: n.users?.full_name ?? null,
  }));
}

/** Append one note. created_by is stamped by the caller and re-checked by
 *  migration 0055's insert policy (`created_by = auth_user_id()`), so a medic
 *  cannot file a note in someone else's name. There is deliberately no update
 *  or delete counterpart: a written note is a record, a correction is a new
 *  note. */
export async function addProblemReportNote(
  db: Db,
  input: { reportId: string; body: string },
  identity: { orgId: string; userId: string },
): Promise<{ error: string | null }> {
  const { error } = await db.from('problem_report_notes').insert({
    org_id: identity.orgId,
    report_id: input.reportId,
    body: input.body,
    created_by: identity.userId,
  });
  return { error: error?.message ?? null };
}

/** Migration 0040's trigger enforces the transition and the acting-user
 *  stamp; this just performs the update the trigger will accept. */
export async function acknowledgeProblemReport(
  db: Db,
  reportId: string,
  userId: string,
): Promise<{ error: string | null }> {
  /* G-36. problem_reports UPDATE is the medic's. An athlete reporting pain and
     seeing it acknowledged, when nothing was recorded, is the worst version of
     this bug in the product. */
  return mustAffect(
    db
      .from('problem_reports')
      .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
      .eq('id', reportId)
      .select('id'),
    { refusal: 'Not saved: acknowledging a problem report belongs to the medic.' },
  );
}

export async function closeProblemReport(
  db: Db,
  reportId: string,
  userId: string,
): Promise<{ error: string | null }> {
  return mustAffect(
    db
      .from('problem_reports')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: userId })
      .eq('id', reportId)
      .select('id'),
    { refusal: 'Not saved: closing a problem report belongs to the medic.' },
  );
}
