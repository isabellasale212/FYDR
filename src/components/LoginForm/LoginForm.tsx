'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PasswordField } from '@/components/PasswordField/PasswordField';
import { createClient } from '@/lib/supabase/client';
import { safeNextPath } from '@/lib/safeRedirect';
import { SIGN_IN_COPY, isSignInErrorCode } from '@/lib/signInSubmission';
import type { SignInResult } from '@/app/auth/sign-in/route';

/** Formats a countdown in the same honest, specific register the rest of the app's
 *  copy uses -- "Try again in 2 minutes", not a vague "try again later". Minutes and
 *  seconds only (the longest tier this build ever issues is 60 minutes). */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now';
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Email and password against Supabase Auth.
 *
 * Where the user lands afterwards is not decided here. The form asks for
 * `/`, and the middleware resolves the shell from the roles in the issued JWT,
 * server-side, on the next request. A client that picked its own destination
 * would be a client-side role check, and CONTRACT.md rule 2 forbids it.
 *
 * login-security checklist item 4: the actual signInWithPassword call now happens
 * server-side, in src/app/auth/sign-in/route.ts, wrapped in the per-email exponential
 * backoff migration 0048_login_attempts.sql builds -- a client-reported attempt count
 * would be unforgeable-proof in name only. This component's own shape (controlled
 * fields, busy state, preventDefault) is unchanged; only what onSubmit awaits changed,
 * from a direct supabase-js call to a fetch against that route.
 *
 * login-security checklist item 3 (MFA): the one destination this file DOES pick itself
 * is `/login/mfa`, and that is not a role decision — it is "does this session's assurance
 * level need to go from aal1 to aal2 before it is a real session", which
 * getAuthenticatorAssuranceLevel() answers directly from the token Supabase Auth already
 * issued, the same non-authoritative-but-fine use of client state the athlete/staff shell
 * pick above already relies on (the middleware and RLS are what actually enforce anything).
 * Deliberately the only change this file makes for MFA — the challenge screen itself, and
 * everything about verifying a code, lives at /login/mfa, not here, so as not to touch the
 * attempt-tracking/lockout logic this file also owns. A browser client is still needed here
 * (createClient() below) purely to read that assurance level — the sign-in call itself moved
 * server-side for item 4, but this one post-success read has no server-side equivalent yet.
 *
 * THE <form> SAYS method="post" action="/auth/sign-in", AND THAT IS NOT DECORATION. Until
 * React has hydrated, the browser is the only thing listening to a Sign in press, and a
 * form with no method submits as GET to its own URL with the password in the query
 * string — seen on 2026-09-11 as `/login?email=…&password=…` in the dev log and the
 * browser history. With a method and an action a pre-hydration submit carries the
 * fields in the body, to the same route the fetch below uses, which answers it with a
 * redirect back here: `?e=<code>` on failure, which the initial state below turns into
 * the same words the fetch path would have shown. See lib/signInSubmission.ts.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // `e` is a code, never a message: the middleware sends no-roles, and the sign-in route
  // sends invalid / missing / locked back to a native (pre-hydration) submit. A code that
  // is not one of ours shows nothing, so the URL cannot be made to display arbitrary text.
  const code = params.get('e');
  const [error, setError] = useState<string | null>(
    isSignInErrorCode(code) && code !== 'locked' ? SIGN_IN_COPY[code] : null,
  );
  const [busy, setBusy] = useState(false);
  // Wall-clock deadline, not a pre-formatted string -- so the message re-renders with a
  // live, honestly-decreasing countdown rather than going stale the moment it's shown.
  // A native submit that hit the lockout arrives as ?e=locked&s=<seconds>; the same
  // countdown starts from that.
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    const s = code === 'locked' ? Number(params.get('s')) : NaN;
    return Number.isFinite(s) && s > 0 ? Date.now() + s * 1000 : null;
  });
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (lockedUntil === null) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      setSecondsRemaining(Math.max(remaining, 0));
      if (remaining <= 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const locked = lockedUntil !== null && secondsRemaining > 0;

  // Open-redirect guard: `next` came off the URL, which anyone could have
  // sent — see safeRedirect.ts's own header for the exact attack. Read once,
  // for the fetch path's router.replace and the native path's hidden field.
  const next = safeNextPath(params.get('next'));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Defense in depth alongside the disabled submit button below -- an implicit
    // Enter-key submit while the one form button is disabled behaves inconsistently
    // across browsers, and the honest countdown means genuinely not sending the request.
    if (locked) return;
    setBusy(true);
    setError(null);

    const response = await fetch('/auth/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = (await response.json().catch(() => null)) as SignInResult | null;

    if (!result || !result.ok) {
      if (result?.locked) {
        // No setError here -- the paragraph below computes a live message from
        // secondsRemaining every tick instead of freezing one at the moment of failure.
        setLockedUntil(new Date(result.lockedUntil).getTime());
        setSecondsRemaining(result.secondsRemaining);
      } else {
        setError(result?.error ?? 'That email and password do not match an account.');
      }
      setBusy(false);
      return;
    }

    // The password check just passed, so there is a real session — but if this account has
    // a verified TOTP factor, that session is only aal1 and is not the real sign-in yet.
    // nextLevel is 'aal2' whenever a verified factor exists; currentLevel !== nextLevel is
    // "and the challenge hasn't been completed this session yet".
    const supabase = createClient();
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      router.replace(`/login/mfa?next=${encodeURIComponent(next)}`);
      setBusy(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  const message = locked
    ? `Too many attempts. Try again in ${formatCountdown(secondsRemaining)}.`
    : error;

  return (
    <form onSubmit={onSubmit} method="post" action="/auth/sign-in" noValidate className="signin-form">
      {/* Only the native path reads this; the fetch path has `next` in scope. */}
      {next !== '/' ? <input type="hidden" name="next" value={next} /> : null}
      <div className="signin-fields">
        {message ? (
          <p className="form-error" role="alert" style={{ margin: 0 }}>
            {message}
          </p>
        ) : null}

        <div className="form-row" style={{ margin: 0 }}>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="field"
            type="email"
            name="email"
            autoComplete="username"
            enterKeyHint="next"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-row" style={{ margin: 0 }}>
          <label className="label" htmlFor="password">
            Password
          </label>
          <PasswordField
            id="password"
            name="password"
            autoComplete="current-password"
            enterKeyHint="go"
            required
            value={password}
            onChange={setPassword}
          />
        </div>

      </div>

      {/* LOCKED IS aria-disabled, NOT disabled — ATH-ADULT-01 board note 4. A
          disabled button leaves the tab order and reads at 45% opacity, which
          is what the countdown label needs least. aria-disabled keeps it
          focusable and announced with its label; the press is refused here at
          the control and again in onSubmit at the form, so Enter in a field
          does nothing while the countdown runs. It wears the kit secondary
          (.btn-ghost) meanwhile, so it reads as not-the-action rather than as
          a faded copy of it. `disabled` is kept for the pending moment only. */}
      <button
        className={locked ? 'btn-ghost signin-submit' : 'btn-primary signin-submit'}
        type="submit"
        disabled={busy}
        aria-disabled={locked || undefined}
        onClick={(event) => {
          if (locked) event.preventDefault();
        }}
      >
        {locked ? `Locked · ${formatCountdown(secondsRemaining)}` : busy ? 'Signing in…' : 'Sign in'}
      </button>

      {/* BELOW the button, centred — Fydr App Launch.dc.html puts the secondary
          action there, and it is also the fix for what this was: the link sat
          inside the field stack, 14px under the password box, while the button
          carried margin-top: auto that collapses to nothing in this layout. The
          two ended up touching, so the link read as a caption on the button
          rather than as a separate way out. */}
      <p className="signin-forgot">
        <Link href="/login/reset">Forgot your password?</Link>
      </p>
    </form>
  );
}
