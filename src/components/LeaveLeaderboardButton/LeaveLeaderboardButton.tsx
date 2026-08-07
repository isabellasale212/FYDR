'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { optOut } from '@/lib/queries/leaderboards';

type Props = { orgId: string; athleteId: string; userId: string; boardId: string; boardName: string };

/** screens/leaderboards.md: "no confirmation friction beyond a single sheet, no reason
 *  required, effective immediately." One tap here, no sheet at all — the same directness
 *  already used for cancelling a session elsewhere in this build. */
export function LeaveLeaderboardButton({ orgId, athleteId, userId, boardId, boardName }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => optOut(createClient(), orgId, athleteId, userId, boardId),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      router.push('/my-data/boards');
    },
  });

  return (
    <div className="card">
      {error ? (
        <p className="form-error" role="alert" style={{ marginBottom: 10 }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn-ghost"
        style={{ width: '100%' }}
        aria-label={`Leave the ${boardName} leaderboard`}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Leaving…' : 'Leave this leaderboard'}
      </button>
    </div>
  );
}
