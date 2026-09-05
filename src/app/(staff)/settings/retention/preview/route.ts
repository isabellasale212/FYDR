import { NextResponse } from 'next/server';
import { computeRetentionPreview } from '@/lib/retention/compute';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

/** Read-only, admin only — see lib/retention/compute.ts's own header for
 *  why this needs the service-role client even for a preview (an admin's
 *  ordinary session cannot read injury_clinical at all, and this has to
 *  count it). */
export async function POST() {
  const { orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) {
    return NextResponse.json({ error: 'Admin access only.' }, { status: 403 });
  }
  const preview = await computeRetentionPreview(orgId);
  return NextResponse.json({ preview });
}
