'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateMyContactDetails } from '@/lib/queries/profile';

type Props = {
  userId: string;
  fullName: string;
  initialPhone: string;
};

/** screens/settings.md's Profile section, the athlete half. Phone only now:
 *  the club asked for preferred name to come out, so this form owns exactly
 *  one field. Legal name, date of birth, position and squad number are shown
 *  read-only elsewhere on this page and are never sent from this form — see
 *  lib/queries/profile.ts's header for exactly why each one is out of scope.
 *
 *  preferred_name itself is untouched in the schema and still displayed
 *  where it is set (migrations 0027-0029 back it with a real database-level
 *  guard). Only the athlete's own ability to edit it is gone — staff still
 *  own it, which is the point of the change.
 *
 *  updateMyContactDetails writes full_name and phone together (one users
 *  row, one update), so this form always resends the athlete's own legal
 *  name unchanged alongside the phone edit rather than risk a blank
 *  full_name — fullName comes from the server component that renders this
 *  form, not from anything this form lets someone type. */
export function AthleteProfileEditForm({ userId, fullName, initialPhone }: Props) {
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
    const trimmedPhone = phone.trim();

    const contactResult = await updateMyContactDetails(db, userId, {
      fullName,
      phone: trimmedPhone || null,
    });

    setBusy(false);

    if (contactResult.error) {
      setError(contactResult.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <h2 className="card-title">Edit profile</h2>
      <p className="import-sub" style={{ marginBottom: 12 }}>
        How the club reaches you. Your name, date of birth, position and squad number are set by staff and aren&apos;t
        editable here.
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
