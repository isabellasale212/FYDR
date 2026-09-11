'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// docs/09-security-and-compliance.md §8's own spec: 12 characters, no forced
// composition rules (deliberately — NCSC/NIST guidance is that length beats
// mandatory symbols/numbers, which mostly just push people toward "Password1!"
// patterns). This used to say 10, which undershot the app's own documented
// minimum — audit finding, TikTok security-checklist item 5.
const MIN_LENGTH = 12;

/**
 * screens/settings.md: current, new, confirm. Requires the current password
 * — Supabase's updateUser() does not ask for or check it, so this
 * re-authenticates with signInWithPassword first and only calls updateUser
 * once that succeeds, which is what "requires the current password" means
 * in practice against this backend.
 *
 * Simplified against the full spec: no breached-password-list check (an
 * external API, HaveIBeenPwned or similar, not something to reach for mid
 * page-build), no "this signs out every other session" notice (true of
 * Supabase's default session behaviour, but not verified here, so not
 * claimed), no recent security activity list.
 */
type PasswordField = 'current' | 'next' | 'confirm';

const PASSWORD_ERROR_ID = 'change-password-error';

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  /* THE FIELD TRAVELS WITH THE MESSAGE. This was a bare string, which reads
     fine and tells a screen reader nothing: "The new password and its
     confirmation do not match" was announced once, and all three password
     boxes still looked equally valid to assistive tech. Naming the field is
     what lets the wrong one carry aria-invalid, so somebody who cannot see the
     red text knows which box to return to. `field: null` is the honest value
     for the two failures that belong to the request rather than to a value —
     marking an input invalid because the network died would be a lie. */
  const [error, setError] = useState<{ field: PasswordField | null; message: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (next.length < MIN_LENGTH) {
      setError({ field: 'next', message: `Use at least ${MIN_LENGTH} characters.` });
      return;
    }
    if (next === current) {
      setError({ field: 'next', message: 'Choose a different password.' });
      return;
    }
    if (next !== confirm) {
      setError({ field: 'confirm', message: 'The new password and its confirmation do not match.' });
      return;
    }

    setBusy(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setError({ field: null, message: 'Could not confirm your account. Sign in again and retry.' });
      setBusy(false);
      return;
    }

    // sign-in-audit-exempt: re-authentication of somebody already signed in, to
    // prove they know the current password before it is changed. It creates a
    // session, which is why the sweep finds it, but it is not a sign-in event:
    // recording it would put a second 'auth.signed_in' in the log for a person
    // who never left, and reading that back as two sign-ins would be wrong.
    // The password CHANGE that follows is the auditable act here, and if that
    // wants a row it is a different action with a different name.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (reauthError) {
      setError({ field: 'current', message: 'That is not your current password.' });
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });

    setBusy(false);

    if (updateError) {
      setError({ field: null, message: 'Could not change your password. Try again.' });
      return;
    }

    setSuccess(true);
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  // method="post": server-rendered, and three password fields. A submit before
  // React has hydrated is the browser's own, and a bare form does that as GET
  // with every field in the query string. See lib/signInSubmission.ts.
  return (
    <form onSubmit={onSubmit} method="post" className="card" noValidate>
      <h2 className="card-title">Password and sign-in</h2>

      {success ? (
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>Password changed.</span>
        </p>
      ) : null}

      <div className="form-row">
        <label className="label" htmlFor="current-password">
          Current password
        </label>
        <input
          id="current-password"
          className="field"
          aria-invalid={error?.field === 'current' || undefined}
          aria-describedby={error?.field === 'current' ? PASSWORD_ERROR_ID : undefined}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </div>

      <div className="form-row">
        <label className="label" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          className="field"
          aria-invalid={error?.field === 'next' || undefined}
          aria-describedby={error?.field === 'next' ? PASSWORD_ERROR_ID : undefined}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <p className="cap" style={{ marginTop: 'var(--sp-4)' }}>
          At least {MIN_LENGTH} characters.
        </p>
      </div>

      <div className="form-row">
        <label className="label" htmlFor="confirm-password">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          className="field"
          aria-invalid={error?.field === 'confirm' || undefined}
          aria-describedby={error?.field === 'confirm' ? PASSWORD_ERROR_ID : undefined}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>

      {error ? (
        <p className="form-error" role="alert" id={PASSWORD_ERROR_ID}>
          {error.message}
        </p>
      ) : null}

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
