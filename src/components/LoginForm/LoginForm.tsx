'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PasswordField } from '@/components/PasswordField/PasswordField';
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
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('e') === 'no-roles'
      ? 'That account holds no role in any club. Ask your club administrator to grant one.'
      : null,
  );
  const [busy, setBusy] = useState(false);
  // Wall-clock deadline, not a pre-formatted string -- so the message re-renders with a
  // live, honestly-decreasing countdown rather than going stale the moment it's shown.
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
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

    router.replace(params.get('next') ?? '/');
    router.refresh();
  }

  const message = locked
    ? `Too many attempts. Try again in ${formatCountdown(secondsRemaining)}.`
    : error;

  return (
    <form onSubmit={onSubmit} noValidate className="signin-form">
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
            required
            value={password}
            onChange={setPassword}
          />
        </div>

        <p className="signin-forgot">
          <Link href="/login/reset">Forgot your password?</Link>
        </p>
      </div>

      <button className="btn-primary signin-submit" type="submit" disabled={busy || locked}>
        {locked ? `Locked · ${formatCountdown(secondsRemaining)}` : busy ? 'Signing in' : 'Sign in'}
      </button>
    </form>
  );
}
