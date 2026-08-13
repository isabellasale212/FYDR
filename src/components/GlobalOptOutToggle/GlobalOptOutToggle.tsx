'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { optOut, optBackIn } from '@/lib/queries/leaderboards';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = { orgId: string; athleteId: string; userId: string; initialOptedOut: boolean };

export function GlobalOptOutToggle({ orgId, athleteId, userId, initialOptedOut }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        initialOptedOut
          ? optBackIn(createClient(), orgId, athleteId, null)
          : optOut(createClient(), orgId, athleteId, userId, null),
      );
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'athlete')),
  });

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="squad-chip"
        aria-pressed={initialOptedOut}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? 'Working…'
          : initialOptedOut
            ? 'Left every leaderboard — tap to rejoin'
            : 'Leave every leaderboard'}
      </button>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
