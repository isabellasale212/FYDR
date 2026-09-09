'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { createInjury } from '@/lib/queries/injuries';
import { todayIso } from '@/lib/format';
import type { BodySide, OccurrenceContext } from '@/lib/types/database';

const BODY_AREAS = [
  'head', 'neck', 'shoulder', 'upper_arm', 'elbow', 'forearm', 'wrist', 'hand',
  'chest', 'upper_back', 'lower_back', 'abdomen', 'hip', 'groin',
  'quadriceps', 'hamstring', 'knee', 'calf', 'achilles', 'ankle', 'foot', 'other',
] as const;
const SIDES = ['left', 'right', 'bilateral'] as const;
const OCCURRED_IN = ['training', 'match', 'gym', 'other', 'unknown'] as const;

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

type Athlete = { id: string; first_name: string; last_name: string };

type Props = {
  orgId: string;
  userId: string;
  timezone: string;
  athletes: readonly Athlete[];
  /** Pre-selected when this form is opened from one athlete's own context —
   *  their profile's "+ Log injury" — so their name does not have to be found
   *  again in a list of twenty-nine. Resolved and VALIDATED by the page against
   *  the athletes it already fetched, so an id that is missing, deleted, or from
   *  another organisation arrives here as undefined and the picker simply opens
   *  unset rather than pre-filling something wrong.
   *
   *  Still a select rather than a fixed label: the person may have clicked into
   *  the wrong profile, and taking the choice away to save a click is a bad
   *  trade on a medical record. */
  initialAthleteId?: string;
};

export function NewInjuryForm({ orgId, userId, timezone, athletes, initialAthleteId }: Props) {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState(initialAthleteId ?? '');
  const [bodyArea, setBodyArea] = useState<(typeof BODY_AREAS)[number]>('hamstring');
  const [side, setSide] = useState('');
  const [onsetDate, setOnsetDate] = useState(todayIso(timezone));
  const [occurredIn, setOccurredIn] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        createInjury(createClient(), orgId, userId, {
          athleteId,
          bodyArea,
          side: (side || null) as BodySide | null,
          onsetDate,
          occurredIn: (occurredIn || null) as OccurrenceContext | null,
          expectedReturn: expectedReturn || null,
        }),
      );
      if (result.error) throw new Error(result.error);
      return result.id;
    },
    onSuccess: (id) => {
      if (id) {
        router.push(`/injuries/${id}`);
        return;
      }
      /* No error and no id used to do nothing at all — a silent no-op. */
      setError('That didn’t save. Try again in a moment.');
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!athleteId) return setError('Choose an athlete.');
    if (!onsetDate) return setError('Set an onset date.');
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <label className="label" htmlFor="new-inj-athlete">
        Athlete
      </label>
      <select
        id="new-inj-athlete"
        className="field"
        value={athleteId}
        onChange={(event) => setAthleteId(event.target.value)}
      >
        <option value="">Choose an athlete</option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.first_name} {a.last_name}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-14)' }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="new-inj-area">
            Body area
          </label>
          <select
            id="new-inj-area"
            className="field"
            value={bodyArea}
            onChange={(event) => setBodyArea(event.target.value as (typeof BODY_AREAS)[number])}
          >
            {BODY_AREAS.map((a) => (
              <option key={a} value={a}>
                {label(a)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="new-inj-side">
            Side
          </label>
          <select id="new-inj-side" className="field" value={side} onChange={(event) => setSide(event.target.value)}>
            <option value="">Not applicable</option>
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-14)' }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="new-inj-onset">
            Onset date
          </label>
          <input
            id="new-inj-onset"
            className="field"
            type="date"
            value={onsetDate}
            onChange={(event) => setOnsetDate(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="new-inj-occurred">
            Occurred in
          </label>
          <select
            id="new-inj-occurred"
            className="field"
            value={occurredIn}
            onChange={(event) => setOccurredIn(event.target.value)}
          >
            <option value="">Not recorded</option>
            {OCCURRED_IN.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="label" htmlFor="new-inj-expected" style={{ marginTop: 'var(--sp-14)' }}>
        Expected return (optional)
      </label>
      <input
        id="new-inj-expected"
        className="field"
        type="date"
        value={expectedReturn}
        onChange={(event) => setExpectedReturn(event.target.value)}
      />

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-18)' }}>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Create injury record'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.push('/injuries')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
