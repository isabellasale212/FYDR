'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { removeMyAvatar, uploadMyAvatar, validateAvatarFile } from '@/lib/queries/avatar';

type Props = {
  orgId: string;
  userId: string;
  fullName: string;
  initialAvatarUrl: string | null;
  initialAvatarColour?: string | null;
};

/* The same ten names groups.colour uses, resolved through the same
 * --group-* token pair, so an avatar colour themes correctly in light and
 * dark and no hex is ever written into a component or the database. A
 * second, parallel palette would drift. */
const AVATAR_COLOURS = [
  'Blue',
  'Green',
  'Purple',
  'Slate',
  'Indigo',
  'Cyan',
  'Olive',
  'Magenta',
  'Steel',
  'Plum',
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** screens/settings.md's Profile section: "display name, phone, avatar".
 *  Shared between the staff and athlete profile edit forms — the upload
 *  and remove logic is identical either way, only orgId/userId/fullName
 *  differ. See lib/queries/avatar.ts's header for the storage decisions
 *  behind it. */
export function AvatarUploadForm({
  orgId,
  userId,
  fullName,
  initialAvatarUrl,
  initialAvatarColour = null,
}: Props) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [colour, setColour] = useState<string | null>(initialAvatarColour);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* The colour only ever backs the initials, so it is offered only when there
   * is no photo — a picker with no visible effect is worse than no picker.
   * Saved immediately on click rather than behind a Save button: it is one
   * field with an instantly visible result, and the surrounding photo
   * controls already work that way. */
  async function pickColour(next: string | null) {
    const previous = colour;
    setColour(next);
    setError(null);
    const { error: writeError } = await createClient()
      .from('users')
      .update({ avatar_colour: next })
      .eq('id', userId);
    if (writeError) {
      setColour(previous);
      setError('Could not save that colour. Try again.');
    }
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    const invalid = validateAvatarFile(file);
    if (invalid) {
      setError(invalid);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setBusy(true);
    const db = createClient();
    const { url, error: err } = await uploadMyAvatar(db, orgId, userId, file);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';

    if (err) {
      setError(err);
      return;
    }
    setAvatarUrl(url);
  }

  async function onRemove() {
    if (!avatarUrl) return;
    setBusy(true);
    setError(null);
    const db = createClient();
    const { error: err } = await removeMyAvatar(db, orgId, userId, avatarUrl);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setAvatarUrl(null);
  }

  return (
    <div className="card">
      <h2 className="card-title">Photo</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-16)' }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a user-uploaded avatar has no build-time dimensions for next/image to optimise, and this is one small image, not a page full of them
          <img
            src={avatarUrl}
            alt=""
            width={64}
            height={64}
            /* Matches the monogram's 4rem: the avatar must not change size
               depending on whether a photo exists. The width/height ATTRIBUTES
               stay 64 — they are the intrinsic size hint that avoids layout
               shift, not the rendered box. */
            style={{ width: '4rem', height: '4rem', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              /* 4rem is 64px at a 16px root. 0i argued this monogram should
                 stay px BECAUSE it clips if the glyph grows inside a hard box —
                 the better answer is to let the box grow too, so the ratio holds
                 at any text size and the initials still respect the reader's
                 preference. */
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: colour ? `var(--group-${colour.toLowerCase()})` : 'var(--surf2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--fs-20)',
              fontWeight: 700,
              /* --on-group: its own token because the --group-* palette
                 inverts between themes, so one ink cannot serve both. It was
                 --on-accent (white), which is derived for the accent's deep
                 blue: on dark's pastel palette that measured 1.89:1 on olive,
                 1.96 on purple and 2.04 on cyan — six of seven colours failing
                 even the 3:1 large-text bar. */
              color: colour ? 'var(--on-group)' : 'var(--muted)',
            }}
          >
            {initials(fullName)}
          </div>
        )}
        <div>
          <div className="chiprow">
            <label className="btn-ghost" style={{ cursor: 'pointer' }}>
              {busy ? 'Working…' : avatarUrl ? 'Replace photo' : 'Upload photo'}
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} disabled={busy} style={{ display: 'none' }} />
            </label>
            {avatarUrl ? (
              <button type="button" className="btn-ghost" onClick={onRemove} disabled={busy}>
                Remove
              </button>
            ) : null}
          </div>
          <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
            JPEG, PNG or WebP, up to 2MB.
          </p>

          {!avatarUrl ? (
            <div style={{ marginTop: 'var(--sp-10)' }}>
              <p className="label" id="avatar-colour-label">
                Or pick a colour for your initials
              </p>
              <div className="chiprow" role="group" aria-labelledby="avatar-colour-label">
                <button
                  type="button"
                  className="squad-chip"
                  aria-pressed={colour === null}
                  onClick={() => pickColour(null)}
                >
                  Default
                </button>
                {AVATAR_COLOURS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="squad-chip"
                    aria-pressed={colour === name}
                    onClick={() => pickColour(name)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-6)' }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: `var(--group-${name.toLowerCase()})`,
                        display: 'inline-block',
                      }}
                    />
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-10)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
