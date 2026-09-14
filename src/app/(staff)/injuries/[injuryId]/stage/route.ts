import { redirect } from 'next/navigation';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import { requireInjuryAccess } from '@/lib/session';

/** PATTERN-S3 C3: the medic's stage writes — open a protocol, advance one
 *  stage, set any other stage — through the two definer functions (0123),
 *  which hold the rules. The page reads the outcome from ?stage=. */
export async function POST(request: Request, { params }: { params: Promise<{ injuryId: string }> }) {
  const { injuryId } = await params;
  const { db, claims } = await requireInjuryAccess();
  const back = (q: string) => redirect(`/injuries/${injuryId}?stage=${q}#ladder-title`);
  if (!hasAnyRole(claims.roles, CLINICAL_ONLY)) back('refused');
  const form = await request.formData();
  const action = form.get('action');
  const code = (m: string) => m.match(/(restriction_line_required|criteria_not_reviewed|reason_required|restriction_line_names_clinical|stage_out_of_range|same_stage|injury_closed|no_protocol)/)?.[1] ?? 'failed';

  if (action === 'open') {
    const total = Number(form.get('total'));
    if (!Number.isInteger(total) || total < 1 || total > 12) back('invalid');
    const { error } = await db.rpc('open_injury_protocol', { p_injury_id: injuryId, p_total_stages: total });
    back(error ? code(error.message) : 'opened');
  }
  if (action === 'advance' || action === 'set') {
    const to = Number(form.get('to'));
    if (!Number.isInteger(to)) back('invalid');
    const line = String(form.get('line') ?? '').trim();
    const reviewed = form.get('reviewed') === '1';
    const reason = String(form.get('reason') ?? '').trim();
    const { error } = await db.rpc('move_injury_stage', { p_injury_id: injuryId, p_to_stage: to, p_restriction_line: line, p_criteria_reviewed: reviewed, p_reason: reason });
    back(error ? code(error.message) : action === 'advance' ? 'advanced' : 'set');
  }
  back('invalid');
}
