'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { expireOverride, type AthleteOverride } from '@/lib/queries/programmes';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { formatDate } from '@/lib/format';

function summary(o: AthleteOverride): string {
  switch (o.override_type) {
    case 'exempt':
      return 'Exempt';
    case 'substitute':
      return 'Substituted';
    case 'volume':
      return `${o.sets ?? '—'} × ${o.reps_min ?? '—'}${o.reps_max && o.reps_max !== o.reps_min ? `–${o.reps_max}` : ''}`;
    case 'load_cap':
      return `Capped at ${o.load_value ?? '—'}`;
    case 'note':
      return 'Note';
    default:
      return '';
  }
}

/** The "Tailoring for this athlete" list on ProgrammeAthleteView. Retirement
 *  is expireOverride (sets expires_at to now), not a delete — migration
 *  0043's own header explains why there is no DELETE grant on this table. */
export function OverrideList({
  orgId,
  overrides,
  canEdit,
}: {
  orgId: string;
  overrides: readonly AthleteOverride[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (overrideId: string) => withWriteTimeout(expireOverride(createClient(), orgId, overrideId)),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setRemovingId(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  if (overrides.length === 0) {
    return <p className="tiny">No tailoring on this programme for this athlete. They follow the parent prescription exactly.</p>;
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {overrides.map((o) => (
        <div key={o.id} className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <span className="nm">
              {o.session_name} — {o.exercise_name}
            </span>
            <div className="tiny">
              {summary(o)}
              {o.reason ? ` · ${o.reason}` : ''}
              {o.expires_at ? ` · expires ${formatDate(o.expires_at)}` : ''}
            </div>
          </div>
          {canEdit ? (
            removingId === o.id ? (
              <span style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(o.id)}
                >
                  {mutation.isPending ? 'Removing…' : 'Confirm'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setRemovingId(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setRemovingId(o.id)}>
                Remove
              </button>
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}
