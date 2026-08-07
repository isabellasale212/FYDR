'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { archiveGroup, restoreGroup } from '@/lib/queries/groups';
import { createClient } from '@/lib/supabase/client';

type Props = { orgId: string; groupId: string; archived: boolean };

/** Archive sets deleted_at, restore clears it. Never a hard delete —
 *  screens/groups.md offers no path to one, and membership rows are
 *  untouched either way so restoring a group restores its squad structure
 *  exactly. */
export function GroupArchiveButton({ orgId, groupId, archived }: Props) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () =>
      archived
        ? restoreGroup(createClient(), groupId, orgId)
        : archiveGroup(createClient(), groupId, orgId),
    onSuccess: () => router.refresh(),
  });

  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Working…' : archived ? 'Restore' : 'Archive'}
    </button>
  );
}
