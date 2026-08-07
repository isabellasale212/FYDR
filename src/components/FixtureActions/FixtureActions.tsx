'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { setFixtureStatus, type FixtureDetail } from '@/lib/queries/schedule';

type Props = { orgId: string; fixture: FixtureDetail };

const LABEL: Record<string, string> = {
  scheduled: 'Reinstate to scheduled',
  postponed: 'Postpone',
  cancelled: 'Cancel fixture',
  played: 'Mark as played',
};

/** The status transitions available from wherever a fixture currently sits.
 *  No delete: unlike a session, screens/fixture-detail.md gives no rule for
 *  when removing a fixture is safe (it anchors md_offset on every session
 *  around it, which a session's own delete rule does not have to reason
 *  about), so this build does not invent one — a real, documented cut. */
export function FixtureActions({ orgId, fixture }: Props) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (status: FixtureDetail['status']) =>
      setFixtureStatus(createClient(), orgId, fixture.id, status),
    onSuccess: (result) => {
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      router.refresh();
    },
  });

  const options: FixtureDetail['status'][] =
    fixture.status === 'scheduled'
      ? ['postponed', 'cancelled', 'played']
      : fixture.status === 'postponed'
        ? ['scheduled', 'cancelled', 'played']
        : ['scheduled'];

  return (
    <div className="card">
      <p className="label">Fixture status</p>
      {actionError ? (
        <p className="form-error" role="alert" style={{ marginTop: 6 }}>
          {actionError}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {options.map((status) => (
          <button
            key={status}
            type="button"
            className="btn-ghost"
            onClick={() => mutation.mutate(status)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Working…' : LABEL[status]}
          </button>
        ))}
      </div>
    </div>
  );
}
