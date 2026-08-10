import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm/LoginForm';

export const metadata = { title: 'Sign in · Fydr' };

/** ATHLETE-APP-SPEC.md §3, real auth substituted in — see base.css's own
 *  "sign-in" section header comment for why (email + password, no OTP
 *  infrastructure anywhere in this build). Staff sign in at this same
 *  route too; the visual language is the spec's athlete one throughout,
 *  since it's this app's only real sign-in screen either way. */
export default function LoginPage() {
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
          <p className="signin-eyebrow">Sign in</p>
          <h1 className="signin-title">Your morning takes 45 seconds.</h1>
          <p className="signin-sub">
            Your club has already added you. Use the email your coach has on file.
          </p>
        </div>

        <Suspense fallback={<p className="tiny" style={{ marginTop: 28 }}>Loading the form.</p>}>
          <LoginForm />
        </Suspense>

        <p className="signin-privacy">
          Your wellness answers are visible to your coaching and medical staff. Injury
          detail is medical only.
        </p>
      </div>
    </main>
  );
}
