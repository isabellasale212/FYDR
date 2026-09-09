'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateOrgDetails } from '@/lib/queries/orgDetails';
import { enumLabel } from '@/lib/format';
import { OrgLogoField } from '@/components/OrgLogoField/OrgLogoField';
import type { OrgSport } from '@/lib/types/database';

const SPORTS: OrgSport[] = ['rugby_union', 'rugby_league', 'football', 'netball', 'hockey', 'cricket', 'basketball', 'athletics', 'other'];

type Props = {
  orgId: string;
  initialName: string;
  initialSport: OrgSport;
  initialTimezone: string;
  initialCountryCode: string;
  initialLogoUrl: string | null;
};

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** screens/settings.md's organisation-settings section, admin only. See
 *  lib/queries/orgDetails.ts's header for exactly what's editable here and
 *  what isn't (season dates, subscription tier — both real, separate cuts).
 *  Logo followed once migration 0031 gave logo_url a Storage bucket to
 *  point at — see lib/queries/orgLogo.ts and OrgLogoField for what's real
 *  there. Upload/remove act immediately via OrgLogoField, independent of
 *  this form's own Save button, matching the wireframe's own two separate
 *  actions ("[Replace] [Remove]" beside the field, not folded into it).
 *
 *  Timezone is validated with Intl.DateTimeFormat before it's ever sent —
 *  a real IANA-zone check using a built-in browser API, not a dependency,
 *  and not just trusting free text the way the field would otherwise. */
export function ClubDetailsEditForm({ orgId, initialName, initialSport, initialTimezone, initialCountryCode, initialLogoUrl }: Props) {
  const [name, setName] = useState(initialName);
  const [sport, setSport] = useState<OrgSport>(initialSport);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Club name can’t be empty.');
      return;
    }
    if (!isValidTimezone(timezone.trim())) {
      setError('That’s not a recognised timezone — try a value like Europe/London or America/New_York.');
      return;
    }
    const code = countryCode.trim().toUpperCase();
    if (code.length !== 2) {
      setError('Country code should be two letters, like GB.');
      return;
    }

    setBusy(true);
    const db = createClient();
    const { error: err } = await updateOrgDetails(db, orgId, { name: trimmedName, sport, timezone: timezone.trim(), countryCode: code });
    setBusy(false);

    if (err) {
      setError(err);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <h2 className="card-title">Club details</h2>
      <p className="import-sub" style={{ marginBottom: 'var(--sp-12)' }}>
        Name, sport and timezone drive rendering on every screen in the club. Season dates and your subscription tier
        aren&apos;t editable here.
      </p>

      <OrgLogoField orgId={orgId} orgName={initialName} initialLogoUrl={initialLogoUrl} />

      {success ? (
        <p className="banner" role="status" style={{ marginBottom: 'var(--sp-12)' }}>
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>Saved.</span>
        </p>
      ) : null}

      <div className="form-row">
        <label className="label" htmlFor="org-name">
          Club name
        </label>
        <input id="org-name" className="field" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="form-row">
        <label className="label" htmlFor="org-sport">
          Sport
        </label>
        <select id="org-sport" className="field" value={sport} onChange={(e) => setSport(e.target.value as OrgSport)}>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {enumLabel(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label className="label" htmlFor="org-timezone">
          Timezone
        </label>
        <input id="org-timezone" className="field" type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/London" />
        <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
          An IANA timezone name.
        </p>
      </div>

      <div className="form-row">
        <label className="label" htmlFor="org-country">
          Country code
        </label>
        <input
          id="org-country"
          className="field"
          style={{ maxWidth: 100 }}
          type="text"
          maxLength={2}
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
        />
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
