'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PasswordField } from '@/components/PasswordField/PasswordField';
import { reportSignIn } from '@/lib/signInAudit';
import { passwordRules, rulesMet, unmetLine } from '@/lib/passwordRules';
import type { InviteContext } from '@/lib/inviteContext';
import { LegalPlaceholder } from '@/components/LegalPlaceholder/LegalPlaceholder';
import { formatDate } from '@/lib/format';

/** Same rule and copy as ChangePasswordForm — the app's one password standard.
 *  12, matching docs/09-security-and-compliance.md §8 (audit: was 10). */
const MIN_LENGTH = 12;
const PASSWORD_MIN = MIN_LENGTH;

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

/** `invite` is PATTERN-S9 artboard 1 (2026-09-13): the identity block above
 *  the field, the two rules stated before typing, the count with its
 *  denominator, the action blocked rather than dimmed while a rule is unmet,
 *  and nothing sent while one is — so no attempt is recorded against the
 *  athlete. The reset arrival keeps its frozen two-field shape. */
export function ResetConfirmForm({ invite = null, timezone = 'Europe/London' }: { invite?: InviteContext | null; timezone?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<LinkPhase>('checking');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const establishRef = useRef<Promise<LinkPhase> | null>(null);
  const rules = invite ? passwordRules({ password: next, firstName: invite.firstName, lastName: invite.lastName, clubName: invite.clubName }) : null;
  const met = rules ? rulesMet(rules) : 0;
  const blocked = rules ? met < rules.length : false;

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

    if (invite) {
      /* Blocked, not dimmed: the button stays a real control and the rules
         say what they need. Nothing is sent while one is unmet. */
      if (blocked) return;
    } else {
      if (next.length < MIN_LENGTH) {
        setError(`Use at least ${MIN_LENGTH} characters.`);
        return;
      }
      if (next !== confirm) {
        setError('The new password and its confirmation do not match.');
        return;
      }
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
      <p className="tiny" style={{ marginTop: 'var(--sp-28)' }}>
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

  if (invite && rules) {
    const line = unmetLine(rules, next);
    const typed = next.length > 0;
    return (
      <form onSubmit={onSubmit} method="post" noValidate className="signin-form" data-invite>
        {/* The emphasised card: who invited you. Club, squad, the person, the
            date, and the address it went to — masked. */}
        <section className="card" aria-labelledby="who-invited" data-emphasis>
          <h2 className="card-title" id="who-invited">Who invited you</h2>
          <p className="import-sub" style={{ marginBottom: 'var(--sp-4)' }}>
            <b>{invite.clubName}</b>
            {invite.squad ? ` — ${invite.squad}` : ''}
          </p>
          <p className="import-sub" style={{ marginBottom: 'var(--sp-4)' }}>
            {invite.inviterName ? `${invite.inviterName}${invite.inviterRole ? `, ${invite.inviterRole}` : ''}` : 'Somebody at the club'}
            {invite.sentAt ? `, on ${formatDate(invite.sentAt, timezone)}` : ''}
          </p>
          {invite.recipientMasked ? (
            <p className="import-sub num" style={{ marginBottom: 0 }}>
              Sent to {invite.recipientMasked}
            </p>
          ) : null}
          <p className="tiny" style={{ marginTop: 'var(--sp-10)' }}>
            Fydr never asks for a password by email or by message. If you did not expect this, do not set one
            {invite.inviterName ? ` — ask ${invite.inviterName.split(' ')[0]} at the club.` : ' — ask at the club.'}
          </p>
          <LegalPlaceholder id="LEGAL-1A" />
        </section>

        <section className="card" aria-labelledby="rules-title">
          <h2 className="card-title" id="rules-title">Two rules, stated before you type</h2>
          {/* Two, not three: the "not a password you use elsewhere" rule was
              removed entirely on 14 September 2026 (decision batch #7) — a
              rule software cannot check is theatre, and nothing is said
              about reuse. */}
          <ul className="pw-rules" aria-live="polite">
            {rules.map((r) => (
              <li key={r.id} className="pw-rule" data-state={r.state}>
                <span className="pw-rule-mark" aria-hidden="true">
                  {r.state === 'met' ? '✓' : r.state === 'unmet' ? '!' : '–'}
                </span>
                <span>
                  {r.label}
                  {r.detail ? <span className="num">{r.detail}</span> : null}
                  <span className="visually-hidden">{r.state === 'met' ? ', met' : r.state === 'unmet' ? ', not met' : ', not checked yet'}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
            {typed ? 'Checked as you type. A rule not met says what it needs.' : 'A dash means not checked yet, not failed.'}
          </p>
        </section>

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
            <div data-invalid={typed && line ? 'true' : undefined} className="pw-field-wrap">
              <PasswordField id="new-password" autoComplete="new-password" required value={next} onChange={setNext} enterKeyHint="go" />
            </div>
            {typed && line ? (
              <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-6)' }}>
                {line}
              </p>
            ) : (
              <p className="cap" style={{ marginTop: 'var(--sp-4)' }}>
                {PASSWORD_MIN} characters or more.
              </p>
            )}
          </div>
        </div>

        <p className="subm-count num" data-complete={blocked ? undefined : ''} style={{ marginTop: 'var(--sp-14)' }}>
          {met} of {rules.length} rules met
        </p>
        <button
          className={`${blocked ? 'btn-ghost' : 'btn-primary'} btn-commit`}
          type="submit"
          disabled={busy}
          aria-disabled={blocked || undefined}
          onClick={(event) => {
            if (blocked) event.preventDefault();
          }}
        >
          {busy ? 'Saving' : 'Set password'}
        </button>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
          {typed && blocked
            ? 'Nothing is sent while a rule is unmet, so no attempt is recorded against you.'
            : invite.isAthlete
              ? 'Next you will read what staff can see, then make one choice.'
              : 'You will be signed in as soon as it is set.'}
        </p>
      </form>
    );
  }

  // This form only exists after the link check above, so React is already
  // listening by the time it can be submitted. method="post" anyway: it
  // carries a password, and the guard that every such form posts is worth
  // more than the exemption.
  return (
    <form onSubmit={onSubmit} method="post" noValidate className="signin-form">
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
          <p className="cap" style={{ marginTop: 'var(--sp-4)' }}>
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
