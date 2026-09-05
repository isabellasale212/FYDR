import { redirect } from 'next/navigation';
import { fetchSarRequest, releaseSarRequest } from '@/lib/queries/sarPack';
import { assembleSarPack } from '@/lib/queries/sarPackAssembly';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

/** screens/exports.md: "The pack cannot be released while review is
 *  pending" — assembleSarPack itself refuses to run if any clinical
 *  record still has no decision, the same check the review form's own
 *  submit already tries to satisfy client-side; this is the check that
 *  actually matters, because it runs server-side regardless of what the
 *  form did or didn't send. Admin only — see lib/queries/sarPack.ts's own
 *  header for why this is the one place in the whole feature that reaches
 *  for the service-role client, and why that's a deliberate, narrow,
 *  audited exception rather than a habit. */
export async function POST(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const { db, orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) redirect('/settings/subject-access?e=no-sar-access');

  const request = await fetchSarRequest(db, orgId, requestId);
  if (!request) redirect('/settings/subject-access?error=Request+not+found.');
  if (request.status !== 'reviewed' && request.status !== 'released') {
    redirect('/settings/subject-access?error=This+request+has+not+been+through+clinical+review+yet.');
  }

  const { pack, error } = await assembleSarPack(orgId, request.athlete_id, requestId);
  if (error || !pack) {
    redirect(`/settings/subject-access?error=${encodeURIComponent(error ?? 'Could not assemble the pack.')}`);
  }

  if (request.status !== 'released') {
    const { error: releaseErr } = await releaseSarRequest(db, orgId, requestId, claims.userId);
    if (releaseErr) redirect(`/settings/subject-access?error=${encodeURIComponent(releaseErr)}`);

    await db.from('audit_log').insert({
      org_id: orgId,
      actor_id: claims.userId,
      actor_role: 'sport_scientist',
      action: 'sar.release',
      entity_type: 'sar_request',
      entity_id: requestId,
      athlete_id: request.athlete_id,
      metadata: { athlete_id: request.athlete_id },
    });
  }

  const filename = `subject-access-pack-${request.athlete_first_name}-${request.athlete_last_name}-${new Date().toISOString().slice(0, 10)}.json`
    .toLowerCase()
    .replace(/\s+/g, '-');

  return new Response(JSON.stringify(pack, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
