import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { createSarRequest } from '@/lib/queries/sarPack';
import { requireStaff } from '@/lib/session';
import { isUuid } from '@/lib/uuid';

/** exports.md's own entry-point table: `athlete-profile.md, "Generate
 *  subject access pack" (admin) → SAR flow, athlete_id`. Admin only — see
 *  migration 0032's header for why (sar_requests_admin_insert). Redirects
 *  straight to the queue rather than a confirmation screen of its own:
 *  the queue is where the due date and the review/release actions live,
 *  and a request with no clinical data at all needs no separate
 *  confirmation step before an admin can release it from there. */
export async function POST(_request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const { db, orgId, claims } = await requireStaff();
  /* Shape-check the route param before it reaches a query. Authenticated
     first, so this never becomes a probe; then 404 rather than 500, because a
     malformed id is a URL that does not name anything, not a server fault. */
  if (!isUuid(athleteId)) notFound();

  if (!claims.roles.includes('admin')) redirect(`/squad/${athleteId}?e=no-sar-access`);

  const { id, error } = await createSarRequest(db, orgId, athleteId, claims.userId);
  if (error || !id) redirect(`/squad/${athleteId}?error=${encodeURIComponent(error ?? 'Could not open the request.')}`);

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: 'admin',
    action: 'sar.request',
    entity_type: 'sar_request',
    entity_id: id,
    athlete_id: athleteId,
    metadata: { athlete_id: athleteId },
  });

  redirect('/settings/subject-access');
}
