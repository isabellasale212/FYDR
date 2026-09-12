'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { setAvailability } from '@/lib/queries/injuries';
import { AvailabilityAudience } from '@/components/AvailabilityAudience/AvailabilityAudience';
import type { AvailabilityReason } from '@/lib/types/database';

/* PATTERN-S3 C5 (2026-09-12): this is an ABSENCE form. Available is withheld
   from the control rather than disabled — an absence that leaves an athlete
   fully available is not a record — and ending an absence is its own act
   ("Mark available again"), which writes the Available row through the same
   confirmed path. */
const ABSENCE_STATUSES = ['modified', 'unavailable'] as const;

// Deliberately a subset of the full availability_reason enum. 'injury' is excluded
// because it is refused by RLS regardless (availability_coach_insert_noninjury,
// migration 0041). 'suspension' and 'load_management' exist in the enum but are not
// offered here — a judgement call, not a technical limit. See ADR-008, "The reason
// picker a coach sees is a subset of the enum".
const NON_INJURY_REASONS: { value: AvailabilityReason; label: string }[] = [
  { value: 'illness', label: 'Illness' },
  { value: 'personal', label: 'Personal' },
  { value: 'academic', label: 'Academic' },
  { value: 'representative', label: 'Representative' },
  { value: 'other', label: 'Other' },
];

const NOTE_MAX = 140;

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

type Props = {
  orgId: string;
  userId: string;
  athleteId: string;
  athleteName: string;
  /** Whether a coach-recorded, non-injury absence is open right now — when
   *  it is, "Mark available again" is offered as the way to end it. */
  currentAbsence: boolean;
};

/**
 * Coach-reachable, non-injury availability. ADR-008 / migration 0041.
 *
 * Never touches injuries or injury_clinical, and cannot: availability_coach_
 * insert_noninjury requires injury_id is null and reason_category is a real,
 * non-injury value, checked server-side by RLS regardless of what this form
 * sends. This form's own restriction to five reasons is a UI choice on top of
 * that, not the boundary itself.
 *
 * Reuses setAvailability (lib/queries/injuries.ts) unchanged — the same
 * close-current-interval-then-insert-new-one function SetAvailabilityForm
 * (medical) already calls. If the athlete's current open interval is
 * injury-linked, the close step affects zero rows (RLS-filtered, not an
 * error) and the insert that follows fails on the one-open-interval
 * constraint (0005) — surfaced below as a plain-language message rather than
 * the raw Postgres error, since "duplicate key value violates constraint
 * availability_one_open_per_athlete" tells a coach nothing about why.
 *
 * reasonCategory is deliberately NEVER nulled here, including when status is
 * set to 'available' (integration-audit majors, Bug 1) — the opposite of what
 * SetAvailabilityForm (medical) does for the same case, and on purpose:
 * availability_coach_insert_noninjury (migration 0042) requires reason_
 * category IS NOT NULL on every coach insert, with no exception for status,
 * confirmed by 200_coach_noninjury_availability_test.sql §3c ("a COACH cannot
 * insert with no reason_category at all" throws 42501 for exactly the
 * 'available' + null case). A coach without the medical role has no other way
 * to write this table, so nulling this field here would leave that coach
 * unable to ever clear an athlete back to Available — trading a cosmetic
 * display bug for a hard functional dead end. The Reason field below is still
 * hidden while 'available' is selected, so a coach is never invited to pick a
 * reason that will not visibly apply, but the value already selected keeps
 * riding along in the write to satisfy RLS. The actual fix for the observed
 * bug (a stale reason showing on the athlete's own Today page) lives in
 * AvailabilityBanner, which now checks status === 'available' first and never
 * looks at reasonCategory at all once it does — see that component's own
 * comment.
 */
export function SetAvailabilityFormCoach({ orgId, userId, athleteId, athleteName, currentAbsence }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof ABSENCE_STATUSES)[number]>('unavailable');
  const [reasonCategory, setReasonCategory] = useState<AvailabilityReason>('personal');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  /* "Mark available again": the write is status available with the reason
     riding along (the policy requires one — see the header). */
  const [ending, setEnding] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      setAvailability(createClient(), orgId, athleteId, userId, {
        status: ending ? 'available' : status,
        restrictions: [],
        reasonCategory,
        note: note.trim() || null,
        injuryId: null,
      }),
    onSuccess: (result) => {
      if (result.error) {
        setError(
          result.error.includes('availability_one_open_per_athlete')
            ? 'This athlete already has an open medical availability record. Ask medical staff to close it before setting a non-injury status.'
            : result.error,
        );
        return;
      }
      setError(null);
      setEnding(false);
      setConfirming(false);
      router.refresh();
    },
  });

  return (
    <div className="card">
      <p className="label">Record an absence</p>
      <p className="tiny" style={{ marginTop: 'var(--sp-4)', marginBottom: 0 }}>
        For illness, personal, academic, representative or other. If this is an injury, medical staff record it &mdash; this form cannot
        open an injury record and does not create one.
      </p>

      {/* The reason first: it is what the absence IS. Chips, the same control
          the availability words use beneath. */}
      <p className="label" style={{ marginTop: 'var(--sp-14)' }} id="avail-coach-reason-label">
        Reason
      </p>
      <div className="chiprow" role="group" aria-labelledby="avail-coach-reason-label" style={{ marginTop: 'var(--sp-6)' }}>
        {NON_INJURY_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            className="squad-chip"
            aria-pressed={reasonCategory === r.value}
            onClick={() => setReasonCategory(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="label" style={{ marginTop: 'var(--sp-14)' }} id="avail-coach-status-label">
        Availability
      </p>
      <div className="chiprow" role="group" aria-labelledby="avail-coach-status-label" style={{ marginTop: 'var(--sp-6)' }}>
        {ABSENCE_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className="squad-chip"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
          >
            {label(s)}
          </button>
        ))}
      </div>
      <p className="tiny" style={{ marginTop: 'var(--sp-6)', marginBottom: 0 }}>
        Available is not offered here: an absence that leaves an athlete fully available is not a record.
      </p>

      <label className="label" htmlFor="avail-coach-note" style={{ marginTop: 'var(--sp-14)' }}>
        Note
      </label>
      <input
        id="avail-coach-note"
        className="field"
        value={note}
        maxLength={NOTE_MAX}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="tiny" style={{ marginTop: 'var(--sp-6)', marginBottom: 0 }}>
        Visible to the athlete and to all staff. This is not a medical record — do not describe symptoms.
      </p>

      {/* What an absence does not carry, said rather than left to be inferred
          (the board's well). */}
      <div className="absence-well">
        <p className="absence-well-k">No clinical record</p>
        <p className="absence-well-v">
          This creates an availability row and nothing else. No injury record, no site, no diagnosis, no return to play
          stage, no row on the injury board. Medical staff are not notified.
        </p>
      </div>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-10)' }}>
          {error}
        </p>
      ) : null}

      {/* Who will read what, before it lands (PATTERN-S3 / STAFF-SS-02-05
          C4, 2026-09-12): the permission rule made visible at the moment it
          is exercised. The button opens the step; Confirm is the write. */}
      {confirming ? (
        <AvailabilityAudience
          athleteName={athleteName}
          status={ending ? 'available' : status}
          injuryLinked={false}
          hasNote={note.trim() !== ''}
          pending={mutation.isPending}
          onConfirm={() => mutation.mutate()}
          onBack={() => {
            setConfirming(false);
            setEnding(false);
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-10)', marginTop: 'var(--sp-14)' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={mutation.isPending}
            onClick={() => {
              setEnding(false);
              setConfirming(true);
            }}
          >
            Record absence
          </button>
          {/* Ending an absence is its own act, offered only while a
              non-injury absence is open: the Available row, through the
              same confirmed path. */}
          {currentAbsence ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={mutation.isPending}
              onClick={() => {
                setEnding(true);
                setConfirming(true);
              }}
            >
              Mark available again
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
