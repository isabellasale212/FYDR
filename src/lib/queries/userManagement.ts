import type { AppRole, Json, UserStatus } from '@/lib/types/database';
import type { Db } from './groups';
import { mustAffect } from '@/lib/write';

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
 *     scheduled report delivery and push/email notifications. Resend
 *     invite and invite revocation are the same gap wearing a different
 *     name — there is no invite to resend or revoke, only a password
 *     already handed over once.
 *   - The Declined/invited-lifecycle states the spec's onboarding-consent
 *     flow would drive — that flow doesn't exist in this build, so every
 *     account created here starts life 'active', not 'invited'.
 *   - Passkeys. Does not exist anywhere in this build's auth layer. MFA used to be listed
 *     here too — it now does exist (login-security checklist item 3), but its reads and
 *     writes go through Supabase's own Auth MFA API (supabase.auth.mfa.*, and, for an
 *     admin reading or removing another user's factor, the service-role
 *     supabase.auth.admin.mfa.* API), not this file's plain RLS-scoped `Db` queries — see
 *     MfaEnrollment.tsx, settings/users/[userId]/page.tsx and its mfa/route.ts.
 *   - Forced sign-out on role removal (the spec's own admin-set-role Edge
 *     Function). users.claims_version still bumps on every user_roles
 *     change (migration 0010's trigger, unrelated to this pass), which is
 *     what a stale-token check downstream would compare against — this
 *     pass doesn't add a check that reads it for that purpose.
 *
 * The dedicated user-detail page, its role history read from audit_log,
 * and the "what this user can see" plain-language summary all followed
 * once the rest of this file existed to build them on top of — see
 * fetchUserDetail/fetchUserAuditHistory below and
 * settings/users/[userId]/page.tsx.
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

/** Returns its own error rather than swallowing one, on purpose: a caller
 *  that awaits this without checking the result once did exactly that —
 *  audit_authenticated_insert (migration 0012) requires actor_id to match
 *  the real signed-in caller's own auth_user_id(), and every write from
 *  this file's three exported functions was passing the *target* user's
 *  id as actorId instead, whenever an admin acted on someone else's row.
 *  Every one of those inserts was silently RLS-rejected — a "mandatory
 *  audit event", this file's own header's words, quietly not happening
 *  for as long as that bug stood. Found live: fetchUserAuditHistory came
 *  back empty for actions this session had definitely just taken. Fixed
 *  at the call sites (UserManagementPanel now threads the real
 *  currentUserId down instead of reusing the row's own user.id), and
 *  fixed here too, so a caller that stops checking this again fails
 *  loudly instead of quietly. */
async function recordUserAudit(
  db: Db,
  orgId: string,
  actorId: string,
  actorRole: AppRole,
  action: string,
  targetUserId: string,
  metadata: Json,
): Promise<{ error: string | null }> {
  const { error } = await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    entity_type: 'user',
    entity_id: targetUserId,
    metadata,
  });
  return { error: error?.message ?? null };
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
): Promise<{ error: string | null; primaryOk: boolean }> {
  const { data: currentRows, error: currentErr } = await db.from('user_roles').select('role').eq('org_id', orgId).eq('user_id', targetUserId);
  if (currentErr) return { error: currentErr.message, primaryOk: false };
  const current = new Set((currentRows ?? []).map((r) => r.role));
  const next = new Set(nextRoles);

  const removingAdmin = current.has('sport_scientist') && !next.has('sport_scientist');
  if (removingAdmin) {
    const { count, error: countErr } = await db
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'sport_scientist');
    if (countErr) return { error: countErr.message, primaryOk: false };
    if ((count ?? 0) <= 1) {
      return { error: 'This is the only admin in the club — remove the role from someone else first, or grant it to another user before removing it here.', primaryOk: false };
    }
  }

  const toAdd = [...next].filter((r) => !current.has(r));
  const toRemove = [...current].filter((r) => !next.has(r));

  if (toAdd.length > 0) {
    const { error } = await db.from('user_roles').insert(toAdd.map((role) => ({ org_id: orgId, user_id: targetUserId, role, granted_by: actorId })));
    if (error) return { error: error.message, primaryOk: false };
  }
  for (const role of toRemove) {
    /* G-36. `toRemove` is computed from the roles this user was just read as
       holding, so a delete matching nothing means the policy refused, not that
       the role was absent. Revoking a role and having it stay is exactly the
       failure that matters on this screen. */
    const removed = await mustAffect(
      db.from('user_roles').delete().eq('org_id', orgId).eq('user_id', targetUserId).eq('role', role).select('role'),
      { refusal: 'Not saved: granting and revoking roles belongs to the sport scientist.' },
    );
    if (removed.error) return { error: removed.error, primaryOk: false };
  }

  // The role change itself has already committed by this point — an
  // audit-write failure below is real and worth surfacing, but it must
  // never be confused with the role change itself having failed. primaryOk
  // is how a caller tells the two apart, so a UI never discards a change
  // that genuinely happened just because its audit row didn't save.
  if (toAdd.length > 0 || toRemove.length > 0) {
    const { error: auditErr } = await recordUserAudit(db, orgId, actorId, actorRole, 'user_roles.changed', targetUserId, { added: toAdd, removed: toRemove });
    if (auditErr) return { error: `Roles were changed, but the audit log entry failed to save: ${auditErr}`, primaryOk: true };
  }

  return { error: null, primaryOk: true };
}

export async function setUserStatus(
  db: Db,
  orgId: string,
  actorId: string,
  actorRole: AppRole,
  targetUserId: string,
  status: Extract<UserStatus, 'active' | 'deactivated'>,
): Promise<{ error: string | null; primaryOk: boolean }> {
  /* G-36. Deactivating somebody who stays active is the worst kind of silent
     no-op: the list shows the new status until the next refresh. */
  const wrote = await mustAffect(
    db.from('users').update({ status }).eq('org_id', orgId).eq('id', targetUserId).select('id'),
    { refusal: 'Not saved: changing a user\u2019s status belongs to the sport scientist.' },
  );
  if (wrote.error) return { error: wrote.error, primaryOk: false };
  const { error: auditErr } = await recordUserAudit(db, orgId, actorId, actorRole, status === 'deactivated' ? 'user.deactivated' : 'user.reactivated', targetUserId, {});
  if (auditErr) return { error: `Status was changed, but the audit log entry failed to save: ${auditErr}`, primaryOk: true };
  return { error: null, primaryOk: true };
}

export async function linkAthleteToUser(db: Db, orgId: string, actorId: string, actorRole: AppRole, userId: string, athleteId: string): Promise<{ error: string | null; primaryOk: boolean }> {
  /* G-36. Zero rows here has TWO meanings and the filter is why: .is(user_id,
     null) matches only an unlinked athlete, so nothing changing means either the
     record was already linked to somebody, or the policy refused. Reporting
     plain success for the first was the old behaviour and it is the more
     dangerous of the two, because an administrator walks away believing a link
     exists that does not.
     
     So the empty branch asks which it was, rather than guessing. One extra
     query, and only when nothing changed. */
  const { data: linked, error } = await db
    .from('athletes')
    .update({ user_id: userId })
    .eq('org_id', orgId)
    .eq('id', athleteId)
    .is('user_id', null)
    .select('id');
  if (error) return { error: error.message, primaryOk: false };
  if (!linked || linked.length === 0) {
    const { data: existing } = await db
      .from('athletes')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('id', athleteId)
      .maybeSingle();
    if (existing?.user_id === userId) {
      return { error: 'That athlete record is already linked to this person. Nothing changed.', primaryOk: false };
    }
    if (existing?.user_id) {
      return { error: 'That athlete record is already linked to a different account. Unlink it first.', primaryOk: false };
    }
    return { error: 'Not saved: linking an athlete record belongs to the sport scientist.', primaryOk: false };
  }
  const { error: auditErr } = await recordUserAudit(db, orgId, actorId, actorRole, 'user.athlete_linked', userId, { athlete_id: athleteId });
  if (auditErr) return { error: `The athlete was linked, but the audit log entry failed to save: ${auditErr}`, primaryOk: true };
  return { error: null, primaryOk: true };
}

export type UserRoleGrant = {
  role: AppRole;
  granted_at: string;
  granted_by_name: string | null;
};

export type UserDetail = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  status: UserStatus;
  last_seen_at: string | null;
  created_at: string;
  roleGrants: UserRoleGrant[];
  athlete_id: string | null;
  athlete_name: string | null;
};

/** The detail screen's own top and left panels — user_roles' own
 *  granted_at/granted_by columns are exactly the "granted 12 Jul, A Bell"
 *  provenance the wireframe shows beside each role, already written by
 *  setUserRoles above; this is the first reader for them. */
export async function fetchUserDetail(db: Db, orgId: string, userId: string): Promise<UserDetail | null> {
  const [userRes, rolesRes, athleteRes] = await Promise.all([
    db.from('users').select('id, email, full_name, phone, status, last_seen_at, created_at').eq('org_id', orgId).eq('id', userId).is('deleted_at', null).maybeSingle(),
    db
      .from('user_roles')
      .select('role, granted_at, users!user_roles_granted_by_fkey(full_name)')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .order('granted_at', { ascending: false }),
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).eq('user_id', userId).is('deleted_at', null).maybeSingle(),
  ]);
  if (userRes.error) throw new Error(userRes.error.message);
  if (rolesRes.error) throw new Error(rolesRes.error.message);
  if (athleteRes.error) throw new Error(athleteRes.error.message);
  if (!userRes.data) return null;

  return {
    id: userRes.data.id,
    email: userRes.data.email,
    full_name: userRes.data.full_name,
    phone: userRes.data.phone,
    status: userRes.data.status,
    last_seen_at: userRes.data.last_seen_at,
    created_at: userRes.data.created_at,
    roleGrants: (rolesRes.data ?? []).map((r) => ({ role: r.role, granted_at: r.granted_at, granted_by_name: r.users?.full_name ?? null })),
    athlete_id: athleteRes.data?.id ?? null,
    athlete_name: athleteRes.data ? `${athleteRes.data.first_name} ${athleteRes.data.last_name}` : null,
  };
}

export type UserAuditRow = {
  id: number;
  action: string;
  occurred_at: string;
  actor_name: string | null;
  metadata: Json;
};

/** The "ROLE HISTORY" panel — every recordUserAudit call above writes
 *  entity_type='user', entity_id=<the affected user>, so this is a plain
 *  filter on that, not a new write path. audit_log's own RLS
 *  (audit_admin_select, migration 0012) is what actually restricts this
 *  to admins; this page is admin-only anyway, the same gate the rest of
 *  Users already has. bulk_invite events don't appear here — entity_id is
 *  null for a whole-batch event, a real, small, documented gap rather
 *  than a per-row entity_id that would misrepresent one audit row as
 *  describing a single account's history. */
export async function fetchUserAuditHistory(db: Db, orgId: string, userId: string): Promise<UserAuditRow[]> {
  const { data, error } = await db
    .from('audit_log')
    .select('id, action, occurred_at, metadata, users!audit_log_actor_id_fkey(full_name)')
    .eq('org_id', orgId)
    .eq('entity_type', 'user')
    .eq('entity_id', userId)
    .order('occurred_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, action: r.action, occurred_at: r.occurred_at, actor_name: r.users?.full_name ?? null, metadata: r.metadata }));
}
