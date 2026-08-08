import type { Db } from './groups';

/* docs/10-roadmap.md's own gap list: "Audit log viewer (new screen 35) —
 * 01-roles-and-permissions.md §2 grants admins access to the audit log and
 * no screen exists." No docs/screens/audit-log.md spec exists for this one
 * — the table (migration 0007) and its RLS (migration 0012,
 * audit_admin_select: admin, own org, no update or delete policy for any
 * role) were both already real and already being written to by a dozen
 * other features before this file existed; only the read screen was
 * missing. Kept deliberately lean: a real, admin-only, reverse-chronological
 * list with an entity_type filter, no invented grouping or analytics this
 * table's own real content doesn't ask for. */

export type AuditLogRow = {
  id: number;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  athleteName: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
};

export async function fetchEntityTypes(db: Db, orgId: string): Promise<string[]> {
  const { data, error } = await db.from('audit_log').select('entity_type').eq('org_id', orgId);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.entity_type))].sort();
}

export async function fetchAuditLog(
  db: Db,
  orgId: string,
  filters: { entityType: string | null },
  limit = 100,
): Promise<AuditLogRow[]> {
  let q = db
    .from('audit_log')
    .select('id, action, entity_type, entity_id, metadata, occurred_at, actor_role, users(full_name), athletes(first_name, last_name)')
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (filters.entityType) q = q.eq('entity_type', filters.entityType);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    actorName: r.users?.full_name ?? null,
    actorRole: r.actor_role,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    athleteName: r.athletes ? `${r.athletes.last_name}, ${r.athletes.first_name}` : null,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    occurredAt: r.occurred_at,
  }));
}
