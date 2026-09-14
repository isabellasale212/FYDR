import { redirect } from 'next/navigation';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import { requireStaff } from '@/lib/session';

/** PATTERN-S3 C6: the medic's decision through decide_proposal (0124) — approve
 *  assigns (active), return needs a reason. */
export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const { db, claims } = await requireStaff();
  const back = (q: string): never => redirect(`/programmes/proposals?p=${q}`);
  if (!hasAnyRole(claims.roles, CLINICAL_ONLY)) back('refused');
  const form = await request.formData();
  const raw = form.get('decision');
  if (raw !== 'return' && raw !== 'approve') back('failed');
  const decision: 'approve' | 'return' = raw === 'return' ? 'return' : 'approve';
  const reason = String(form.get('reason') ?? '').trim();
  const { error } = await db.rpc('decide_proposal', { p_assignment_id: assignmentId, p_decision: decision, p_reason: reason });
  if (error) back(error.message.match(/(reason_required|not_a_proposal)/)?.[1] ?? 'failed');
  back(decision === 'approve' ? 'approved' : 'returned');
}
