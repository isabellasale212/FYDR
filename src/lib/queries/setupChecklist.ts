import type { SetupCounts } from '@/lib/setupChecklist';
import type { Db } from './groups';

/* PATTERN-S8 C1 (2026-09-13): the five counts the setup checklist reads —
 * head counts and one small read, every one scoped to the org and to what
 * RLS lets the sport scientist see. "Default" for a threshold is
 * created_by null (D8, answered 2026-09-13). */
export async function fetchSetupCounts(db: Db, orgId: string): Promise<SetupCounts> {
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: c, error } = await q;
    if (error) throw new Error(error.message);
    return c ?? 0;
  };
  const [athletes, groups, thresholdsActive, thresholdsDefault, users, roles, memberships] = await Promise.all([
    count(db.from('athletes').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club')),
    count(db.from('groups').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null)),
    count(db.from('thresholds').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null).eq('is_active', true)),
    count(db.from('thresholds').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null).eq('is_active', true).is('created_by', null)),
    (async () => {
      const { data, error } = await db.from('users').select('id, status').eq('org_id', orgId);
      if (error) throw new Error(error.message);
      return data ?? [];
    })(),
    (async () => {
      const { data, error } = await db.from('user_roles').select('user_id, role').eq('org_id', orgId);
      if (error) throw new Error(error.message);
      return data ?? [];
    })(),
    (async () => {
      const { data, error } = await db.from('group_memberships').select('athlete_id').eq('org_id', orgId).is('removed_at', null);
      if (error) throw new Error(error.message);
      return data ?? [];
    })(),
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const r of roles) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }
  const live = users.filter((u) => u.status !== 'deactivated');
  const staff = live.filter((u) => (rolesByUser.get(u.id) ?? []).some((r) => r !== 'athlete'));
  const staffInvited = staff.filter((u) => u.status === 'invited').length;
  const accountsWithoutRole = live.filter((u) => (rolesByUser.get(u.id) ?? []).length === 0).length;

  /* Athletes in no group: the live roster minus the distinct members. A
     count, not the names — the groups page lists them. */
  const inAGroup = new Set(memberships.map((m) => m.athlete_id)).size;

  return {
    athletes,
    groups,
    athletesInNoGroup: Math.max(0, athletes - Math.min(inAGroup, athletes)),
    thresholdsActive,
    thresholdsDefault,
    staffAccounts: staff.length,
    staffSignedIn: staff.length - staffInvited,
    staffInvited,
    accountsWithoutRole,
  };
}
