'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateMyContactDetails } from '@/lib/queries/profile';

type Props = {
  userId: string;
  initialFullName: string;
  initialPhone: string;
};

/** screens/settings.md's Profile section, the staff half — display name
 *  and phone. Club, role and timezone stay read-only on the same page, per
 *  the same paragraph: roles are admin-granted, not self-service, and club
 *  membership isn't a profile field at all. See
 *  lib/queries/profile.ts's header for the rest of what's cut and why. */
export function StaffProfileEditForm({ userId, initialFullName, initialPhone }: Props) {
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError('Name can’t be empty.');
      return;
    }

    setBusy(true);
    const db = createClient();
    const { error: err } = await updateMyContactDetails(db, userId, { fullName: trimmedName, phone: phone.trim() || null });
    setBusy(false);

    if (err) {
      setError(err);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <h2 className="card-title">Edit profile</h2>
      <p className="import-sub" style={{ marginBottom: 'var(--sp-12)' }}>
        Club, role and timezone are set by the club and aren&apos;t editable here.
      </p>

      {success ? (
        <p className="banner" role="status" style={{ marginBottom: 'var(--sp-12)' }}>
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>Saved.</span>
        </p>
      ) : null}

      <div className="form-row">
        <label className="label" htmlFor="staff-full-name">
          Name
        </label>
        <input id="staff-full-name" className="field" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} />
      </div>

      <div className="form-row">
        <label className="label" htmlFor="staff-phone">
          Phone
        </label>
        <input id="staff-phone" className="field" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
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
