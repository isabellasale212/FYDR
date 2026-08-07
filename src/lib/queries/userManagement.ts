import type { AppRole, Json, UserStatus } from '@/lib/types/database';
import type { Db } from './groups';

/* docs/screens/user-management.md, screen 32, admin only, cut down hard —
 * see src/app/(staff)/settings/users/create/route.ts's header for the
 * account-creation half, which needs the service role key and lives in a
 * Route Handler rather than here.
 *
 * What this pass builds: the merged user/unlinked-athlete list the spec
 * insists on ("without that merge, the two most common onboarding states
 * are invisible"), granting and revoking roles, deactivating and
 * reactivating an account, and linking an existing account to an unlinked
 * athlete record. Every role or status change writes an audit_log row —
 * "a mandatory audit event", the spec's own words, not optional. Bulk CSV
 * invite followed once single-account creation existed to build it on top
 * of — see lib/queries/bulkInvite.ts and settings/users/bulk-invite/, the
 * same account-creation logic run per row rather than a second
 * implementation of it.
 *
 * What's cut, and it's real:
 *   - Invite email and SMS. Account creation makes a genuine auth.users
 *     row with a real temporary password, shown once to the admin to share
 *     directly — there is no email service or SMS provider anywhere in
 *     this project to send either automatically. Same category of gap as
 *     scheduled report delivery and push/email notifications.
 *   - A dedicated user-detail page, resend invite, invite revocation, and
 *     the Declined/invited-lifecycle states the spec's onboarding-consent
 *     flow would drive — none of that flow exists in this build, so every
 *     account created here starts life 'active', not 'invited'.
 *   - Role history read back from audit_log on a detail screen. The write
 *     happens; a dedicated reader for it doesn't yet.
 *   - MFA, passkeys, "what this user can see" plain-language summary.
 *   - Forced sign-out on role removal (the spec's own admin-set-role Edge
 *     Function). users.claims_version still bumps on every user_roles
 *     change (migration 0010's trigger, unrelated to this pass), which is
 *     what a stale-token check downstream would compare against — this
 *     pass doesn't add a check that reads it for that purpose.
 */

export type UserWithRoles = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  status: UserStatus;
  last_seen_at: string | null;
  roles: AppRole[];
  athlete_id: string | null;
  athlete_name: string | null;
};

export type UnlinkedAthlete = {
  id: string;
  first_name: string;
  last_name: string;
  squad_number: number | null;
};

export async function fetchUsersWithRoles(db: Db, orgId: string): Promise<UserWithRoles[]> {
  const [usersRes, rolesRes, athletesRes] = await Promise.all([
    db
      .from('users')
      .select('id, email, full_name, phone, status, last_seen_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('full_name'),
    db.from('user_roles').select('user_id, role').eq('org_id', orgId),
    db.from('athletes').select('id, first_name, last_name, user_id').eq('org_id', orgId).is('deleted_at', null).not('user_id', 'is', null),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (rolesRes.error) throw new Error(rolesRes.error.message);
  if (athletesRes.error) throw new Error(athletesRes.error.message);

  const rolesByUser = new Map<string, AppRole[]>();
  for (const r of rolesRes.data ?? []) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }
  const athleteByUser = new Map((athletesRes.data ?? []).filter((a) => a.user_id).map((a) => [a.user_id as string, a]));

  return (usersRes.data ?? []).map((u) => {
    const athlete = athleteByUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      phone: u.phone,
      status: u.status,
      last_seen_at: u.last_seen_at,
      roles: (rolesByUser.get(u.id) ?? []).sort(),
      athlete_id: athlete?.id ?? null,
      athlete_name: athlete ? `${athlete.first_name} ${athlete.last_name}` : null,
    };
  });
}

export async function fetchUnlinkedAthletes(db: Db, orgId: string): Promise<UnlinkedAthlete[]> {
  const { data, error } = await db
    .from('athletes')
    .select('id, first_name, last_name, squad_number')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .is('user_id', null)
    .order('last_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function recordUserAudit(
  db: Db,
  orgId: string,
  actorId: string,
  actorRole: AppRole,
  action: string,
  targetUserId: string,
  metadata: Json,
): Promise<void> {
  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    entity_type: 'user',
    entity_id: targetUserId,
    metadata,
  });
}

/** Sets a user's roles to exactly `roles` (additive set, not a toggle) —
 *  inserts what's missing, deletes what's no longer there. Refuses to
 *  leave an organisation with zero admins, the one guardrail the spec's
 *  own "requireTyped for removing the last admin" is standing in for here,
 *  without the typed-confirmation UI. */
export async function setUserRoles(
  db: Db,
  orgId: string,
  actorId: string,
  actorRole: AppRole,
  targetUserId: string,
  nextRoles: readonly AppRole[],
): Promise<{ error: string | null }> {
  const { data: currentRows, error: currentErr } = await db.from('user_roles').select('role').eq('org_id', orgId).eq('user_id', targetUserId);
  if (currentErr) return { error: currentErr.message };
  const current = new Set((currentRows ?? []).map((r) => r.role));
  const next = new Set(nextRoles);

  const removingAdmin = current.has('admin') && !next.has('admin');
  if (removingAdmin) {
    const { count, error: countErr } = await db
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'admin');
    if (countErr) return { error: countErr.message };
    if ((count ?? 0) <= 1) {
      return { error: 'This is the only admin in the club — remove the role from someone else first, or grant it to another user before removing it here.' };
    }
  }

  const toAdd = [...next].filter((r) => !current.has(r));
  const toRemove = [...current].filter((r) => !next.has(r));

  if (toAdd.length > 0) {
    const { error } = await db.from('user_roles').insert(toAdd.map((role) => ({ org_id: orgId, user_id: targetUserId, role, granted_by: actorId })));
    if (error) return { error: error.message };
  }
  for (const role of toRemove) {
    const { error } = await db.from('user_roles').delete().eq('org_id', orgId).eq('user_id', targetUserId).eq('role', role);
    if (error) return { error: error.message };
  }

  if (toAdd.length > 0 || toRemove.length > 0) {
    await recordUserAudit(db, orgId, actorId, actorRole, 'user_roles.changed', targetUserId, { added: toAdd, removed: toRemove });
  }

  return { error: null };
}

export async function setUserStatus(
  db: Db,
  orgId: string,
  actorId: string,
  actorRole: AppRole,
  targetUserId: string,
  status: Extract<UserStatus, 'active' | 'deactivated'>,
): Promise<{ error: string | null }> {
  const { error } = await db.from('users').update({ status }).eq('org_id', orgId).eq('id', targetUserId);
  if (error) return { error: error.message };
  await recordUserAudit(db, orgId, actorId, actorRole, status === 'deactivated' ? 'user.deactivated' : 'user.reactivated', targetUserId, {});
  return { error: null };
}

export async function linkAthleteToUser(db: Db, orgId: string, actorId: string, actorRole: AppRole, userId: string, athleteId: string): Promise<{ error: string | null }> {
  const { error } = await db.from('athletes').update({ user_id: userId }).eq('org_id', orgId).eq('id', athleteId).is('user_id', null);
  if (error) return { error: error.message };
  await recordUserAudit(db, orgId, actorId, actorRole, 'user.athlete_linked', userId, { athlete_id: athleteId });
  return { error: null };
}
