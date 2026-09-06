import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendInviteEmail } from '@/lib/email/send';
import { deleteInvitedUser, issueInvite } from '@/lib/invite';
import { requireStaff } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { SETTINGS_ADMIN, actingRole, hasAnyRole } from '@/lib/access';

/* The allow-list the submitted roles are filtered through, so anything absent
 * here cannot be granted at all. It held four values and the enum now holds
 * six, which meant an administrator could not give anybody the S&C or the
 * nutritionist role through the only screen that grants roles. */
const VALID_ROLES: AppRole[] = ['athlete', 'coach', 'medic', 'sport_scientist', 'strength_conditioning', 'nutritionist'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateUserResult = {
  ok: boolean;
  error: string | null;
  userId: string | null;
  /** The single-use link the new person follows to set their own password.
   *  Replaces the temporary password this response used to carry. Returned
   *  because no email provider exists yet, so without it the account would be
   *  unreachable; see lib/invite.ts for why a link is not the same thing. */
  inviteUrl: string | null;
  emailDelivered: boolean;
};

/** docs/screens/user-management.md, the one write in this feature that
 *  can't go through an RLS-gated client at all: creating a real auth.users
 *  row needs the service role key (createAdminClient, lib/supabase/admin.ts),
 *  which is why this is a Route Handler and not a plain query function.
 *  requireStaff() confirms a signed-in staff member; the explicit role
 *  check just below is what actually restricts this to admins — the same
 *  two-layer pattern (session check, then a role check this file owns)
 *  every other role-gated route in this build already uses.
 *
 *  Genuinely attempts an invite email now — see lib/email/provider.ts —
 *  but no SMS, and the email itself is almost always a real, honest no-op
 *  rather than a real send: no email provider account exists anywhere in
 *  this project, the same gap lib/queries/userManagement.ts's header has
 *  always named. What's different is the code path is real and complete,
 *  not missing — the moment a real RESEND_API_KEY exists, this route
 *  needs no further changes to start actually sending. The temporary
 *  password is returned either way, in this response only, never logged
 *  and never stored anywhere beyond auth.users' own hash of it — a
 *  delivered email is an addition to that, never a replacement for it. */
export async function POST(request: Request): Promise<NextResponse<CreateUserResult>> {
  const { db, orgId, orgName, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) {
    return NextResponse.json({ ok: false, error: 'Admin access only.', userId: null, inviteUrl: null, emailDelivered: false }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid request.', userId: null, inviteUrl: null, emailDelivered: false }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const roles: AppRole[] = Array.isArray(body.roles) ? body.roles.filter((r: unknown): r is AppRole => VALID_ROLES.includes(r as AppRole)) : [];
  const athleteId = typeof body.athleteId === 'string' && body.athleteId ? body.athleteId : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email address.', userId: null, inviteUrl: null, emailDelivered: false }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ ok: false, error: 'Enter a name.', userId: null, inviteUrl: null, emailDelivered: false }, { status: 400 });
  }
  if (roles.length === 0) {
    return NextResponse.json({ ok: false, error: 'Tick at least one role.', userId: null, inviteUrl: null, emailDelivered: false }, { status: 400 });
  }

  /* The auth user is created FIRST now, and the application row second. That
     is the reverse of the old order and it follows from the mechanism:
     generateLink assigns the id, so there is no id to write a users row against
     until the invite exists. The rollback runs the other way round to match. */
  const admin = createAdminClient();
  const invited = await issueInvite(admin, email, fullName, new URL(request.url).origin);
  if (!invited.ok) {
    return NextResponse.json({ ok: false, error: invited.error, userId: null, inviteUrl: null, emailDelivered: false }, { status: 400 });
  }
  const { userId: newUserId, inviteUrl } = invited.invite;

  const { error: insertErr } = await db.from('users').insert({
    id: newUserId,
    org_id: orgId,
    email,
    full_name: fullName,
    status: 'active',
  });
  if (insertErr) {
    // Cancel the invite rather than leave a sign-in with no application user
    // behind it. Both were created by this request, seconds ago.
    await deleteInvitedUser(admin, newUserId);
    const message = /duplicate key|already exists/i.test(insertErr.message) ? 'That email is already registered in this club.' : insertErr.message;
    return NextResponse.json({ ok: false, error: message, userId: null, inviteUrl: null, emailDelivered: false }, { status: 400 });
  }

  const { error: rolesErr } = await db.from('user_roles').insert(roles.map((role) => ({ org_id: orgId, user_id: newUserId, role, granted_by: claims.userId })));
  if (rolesErr) {
    // The account genuinely exists at this point (a real sign-in would
    // work) — say so plainly rather than report a clean failure, and hand
    // back the password and id so the admin isn't left with no way to
    // finish the job from the user list.
    return NextResponse.json({ ok: false, error: `Account created, but roles failed to save: ${rolesErr.message}. Set roles for this user from the list.`, userId: newUserId, inviteUrl, emailDelivered: false }, { status: 500 });
  }

  if (athleteId) {
    /* Same two meanings as linkAthleteToUser, and the same answer: say which.
       An invite that silently fails to link leaves an account with no athlete
       record behind it, which reads as a working invite until somebody looks. */
    const { data: linkedRows, error: linkErr } = await db
      .from('athletes')
      .update({ user_id: newUserId })
      .eq('org_id', orgId)
      .eq('id', athleteId)
      .is('user_id', null)
      .select('id');
    if (!linkErr && (!linkedRows || linkedRows.length === 0)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Account and roles created, but that athlete record was already linked to another account, so it was left alone.',
          userId: newUserId,
          inviteUrl,
          emailDelivered: false,
        },
        { status: 409 },
      );
    }
    if (linkErr) {
      return NextResponse.json({ ok: false, error: `Account and roles created, but linking the athlete record failed: ${linkErr.message}`, userId: newUserId, inviteUrl, emailDelivered: false }, { status: 500 });
    }
  }

  const actorRole = actingRole(claims.roles);

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: actorRole,
    action: 'user.created',
    entity_type: 'user',
    entity_id: newUserId,
    metadata: { roles, athlete_id: athleteId },
  });

  /* Attempts a real invite email — see lib/email/provider.ts for why this is
     almost always an honest no-op today rather than a real send. The link is
     returned either way: with no provider configured, refusing to show it would
     mean every account created is one nobody can ever sign in to. */
  const { delivered: emailDelivered } = await sendInviteEmail(db, orgId, claims.userId, actorRole, newUserId, email, {
    recipientName: fullName,
    clubName: orgName,
    inviteUrl,
  });

  return NextResponse.json({ ok: true, error: null, userId: newUserId, inviteUrl, emailDelivered });
}
