'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  linkAthleteToUser,
  setUserRoles,
  type UnlinkedAthlete,
  type UserAuditRow,
  type UserDetail,
  roleToggleRefusal,
} from '@/lib/queries/userManagement';
import type { SetUserStatusResult } from '@/app/(staff)/settings/users/[userId]/status/route';
import type { RemoveMfaFactorResult } from '@/app/(staff)/settings/users/[userId]/mfa/route';
import { Pill } from '@/components/Pill/Pill';
import { BlockedButton } from '@/components/BlockedButton/BlockedButton';
import { USER_STATUS } from '@/lib/status';
import { formatDate, formatDateTime } from '@/lib/format';
import { ROLE_CHANGE_EFFECT, ROLE_WORDS, capabilitiesFor, roleChangePreview } from '@/lib/roleGrants';
import type { AppRole } from '@/lib/types/database';

/* The tick boxes this panel offers. Missing both new roles, so neither could
 * be granted or revoked from the user detail screen. */
const ALL_ROLES: AppRole[] = ['athlete', 'coach', 'medic', 'sport_scientist', 'strength_conditioning', 'nutritionist'];

type Props = {
  orgId: string;
  currentUserId: string;
  currentActorRole: AppRole;
  timezone: string;
  user: UserDetail;
  history: UserAuditRow[];
  unlinkedAthletes: UnlinkedAthlete[];
  isSelf: boolean;
  /** How many sport_scientist rows the org holds; the last one cannot be
   *  removed, so the self-row chip is disabled when it is this user's. */
  sportScientistCount: number;
  /** login-security checklist item 3: the real read this used to hardcode as "Not
   *  enrolled" for everyone — see page.tsx's own header. null means genuinely not
   *  enrolled, not "unknown". */
  mfaFactor: { id: string; created_at: string } | null;
};

/* PATTERN-S8 C4 (2026-09-13): "What this user can see" and the change
 * preview are both lib/roleGrants.ts — access.ts's sets with a sentence
 * each — so the list a sport scientist reads is the list the gates use.
 * The old four-role summary ("Users and billing", coach-or-medic as "squad
 * performance data") is gone; it predated the five-role model. */

const AUDIT_ACTION_LABEL: Record<string, string> = {
  'user.created': 'Account created',
  'user_roles.changed': 'Roles changed',
  'user.deactivated': 'Deactivated',
  'user.reactivated': 'Reactivated',
  'user.athlete_linked': 'Linked to an athlete record',
};

/** The detail screen screens/user-management.md's own wireframe draws,
 *  reduced against what this build's auth layer actually has — see this
 *  file's page.tsx for the specific cuts.
 *
 *  PATTERN-S8 C4 (2026-09-13): role chips no longer write on click. A chip
 *  moves a PENDING set; while pending differs from held, a preview card in
 *  the same card as the button says what the change grants and removes
 *  (lib/roleGrants.ts, from access.ts's sets), the rules it trips, and when
 *  it takes effect; Save roles writes, Cancel drops it. The immediate
 *  toggle the list used to share is gone from the list too — it now states
 *  roles as facts and sends changes here. */
export function UserDetailPanel({ orgId, currentUserId, currentActorRole, timezone, user, history, unlinkedAthletes, isSelf, sportScientistCount, mfaFactor }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState<AppRole[]>(user.roleGrants.map((g) => g.role).sort());
  /* C4: the set the chips show; written only by Save roles. */
  const [pending, setPending] = useState<AppRole[]>(user.roleGrants.map((g) => g.role).sort());
  const [status, setStatus] = useState(user.status);
  const [athleteName, setAthleteName] = useState(user.athlete_name);
  const [linkChoice, setLinkChoice] = useState('');
  const [busyRoles, setBusyRoles] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyLink, setBusyLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState(mfaFactor);
  const [busyMfa, setBusyMfa] = useState(false);
  const [confirmingMfaRemove, setConfirmingMfaRemove] = useState(false);

  const invitedRow = [...history].reverse().find((h) => h.action === 'user.created');

  function togglePending(role: AppRole) {
    setPending((p) => (p.includes(role) ? p.filter((r) => r !== role) : [...p, role]).sort());
  }

  const preview = roleChangePreview(roles, pending);

  async function saveRoles() {
    if (!preview) return;
    const db = createClient();
    setBusyRoles(true);
    setError(null);
    const { error: err, primaryOk } = await setUserRoles(db, orgId, currentUserId, currentActorRole, user.id, pending);
    setBusyRoles(false);
    if (err) setError(err);
    if (!primaryOk) return;
    setRoles([...pending]);
    router.refresh();
  }

  /* S8 D5 (batch B1): deactivate is the revoke. The route writes the status
     and bans the sign-in itself, so an outstanding invite or magic link dies
     with the account — a client-side RLS write could change the row and
     never reach the token. */
  async function toggleStatus() {
    const nextStatus = status === 'deactivated' ? 'active' : 'deactivated';
    setBusyStatus(true);
    setError(null);
    const res = await fetch(`/settings/users/${user.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
    const out = (await res.json().catch(() => null)) as SetUserStatusResult | null;
    setBusyStatus(false);
    if (!out) { setError('Not saved: the request did not complete. Try again.'); return; }
    if (out.error) setError(out.error);
    if (!out.primaryOk) return;
    setStatus(nextStatus);
    router.refresh();
  }

  async function link() {
    if (!linkChoice) return;
    const db = createClient();
    setBusyLink(true);
    setError(null);
    const { error: err, primaryOk } = await linkAthleteToUser(db, orgId, currentUserId, currentActorRole, user.id, linkChoice);
    setBusyLink(false);
    if (err) setError(err);
    if (!primaryOk) return;
    const athlete = unlinkedAthletes.find((a) => a.id === linkChoice);
    setAthleteName(athlete ? `${athlete.first_name} ${athlete.last_name}` : null);
    setLinkChoice('');
    router.refresh();
  }

  /** The one account-recovery path Supabase's MFA API leaves for a staff member who has
   *  lost their authenticator — see the Route Handler's own header for why this needs the
   *  service role key and can't be a plain RLS-scoped write like the actions above. */
  async function removeMfaFactor() {
    if (!mfa) return;
    setBusyMfa(true);
    setError(null);
    const res = await fetch(`/settings/users/${user.id}/mfa`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId: mfa.id }),
    });
    const data: RemoveMfaFactorResult = await res.json();
    setBusyMfa(false);
    setConfirmingMfaRemove(false);
    if (!data.ok) {
      setError(data.error ?? 'Could not remove the MFA factor.');
      return;
    }
    setMfa(null);
    router.refresh();
  }

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-10)' }}>
          <div>
            <p className="nm">
              {user.email} {isSelf ? <span className="tiny">(you)</span> : null}
            </p>
            <p className="tiny">
              {user.last_seen_at ? `Last seen ${formatDateTime(user.last_seen_at, timezone)}` : 'Never signed in'}
            </p>
          </div>
          <Pill status={USER_STATUS[status]} />
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="profile-grid">
        <div className="stack">
          <section className="card" aria-labelledby="roles-title" id="roles">
            <h2 className="card-title" id="roles-title">
              Roles
            </h2>
            <div className="chiprow">
              {ALL_ROLES.map((role) => {
                /* §0ae: the database refuses a self-grant of medic and the
                   removal of the last sport scientist. The chip says so on
                   tap (BlockedButton), never a title; the refusal itself is
                   the trigger's. */
                const refusal = roleToggleRefusal(role, roles.includes(role), isSelf, sportScientistCount);
                const blocked = status === 'deactivated' ? 'This account is deactivated. Reactivate it before changing its roles.' : refusal;
                return (
                  <BlockedButton
                    key={role}
                    className="squad-chip"
                    aria-pressed={pending.includes(role)}
                    blocked={blocked !== null || busyRoles}
                    reason={blocked ?? 'Saving…'}
                    onClick={() => togglePending(role)}
                  >
                    {ROLE_WORDS[role]}
                  </BlockedButton>
                );
              })}
            </div>
            {preview ? (
              <div className={`card rc-preview${preview.loses.length > 0 ? ' rc-preview-removes' : ''}`} role="region" aria-live="polite" aria-labelledby="rc-heading">
                <p className="nm" id="rc-heading">
                  {preview.heading}: {preview.sentence}
                </p>
                {preview.gains.length > 0 ? (
                  <>
                    <p className="cap rc-sub">Grants</p>
                    <ul className="rc-list">
                      {preview.gains.map((g) => (
                        <li key={g}>
                          <span className="g g-good" aria-hidden="true">
                            +
                          </span>{' '}
                          {g}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {preview.loses.length > 0 ? (
                  <>
                    <p className="cap rc-sub">Removes</p>
                    <ul className="rc-list">
                      {preview.loses.map((l) => (
                        <li key={l}>
                          <span className="g g-bad" aria-hidden="true">
                            −
                          </span>{' '}
                          {l}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {preview.warnings.map((w) => (
                  <p className="tiny rc-warn" key={w}>
                    {w}
                  </p>
                ))}
                <p className="cap">{ROLE_CHANGE_EFFECT}</p>
                <div className="chiprow rc-actions">
                  <button type="button" className="btn-primary" disabled={busyRoles} onClick={saveRoles}>
                    {busyRoles ? 'Saving…' : 'Save roles'}
                  </button>
                  <button type="button" className="btn-ghost" disabled={busyRoles} onClick={() => setPending([...roles])}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="cap" style={{ marginTop: 'var(--sp-10)' }}>
                Roles add up: this person has the union of every role shown. Tap a role to see what changing it would grant and remove; nothing is saved until you press Save roles.
              </p>
            )}
            <ul className="tiny" style={{ marginTop: 'var(--sp-8)', paddingLeft: 'var(--sp-18)' }}>
              {user.roleGrants.map((g) => (
                <li key={g.role}>
                  {ROLE_WORDS[g.role]} — granted {formatDate(g.granted_at, timezone)}
                  {g.granted_by_name ? `, ${g.granted_by_name}` : ''}
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="see-title">
            <h2 className="card-title" id="see-title">
              What this user can see
            </h2>
            {capabilitiesFor(roles).length === 0 ? (
              <p className="tiny">Nothing in the staff app{roles.includes('athlete') ? ' — the athlete app for their own record only' : ''}.</p>
            ) : (
              <ul className="rc-list">
                {capabilitiesFor(roles).map((c) => (
                  <li key={c.key}>{c.label}</li>
                ))}
              </ul>
            )}
            <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
              Computed from the roles held now, as the union of every one of them — the same sets every screen&apos;s gate reads.
            </p>
          </section>

          <section className="card" aria-labelledby="danger-title">
            <h2 className="card-title" id="danger-title">
              Danger zone
            </h2>
            <button type="button" className="btn-ghost" disabled={busyStatus || isSelf} onClick={toggleStatus}>
              {busyStatus ? 'Working…' : status === 'deactivated' ? 'Reactivate user' : 'Deactivate user'}
            </button>
            <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
              {status === 'deactivated'
                ? 'Lets them sign in again — an invite they never followed works again too, until it expires.'
                : 'Signs them out, blocks sign in and cancels any outstanding invite or magic link at the same moment. Nothing is deleted.'}
              {isSelf ? ' You cannot deactivate your own account.' : ''}
            </p>
          </section>
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="athlete-title">
            <h2 className="card-title" id="athlete-title">
              Athlete record
            </h2>
            {athleteName ? (
              <p className="sub">Linked to {athleteName}</p>
            ) : (
              <>
                <p className="sub">Not linked.</p>
                {roles.includes('athlete') && unlinkedAthletes.length > 0 ? (
                  <div style={{ display: 'flex', gap: 'var(--sp-8)', alignItems: 'center', marginTop: 'var(--sp-8)' }}>
                    <select className="field" style={{ minHeight: 32, padding: 'var(--s-2) var(--s-4)', width: 'auto' }} value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
                      <option value="">Pick one to link</option>
                      {unlinkedAthletes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.squad_number ? `#${a.squad_number} ` : ''}
                          {a.first_name} {a.last_name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-ghost" disabled={!linkChoice || busyLink} onClick={link}>
                      {busyLink ? 'Linking…' : 'Link'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="card" aria-labelledby="account-title">
            <h2 className="card-title" id="account-title">
              Account
            </h2>
            <div className="kv">
              <span className="sub">Created</span>
              <span className="sub">{formatDate(user.created_at, timezone)}</span>
            </div>
            <div className="kv">
              <span className="sub">Invited by</span>
              <span className="sub">{invitedRow?.actor_name ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="sub">Last seen</span>
              <span className="sub">{user.last_seen_at ? formatDate(user.last_seen_at, timezone) : '—'}</span>
            </div>
            <div className="kv">
              <span className="sub">MFA</span>
              <span className={mfa ? 'g-good' : 'sub'}>{mfa ? `Enrolled ${formatDate(mfa.created_at, timezone)}` : 'Not enrolled'}</span>
            </div>
            {mfa ? (
              !confirmingMfaRemove ? (
                <button type="button" className="btn-ghost" style={{ marginTop: 'var(--sp-8)' }} disabled={busyMfa} onClick={() => setConfirmingMfaRemove(true)}>
                  Remove MFA factor
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--sp-8)', marginTop: 'var(--sp-8)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="tiny" style={{ color: 'var(--bad-text)' }}>
                    Remove this user&apos;s MFA factor?
                  </span>
                  <button type="button" className="btn-ghost" style={{ color: 'var(--bad-text)', borderColor: 'var(--bad)' }} disabled={busyMfa} onClick={removeMfaFactor}>
                    {busyMfa ? 'Removing…' : 'Yes, remove it'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setConfirmingMfaRemove(false)}>
                    Never mind
                  </button>
                </div>
              )
            ) : null}
            {mfa ? (
              <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
                There is no recovery-code system — this is the only way back in for someone
                who has lost their authenticator. They will need to re-enrol from Settings
                once they can sign in again.
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <section className="card" aria-labelledby="history-title">
        <h2 className="card-title" id="history-title">
          Role history
        </h2>
        {history.length === 0 ? (
          <p className="cap">No history recorded for this account.</p>
        ) : (
          <table className="tbl">
            <caption className="visually-hidden">Role and status history</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Event</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="num sub">{formatDateTime(h.occurred_at, timezone)}</td>
                  <td className="nm">{AUDIT_ACTION_LABEL[h.action] ?? h.action}</td>
                  <td className="sub">{h.actor_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
