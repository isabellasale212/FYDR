import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/session';

export type RemoveMfaFactorResult = { ok: boolean; error: string | null };

/** login-security checklist item 3 (MFA). The one MFA write this build cannot do through
 *  an RLS-gated client at all, same shape as settings/users/create/route.ts's own header:
 *  removing another user's factor is `supabase.auth.admin.mfa.deleteFactor()`, which needs
 *  the service role key (createAdminClient, lib/supabase/admin.ts). requireStaff() confirms
 *  a signed-in staff member; the explicit admin check just below is what actually restricts
 *  this — the same two-layer pattern every other role-gated route in this build uses.
 *
 *  Why this exists at all: Supabase's TOTP MFA API has no recovery-code mechanism (checked
 *  the shipped .d.ts before building any of this — see lib/mfa.ts's header). A staff member
 *  who is required to enrol (MfaEnrollment.tsx's role prompt) and then loses their
 *  authenticator has exactly one way back into their account: an admin removes the factor
 *  for them here, so they can sign in on a password alone and re-enrol. There is
 *  deliberately no self-service "I lost my device" flow — that would be a second, unaudited
 *  way to strip a security control off an account, and this one at least leaves an
 *  audit_log row naming which admin did it and when. */
export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse<RemoveMfaFactorResult>> {
  const { userId } = await params;
  const { db, orgId, claims } = await requireStaff();
  if (!claims.roles.includes('admin')) {
    return NextResponse.json({ ok: false, error: 'Admin access only.' }, { status: 403 });
  }

  // The target must actually be a user of this admin's own organisation — orgId is never
  // trusted from the request body, only from the admin's own session (CLAUDE.md §2 rule 2).
  const { data: targetUser, error: targetErr } = await db.from('users').select('id').eq('org_id', orgId).eq('id', userId).is('deleted_at', null).maybeSingle();
  if (targetErr) {
    return NextResponse.json({ ok: false, error: targetErr.message }, { status: 500 });
  }
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: 'No such user in this club.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const factorId = typeof body?.factorId === 'string' ? body.factorId : '';
  if (!factorId) {
    return NextResponse.json({ ok: false, error: 'Missing factor id.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factorId, userId });
  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 400 });
  }

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: claims.userId,
    actor_role: 'admin',
    action: 'user.mfa_removed',
    entity_type: 'user',
    entity_id: userId,
    metadata: { factor_id: factorId },
  });

  return NextResponse.json({ ok: true, error: null });
}
