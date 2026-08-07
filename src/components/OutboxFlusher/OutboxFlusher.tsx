'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  dequeueTraining,
  dequeueWellness,
  pendingTraining,
  pendingWellness,
} from '@/lib/outbox';
import { submitWellnessEntry } from '@/lib/queries/wellness';
import { submitTrainingEntry } from '@/lib/queries/training';
import { createClient } from '@/lib/supabase/client';

type Props = { orgId: string; athleteId: string; userId: string };

/** Retries anything check-in or an RPE rating could not send. Runs once on
 *  load and again when the browser says it is back online. Reports "saved on
 *  this phone", and never an error: the athlete has already done the thing. */
export function OutboxFlusher({ orgId, athleteId, userId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function flush() {
      const wellnessItems = pendingWellness();
      const trainingItems = pendingTraining();
      if (!cancelled) setPending(wellnessItems.length + trainingItems.length);
      if (wellnessItems.length === 0 && trainingItems.length === 0) return;

      const db = createClient();
      let sent = 0;

      for (const item of wellnessItems) {
        try {
          await submitWellnessEntry(db, item.input, {
            orgId,
            athleteId,
            userId,
          });
          dequeueWellness(item.input.id);
          sent += 1;
        } catch {
          /* Still no signal, or the row is already there under this id. Either
             way it stays queued and is tried again next time. */
        }
      }

      for (const item of trainingItems) {
        try {
          await submitTrainingEntry(db, item.input, {
            orgId,
            athleteId,
            userId,
          });
          dequeueTraining(item.input.id);
          sent += 1;
        } catch {
          /* Same reasoning as the wellness loop above. */
        }
      }

      if (cancelled) return;
      setPending(pendingWellness().length + pendingTraining().length);
      if (sent > 0) router.refresh();
    }

    void flush();
    window.addEventListener('online', flush);
    return () => {
      cancelled = true;
      window.removeEventListener('online', flush);
    };
  }, [orgId, athleteId, userId, router]);

  if (pending === 0) return null;

  return (
    <p className="tiny" role="status">
      <span aria-hidden="true">☁ </span>
      <span className="mono">{pending}</span> entr
      {pending === 1 ? 'y is' : 'ies are'} saved on this phone and will send when
      you have signal.
    </p>
  );
}
