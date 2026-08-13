'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  dequeueNutritionCheckin,
  dequeueTraining,
  dequeueWellness,
  pendingNutritionCheckins,
  pendingTraining,
  pendingWellness,
} from '@/lib/outbox';
import { submitWellnessEntry } from '@/lib/queries/wellness';
import { submitTrainingEntry } from '@/lib/queries/training';
import { submitCheckin } from '@/lib/queries/nutrition';
import { createClient } from '@/lib/supabase/client';

type Props = { orgId: string; athleteId: string; userId: string };

/** Delivered is delivered: a queued write that fails on a unique violation is
 *  already on the server — either this exact id landed on an earlier attempt
 *  whose response was lost, or (nutrition) the week already has a live answer
 *  recorded another way. Retrying it forever would pin the "will send when
 *  you have signal" note on an entry that has nowhere left to go. */
function alreadyDelivered(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('duplicate key');
}

/** Retries anything a check-in, an RPE rating or the weekly nutrition
 *  check-in could not send. Runs once on load and again when the browser
 *  says it is back online. Reports "saved on this phone", and never an
 *  error: the athlete has already done the thing. */
export function OutboxFlusher({ orgId, athleteId, userId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function flush() {
      const wellnessItems = pendingWellness();
      const trainingItems = pendingTraining();
      const nutritionItems = pendingNutritionCheckins();
      if (!cancelled)
        setPending(wellnessItems.length + trainingItems.length + nutritionItems.length);
      if (
        wellnessItems.length === 0 &&
        trainingItems.length === 0 &&
        nutritionItems.length === 0
      )
        return;

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
        } catch (err) {
          if (alreadyDelivered(err)) {
            dequeueWellness(item.input.id);
            sent += 1;
          }
          /* Otherwise: still no signal. It stays queued and is tried again
             next time. */
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
        } catch (err) {
          if (alreadyDelivered(err)) {
            dequeueTraining(item.input.id);
            sent += 1;
          }
          /* Same reasoning as the wellness loop above. */
        }
      }

      for (const item of nutritionItems) {
        try {
          await submitCheckin(db, item.input, { orgId, athleteId, userId });
          dequeueNutritionCheckin(item.input.id);
          sent += 1;
        } catch (err) {
          if (alreadyDelivered(err)) {
            dequeueNutritionCheckin(item.input.id);
            sent += 1;
          }
          /* Same reasoning again. */
        }
      }

      if (cancelled) return;
      setPending(
        pendingWellness().length +
          pendingTraining().length +
          pendingNutritionCheckins().length,
      );
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
