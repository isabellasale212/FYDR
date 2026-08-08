import type { Db } from '@/lib/queries/groups';

/* migration 0033's own header covers what writes these rows — a nightly
 * pg_cron job, not this app. This file is the read side: a plain
 * RLS-gated query, unlike compute.ts's own functions, because reading
 * audit_log is exactly what an admin's ordinary session is already
 * allowed to do (audit_admin_select, migration 0012) — no service-role
 * client needed just to look at what the nightly job already found. */

export type RetentionNightlyReport = {
  orgId: string;
  occurredAt: string;
  importBatchesEligible: number;
  injuriesEligible: number;
};

export async function fetchRetentionNightlyReports(db: Db, orgId: string, limit = 10): Promise<RetentionNightlyReport[]> {
  const { data, error } = await db
    .from('audit_log')
    .select('org_id, occurred_at, metadata')
    .eq('org_id', orgId)
    .eq('action', 'retention.nightly_preview')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const metadata = r.metadata as { import_batches_eligible?: number; injuries_eligible?: number } | null;
    return {
      orgId, // the .eq('org_id', orgId) filter above guarantees every row matches this, not r.org_id — which the generated type leaves nullable even though this column is `not null` in the schema
      occurredAt: r.occurred_at,
      importBatchesEligible: metadata?.import_batches_eligible ?? 0,
      injuriesEligible: metadata?.injuries_eligible ?? 0,
    };
  });
}
