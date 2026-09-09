import { Suspense } from 'react';
import { MfaChallengeForm } from '@/components/MfaChallengeForm/MfaChallengeForm';
import { FydrLockup } from '@/components/FydrLockup/FydrLockup';

export const metadata = { title: 'Verify it’s you · Fydr' };

/** login-security checklist item 3 (MFA). Landed on only by LoginForm.tsx, after a
 *  password check has already succeeded, for the one case that needs a second step: the
 *  account has a verified TOTP factor and this session hasn't completed the challenge yet.
 *  Not gated by middleware.ts on purpose — see MfaChallengeForm.tsx's own header — the
 *  form guards itself on mount instead. Same visual shell as /login, this build's only real
 *  sign-in screen (see /login/page.tsx's own comment on why that spec citation covers both
 *  shells), because this is a continuation of that same flow, not a different one. */
export default function MfaChallengePage() {
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
          <p className="signin-eyebrow">Sign in</p>
          <h1 className="signin-title">Enter your code.</h1>
          <p className="signin-sub">
            Your account has two-factor authentication on. Enter the 6-digit code from your
            authenticator app.
          </p>
        </div>

        <Suspense fallback={<p className="tiny" style={{ marginTop: 'var(--sp-28)' }}>Loading the form.</p>}>
          <MfaChallengeForm />
        </Suspense>
      </div>
    </main>
  );
}
