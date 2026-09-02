'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/format';
import { currentVerifiedFactor, qrCodeDataUri, type MfaFactorSummary } from '@/lib/mfa';

type Props = {
  timezone: string;
  roleRequiresMfa: boolean;
  initialFactors: MfaFactorSummary[];
};

type Phase = 'status' | 'enrolling';

/** docs/09-security-and-compliance.md §8.1: TOTP enrollment against Supabase Auth's own
 *  MFA API (`supabase.auth.mfa.enroll/challengeAndVerify/unenroll/listFactors` —
 *  @supabase/supabase-js 2.112.2, checked the shipped .d.ts before building this, these are
 *  real methods, not invented). Same shape as ChangePasswordForm just below it on this
 *  page: a 'use client' card owning its own request/response cycle against the browser
 *  Supabase client, no server action.
 *
 *  "Mandatory for coach/medical/admin" (the doc's word) is implemented here as a strong,
 *  undismissable prompt — a banner that says the role requires it and does not go away
 *  until enrolled — not a login-blocking gate. That is a deliberate softening, not an
 *  oversight: CLAUDE.md §2 rule 2 and CONTRACT.md both say a client-side check is for
 *  hiding UI only and is never a real authorisation boundary, so a JS gate that refused to
 *  render the rest of the app for an unenrolled coach would be exactly the kind of "security
 *  theatre" 09-security-and-compliance.md §8.1 warns against for a different reason
 *  ("do not enforce MFA in the UI, because the UI is not the security boundary") — it would
 *  block nothing a motivated user couldn't bypass, while still locking out every legitimate
 *  coach the moment this shipped, with the real RLS-level enforcement (auth_is_aal2(),
 *  migration 0048) deliberately not wired into any policy yet. A prompt that cannot be
 *  dismissed but does not block is the honest middle ground until that RLS work lands.
 *
 *  No recovery codes: see lib/mfa.ts's header for why (Supabase's TOTP MFA API has none).
 *  A staff member who loses their authenticator needs an admin to remove the factor for
 *  them — UserDetailPanel's "Remove MFA factor" action. */
export function MfaEnrollment({ timezone, roleRequiresMfa, initialFactors }: Props) {
  const [factors, setFactors] = useState<MfaFactorSummary[]>(initialFactors);
  const [phase, setPhase] = useState<Phase>('status');
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const verified = currentVerifiedFactor(factors);

  async function refreshFactors() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
  }

  async function startEnroll() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    const supabase = createClient();

    // Clean up any unverified factor left over from an abandoned attempt (a page reload
    // mid-enrollment, most likely) before starting a fresh one — otherwise they pile up
    // silently, one per abandoned attempt. `.totp` on the list response is verified-only
    // (GoTrueMFAApi's own type: `[K in T[number]]: Factor<K, 'verified'>[]`), so this reads
    // `.all` — the one bucket that actually includes unverified factors — filtered to totp.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'Fydr',
    });
    setBusy(false);

    if (enrollError || !data) {
      setError(enrollError?.message ?? 'Could not start enrollment. Try again.');
      return;
    }

    setPendingFactorId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCode('');
    setPhase('enrolling');
  }

  async function cancelEnroll() {
    if (pendingFactorId) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    }
    setPendingFactorId(null);
    setQrSvg(null);
    setSecret(null);
    setCode('');
    setError(null);
    setPhase('status');
  }

  async function confirmEnroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingFactorId) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: code.trim(),
    });
    setBusy(false);

    if (verifyError) {
      setError('That code did not verify. Check the time on your authenticator app and try again.');
      return;
    }

    setPendingFactorId(null);
    setQrSvg(null);
    setSecret(null);
    setCode('');
    setPhase('status');
    setSuccess('Two-factor authentication is on for your account.');
    await refreshFactors();
  }

  async function removeFactor() {
    if (!verified) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    setConfirmingRemove(false);

    if (unenrollError) {
      setError(
        'Could not remove it: ' +
          unenrollError.message +
          '. Removing a verified factor needs a session that has completed a fresh sign-in with your authenticator code — sign out and back in, then try again.',
      );
      return;
    }

    setSuccess('Two-factor authentication is off for your account.');
    await refreshFactors();
  }

  return (
    <section className="card" aria-labelledby="mfa-title">
      <h2 className="card-title" id="mfa-title">
        Two-factor authentication
      </h2>

      {roleRequiresMfa && !verified && phase === 'status' ? (
        <p
          className="banner"
          role="alert"
          style={{ background: 'rgb(var(--warn-rgb) / 0.1)', borderColor: 'rgb(var(--warn-rgb) / 0.45)', color: 'var(--warn-text)' }}
        >
          <span className="g" aria-hidden="true">
            !
          </span>
          <span>
            Your role requires two-factor authentication. Set it up below — this club&apos;s
            policy is that coach, medical and admin accounts carry a second factor.
          </span>
        </p>
      ) : null}

      {success ? (
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>{success}</span>
        </p>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {phase === 'status' ? (
        verified ? (
          <>
            <div className="kv">
              <span className="sub">Status</span>
              <span className="g-good">On</span>
            </div>
            <div className="kv">
              <span className="sub">Added</span>
              <span className="sub">{formatDate(verified.created_at, timezone)}</span>
            </div>
            <p className="cap" style={{ marginTop: 10 }}>
              An authenticator app code is required on every sign-in. There is no recovery
              code — if you lose access to your authenticator, an admin has to remove this
              for you before you can sign in again.
            </p>
            {!confirmingRemove ? (
              <button type="button" className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setConfirmingRemove(true)}>
                Remove two-factor authentication
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="tiny" style={{ color: 'var(--bad-text)' }}>
                  Turn off two-factor authentication for your account?
                </span>
                <button type="button" className="btn-ghost" style={{ color: 'var(--bad-text)', borderColor: 'var(--bad)' }} disabled={busy} onClick={removeFactor}>
                  {busy ? 'Removing…' : 'Yes, remove it'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmingRemove(false)}>
                  Never mind
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="kv">
              <span className="sub">Status</span>
              <span className="sub">Not enrolled</span>
            </div>
            <p className="cap" style={{ marginTop: 4 }}>
              Add an authenticator app (Google Authenticator, 1Password, Authy or similar) as
              a second sign-in step.
            </p>
            <button type="button" className="btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={startEnroll}>
              {busy ? 'Starting…' : 'Set up two-factor authentication'}
            </button>
          </>
        )
      ) : (
        <form onSubmit={confirmEnroll} noValidate>
          <p className="sub" style={{ marginTop: 0 }}>
            Scan this with your authenticator app, then enter the 6-digit code it shows.
          </p>
          {qrSvg ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data: URI SVG, not an app asset; next/image does not accept data: sources.
            <img
              src={qrCodeDataUri(qrSvg)}
              alt="QR code for your authenticator app"
              width={176}
              height={176}
              style={{ display: 'block', margin: '10px 0', borderRadius: 'var(--r-field)', background: 'var(--on-accent)', padding: 8 }}
            />
          ) : null}
          {secret ? (
            <p className="tiny" style={{ marginBottom: 10 }}>
              Can&apos;t scan it? Enter this key by hand:{' '}
              <span className="mono" style={{ userSelect: 'all' }}>
                {secret}
              </span>
            </p>
          ) : null}

          <div className="form-row" style={{ maxWidth: 200 }}>
            <label className="label" htmlFor="mfa-enroll-code">
              6-digit code
            </label>
            <input
              id="mfa-enroll-code"
              className="field mono"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn-primary" type="submit" disabled={busy || code.length < 6}>
              {busy ? 'Verifying…' : 'Confirm and turn on'}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={cancelEnroll}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
