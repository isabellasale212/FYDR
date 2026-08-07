import type { Db } from './groups';

/* 09-security-and-compliance.md §6 and screens/exports.md's "Admin, subject
 * access pack" section. migration 0032's own header explains the reduced,
 * synchronous scope (no worker queue, no signed-URL storage lifecycle, no
 * email/push on completion — the same infrastructure gap every other
 * export and invite in this build already has). This file is the plain
 * RLS-gated half of the feature: opening a request, listing the queue, and
 * the clinical review reads/writes — safe for a Client Component to import.
 * The actual whole-pack assembly lives in sarPackAssembly.ts, on the
 * server-only service-role client, and is imported only by the release
 * Route Handler — see that file's own header for why it needs a different
 * client than everything here, and why this file is split from it at all
 * (a real build error, not a style choice: Next.js bundles a module's
 * whole export surface together, so a single shared file would have
 * pulled the service-role client into the browser bundle the moment
 * ClinicalReviewForm imported anything from it). */

export type SarRequestListRow = {
  id: string;
  athlete_id: string;
  athlete_first_name: string;
  athlete_last_name: string;
  requested_by_name: string;
  requested_at: string;
  due_at: string;
  status: string;
};

export async function fetchSarRequests(db: Db, orgId: string): Promise<SarRequestListRow[]> {
  const { data, error } = await db
    .from('sar_requests')
    .select('id, athlete_id, requested_at, due_at, status, athletes!inner(first_name, last_name), users!sar_requests_requested_by_fkey(full_name)')
    .eq('org_id', orgId)
    .order('requested_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    athlete_id: r.athlete_id,
    athlete_first_name: r.athletes.first_name,
    athlete_last_name: r.athletes.last_name,
    requested_by_name: r.users?.full_name ?? 'Unknown',
    requested_at: r.requested_at,
    due_at: r.due_at,
    status: r.status,
  }));
}

export type SarRequestDetail = {
  id: string;
  athlete_id: string;
  athlete_first_name: string;
  athlete_last_name: string;
  status: string;
  due_at: string;
};

export async function fetchSarRequest(db: Db, orgId: string, requestId: string): Promise<SarRequestDetail | null> {
  const { data, error } = await db
    .from('sar_requests')
    .select('id, athlete_id, status, due_at, athletes!inner(first_name, last_name)')
    .eq('org_id', orgId)
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    athlete_id: data.athlete_id,
    athlete_first_name: data.athletes.first_name,
    athlete_last_name: data.athletes.last_name,
    status: data.status,
    due_at: data.due_at,
  };
}

/** screens/exports.md: "One month from the request" — a calendar month,
 *  not a fixed 30 days, so the due date lands on the same day of the
 *  following month regardless of month length. */
export async function createSarRequest(db: Db, orgId: string, athleteId: string, requestedBy: string): Promise<{ id: string | null; error: string | null }> {
  const dueAt = new Date();
  dueAt.setUTCMonth(dueAt.getUTCMonth() + 1);

  const { data, error } = await db
    .from('sar_requests')
    .insert({ org_id: orgId, athlete_id: athleteId, requested_by: requestedBy, due_at: dueAt.toISOString() })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export type InjuryForReview = {
  injury_id: string;
  body_area: string;
  onset_date: string;
  diagnosis: string | null;
  mechanism: string | null;
  clinical_notes: string | null;
  treatment_plan: string | null;
  decision: 'include' | 'withhold' | null;
  reason: string | null;
};

/** Medical's review queue for one request: every injury of this athlete
 *  that has a clinical record, joined to whatever decision (if any) has
 *  already been recorded for this specific request — reviewing is
 *  per-request, not a one-time global flag on the injury, because a
 *  reason for withholding is evaluated against a specific disclosure, not
 *  fixed forever. Reads injury_clinical directly: RLS's own
 *  clinical_medical_only policy (migration 0012) is what actually keeps
 *  this safe for a medical caller, the same reliance this build's other
 *  clinical read (fetchInjuryClinical) already has. */
export async function fetchInjuriesForReview(db: Db, orgId: string, athleteId: string, requestId: string): Promise<InjuryForReview[]> {
  const [injuriesRes, reviewsRes] = await Promise.all([
    db
      .from('injuries')
      .select('id, body_area, onset_date, injury_clinical(diagnosis, mechanism, clinical_notes, treatment_plan)')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId),
    db.from('sar_clinical_reviews').select('injury_id, decision, reason').eq('org_id', orgId).eq('sar_request_id', requestId),
  ]);
  if (injuriesRes.error) throw new Error(injuriesRes.error.message);
  if (reviewsRes.error) throw new Error(reviewsRes.error.message);

  const decisionByInjury = new Map((reviewsRes.data ?? []).map((r) => [r.injury_id, r]));

  return (injuriesRes.data ?? [])
    .filter((i) => i.injury_clinical !== null)
    .map((i) => {
      const clinical = i.injury_clinical!;
      const decision = decisionByInjury.get(i.id);
      return {
        injury_id: i.id,
        body_area: i.body_area,
        onset_date: i.onset_date,
        diagnosis: clinical.diagnosis,
        mechanism: clinical.mechanism,
        clinical_notes: clinical.clinical_notes,
        treatment_plan: clinical.treatment_plan,
        decision: (decision?.decision as 'include' | 'withhold' | undefined) ?? null,
        reason: decision?.reason ?? null,
      };
    });
}

export async function submitClinicalReview(
  db: Db,
  orgId: string,
  requestId: string,
  injuryId: string,
  decision: 'include' | 'withhold',
  reason: string | null,
  reviewedBy: string,
): Promise<{ error: string | null }> {
  const { error } = await db.from('sar_clinical_reviews').insert({
    org_id: orgId,
    sar_request_id: requestId,
    injury_id: injuryId,
    decision,
    reason,
    reviewed_by: reviewedBy,
  });
  return { error: error?.message ?? null };
}

export async function markRequestReviewed(db: Db, orgId: string, requestId: string): Promise<{ error: string | null }> {
  const { error } = await db.from('sar_requests').update({ status: 'reviewed' }).eq('org_id', orgId).eq('id', requestId);
  return { error: error?.message ?? null };
}

export async function releaseSarRequest(db: Db, orgId: string, requestId: string, releasedBy: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('sar_requests')
    .update({ status: 'released', released_by: releasedBy, released_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('id', requestId);
  return { error: error?.message ?? null };
}
