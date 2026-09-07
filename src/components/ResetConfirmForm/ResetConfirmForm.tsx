'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PasswordField } from '@/components/PasswordField/PasswordField';
import { reportSignIn } from '@/lib/signInAudit';

/** Same rule and copy as ChangePasswordForm — the app's one password standard.
 *  12, matching docs/09-security-and-compliance.md §8 (audit: was 10). */
const MIN_LENGTH = 12;

type LinkPhase = 'checking' | 'ready' | 'no-link' | 'expired' | 'failed';

/**
 * The landing side of the reset email (audit S9). Supabase's link hits its
 * verify endpoint, which redirects here either with a one-time ?code= (which
 * becomes a signed-in recovery session) or with error params when the link
 * is expired or already used. Once a session exists, updateUser sets the new
 * password, and routing to `/` lets the middleware land the user in whichever
 * shell their roles resolve to — this page never picks a destination itself.
 *
 * Session handling, deliberately simple: any session on this page may set a
 * new password, with no attempt to distinguish a recovery session from an
 * ordinary one. Trying to tell them apart breaks the person who refreshes
 * mid-reset (the code is single-use and gone from the URL), and a signed-in
 * visitor setting their own password here is no more powerful than the reset
 * email they could send themselves. The settings ChangePasswordForm keeps its
 * stricter current-password check for the signed-in path.
 *
 * The one-time code is exchanged exactly once: getSession() first (the SDK's
 * own URL detection usually exchanges it on load), an explicit
 * exchangeCodeForSession only as fallback, and the whole establishment step
 * is cached in a ref so React strict-mode's double effect cannot burn the
 * code twice. PKCE constraint, surfaced in the request page's copy too: the
 * exchange only succeeds in the browser that asked for the email.
 */
async function establishRecoverySession(): Promise<LinkPhase> {
  const supabase = createClient();
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  const param = (key: string) => url.searchParams.get(key) ?? hash.get(key);

  if (param('error') !== null || param('error_code') !== null) {
    return param('error_code') === 'otp_expired' ? 'expired' : 'failed';
  }

  // getSession waits for the client's initialisation, which includes its own
  // detection of the code in the URL — so a successful auto-exchange is
  // visible here, and no second exchange is attempted.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    window.history.replaceState(null, '', url.pathname);
    return 'ready';
  }

  const code = url.searchParams.get('code');
  if (!code) return 'no-link';

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return 'failed';
  window.history.replaceState(null, '', url.pathname);
  return 'ready';
}

export function ResetConfirmForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<LinkPhase>('checking');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const establishRef = useRef<Promise<LinkPhase> | null>(null);

  useEffect(() => {
    let cancelled = false;
    /* Chained onto the ref rather than onto the effect, so the report fires
       exactly once: establishRef is assigned once, so this .then is built once,
       and React strict-mode's double effect attaches only the setPhase handler
       below a second time. A reset that reaches 'ready' IS a sign-in — the
       session exists whether or not a new password is then chosen — and it is
       the one sign-in flow that never passes through a server route, so
       without this it is the account-takeover path with no record. */
    establishRef.current ??= establishRecoverySession().then((result) => {
      if (result === 'ready') reportSignIn('recovery');
      return result;
    });
    void establishRef.current.then((result) => {
      if (!cancelled) setPhase(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (next.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setError('The new password and its confirmation do not match.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: next });

    if (updateError) {
      setBusy(false);
      setError(
        /different/i.test(updateError.message)
          ? 'Choose a different password.'
          : 'Could not change your password. Try again.',
      );
      return;
    }

    // Stay busy through the redirect; the middleware resolves the shell.
    router.replace('/');
    router.refresh();
  }

  if (phase === 'checking') {
    return (
      <p className="tiny" style={{ marginTop: 28 }}>
        Checking your reset link.
      </p>
    );
  }

  if (phase !== 'ready') {
    return (
      <div className="signin-fields">
        {phase === 'no-link' ? (
          <p className="signin-sub" style={{ margin: 0 }}>
            This page only works from the link in a password-reset email. Request one
            and open it on this device.
          </p>
        ) : (
          <p className="form-error" role="alert" style={{ margin: 0 }}>
            {phase === 'expired'
              ? 'That reset link has expired. Request a fresh one and open it straight away.'
              : 'That reset link did not work. It may have been used already, or opened on a different device from the one that asked for it. Request a fresh link from this device.'}
          </p>
        )}
        <div className="reset-actions">
          <Link className="btn-primary" href="/login/reset">
            Request a reset link
          </Link>
        </div>
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
          <label className="label" htmlFor="new-password">
            New password
          </label>
          <PasswordField
            id="new-password"
            autoComplete="new-password"
            required
            value={next}
            onChange={setNext}
          />
          <p className="cap" style={{ marginTop: 4 }}>
            At least {MIN_LENGTH} characters.
          </p>
        </div>

        <div className="form-row" style={{ margin: 0 }}>
          <label className="label" htmlFor="confirm-password">
            Confirm new password
          </label>
          <PasswordField
            id="confirm-password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={setConfirm}
          />
        </div>
      </div>

      <button className="btn-primary signin-submit" type="submit" disabled={busy}>
        {busy ? 'Saving' : 'Set new password'}
      </button>
    </form>
  );
}
