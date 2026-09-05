import { NextResponse } from 'next/server';
import { runRetention } from '@/lib/retention/compute';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

/** The one route in this feature that actually writes. Requires the
 *  client to send `{ confirm: true }` — a caller that gets this route's
 *  URL wrong and POSTs an empty body is refused, not defaulted into a
 *  real run, matching "refuses to run without a dry-run mode" in spirit:
 *  the dry run (preview) has to have already happened in the UI for the
 *  Run button to even be enabled, and this is the second, explicit gate
 *  behind it. */
export async function POST(request: Request) {
  const { db, orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) {
    return NextResponse.json({ error: 'Admin access only.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirm !== true) {
    return NextResponse.json({ error: 'Confirmation required.' }, { status: 400 });
  }

  const { result, error } = await runRetention(orgId, false);
  if (error || !result) {
    return NextResponse.json({ error: error ?? 'Retention run failed.' }, { status: 500 });
  }

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: 'sport_scientist',
    action: 'retention.run',
    entity_type: 'organisation',
    entity_id: orgId,
    metadata: { import_batches_deleted: result.importBatchesDeleted, injuries_redacted: result.injuriesRedacted },
  });

  return NextResponse.json({ result });
}
