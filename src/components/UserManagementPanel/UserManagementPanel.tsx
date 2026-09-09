'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { linkAthleteToUser, setUserRoles, setUserStatus, type UnlinkedAthlete, type UserWithRoles } from '@/lib/queries/userManagement';
import { Pill } from '@/components/Pill/Pill';
import { enumLabel, formatDate } from '@/lib/format';
import { USER_STATUS } from '@/lib/status';
import type { AppRole } from '@/lib/types/database';
import type { CreateUserResult } from '@/app/(staff)/settings/users/create/route';

/* The tick boxes the user list offers when creating an account. Same list as
 * UserDetailPanel's and same gap: neither new role could be offered. */
const ALL_ROLES: AppRole[] = ['athlete', 'coach', 'medic', 'sport_scientist', 'strength_conditioning', 'nutritionist'];

type Props = {
  orgId: string;
  currentUserId: string;
  currentActorRole: AppRole;
  timezone: string;
  initialUsers: UserWithRoles[];
  initialUnlinked: UnlinkedAthlete[];
};

export function UserManagementPanel({ orgId, currentUserId, currentActorRole, timezone, initialUsers, initialUnlinked }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [unlinked, setUnlinked] = useState(initialUnlinked);
  const [showCreate, setShowCreate] = useState(false);
  const [prefillAthlete, setPrefillAthlete] = useState<UnlinkedAthlete | null>(null);
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(search.trim().toLowerCase()));

  function refresh() {
    router.refresh();
  }

  return (
    <div className="stack">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-12)', flexWrap: 'wrap' }}>
        <div>
          <p className="nm">{users.length} users</p>
          <p className="tiny">
            {users.reduce((n, u) => n + (u.roles.some((r) => r !== 'athlete') ? 1 : 0), 0)} staff ·{' '}
            {users.reduce((n, u) => n + (u.roles.includes('athlete') ? 1 : 0), 0)} athlete accounts
            {unlinked.length > 0 ? ` · ${unlinked.length} athlete record${unlinked.length === 1 ? '' : 's'} with no account` : ''}
          </p>
        </div>
        <div className="chiprow">
          <Link href="/settings/users/bulk-invite" className="btn-ghost">
            Bulk invite athletes →
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (showCreate) setPrefillAthlete(null);
              setShowCreate((v) => !v);
            }}
          >
            {showCreate ? 'Cancel' : '+ Invite people'}
          </button>
        </div>
      </div>

      {showCreate ? (
        <CreateUserForm
          unlinked={unlinked}
          prefillAthlete={prefillAthlete}
          onLinked={(athleteId) => {
            if (athleteId) setUnlinked((rows) => rows.filter((a) => a.id !== athleteId));
          }}
          onDone={() => {
            setShowCreate(false);
            setPrefillAthlete(null);
            refresh();
          }}
        />
      ) : null}

      <div className="form-row" style={{ maxWidth: 360 }}>
        <input className="field" type="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <section className="card flush">
        {filtered.length === 0 ? (
          <p className="tiny" style={{ padding: 'var(--sp-16)' }}>
            No matching user.
          </p>
        ) : (
          filtered.map((u, index) => (
            <UserRow
              key={u.id}
              orgId={orgId}
              user={u}
              isSelf={u.id === currentUserId}
              currentUserId={currentUserId}
              currentActorRole={currentActorRole}
              timezone={timezone}
              divider={index > 0}
              unlinkedAthletes={unlinked}
              onChanged={(next) => setUsers((rows) => rows.map((r) => (r.id === next.id ? next : r)))}
              onLinked={(athleteId) => setUnlinked((rows) => rows.filter((a) => a.id !== athleteId))}
            />
          ))
        )}
      </section>

      {unlinked.length > 0 ? (
        <section className="card flush">
          {/* NO SUBTEXT. It read "On the squad, but nobody has invited them yet",
              which is the heading again: "nobody has invited them yet" IS "no
              account", and "on the squad" is what this whole panel is. Cut by
              Isabella 2026-09-09 from the subheader audit. The 8px bottom padding
              moved onto the heading — the paragraph was carrying it, so deleting
              it outright would have butted the list against the title. */}
          <h2 className="card-title" style={{ padding: '16px 16px 8px' }}>
            Athlete records with no account
          </h2>
          {unlinked.map((a, index) => (
            <div key={a.id}>
              {index > 0 ? <div className="hair" /> : null}
              <div className="load-row" style={{ gridTemplateColumns: '1fr auto', padding: '10px 16px' }}>
                <span className="nm">
                  {a.squad_number ? `#${a.squad_number} ` : ''}
                  {a.first_name} {a.last_name}
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setPrefillAthlete(a);
                    setShowCreate(true);
                  }}
                >
                  Invite →
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function CreateUserForm({
  unlinked,
  prefillAthlete,
  onLinked,
  onDone,
}: {
  unlinked: UnlinkedAthlete[];
  prefillAthlete: UnlinkedAthlete | null;
  onLinked: (linkedAthleteId: string | null) => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState(prefillAthlete ? `${prefillAthlete.first_name} ${prefillAthlete.last_name}` : '');
  const [roles, setRoles] = useState<Set<AppRole>>(new Set(prefillAthlete ? (['athlete'] as AppRole[]) : []));
  const [athleteId, setAthleteId] = useState(prefillAthlete?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateUserResult | null>(null);

  function toggleRole(role: AppRole) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (roles.size === 0) {
      setError('Tick at least one role.');
      return;
    }

    setBusy(true);
    const res = await fetch('/settings/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, roles: [...roles], athleteId: roles.has('athlete') && athleteId ? athleteId : null }),
    });
    const data: CreateUserResult = await res.json();
    setBusy(false);

    if (!data.ok) {
      setError(data.error ?? 'Could not create the account.');
      if (data.userId) setResult(data); // partial success — still show the password, there's a real account behind it
      return;
    }
    setResult(data);
    // The athlete link (if any) already landed server-side; reflect it in
    // the unlinked list now, but don't close the form — the password below
    // is shown exactly once, and closing this form is what makes it
    // unrecoverable, so that has to be a decision the admin makes, not a
    // side effect of the account existing.
    onLinked(roles.has('athlete') && athleteId ? athleteId : null);
  }

  if (result?.ok) {
    return (
      <div className="card" style={{ borderColor: 'var(--good)' }}>
        <h2 className="card-title">Account created</h2>
        {result.emailDelivered ? (
          <p className="import-sub" style={{ marginBottom: 'var(--sp-10)' }}>
            An invite email has been sent to {fullName}. Keep the link below too, in case it doesn&apos;t arrive.
          </p>
        ) : (
          <p className="import-sub" style={{ marginBottom: 'var(--sp-10)' }}>
            Send this link to {fullName} yourself &mdash; no email provider is configured in this environment, so no invite
            email went out. It signs them in once and lets them choose their own password.
          </p>
        )}
        <p className="nm" style={{ fontSize: 'var(--fs-13)', padding: '10px 14px', background: 'var(--surf2)', borderRadius: 8, wordBreak: 'break-all' }}>
          {result.inviteUrl}
        </p>
        <p className="cap" style={{ marginBottom: 'var(--sp-12)' }}>
          The link works once and confirms their email address at the same time. No password has been set for them, and
          nobody here can see the one they choose.
        </p>
        <button type="button" className="btn-primary" onClick={onDone}>
          Done, I&apos;ve copied it
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <h2 className="card-title">Invite people</h2>
      <p className="import-sub" style={{ marginBottom: 'var(--sp-12)' }}>
        Creates a real account and tries to send an invite email; no SMS. Without an email provider configured, you&apos;ll
        get an invite link to pass on yourself instead.
      </p>

      {result && !result.ok ? (
        <div className="banner" role="alert" style={{ marginBottom: 'var(--sp-12)', borderColor: 'var(--warn)' }}>
          <span className="g g-warn" aria-hidden="true">
            !
          </span>
          <span>
            {error}{' '}
            {result.inviteUrl ? (
              <>
                The account exists; their invite link is <b className="nm" style={{ wordBreak: 'break-all' }}>{result.inviteUrl}</b>
              </>
            ) : null}
          </span>
        </div>
      ) : error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="form-row">
        <label className="label" htmlFor="invite-name">
          Full name
        </label>
        <input id="invite-name" className="field" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>

      <div className="form-row">
        <label className="label" htmlFor="invite-email">
          Email
        </label>
        <input id="invite-email" className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div className="form-row">
        <span className="label">Roles</span>
        <p className="tiny" style={{ marginBottom: 'var(--sp-8)' }}>
          Roles are additive &mdash; tick everything that applies.
        </p>
        <div className="chiprow">
          {ALL_ROLES.map((role) => (
            <button key={role} type="button" className="squad-chip" aria-pressed={roles.has(role)} onClick={() => toggleRole(role)}>
              {enumLabel(role)}
            </button>
          ))}
        </div>
      </div>

      {roles.has('athlete') && unlinked.length > 0 ? (
        <div className="form-row">
          <label className="label" htmlFor="invite-athlete">
            Link to an existing squad record
          </label>
          <select id="invite-athlete" className="field" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">No athlete record for now</option>
            {unlinked.map((a) => (
              <option key={a.id} value={a.id}>
                {a.squad_number ? `#${a.squad_number} ` : ''}
                {a.first_name} {a.last_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

function UserRow({
  orgId,
  user,
  isSelf,
  currentUserId,
  currentActorRole,
  timezone,
  divider,
  unlinkedAthletes,
  onChanged,
  onLinked,
}: {
  orgId: string;
  user: UserWithRoles;
  isSelf: boolean;
  currentUserId: string;
  currentActorRole: AppRole;
  timezone: string;
  divider: boolean;
  unlinkedAthletes: UnlinkedAthlete[];
  onChanged: (next: UserWithRoles) => void;
  onLinked: (athleteId: string) => void;
}) {
  const [busyRole, setBusyRole] = useState<AppRole | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
  const [linkChoice, setLinkChoice] = useState('');
  const [busyLink, setBusyLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    onLinked(linkChoice);
    onChanged({ ...user, athlete_id: linkChoice, athlete_name: athlete ? `${athlete.first_name} ${athlete.last_name}` : null });
    setLinkChoice('');
  }

  async function toggleRole(role: AppRole) {
    const db = createClient();
    const next = user.roles.includes(role) ? user.roles.filter((r) => r !== role) : [...user.roles, role];
    setBusyRole(role);
    setError(null);
    const { error: err, primaryOk } = await setUserRoles(db, orgId, currentUserId, currentActorRole, user.id, next);
    setBusyRole(null);
    if (err) setError(err);
    if (!primaryOk) return;
    onChanged({ ...user, roles: next.sort() });
  }

  async function toggleStatus() {
    const db = createClient();
    const nextStatus = user.status === 'deactivated' ? 'active' : 'deactivated';
    setBusyStatus(true);
    setError(null);
    const { error: err, primaryOk } = await setUserStatus(db, orgId, currentUserId, currentActorRole, user.id, nextStatus);
    setBusyStatus(false);
    if (err) setError(err);
    if (!primaryOk) return;
    onChanged({ ...user, status: nextStatus });
  }

  return (
    <div>
      {divider ? <div className="hair" /> : null}
      <div style={{ padding: '12px 16px' }}>
        <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
          <div>
            <p className="nm">
              <Link href={`/settings/users/${user.id}`}>{user.full_name}</Link> {isSelf ? <span className="tiny">(you)</span> : null}
            </p>
            <p className="tiny">
              {user.email}
              {user.athlete_name ? ` · linked to ${user.athlete_name}` : ''}
              {user.last_seen_at ? ` · last seen ${formatDate(user.last_seen_at, timezone)}` : ''}
            </p>
          </div>
          <div className="chiprow">
            {ALL_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                className="squad-chip"
                aria-pressed={user.roles.includes(role)}
                disabled={busyRole === role || user.status === 'deactivated'}
                onClick={() => toggleRole(role)}
              >
                {enumLabel(role)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>
            <Pill status={USER_STATUS[user.status]} />
            <button type="button" className="btn-ghost" disabled={busyStatus || isSelf} onClick={toggleStatus}>
              {busyStatus ? 'Working…' : user.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
            </button>
          </div>
        </div>
        {user.roles.includes('athlete') && !user.athlete_id && unlinkedAthletes.length > 0 ? (
          <div style={{ display: 'flex', gap: 'var(--sp-8)', alignItems: 'center', marginTop: 'var(--sp-8)' }}>
            <span className="tiny">No linked athlete record —</span>
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
        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-6)' }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
