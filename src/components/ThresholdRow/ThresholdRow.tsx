'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import type { Threshold } from '@/lib/queries/thresholds';
import { archiveThreshold, setThresholdActive } from '@/lib/queries/thresholds';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { Pill } from '@/components/Pill/Pill';
import { SEVERITY_STATUS } from '@/lib/status';
import { enumLabel } from '@/lib/format';

type Props = { threshold: Threshold; orgId: string; sentence: string };

export function ThresholdRow({ threshold, orgId, sentence }: Props) {
  const router = useRouter();
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Bounded writes (audit S5's rule): both helpers throw on failure and
   * neither mutation had an onError — a failed retire silently collapsed
   * the confirm row and left the threshold live. */
  const toggle = useMutation({
    mutationFn: () =>
      withWriteTimeout(setThresholdActive(createClient(), threshold.id, orgId, !threshold.is_active)),
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const archive = useMutation({
    mutationFn: () => withWriteTimeout(archiveThreshold(createClient(), threshold.id, orgId)),
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <div
      className="todo"
      style={{
        borderTop: '1px solid var(--hair)',
        cursor: 'default',
        alignItems: 'flex-start',
        opacity: threshold.is_active ? 1 : 0.6,
      }}
    >
      <span
        className="dot"
        aria-hidden="true"
        style={{ marginTop: 6, color: threshold.is_active ? 'var(--good-text)' : 'var(--faint)' }}
      >
        ●
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{threshold.name}</span>
          <Pill status={SEVERITY_STATUS[threshold.severity as 'low' | 'medium' | 'high']} />
          {!threshold.is_active ? <span className="tiny">Inactive</span> : null}
        </span>
        {/* No maxWidth here — a stray `maxWidth: 62` (a bare number, so React
         *  renders it as 62px) squeezed this whole sentence into a
         *  one-word-per-line column. Wraps naturally within the row's own
         *  flex:1 width instead, same as the "Notifies ..." line below it. */}
        <span className="tiny" style={{ display: 'block', marginTop: 3, whiteSpace: 'normal' }}>
          {sentence}
        </span>
        <span className="tiny" style={{ display: 'block', marginTop: 3 }}>
          Notifies {threshold.notify_roles.map(enumLabel).join(', ')}
        </span>

        {error ? (
          <span className="form-error" role="alert" style={{ display: 'block', marginTop: 6 }}>
            {error}
          </span>
        ) : null}

        {confirmingArchive ? (
          <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span className="tiny">Retire this threshold for good?</span>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => archive.mutate()}
              disabled={archive.isPending}
            >
              {archive.isPending ? 'Retiring…' : 'Yes, retire it'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmingArchive(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {toggle.isPending ? 'Working…' : threshold.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmingArchive(true)}>
              Retire
            </button>
          </span>
        )}
      </span>
    </div>
  );
}
