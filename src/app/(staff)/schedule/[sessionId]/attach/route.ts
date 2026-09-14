import { redirect } from 'next/navigation';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';
import { attachSessionToFixture } from '@/lib/queries/matchParticipation';
import { refuse, requireStaff } from '@/lib/session';

/** Attach this unlinked match session to a fixture — the orphan's answer
 *  from the session's side (decision batch, 14 September 2026: an attach
 *  action, never a backfill). Audited as a sessions update (0104). */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { db, orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) await refuse(db, 'fixture_attach', `/schedule/${sessionId}`);
  const form = await request.formData();
  const fixtureId = String(form.get('fixture') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(fixtureId)) redirect(`/schedule/${sessionId}?attach=failed`);
  const { error } = await attachSessionToFixture(db, orgId, fixtureId, sessionId);
  redirect(error ? `/schedule/${sessionId}?attach=failed` : `/schedule/fixtures/${fixtureId}?attach=done`);
}
