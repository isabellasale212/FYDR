'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { removeOrgLogo, uploadOrgLogo, validateLogoFile } from '@/lib/queries/orgLogo';

type Props = {
  orgId: string;
  orgName: string;
  initialLogoUrl: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** screens/settings.md's Club details wireframe: a Logo row with
 *  Replace/Remove, inside the same card as name/sport/timezone, not a
 *  separate card the way an athlete's Photo is on the Profile screen — that
 *  difference is deliberate, matching the wireframe's own layout rather
 *  than copying AvatarUploadForm's shape wholesale. Upload/remove act
 *  immediately, independent of Club details' own Save button, same as
 *  Replace/Remove do for an avatar. See lib/queries/orgLogo.ts for the
 *  storage decisions behind it. */
export function OrgLogoField({ orgId, orgName, initialLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    const invalid = validateLogoFile(file);
    if (invalid) {
      setError(invalid);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setBusy(true);
    const db = createClient();
    const { url, error: err } = await uploadOrgLogo(db, orgId, file);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';

    if (err) {
      setError(err);
      return;
    }
    setLogoUrl(url);
  }

  async function onRemove() {
    if (!logoUrl) return;
    setBusy(true);
    setError(null);
    const db = createClient();
    const { error: err } = await removeOrgLogo(db, orgId, logoUrl);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setLogoUrl(null);
  }

  return (
    <div className="form-row">
      <span className="label">Logo</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-16)' }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a club-uploaded logo has no build-time dimensions for next/image to optimise, and this is one small image, not a page full of them
          <img
            src={logoUrl}
            alt=""
            width={48}
            height={48}
            /* 3rem to match the initials box beside it. */
            style={{ width: '3rem', height: '3rem', borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)', background: 'var(--surf2)' }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              /* 3rem is 48px at a 16px root; see AvatarUploadForm for the
                 argument. Its initials read var(--fs-16). */
              width: '3rem',
              height: '3rem',
              borderRadius: 8,
              background: 'var(--surf2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--fs-16)',
              fontWeight: 700,
              color: 'var(--muted)',
            }}
          >
            {initials(orgName)}
          </div>
        )}
        <div className="chiprow">
          <label className="btn-ghost" style={{ cursor: 'pointer' }}>
            {busy ? 'Working…' : logoUrl ? 'Replace' : 'Upload'}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} disabled={busy} style={{ display: 'none' }} />
          </label>
          {logoUrl ? (
            <button type="button" className="btn-ghost" onClick={onRemove} disabled={busy}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-8)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
