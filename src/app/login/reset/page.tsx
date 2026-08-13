import Link from 'next/link';
import { ResetRequestForm } from '@/components/ResetRequestForm/ResetRequestForm';

export const metadata = { title: 'Reset your password · Fydr' };

/** Self-serve password recovery, step one of two (audit S9). Same visual
 *  shell as /login — logo row, heading block, bottom-pinned button. Public
 *  route: it matches neither shell prefix in src/lib/supabase/middleware.ts,
 *  and it must, since the person using it cannot sign in. */
export default function ResetRequestPage() {
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
          <h1 className="signin-title">Locked out? One email fixes it.</h1>
          <p className="signin-sub">
            Enter the email your club has on file. We will send you a link that sets a
            new password.
          </p>
        </div>

        <ResetRequestForm />

        <p className="signin-return">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
