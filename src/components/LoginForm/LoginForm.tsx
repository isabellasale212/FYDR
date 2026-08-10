'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Email and password against Supabase Auth.
 *
 * Where the user lands afterwards is not decided here. The form asks for
 * `/`, and the middleware resolves the shell from the roles in the issued JWT,
 * server-side, on the next request. A client that picked its own destination
 * would be a client-side role check, and CONTRACT.md rule 2 forbids it.
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

    router.replace(params.get('next') ?? '/');
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
          <input
            id="password"
            className="field"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      <button className="btn-primary signin-submit" type="submit" disabled={busy}>
        {busy ? 'Signing in' : 'Sign in'}
      </button>
    </form>
  );
}
