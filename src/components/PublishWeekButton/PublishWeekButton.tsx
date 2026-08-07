'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { publishWeek } from '@/lib/queries/teamAllocation';

type Props = { orgId: string; userId: string; weekStart: string; draftCount: number };

/** Publish discloses the whole week at once — screens/team-allocation.md: this is
 *  "the act that makes the allocation visible to athletes", coach only. */
export function PublishWeekButton({ orgId, userId, weekStart, draftCount }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => publishWeek(createClient(), orgId, userId, weekStart),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  if (draftCount === 0) return null;

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
