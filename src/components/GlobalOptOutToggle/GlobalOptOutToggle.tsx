'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { optOut, optBackIn } from '@/lib/queries/leaderboards';

type Props = { orgId: string; athleteId: string; userId: string; initialOptedOut: boolean };

export function GlobalOptOutToggle({ orgId, athleteId, userId, initialOptedOut }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      initialOptedOut
        ? optBackIn(createClient(), orgId, athleteId, null)
        : optOut(createClient(), orgId, athleteId, userId, null),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
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
