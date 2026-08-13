'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { setAvailability } from '@/lib/queries/injuries';
import { humanizeDbError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { AvailabilityReason } from '@/lib/types/database';

const STATUSES = ['available', 'modified', 'unavailable'] as const;
const REASONS = ['injury', 'illness', 'personal', 'suspension', 'load_management'] as const;
const COMMON_RESTRICTIONS = ['no contact', 'no sprinting', 'no loading', 'upper body only', 'no pitch work'];

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

type Props = { orgId: string; userId: string; athleteId: string; injuryId: string | null };

/** Medical only, per migration 0012's availability RLS: "there is no coach insert
 *  policy on this table. Not a restricted one, not one gated on a column: none." Sets
 *  a new interval rather than editing the last one, matching setAvailability's own
 *  comment on why. */
export function SetAvailabilityForm({ orgId, userId, athleteId, injuryId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('modified');
  const [restrictions, setRestrictions] = useState<Set<string>>(new Set());
  const [reasonCategory, setReasonCategory] = useState<string>('injury');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        setAvailability(createClient(), orgId, athleteId, userId, {
          status,
          restrictions: [...restrictions],
          reasonCategory: (reasonCategory || null) as AvailabilityReason | null,
          note: note.trim() || null,
          injuryId,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  function toggleRestriction(r: string) {
    setRestrictions((current) => {
      const next = new Set(current);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  return (
    <div className="card">
      <p className="label">Set availability</p>
      <div className="chiprow" style={{ marginTop: 8 }}>
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
          <p className="label" style={{ marginTop: 14 }}>
            Restrictions (coach visible)
          </p>
          <div className="chiprow" style={{ marginTop: 6 }}>
            {COMMON_RESTRICTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className="squad-chip"
                aria-pressed={restrictions.has(r)}
                onClick={() => toggleRestriction(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <label className="label" htmlFor="avail-reason" style={{ marginTop: 14 }}>
            Reason
          </label>
          <select
            id="avail-reason"
            className="field"
            value={reasonCategory}
            onChange={(event) => setReasonCategory(event.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label className="label" htmlFor="avail-note" style={{ marginTop: 14 }}>
        Note (coach visible &mdash; not a clinical field)
      </label>
      <input id="avail-note" className="field" value={note} onChange={(event) => setNote(event.target.value)} />

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: 14 }}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Saving…' : 'Update availability'}
      </button>
    </div>
  );
}
