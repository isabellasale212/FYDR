import { redirect } from 'next/navigation';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';
import { attachSessionToFixture } from '@/lib/queries/matchParticipation';
import { refuse, requireStaff } from '@/lib/session';

/** Attach an existing unlinked match session to this fixture — the orphan's
 *  answer (decision batch, 14 September 2026: an attach action, never a
 *  backfill). Audited as a sessions update (0104). */
export async function POST(request: Request, { params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const { db, orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) await refuse(db, 'fixture_attach', `/schedule/fixtures/${fixtureId}`);
  const form = await request.formData();
  const sessionId = String(form.get('session') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) redirect(`/schedule/fixtures/${fixtureId}?attach=failed`);
  const { error } = await attachSessionToFixture(db, orgId, fixtureId, sessionId);
  redirect(`/schedule/fixtures/${fixtureId}?attach=${error ? 'failed' : 'done'}`);
}
