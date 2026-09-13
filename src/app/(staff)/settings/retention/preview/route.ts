import { NextResponse } from 'next/server';
import { computeRetentionPreview } from '@/lib/retention/compute';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

/** Read-only, admin only — see lib/retention/compute.ts's own header for
 *  why this needs the service-role client even for a preview (an admin's
 *  ordinary session cannot read injury_clinical at all, and this has to
 *  count it). */
export async function POST() {
  const { db, orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) {
    return NextResponse.json({ error: 'Admin access only.' }, { status: 403 });
  }
  const preview = await computeRetentionPreview(orgId);
  /* PATTERN-S8 C9 / decision batch A6 (2026-09-13): a preview is logged as
     its own action and retains no rows — the counts only, never the ids or
     the names the screen shows. */
  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: 'sport_scientist',
    action: 'retention.preview',
    entity_type: 'organisation',
    entity_id: orgId,
    metadata: {
      categories: preview.categories.map((c) => ({ category: c.category, count: c.count, automated: c.automated })),
      athletes_total: preview.athletes.total,
      athletes_current: preview.athletes.current,
    },
  });
  return NextResponse.json({ preview });
}
