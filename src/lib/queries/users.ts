import type { Db } from './groups';

/** Names for a short, known list of user ids — the read-only owner lines
 *  (STAFF-SS-02-05 C5) and anything else that names who set a row. Bounded by
 *  the caller's own id list; scoped to the org as the rest of this layer is. */
export async function fetchUserNames(db: Db, orgId: string, userIds: readonly (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from('users').select('id, full_name').eq('org_id', orgId).in('id', ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((u) => [u.id, u.full_name]));
}
