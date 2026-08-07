'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  cancelSession,
  reinstateSession,
  deleteSession,
  type SessionDetail,
} from '@/lib/queries/schedule';

type Props = { orgId: string; session: SessionDetail };

/** Cancel, reinstate, delete. screens/schedule.md: "Cancelling requires no
 *  confirmation text, deleting does" — so cancel fires straight away, like
 *  `GroupArchiveButton`, and delete needs a second tap on an inline
 *  confirmation rather than a browser `confirm()` dialog, matching this
 *  app's existing tone elsewhere. The server is the real gate on delete
 *  (recorded data, or a past session): this only surfaces what it says. */
export function SessionActions({ orgId, session }: Props) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const cancelled = session.status === 'cancelled';

  const toggleCancelled = useMutation({
    mutationFn: () =>
      cancelled
        ? reinstateSession(createClient(), orgId, session.id)
        : cancelSession(createClient(), orgId, session.id),
    onSuccess: (result) => {
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      router.refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteSession(createClient(), orgId, session.id),
    onSuccess: (result) => {
      if (result.error) {
        setActionError(result.error);
        setConfirmingDelete(false);
        return;
      }
      router.push('/schedule');
    },
  });

  return (
    <div className="card">
      <p className="label">Session actions</p>
      {actionError ? (
        <p className="form-error" role="alert" style={{ marginTop: 6 }}>
          {actionError}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => toggleCancelled.mutate()}
          disabled={toggleCancelled.isPending}
        >
          {toggleCancelled.isPending
            ? 'Working…'
            : cancelled
              ? 'Reinstate session'
              : 'Cancel session'}
        </button>

        {!confirmingDelete ? (
          <button type="button" className="btn-ghost" onClick={() => setConfirmingDelete(true)}>
            Delete session
          </button>
        ) : (
          <>
            <span className="tiny" style={{ color: 'var(--bad)' }}>
              Delete this session? This cannot be undone.
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmingDelete(false)}>
              Never mind
            </button>
          </>
        )}
      </div>
    </div>
  );
}
