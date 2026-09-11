'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Ask Supabase to email a password-reset link (audit S9: no recovery path
 * anywhere). The redirect target is this origin's /login/reset/confirm,
 * which the email link lands on with a one-time code.
 *
 * Non-enumeration, same standard as LoginForm's sign-in error: the
 * confirmation copy is identical whether or not the email has an account,
 * and error branches exist only for conditions that say nothing about
 * account existence (rate limit, transport failure). Whether the email
 * actually arrives depends on the Supabase project's SMTP configuration
 * and redirect allow-list, which this client cannot see — the error path
 * here is visible precisely because that config may be incomplete.
 *
 * The "open it on this device" line is real, not decoration: the reset
 * link carries a PKCE code whose verifier is stored by the browser that
 * made this request, so the link only completes in that same browser.
 */
export function ResetRequestForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login/reset/confirm`,
    });

    setBusy(false);

    if (resetError) {
      const status = resetError.status ?? 0;
      if (status === 429 || /rate limit|too many|seconds/i.test(resetError.message)) {
        setError('Too many requests just now. Wait a minute, then try again.');
        return;
      }
      if (status >= 500 || /fetch|network/i.test(resetError.message)) {
        setError('Could not reach the server. Check your connection and try again.');
        return;
      }
      // Any other failure says nothing the confirmation should not say:
      // fall through to the same neutral copy an existing account gets.
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="signin-fields">
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            If that email has an account, a reset link is on its way. Open it on this
            device — the link only works in the browser that asked for it.
          </span>
        </p>
        <p className="cap" style={{ margin: 0 }}>
          Nothing after a few minutes? Check your spam folder, or{' '}
          <button
            type="button"
            className="linklike"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  // method="post": this form is server-rendered, so a submit before React has
  // hydrated is the browser's own, and a bare form does that as GET with the
  // email in the query string. POST keeps it in the body; the page simply
  // re-renders. Same reasoning as LoginForm, see lib/signInSubmission.ts.
  return (
    <form onSubmit={onSubmit} method="post" noValidate className="signin-form">
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
      </div>

      <button className="btn-primary signin-submit" type="submit" disabled={busy}>
        {busy ? 'Sending' : 'Email me a reset link'}
      </button>
    </form>
  );
}
