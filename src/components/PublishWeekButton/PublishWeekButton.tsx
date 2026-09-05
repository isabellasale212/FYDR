'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { publishWeek } from '@/lib/queries/teamAllocation';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = {
  orgId: string;
  userId: string;
  weekStart: string;
  draftCount: number;
  /** Whether this viewer may actually write. G-34: the control used to be
   *  unconditional, so a role the policy excludes pressed it and nothing
   *  happened, with no error. Resolved from the matching set in lib/access.ts
   *  by the page. */
  canManage: boolean;
};

/** Publish discloses the whole week at once — screens/team-allocation.md: this is
 *  "the act that makes the allocation visible to athletes", coach only. */
export function PublishWeekButton({ orgId, userId, weekStart, draftCount, canManage }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => withWriteTimeout(publishWeek(createClient(), orgId, userId, weekStart)),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  if (draftCount === 0) return null;

  /* After every hook, never before: an early return above them changes the
     hook order between renders. G-34 gates the control, not the component's
     lifecycle. */
  if (!canManage) return null;

  return (
    <div>
      <button type="button" className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Publishing…' : `Publish this week (${draftCount} draft${draftCount === 1 ? '' : 's'})`}
      </button>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
