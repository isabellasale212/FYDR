import Link from 'next/link';
import { ResetRequestForm } from '@/components/ResetRequestForm/ResetRequestForm';
import { FydrLockup } from '@/components/FydrLockup/FydrLockup';

export const metadata = { title: 'Reset your password · Fydr' };

/** Self-serve password recovery, step one of two (audit S9). Same visual
 *  shell as /login — logo row, heading block, bottom-pinned button. Public
 *  route: it matches neither shell prefix in src/lib/supabase/middleware.ts,
 *  and it must, since the person using it cannot sign in. */
export default function ResetRequestPage() {
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
