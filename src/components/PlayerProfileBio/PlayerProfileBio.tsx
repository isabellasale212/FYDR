'use client';

import { BlockedButton } from '@/components/BlockedButton/BlockedButton';
import { useState, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateAthleteBio } from '@/lib/queries/squad';
import type { DominantSide } from '@/lib/types/database';

// This page's own missing-value glyph (see AthletePage's own EM_DASH/emDash
// for the "why an em dash, not the app-wide BLANK" rule) — duplicated here,
// not imported, because it lives in page.tsx and a page file can't be
// imported into a component. Same two lines, same rule.
const EM_DASH = '—';
function emDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  return String(value);
}
const HAND_LABEL: Record<string, string> = { left: 'L', right: 'R', both: 'A' };
const HAND_OPTIONS: { value: DominantSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Ambidextrous' },
];

type Props = {
  orgId: string;
  athleteId: string;
  /** Coach-only in practice — see this file's own header. */
  canEdit: boolean;
  backLink: ReactNode;
  avatar: ReactNode;
  nameBlock: ReactNode;
  domainChips: ReactNode;
  wellnessMini: ReactNode;
  availabilityLine: ReactNode | null;
  /** Never editable here — computed from date_of_birth, not a stored field. */
  ageDisplay: string;
  /** Never editable here — BodyWeightPanel, right below on this same page,
   *  is the real logged-history flow for this number; this form is not a
   *  second way to set it. */
  /** Null when the reader may not see body mass (BODY_MASS_VIEW — the coach,
   *  STAFF-SS-02-05 C9): the Weight cell is absent, not blank. */
  weightDisplay: string | null;
  initialPosition: string | null;
  initialSquadNumber: number | null;
  initialHeightCm: number | null;
  initialDominantSide: DominantSide | null;
};

/** The profile header row plus the six-cell bio strip beneath it (Position /
 *  Jersey / Height / Age / Hand / Weight) — one component because the Edit
 *  trigger lives in the header row while the fields it edits sit in the
 *  strip below, and toggling one has to affect the other; a page.tsx server
 *  component can't hold the shared state itself.
 *
 *  "Edit" used to be permanently disabled — "Staff-side profile editing
 *  isn't available yet." It already can be: athletes_manage_update
 *  0012 granted exactly coach and admin an update on this row ("coach manages
 *  the squad... medical reads for context and does not edit the roster"). That
 *  is no longer the rule: the specification's 2026-09-04 edit 1 resolves D-26 by
 *  giving the medic the same edit as the coach, and 0071 grants it. canEdit now
 *  resolves from ATHLETE_BIO_EDIT, which is the sport scientist, the coach and
 *  the medic. Still enforced twice: the UI
 *  disables the control for anyone else (CLAUDE.md rule 2 — a display
 *  choice, not the boundary) and RLS rejects the write regardless of what a
 *  client sends. No new migration — this wires up a write path the schema
 *  already allowed and the profile page never offered.
 *
 *  Expands the strip in place rather than navigating to a separate settings
 *  screen: every field it touches is already sitting right here, and a
 *  coach changing four cells is faster staying on this page than leaving
 *  it — the same "fastest for the coach" test the dashboard tiles apply. */
export function PlayerProfileBio({
  orgId,
  athleteId,
  canEdit,
  backLink,
  avatar,
  nameBlock,
  domainChips,
  wellnessMini,
  availabilityLine,
  ageDisplay,
  weightDisplay,
  initialPosition,
  initialSquadNumber,
  initialHeightCm,
  initialDominantSide,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [position, setPosition] = useState(initialPosition ?? '');
  const [squadNumber, setSquadNumber] = useState(initialSquadNumber !== null ? String(initialSquadNumber) : '');
  const [heightCm, setHeightCm] = useState(initialHeightCm !== null ? String(initialHeightCm) : '');
  const [dominantSide, setDominantSide] = useState<DominantSide | ''>(initialDominantSide ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setEditing(false);
    setError(null);
    setPosition(initialPosition ?? '');
    setSquadNumber(initialSquadNumber !== null ? String(initialSquadNumber) : '');
    setHeightCm(initialHeightCm !== null ? String(initialHeightCm) : '');
    setDominantSide(initialDominantSide ?? '');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedSquadNumber = squadNumber.trim();
    const trimmedHeight = heightCm.trim();
    const parsedSquadNumber = trimmedSquadNumber === '' ? null : Number(trimmedSquadNumber);
    const parsedHeight = trimmedHeight === '' ? null : Number(trimmedHeight);

    if (parsedSquadNumber !== null && (!Number.isInteger(parsedSquadNumber) || parsedSquadNumber < 0)) {
      setError('Squad number must be a whole, positive number.');
      return;
    }
    if (parsedHeight !== null && (Number.isNaN(parsedHeight) || parsedHeight <= 0)) {
      setError('Height must be a number, in centimetres.');
      return;
    }

    setBusy(true);
    const { error: updateError } = await updateAthleteBio(createClient(), orgId, athleteId, {
      position: position.trim() || null,
      squadNumber: parsedSquadNumber,
      heightCm: parsedHeight,
      dominantSide: dominantSide || null,
    });
    setBusy(false);

    if (updateError) {
      setError(updateError);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <>
      <div className="pp-header-top">
        {backLink}
        {avatar}
        {nameBlock}
        {domainChips}
        {canEdit ? (
          <button
            type="button"
            className="btn-ghost-pill"
            aria-expanded={editing}
            onClick={() => (editing ? cancel() : setEditing(true))}
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        ) : (
          <BlockedButton
            className="btn-ghost-pill"
            blocked
            reason="Medical reads the roster and does not edit it — only a coach can change these details."
          >
            Edit
          </BlockedButton>
        )}
        {wellnessMini}
      </div>

      {availabilityLine}

      {editing ? (
        <form onSubmit={onSubmit} className="pp-detail-row" aria-label="Edit athlete details">
          <div className="pp-detail-cell">
            <label className="l" htmlFor="pp-edit-position">
              Position
            </label>
            <input
              id="pp-edit-position"
              className="field"
              style={{ marginTop: 'var(--sp-4)', minHeight: 36, fontSize: 'var(--fs-13)' }}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Fly-half"
              maxLength={60}
            />
          </div>
          <div className="pp-detail-cell">
            <label className="l" htmlFor="pp-edit-squad-number">
              Jersey
            </label>
            <input
              id="pp-edit-squad-number"
              className="field"
              style={{ marginTop: 'var(--sp-4)', minHeight: 36, fontSize: 'var(--fs-13)' }}
              type="number"
              min={0}
              max={999}
              value={squadNumber}
              onChange={(e) => setSquadNumber(e.target.value)}
            />
          </div>
          <div className="pp-detail-cell">
            <label className="l" htmlFor="pp-edit-height">
              Height (cm)
            </label>
            <input
              id="pp-edit-height"
              className="field"
              style={{ marginTop: 'var(--sp-4)', minHeight: 36, fontSize: 'var(--fs-13)' }}
              type="number"
              min={0}
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <div className="pp-detail-cell">
            <div className="l">Age</div>
            <div className="v">{ageDisplay}</div>
          </div>
          <div className="pp-detail-cell">
            <label className="l" htmlFor="pp-edit-hand">
              Hand
            </label>
            <select
              id="pp-edit-hand"
              className="field"
              style={{ marginTop: 'var(--sp-4)', minHeight: 36, fontSize: 'var(--fs-13)' }}
              value={dominantSide}
              onChange={(e) => setDominantSide(e.target.value as DominantSide | '')}
            >
              <option value="">{EM_DASH}</option>
              {HAND_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          {weightDisplay !== null ? (
            <div className="pp-detail-cell">
              <div className="l">Weight</div>
              <div className="v">{weightDisplay}</div>
            </div>
          ) : null}

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 'var(--sp-12)', marginTop: 'var(--sp-6)' }}>
            {error ? (
              <p className="form-error" role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn-primary" disabled={busy} style={{ marginLeft: 'auto', padding: '8px 20px' }}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-ghost" onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="pp-detail-row">
          <div className="pp-detail-cell">
            <div className="l">Position</div>
            <div className="v">{emDash(initialPosition)}</div>
          </div>
          <div className="pp-detail-cell">
            <div className="l">Jersey</div>
            <div className="v">{initialSquadNumber !== null ? `#${initialSquadNumber}` : EM_DASH}</div>
          </div>
          <div className="pp-detail-cell">
            <div className="l">Height</div>
            <div className="v">{initialHeightCm !== null ? `${initialHeightCm} cm` : EM_DASH}</div>
          </div>
          <div className="pp-detail-cell">
            <div className="l">Age</div>
            <div className="v">{ageDisplay}</div>
          </div>
          <div className="pp-detail-cell">
            <div className="l">Hand</div>
            <div className="v">{initialDominantSide ? (HAND_LABEL[initialDominantSide] ?? EM_DASH) : EM_DASH}</div>
          </div>
          {weightDisplay !== null ? (
            <div className="pp-detail-cell">
              <div className="l">Weight</div>
              <div className="v">{weightDisplay}</div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
