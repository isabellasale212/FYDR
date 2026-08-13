'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { archiveGroup, restoreGroup } from '@/lib/queries/groups';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = { orgId: string; groupId: string; archived: boolean };

/** Archive sets deleted_at, restore clears it. Never a hard delete —
 *  screens/groups.md offers no path to one, and membership rows are
 *  untouched either way so restoring a group restores its squad structure
 *  exactly.
 *
 *  Bounded write (audit S5's rule): archiveGroup/restoreGroup throw on any
 *  failure, and this button used to have no onError at all — a failed
 *  archive simply did nothing, and a hung one said "Working…" forever. */
export function GroupArchiveButton({ orgId, groupId, archived }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        archived
          ? restoreGroup(createClient(), groupId, orgId)
          : archiveGroup(createClient(), groupId, orgId),
      ),
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Working…' : archived ? 'Restore' : 'Archive'}
      </button>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
