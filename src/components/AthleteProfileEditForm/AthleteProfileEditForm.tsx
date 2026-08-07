'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateMyContactDetails, updateMyPreferredName } from '@/lib/queries/profile';

type Props = {
  userId: string;
  athleteId: string;
  fullName: string;
  initialPreferredName: string;
  initialPhone: string;
};

/** screens/settings.md's Profile section, the athlete half — "for athletes
 *  the fields they own": preferred_name (the athlete's own record, not
 *  legal name) and phone (users.phone, same column staff edit). Legal
 *  name, date of birth, position and squad number are shown read-only
 *  elsewhere on this page and are never sent from this form — see
 *  lib/queries/profile.ts's header for exactly why each one is out of
 *  scope, and how migrations 0027-0029 back the preferred_name write with
 *  a real database-level guard, not just this form's own restraint.
 *
 *  updateMyContactDetails writes full_name and phone together (one users
 *  row, one update), so this form always resends the athlete's own legal
 *  name unchanged alongside the phone edit rather than risk a blank
 *  full_name — fullName comes from the server component that renders this
 *  form, not from anything this form lets someone type. */
export function AthleteProfileEditForm({ userId, athleteId, fullName, initialPreferredName, initialPhone }: Props) {
  const [preferredName, setPreferredName] = useState(initialPreferredName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);

    const db = createClient();
    const trimmedPreferred = preferredName.trim();
    const trimmedPhone = phone.trim();

    const [nameResult, contactResult] = await Promise.all([
      updateMyPreferredName(db, athleteId, trimmedPreferred || null),
      updateMyContactDetails(db, userId, { fullName, phone: trimmedPhone || null }),
    ]);

    setBusy(false);

    if (nameResult.error || contactResult.error) {
      setError(nameResult.error ?? contactResult.error ?? 'Could not save. Try again.');
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <h2 className="card-title">Edit profile</h2>
      <p className="import-sub" style={{ marginBottom: 12 }}>
        What you&apos;re called and how the club reaches you. Legal name, date of birth, position and squad number are set by
        staff and aren&apos;t editable here.
      </p>

      {success ? (
        <p className="banner" role="status" style={{ marginBottom: 12 }}>
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>Saved.</span>
        </p>
      ) : null}

      <div className="form-row">
        <label className="label" htmlFor="preferred-name">
          Preferred name
        </label>
        <input
          id="preferred-name"
          className="field"
          type="text"
          value={preferredName}
          placeholder="What you'd rather be called"
          onChange={(event) => setPreferredName(event.target.value)}
        />
      </div>

      <div className="form-row">
        <label className="label" htmlFor="athlete-phone">
          Phone
        </label>
        <input id="athlete-phone" className="field" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
