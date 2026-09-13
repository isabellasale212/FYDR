import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';
import { setUserStatus } from '@/lib/queries/userManagement';
import type { UserStatus } from '@/lib/types/database';

export type SetUserStatusResult = { ok: boolean; error: string | null; status: Extract<UserStatus, 'active' | 'deactivated'> | null; primaryOk: boolean };

/** PATTERN-S8 D5, ruled 13 September 2026 (decision batch B1): DEACTIVATE IS
 *  THE REVOKE. One button, not two — deactivating an account invalidates any
 *  outstanding invite or magic link at the same moment, and there is no
 *  separate Revoke control.
 *
 *  Why a route and not the panel's own RLS write. The users.status update is
 *  still the panel's rule (setUserStatus, the users_admin_update policy); what
 *  it could never do is reach the auth row. An invite is a single-use Supabase
 *  token that nothing in the application schema can see, so a deactivated
 *  account's unfollowed invite still signed the person in — the access-token
 *  hook (0010) then issued a token with no org and no roles, which is a locked
 *  door with the front door open. Banning the auth user
 *  (auth.admin.updateUserById, ban_duration) is what makes GoTrue refuse the
 *  token at verification: the invite, a magic link and a password sign-in all
 *  stop at the same moment. Reactivating lifts the ban ('none').
 *
 *  Order: the application row first (the panel's refusal words come from that
 *  write), then the auth ban. If the ban fails the status is already changed
 *  and the response says so — the account is deactivated in the app and the
 *  invite is NOT yet cancelled — rather than reporting a clean failure or a
 *  clean success. The audit row records which of the two happened. */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse<SetUserStatusResult>> {
  const { userId } = await params;
  const { db, orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) {
    return NextResponse.json({ ok: false, error: 'Admin access only.', status: null, primaryOk: false }, { status: 403 });
  }
  if (userId === claims.userId) {
    return NextResponse.json({ ok: false, error: 'You cannot deactivate your own account.', status: null, primaryOk: false }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status === 'deactivated' ? 'deactivated' : body?.status === 'active' ? 'active' : null;
  if (!status) {
    return NextResponse.json({ ok: false, error: 'Invalid status.', status: null, primaryOk: false }, { status: 400 });
  }

  // The target must be a user of this admin's own organisation — orgId from the
  // session, never the request (CLAUDE.md §2 rule 2).
  const { data: target, error: targetErr } = await db.from('users').select('id').eq('org_id', orgId).eq('id', userId).is('deleted_at', null).maybeSingle();
  if (targetErr) return NextResponse.json({ ok: false, error: targetErr.message, status: null, primaryOk: false }, { status: 500 });
  if (!target) return NextResponse.json({ ok: false, error: 'No such user in this club.', status: null, primaryOk: false }, { status: 404 });

  const actorRole = claims.roles.includes('sport_scientist') ? 'sport_scientist' : claims.roles[0] ?? null;
  const wrote = await setUserStatus(db, orgId, claims.userId, actorRole, userId, status);
  if (!wrote.primaryOk) {
    return NextResponse.json({ ok: false, error: wrote.error, status: null, primaryOk: false }, { status: 400 });
  }

  /* The revoke. 100 years is GoTrue's idiom for "until lifted"; 'none' lifts it. */
  const admin = createAdminClient();
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: status === 'deactivated' ? '876000h' : 'none' });

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: actorRole,
    action: status === 'deactivated' ? 'user.invites_revoked' : 'user.invites_restored',
    entity_type: 'user',
    entity_id: userId,
    metadata: { sign_in_blocked_at_auth: !banErr, error: banErr?.message ?? null },
  });

  if (banErr) {
    return NextResponse.json(
      {
        ok: false,
        error:
          status === 'deactivated'
            ? `Deactivated in Fydr, but the sign-in itself could not be blocked (${banErr.message}) — an outstanding invite or magic link may still work. Try again.`
            : `Reactivated in Fydr, but sign-in could not be unblocked (${banErr.message}). Try again.`,
        status,
        primaryOk: true,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, error: wrote.error, status, primaryOk: true });
}
