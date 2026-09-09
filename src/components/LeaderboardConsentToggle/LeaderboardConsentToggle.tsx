'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { grantLeaderboardVisibility, withdrawLeaderboardVisibility } from '@/lib/queries/leaderboards';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = { orgId: string; athleteId: string; initialGranted: boolean };

/** The under-18 opt-in, screens/leaderboards.md's Children's Code rule: nothing turns
 *  this on except the athlete's own tap, and nothing but their own tap turns it off. */
export function LeaderboardConsentToggle({ orgId, athleteId, initialGranted }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        initialGranted
          ? withdrawLeaderboardVisibility(createClient(), athleteId)
          : grantLeaderboardVisibility(createClient(), orgId, athleteId),
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
    <div style={{ marginTop: 'var(--sp-10)' }}>
      <button
        type="button"
        className="squad-chip"
        aria-pressed={initialGranted}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? 'Working…'
          : initialGranted
            ? 'On — tap to turn off'
            : 'Off — tap to appear on leaderboards'}
      </button>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-8)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
