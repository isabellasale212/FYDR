'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { updateProgrammeStatus } from '@/lib/queries/programmes';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { ProgrammeStatus } from '@/lib/types/database';
import { enumLabel } from '@/lib/format';

type Props = { orgId: string; programmeId: string; status: ProgrammeStatus; canEdit: boolean };

const CAPTION: Record<ProgrammeStatus, string> = {
  draft: 'Draft. Not visible to assigned athletes yet.',
  active: 'Active. Assigned athletes can see this now.',
  archived: 'Archived. Kept for reference; no longer active on athletes’ programmes.',
};

/** screens/programme-builder.md "Publishing" — the write half migration 0043
 *  finally gave a real destination: resolve_my_programme_sessions did not
 *  check programmes.status before that migration, so "Draft" was previously
 *  decorative — audit finding 32's "Draft unexplained". No validation set
 *  beyond RLS before publishing (a real, documented cut — see the migration
 *  header); a programme with zero exercises can still be published. */
export function ProgrammeStatusControl({ orgId, programmeId, status, canEdit }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (next: ProgrammeStatus) =>
      withWriteTimeout(updateProgrammeStatus(createClient(), orgId, programmeId, next)),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)', flexWrap: 'wrap' }}>
      <span className={`pill ${status === 'active' ? 'pill-good' : status === 'draft' ? 'pill-neutral' : 'pill-warn'}`}>
        {enumLabel(status)}
      </span>
      <span className="tiny">{CAPTION[status]}</span>
      {canEdit ? (
        status === 'draft' ? (
          <button type="button" className="btn-ghost" disabled={mutation.isPending} onClick={() => mutation.mutate('active')}>
            {mutation.isPending ? 'Publishing…' : 'Publish'}
          </button>
        ) : status === 'active' ? (
          <button type="button" className="btn-ghost" disabled={mutation.isPending} onClick={() => mutation.mutate('archived')}>
            {mutation.isPending ? 'Archiving…' : 'Archive'}
          </button>
        ) : (
          <button type="button" className="btn-ghost" disabled={mutation.isPending} onClick={() => mutation.mutate('active')}>
            {mutation.isPending ? 'Reactivating…' : 'Reactivate'}
          </button>
        )
      ) : null}
      {error ? (
        <p className="form-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
