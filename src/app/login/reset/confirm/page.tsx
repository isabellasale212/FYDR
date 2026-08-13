import Link from 'next/link';
import { ResetConfirmForm } from '@/components/ResetConfirmForm/ResetConfirmForm';

export const metadata = { title: 'Choose a new password · Fydr' };

/** Self-serve password recovery, step two of two (audit S9): where the
 *  emailed reset link lands. Public route — the visitor is signed out until
 *  the link's code is exchanged, and /login/reset/confirm matches neither
 *  shell prefix in src/lib/supabase/middleware.ts (and is not the exact
 *  `/login` match that bounces signed-in users), so a fresh recovery
 *  session is not redirected away before it can set a password. */
export default function ResetConfirmPage() {
  return (
    <main className="login-wrap" id="main">
      <div className="login-card">
        <div className="signin-logo">
          <div className="signin-mark" aria-hidden="true" />
          <span className="signin-word">
            Fydr<i>.</i>
          </span>
        </div>

        <div className="signin-head">
          <p className="signin-eyebrow">Password reset</p>
          <h1 className="signin-title">Choose a new password.</h1>
          <p className="signin-sub">You will be signed in as soon as it is set.</p>
        </div>

        <ResetConfirmForm />

        <p className="signin-return">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
