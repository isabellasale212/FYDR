'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { POSITIONS } from '@/lib/positions';
import type { SquadNumberHolder } from '@/lib/queries/squad';

type Props = {
  /** Live squad numbers and who holds them, read on the server. Present so a
   *  clash can name its holder as the number is typed — the spec's "refused with
   *  a sentence naming the athlete who already holds it". The unique index added
   *  in 0077 is what enforces it; this only means the person finds out before
   *  pressing Save rather than after. */
  takenNumbers: readonly SquadNumberHolder[];
};

export function AddAthleteForm({ takenNumbers }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [position, setPosition] = useState('');
  const [squadNumber, setSquadNumber] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  /* The transfer case gets its own state rather than being folded into `error`,
     because it is not one. Nothing went wrong, nothing can be retried, and the
     thing the club asked for exists. */
  const [squadRecordOnly, setSquadRecordOnly] = useState<string | null>(null);

  const byNumber = useMemo(
    () => new Map(takenNumbers.map((t) => [t.squad_number, t.name])),
    [takenNumbers],
  );
  const clash = squadNumber ? (byNumber.get(Number(squadNumber)) ?? null) : null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/squad/new/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth,
          position: position || null,
          squadNumber: squadNumber === '' ? null : Number(squadNumber),
          email: email || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'That did not save.');
        setSaving(false);
        return;
      }
      if (json.outcome === 'squad_record_only') {
        setSquadRecordOnly(json.existingAccountEmail ?? email);
        setSaving(false);
        return;
      }
      /* A partial success: the athlete exists, something after it did not. The
         invite link is shown when there is one, because this project has no mail
         provider and the link would otherwise be unreachable. */
      if (json.error) {
        setError(json.error);
        setInvite(json.inviteUrl ?? null);
        setSaving(false);
        return;
      }
      if (json.inviteUrl) {
        setInvite(json.inviteUrl);
        setSaving(false);
        return;
      }
      router.push(`/squad/${json.athleteId}`);
    } catch {
      setError('That did not save. Check your connection and try again.');
      setSaving(false);
    }
  }

  if (squadRecordOnly) {
    /* Explains what happened, why, and what to do about it -- in that order,
       and without calling any of it an error. The reason matters as much as the
       outcome here: told only "no account was created", a person reasonably
       assumes something broke and tries again, which produces a second athlete
       record rather than an account. */
    return (
      <div className="card">
        <p className="card-title">
          {firstName} {lastName} is on your squad.
        </p>
        <p className="tiny" style={{ marginTop: 8 }}>
          They have <b>no app access at this club</b>, and that is not a failure &mdash; it is what happens when an
          athlete is already on Fydr somewhere else. {squadRecordOnly} already belongs to a Fydr account, most
          likely at a previous club.
        </p>
        <p className="tiny" style={{ marginTop: 8 }}>
          A Fydr account belongs to one squad record, so their old club&rsquo;s account cannot also be yours. The
          record you have just created is your club&rsquo;s own, and it starts empty: nothing from their previous
          club comes across, and nothing you record here goes back.
        </p>
        <p className="tiny" style={{ marginTop: 8 }}>
          Everything staff do works already &mdash; availability, injuries, weigh-ins, attendance, testing, reports.
          The only thing missing is {firstName} signing in to submit their own wellness check-ins. If you need that,
          invite them from their profile using a <b>different email address</b>.
        </p>
        <div className="flag-actions" style={{ marginTop: 14 }}>
          <button type="button" className="btn-primary" onClick={() => router.push(`/squad`)}>
            Back to the squad
          </button>
        </div>
      </div>
    );
  }

  if (invite || (error && !saving && invite !== null)) {
    return (
      <div className="card">
        <p className="card-title">
          {firstName} {lastName} is on the squad.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="tiny" style={{ marginTop: 8 }}>
          Send them this link so they can set their own password. It works once, and it expires.
        </p>
        <p className="tiny" style={{ wordBreak: 'break-all', marginTop: 6 }}>
          {invite}
        </p>
        <div className="flag-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn-primary" onClick={() => router.push('/squad')}>
            Back to the squad
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={save}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="label" htmlFor="first-name">
        First name
      </label>
      <input
        id="first-name"
        className="field"
        value={firstName}
        required
        onChange={(e) => setFirstName(e.target.value)}
      />

      <label className="label" htmlFor="last-name" style={{ marginTop: 12 }}>
        Last name
      </label>
      <input
        id="last-name"
        className="field"
        value={lastName}
        required
        onChange={(e) => setLastName(e.target.value)}
      />

      <label className="label" htmlFor="dob" style={{ marginTop: 12 }}>
        Date of birth
      </label>
      <input
        id="dob"
        className="field"
        type="date"
        value={dateOfBirth}
        required
        onChange={(e) => setDateOfBirth(e.target.value)}
      />

      <label className="label" htmlFor="position" style={{ marginTop: 12 }}>
        Position
      </label>
      <select id="position" className="field" value={position} onChange={(e) => setPosition(e.target.value)}>
        <option value="">Not set</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <label className="label" htmlFor="squad-number" style={{ marginTop: 12 }}>
        Squad number
      </label>
      <input
        id="squad-number"
        className="field num"
        type="number"
        min={0}
        max={999}
        value={squadNumber}
        onChange={(e) => setSquadNumber(e.target.value)}
        aria-describedby={clash ? 'squad-number-clash' : undefined}
      />
      {clash ? (
        <p id="squad-number-clash" className="form-error" style={{ marginTop: 6 }}>
          {clash} already has {squadNumber}. Choose another, or free it up on their profile first.
        </p>
      ) : null}

      <label className="label" htmlFor="email" style={{ marginTop: 12 }}>
        Email (optional)
      </label>
      <input id="email" className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <p className="tiny" style={{ marginTop: 6 }}>
        Leave blank to add them to the roster with no app access. You can invite them later from their profile.
      </p>

      <div className="flag-actions" style={{ marginTop: 16 }}>
        <button type="submit" className="btn-primary" disabled={saving || clash !== null}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.push('/squad')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
