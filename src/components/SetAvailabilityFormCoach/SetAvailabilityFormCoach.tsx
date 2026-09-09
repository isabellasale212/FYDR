'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { setAvailability } from '@/lib/queries/injuries';
import type { AvailabilityReason } from '@/lib/types/database';

const STATUSES = ['available', 'modified', 'unavailable'] as const;

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

type Props = { orgId: string; userId: string; athleteId: string };

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
export function SetAvailabilityFormCoach({ orgId, userId, athleteId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('unavailable');
  const [reasonCategory, setReasonCategory] = useState<AvailabilityReason>('personal');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      setAvailability(createClient(), orgId, athleteId, userId, {
        status,
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
      router.refresh();
    },
  });

  return (
    <div className="card">
      <p className="label">Set availability</p>
      <p className="tiny" style={{ marginTop: 'var(--sp-4)', marginBottom: 0 }}>
        For a non-injury reason only — illness, personal leave, exams, representative
        honours, or other. For an injury, use the injury record instead.
      </p>

      <div className="chiprow" style={{ marginTop: 'var(--sp-10)' }}>
        {STATUSES.map((s) => (
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

      {status !== 'available' ? (
        <>
          <label className="label" htmlFor="avail-coach-reason" style={{ marginTop: 'var(--sp-14)' }}>
            Reason
          </label>
          <select
            id="avail-coach-reason"
            className="field"
            value={reasonCategory}
            onChange={(event) => setReasonCategory(event.target.value as AvailabilityReason)}
          >
            {NON_INJURY_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label className="label" htmlFor="avail-coach-note" style={{ marginTop: 'var(--sp-14)' }}>
        Note (coach visible &mdash; not a clinical field)
      </label>
      <input
        id="avail-coach-note"
        className="field"
        value={note}
        maxLength={NOTE_MAX}
        onChange={(event) => setNote(event.target.value)}
      />

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-10)' }}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: 'var(--sp-14)' }}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Saving…' : 'Update availability'}
      </button>
    </div>
  );
}
