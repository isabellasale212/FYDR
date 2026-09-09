'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { grantHealthkitSync, withdrawHealthkitSync } from '@/lib/queries/healthkit';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = { orgId: string; athleteId: string; initialGranted: boolean };

/** The athlete's own Apple Health permission. Same shape as the leaderboard
 *  consent toggle beside it, for the same reason: nothing turns this on except
 *  the athlete's own tap, and nothing but their own tap turns it off. A coach
 *  cannot see the state at all — see lib/queries/healthkit.ts's header and
 *  migration 0012's own note on athlete_consents. */
export function HealthkitConsentToggle({ orgId, athleteId, initialGranted }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        initialGranted
          ? withdrawHealthkitSync(createClient(), athleteId)
          : grantHealthkitSync(createClient(), orgId, athleteId),
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
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {initialGranted ? 'Allowed' : 'Allow Apple Health'}
      </button>
      {error ? (
        <p className="tiny" role="alert" style={{ color: 'var(--bad-text)', margin: '8px 0 0' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
