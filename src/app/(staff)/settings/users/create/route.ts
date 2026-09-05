import { randomBytes, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendInviteEmail } from '@/lib/email/send';
import { requireStaff } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

const VALID_ROLES: AppRole[] = ['athlete', 'coach', 'medic', 'sport_scientist'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateUserResult = {
  ok: boolean;
  error: string | null;
  userId: string | null;
  temporaryPassword: string | null;
  emailDelivered: boolean;
};

function generateTemporaryPassword(): string {
  // 12 random bytes, base64url-encoded — readable enough to copy by hand,
  // well above the 10-character minimum this build's own change-password
  // form already enforces.
  return randomBytes(12).toString('base64url');
}

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
  if (!claims.roles.includes('sport_scientist')) {
    return NextResponse.json({ ok: false, error: 'Admin access only.', userId: null, temporaryPassword: null, emailDelivered: false }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid request.', userId: null, temporaryPassword: null, emailDelivered: false }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const roles: AppRole[] = Array.isArray(body.roles) ? body.roles.filter((r: unknown): r is AppRole => VALID_ROLES.includes(r as AppRole)) : [];
  const athleteId = typeof body.athleteId === 'string' && body.athleteId ? body.athleteId : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email address.', userId: null, temporaryPassword: null, emailDelivered: false }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ ok: false, error: 'Enter a name.', userId: null, temporaryPassword: null, emailDelivered: false }, { status: 400 });
  }
  if (roles.length === 0) {
    return NextResponse.json({ ok: false, error: 'Tick at least one role.', userId: null, temporaryPassword: null, emailDelivered: false }, { status: 400 });
  }

  const newUserId = randomUUID();

  const { error: insertErr } = await db.from('users').insert({
    id: newUserId,
    org_id: orgId,
    email,
    full_name: fullName,
    status: 'active',
  });
  if (insertErr) {
    const message = /duplicate key|already exists/i.test(insertErr.message) ? 'That email is already registered in this club.' : insertErr.message;
    return NextResponse.json({ ok: false, error: message, userId: null, temporaryPassword: null, emailDelivered: false }, { status: 400 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const admin = createAdminClient();
  const authResult = await admin.auth.admin.createUser({
    id: newUserId,
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authResult.error) {
    // Roll back the just-created row rather than leave an application user
    // with no matching sign-in — this row never existed before this
    // request, so removing it is cancelling a failed creation, not
    // deleting a real user's data.
    await db.from('users').delete().eq('id', newUserId);
    const message = /already been registered|already exists/i.test(authResult.error.message)
      ? 'That email is already registered on this project.'
      : authResult.error.message;
    return NextResponse.json({ ok: false, error: message, userId: null, temporaryPassword: null, emailDelivered: false }, { status: 400 });
  }

  const { error: rolesErr } = await db.from('user_roles').insert(roles.map((role) => ({ org_id: orgId, user_id: newUserId, role, granted_by: claims.userId })));
  if (rolesErr) {
    // The account genuinely exists at this point (a real sign-in would
    // work) — say so plainly rather than report a clean failure, and hand
    // back the password and id so the admin isn't left with no way to
    // finish the job from the user list.
    return NextResponse.json({ ok: false, error: `Account created, but roles failed to save: ${rolesErr.message}. Set roles for this user from the list.`, userId: newUserId, temporaryPassword, emailDelivered: false }, { status: 500 });
  }

  if (athleteId) {
    const { error: linkErr } = await db.from('athletes').update({ user_id: newUserId }).eq('org_id', orgId).eq('id', athleteId).is('user_id', null);
    if (linkErr) {
      return NextResponse.json({ ok: false, error: `Account and roles created, but linking the athlete record failed: ${linkErr.message}`, userId: newUserId, temporaryPassword, emailDelivered: false }, { status: 500 });
    }
  }

  const actorRole = (claims.roles.includes('sport_scientist') ? 'sport_scientist' : claims.roles[0]) as AppRole;

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: actorRole,
    action: 'user.created',
    entity_type: 'user',
    entity_id: newUserId,
    metadata: { roles, athlete_id: athleteId },
  });

  // Attempts a real invite email — see lib/email/provider.ts for why this
  // is almost always the honest no-op today (no RESEND_API_KEY anywhere
  // in this project) rather than a real send. Either way, the temporary
  // password is still returned below: this never becomes the only way to
  // get a new account working, only an additional one when it's real.
  const { delivered: emailDelivered } = await sendInviteEmail(db, orgId, claims.userId, actorRole, newUserId, email, {
    recipientName: fullName,
    clubName: orgName,
    temporaryPassword,
    signInUrl: new URL('/login', request.url).toString(),
  });

  return NextResponse.json({ ok: true, error: null, userId: newUserId, temporaryPassword, emailDelivered });
}
