'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  linkAthleteToUser,
  setUserRoles,
  setUserStatus,
  type UnlinkedAthlete,
  type UserAuditRow,
  type UserDetail,
} from '@/lib/queries/userManagement';
import { Pill } from '@/components/Pill/Pill';
import { USER_STATUS } from '@/lib/status';
import { formatDate, formatDateTime, enumLabel } from '@/lib/format';
import type { AppRole } from '@/lib/types/database';

const ALL_ROLES: AppRole[] = ['coach', 'medical', 'admin', 'athlete'];

type Props = {
  orgId: string;
  currentUserId: string;
  currentActorRole: AppRole;
  timezone: string;
  user: UserDetail;
  history: UserAuditRow[];
  unlinkedAthletes: UnlinkedAthlete[];
  isSelf: boolean;
};

/** screens/user-management.md's own "WHAT THIS USER CAN SEE" panel, from
 *  01-roles-and-permissions.md §2's permission matrix, reduced to the
 *  wireframe's own five rows. Roles are additive, so this is a plain OR
 *  across whatever roles are held, not a lookup keyed to one role — the
 *  same "union of permissions" rule the wireframe states in words
 *  ("This user has the union of Coach and Medical permissions"). */
function permissionSummary(roles: readonly AppRole[]): { label: string; yes: boolean }[] {
  const has = (r: AppRole) => roles.includes(r);
  const anyStaffRole = has('coach') || has('medical') || has('admin');
  return [
    { label: 'Squad performance data', yes: has('coach') || has('medical') },
    { label: 'Clinical detail', yes: has('medical') },
    { label: 'Availability, set', yes: has('medical') },
    { label: 'Users and billing', yes: has('admin') },
    { label: 'Own data only', yes: !anyStaffRole },
  ];
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  'user.created': 'Account created',
  'user_roles.changed': 'Roles changed',
  'user.deactivated': 'Deactivated',
  'user.reactivated': 'Reactivated',
  'user.athlete_linked': 'Linked to an athlete record',
};

/** The detail screen screens/user-management.md's own wireframe draws,
 *  reduced against what this build's auth layer actually has — see this
 *  file's page.tsx for the specific cuts. Role toggles apply immediately
 *  per click, the same as the Users list's own inline row, rather than
 *  the wireframe's batched checkboxes-plus-Save: this build already
 *  shipped and tested the immediate version on the list screen, and a
 *  second, differently-timed edit pattern on the same data one click away
 *  would be a real inconsistency, not a faithful rendering of the
 *  wireframe's intent. */
export function UserDetailPanel({ orgId, currentUserId, currentActorRole, timezone, user, history, unlinkedAthletes, isSelf }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState(user.roleGrants.map((g) => g.role).sort());
  const [status, setStatus] = useState(user.status);
  const [athleteName, setAthleteName] = useState(user.athlete_name);
  const [linkChoice, setLinkChoice] = useState('');
  const [busyRole, setBusyRole] = useState<AppRole | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyLink, setBusyLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitedRow = [...history].reverse().find((h) => h.action === 'user.created');

  async function toggleRole(role: AppRole) {
    const db = createClient();
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    setBusyRole(role);
    setError(null);
    const { error: err, primaryOk } = await setUserRoles(db, orgId, currentUserId, currentActorRole, user.id, next);
    setBusyRole(null);
    if (err) setError(err);
    if (!primaryOk) return;
    setRoles(next.sort());
    router.refresh();
  }

  async function toggleStatus() {
    const db = createClient();
    const nextStatus = status === 'deactivated' ? 'active' : 'deactivated';
    setBusyStatus(true);
    setError(null);
    const { error: err, primaryOk } = await setUserStatus(db, orgId, currentUserId, currentActorRole, user.id, nextStatus);
    setBusyStatus(false);
    if (err) setError(err);
    if (!primaryOk) return;
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

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
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
          <section className="card" aria-labelledby="roles-title">
            <h2 className="card-title" id="roles-title">
              Roles
            </h2>
            <div className="chiprow">
              {ALL_ROLES.map((role) => (
                <button key={role} type="button" className="squad-chip" aria-pressed={roles.includes(role)} disabled={busyRole === role || status === 'deactivated'} onClick={() => toggleRole(role)}>
                  {enumLabel(role)}
                </button>
              ))}
            </div>
            <p className="cap" style={{ marginTop: 10 }}>
              Roles are additive. This user has the union of every ticked role&apos;s permissions.
            </p>
            <ul className="tiny" style={{ marginTop: 8, paddingLeft: 18 }}>
              {user.roleGrants.map((g) => (
                <li key={g.role}>
                  {enumLabel(g.role)} — granted {formatDate(g.granted_at, timezone)}
                  {g.granted_by_name ? `, ${g.granted_by_name}` : ''}
                </li>
              ))}
            </ul>
            <p className="cap" style={{ marginTop: 8 }}>
              Removing a role does not force a log-out on other devices — if access must end
              immediately, deactivate the account instead.
            </p>
          </section>

          <section className="card" aria-labelledby="see-title">
            <h2 className="card-title" id="see-title">
              What this user can see
            </h2>
            {permissionSummary(roles).map((row) => (
              <div className="kv" key={row.label}>
                <span className="sub">{row.label}</span>
                <span className={row.yes ? 'g-good' : 'sub'}>{row.yes ? 'Yes' : 'No'}</span>
              </div>
            ))}
          </section>

          <section className="card" aria-labelledby="danger-title">
            <h2 className="card-title" id="danger-title">
              Danger zone
            </h2>
            <button type="button" className="btn-ghost" disabled={busyStatus || isSelf} onClick={toggleStatus}>
              {busyStatus ? 'Working…' : status === 'deactivated' ? 'Reactivate user' : 'Deactivate user'}
            </button>
            <p className="cap" style={{ marginTop: 8 }}>
              {status === 'deactivated' ? 'Signs them back in.' : 'Signs them out and blocks sign in. Nothing is deleted.'}
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <select className="field" style={{ minHeight: 32, padding: '4px 8px', width: 'auto' }} value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
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
              <span className="sub">Not enrolled</span>
            </div>
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
                  <td className="mono sub">{formatDateTime(h.occurred_at, timezone)}</td>
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
