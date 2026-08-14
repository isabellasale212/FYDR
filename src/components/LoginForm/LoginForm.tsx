'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PasswordField } from '@/components/PasswordField/PasswordField';

/**
 * Email and password against Supabase Auth.
 *
 * Where the user lands afterwards is not decided here. The form asks for
 * `/`, and the middleware resolves the shell from the roles in the issued JWT,
 * server-side, on the next request. A client that picked its own destination
 * would be a client-side role check, and CONTRACT.md rule 2 forbids it.
 *
 * login-security checklist item 3 (MFA): the one destination this file DOES pick itself
 * is `/login/mfa`, and that is not a role decision — it is "does this session's assurance
 * level need to go from aal1 to aal2 before it is a real session", which
 * getAuthenticatorAssuranceLevel() answers directly from the token Supabase Auth already
 * issued, the same non-authoritative-but-fine use of client state the athlete/staff shell
 * pick above already relies on (the middleware and RLS are what actually enforce anything).
 * Deliberately the only change this file makes for MFA — the challenge screen itself, and
 * everything about verifying a code, lives at /login/mfa, not here, so as not to touch the
 * attempt-tracking/lockout logic this file also owns.
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('That email and password do not match an account.');
      setBusy(false);
      return;
    }

    const next = params.get('next') ?? '/';

    // The password check just passed, so there is a real session — but if this account has
    // a verified TOTP factor, that session is only aal1 and is not the real sign-in yet.
    // nextLevel is 'aal2' whenever a verified factor exists; currentLevel !== nextLevel is
    // "and the challenge hasn't been completed this session yet".
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      router.replace(`/login/mfa?next=${encodeURIComponent(next)}`);
      setBusy(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="signin-form">
      <div className="signin-fields">
        {error ? (
          <p className="form-error" role="alert" style={{ margin: 0 }}>
            {error}
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

      <button className="btn-primary signin-submit" type="submit" disabled={busy}>
        {busy ? 'Signing in' : 'Sign in'}
      </button>
    </form>
  );
}
