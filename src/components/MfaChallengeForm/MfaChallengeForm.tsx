'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeNextPath } from '@/lib/safeRedirect';

type Status = 'loading' | 'ready' | 'error';

/** login-security checklist item 3 — the TOTP challenge step LoginForm.tsx redirects into
 *  after a successful password check when the account has a verified factor. This is a
 *  password-authenticated session already (aal1); the point of this screen is to raise it
 *  to aal2 via `supabase.auth.mfa.challengeAndVerify()` before the caller is treated as
 *  properly signed in anywhere that will eventually check for it.
 *
 *  Guards itself rather than relying on the middleware, because this route deliberately
 *  isn't in `STAFF_PREFIXES`/`ATHLETE_PREFIXES` — see middleware.ts. Anyone with no session,
 *  or a session that doesn't actually need a challenge, is bounced on mount rather than
 *  shown a form that would fail anyway. */
export function MfaChallengeForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Open-redirect guard: `next` came off the URL, which anyone could have
  // sent — see safeRedirect.ts's own header for the exact attack.
  const next = safeNextPath(params.get('next'));

  const [status, setStatus] = useState<Status>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function guard() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal || aal.nextLevel !== 'aal2' || aal.currentLevel === aal.nextLevel) {
        // Nothing to challenge — already aal2, or no verified factor at all. Either way
        // this screen has nothing to do; send them on to where they were headed.
        router.replace(next);
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp[0] ?? null;
      if (!factor) {
        // aal said a challenge was needed but listFactors disagrees — an inconsistent
        // state this screen cannot resolve. Back to a plain sign-in rather than a dead end.
        router.replace('/login');
        return;
      }

      if (!cancelled) {
        setFactorId(factor.id);
        setStatus('ready');
      }
    }

    guard().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; `next` and `router` are read at call time and do not need to re-trigger the guard.
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (verifyError) {
      setBusy(false);
      setCode('');
      setError('That code was not accepted. Check the time on your authenticator app and try again.');
      return;
    }

    router.replace(next);
    router.refresh();
  }

  async function startOver() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (status === 'loading') {
    return <p className="tiny">Checking your session.</p>;
  }

  if (status === 'error') {
    return (
      <div className="signin-form">
        <p className="form-error" role="alert">
          Something went wrong loading the sign-in check. Try signing in again.
        </p>
        <button className="btn-primary signin-submit" type="button" onClick={startOver}>
          Back to sign in
        </button>
      </div>
    );
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
          <label className="label" htmlFor="mfa-code">
            6-digit code
          </label>
          <input
            id="mfa-code"
            className="field num"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>

        <p className="signin-forgot">
          <button type="button" style={{ font: 'inherit', color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }} onClick={startOver}>
            Not your account? Sign in again
          </button>
        </p>
      </div>

      <button className="btn-primary signin-submit" type="submit" disabled={busy || code.length < 6}>
        {busy ? 'Verifying' : 'Verify'}
      </button>
    </form>
  );
}
