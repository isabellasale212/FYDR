import Link from 'next/link';
import { ResetConfirmForm } from '@/components/ResetConfirmForm/ResetConfirmForm';
import { FydrLockup } from '@/components/FydrLockup/FydrLockup';
import { createClient } from '@/lib/supabase/server';
import { getClaims } from '@/lib/supabase/claims';
import { fetchInviteContext, type InviteContext } from '@/lib/inviteContext';

export const metadata = { title: 'Choose a password · Fydr' };

/** Self-serve password recovery, step two of two (audit S9): where the
 *  emailed reset link lands. Public route — the visitor is signed out until
 *  the link's code is exchanged, and /login/reset/confirm matches neither
 *  shell prefix in src/lib/supabase/middleware.ts (and is not the exact
 *  `/login` match that bounces signed-in users), so a fresh recovery
 *  session is not redirected away before it can set a password. */
export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /* One screen, two arrivals. A reset is somebody who has a password and wants
     a different one; an invite is somebody who has never had one, arriving from
     /auth/confirm after their token was verified. The form below is identical
     either way, and so is the design, which is frozen: only the two lines that
     would otherwise tell an invited person they are resetting something they
     have never had. */
  const isInvite = (await searchParams).invite === '1';
  /* PATTERN-S9 artboard 1 (2026-09-13): an invite arrives signed in — the
     token was verified a moment ago by /auth/confirm — so the page can name
     the club, the squad, who sent it and when, and the address it went to,
     from the recipient's own rows. Nothing is read for a reset. */
  let invite: InviteContext | null = null;
  let timezone = 'Europe/London';
  if (isInvite) {
    const supabase = await createClient();
    const claims = await getClaims(supabase);
    if (claims?.orgId) {
      const [ctx, org] = await Promise.all([
        fetchInviteContext(supabase, { userId: claims.userId, orgId: claims.orgId, athleteId: claims.athleteId, email: claims.email, roles: claims.roles }),
        supabase.from('organisations').select('timezone').eq('id', claims.orgId).maybeSingle(),
      ]);
      invite = ctx;
      timezone = org.data?.timezone ?? timezone;
    }
  }
  return (
    <main className="login-wrap" id="main">
      <div className="login-card">
        {/* The real mark, the same component the splash draws, at a scale
            suited to a 480px card. This was a 26x26 rounded blue square beside
            a second, separately-declared wordmark until 2026-09-07 — a shape
            that appears nowhere else in the brand, on the three screens
            somebody reaches when they are already locked out. */}
        <div className="signin-logo">
          <FydrLockup title="Fydr" />
        </div>

        <div className="signin-head">
          <p className="signin-eyebrow">{isInvite ? 'Invite' : 'Password reset'}</p>
          <h1 className="signin-title">{isInvite ? 'Set a password' : 'Choose a new password.'}</h1>
          {isInvite ? null : <p className="signin-sub">You will be signed in as soon as it is set.</p>}
        </div>

        <ResetConfirmForm invite={invite} timezone={timezone} />

        <p className="signin-return">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
