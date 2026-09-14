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
import { ThresholdPreview } from '@/components/ThresholdPreview/ThresholdPreview';

type Props = {
  threshold: Threshold;
  orgId: string;
  sentence: string;
  /** PATTERN-S8 C6: "Set by Jane Pemberton · 24 Aug" or "One of the club
   *  defaults · unchanged since 6 Aug" — the owner and date the dashboard
   *  quotes ("Thresholds set by … · 24 Aug"), per rule. */
  ownerLine: string;
  /** Whether this viewer may actually write. G-34: the control used to be
   *  unconditional, so a role the policy excludes pressed it and nothing
   *  happened, with no error. Resolved from the matching set in lib/access.ts
   *  by the page. */
  canManage: boolean;
};

export function ThresholdRow({ threshold, orgId, sentence, ownerLine, canManage }: Props) {
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
        style={{ marginTop: 'var(--sp-6)', color: threshold.is_active ? 'var(--good-text)' : 'var(--faint)' }}
      >
        ●
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--w-bold)' }}>{threshold.name}</span>
          <Pill status={SEVERITY_STATUS[threshold.severity as 'low' | 'medium' | 'high']} />
          {!threshold.is_active ? <span className="tiny">Inactive</span> : null}
        </span>
        {/* No maxWidth here — a stray `maxWidth: 62` (a bare number, so React
         *  renders it as 62px) squeezed this whole sentence into a
         *  one-word-per-line column. Wraps naturally within the row's own
         *  flex:1 width instead, same as the "Notifies ..." line below it. */}
        <span className="tiny" style={{ display: 'block', marginTop: 'var(--sp-4)', whiteSpace: 'normal' }}>
          {sentence}
        </span>
        <span className="tiny" style={{ display: 'block', marginTop: 'var(--sp-4)' }}>
          Notifies {threshold.notify_roles.map(enumLabel).join(', ')}
        </span>
        <span className="tiny thr-owner" style={{ display: 'block', marginTop: 'var(--sp-4)' }}>
          {ownerLine}
        </span>

        {error ? (
          <span className="form-error" role="alert" style={{ display: 'block', marginTop: 'var(--sp-6)' }}>
            {error}
          </span>
        ) : null}

        {/* G-34: the row stays visible to every staff role, because §3.6 gives the
            medic and the S&C a V on thresholds. Only the two write controls go,
            for the roles that cannot write. Hiding the row instead would take
            away a read the matrix grants. */}
        {/* PATTERN-S8 C6: the 28-day preview on demand, for the roles that
            configure rules (the RPC answers nobody else). */}
        {canManage ? (
          <span style={{ display: 'block', marginTop: 'var(--sp-8)' }}>
            <ThresholdPreview kind="saved" thresholdId={threshold.id} />
          </span>
        ) : null}

        {!canManage ? null : confirmingArchive ? (
          <span style={{ display: 'flex', gap: 'var(--sp-8)', marginTop: 'var(--sp-8)' }}>
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
          <span style={{ display: 'flex', gap: 'var(--sp-8)', marginTop: 'var(--sp-8)' }}>
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
