/* The outbox flush — every domain's queue tried once, in order. Lifted out of
 * components/OutboxFlusher on 2026-09-14 so the queue screen's "Send now"
 * (decision batch 14 Sept, #2: on the offline queue screen only, never per
 * item) runs exactly what Today runs on load and on `online`: one function,
 * one set of rules. Nothing here renders. The gym half is flushGymSets,
 * shared with the logger since ATH-ADULT-09 C4. */

import {
  dequeueNutritionCheckin,
  dequeueTraining,
  dequeueWellness,
  markNutritionCheckinClosed,
  markNutritionCheckinConflict,
  markTrainingConflict,
  markWellnessConflict,
  pendingGymSetLogs,
  pendingNutritionCheckins,
  pendingTraining,
  pendingWellness,
  recordLastSent,
  type PendingNutritionCheckin,
  type PendingTraining,
  type PendingWellness,
} from '@/lib/outbox';
import { submitWellnessEntry, fetchWellnessDay } from '@/lib/queries/wellness';
import { submitTrainingEntry, fetchTrainingEntryForSession } from '@/lib/queries/training';
import { submitCheckin, fetchCheckinForWeek } from '@/lib/queries/nutrition';
import { flushGymSets, isDuplicateKeyError, isPolicyRefusal, type ConflictOutcome } from '@/lib/gymOutboxFlush';
import type { Db } from '@/lib/queries/groups';

/** A duplicate-key hit on a plain insert has two causes a bare substring
 *  match cannot tell apart: (a) this exact id already landed on an earlier
 *  attempt whose response was lost — a safe replay — or (b) a DIFFERENT id
 *  already holds the slot (the table's "one live per day/session/week"
 *  partial index, not the primary key) — a genuine second submission for the
 *  same slot. The disabled-button guard now on each plain-submit form
 *  (CheckInForm/RpeForm/NutritionCheckinForm) prevents the fast-double-tap
 *  route to (b) at the source; this is defence in depth for the case it
 *  still happens across two tabs or two devices.
 *
 *  Disambiguates (a) from (b) by asking the *_current view, keyed by the
 *  same identity the slot's own unique index is built from, which id is
 *  actually live. This item's own id live -> (a), safe to dequeue as
 *  delivered. A different id (or an unexpected empty result) -> (b): this
 *  submission never reached the server and must not be discarded silently
 *  (CLAUDE.md §2 rule 6). 'unknown' means the lookup itself could not
 *  complete (still no signal) — treated the same as any other retry-later
 *  failure, never guessed in either direction. */
async function resolveWellnessConflict(
  db: Db,
  athleteId: string,
  item: PendingWellness,
): Promise<ConflictOutcome> {
  try {
    const current = await fetchWellnessDay(db, athleteId, item.input.entry_date);
    return current?.id === item.input.id ? 'delivered' : 'conflict';
  } catch {
    return 'unknown';
  }
}

async function resolveTrainingConflict(
  db: Db,
  athleteId: string,
  item: PendingTraining,
): Promise<ConflictOutcome> {
  if (!item.input.session_id) {
    /* RpeForm always submits a real session_id (it's a required prop); this
       branch only exists because TrainingEntryInput's schema also allows
       null for an ad-hoc entry point that is not built yet. With no
       session_id there is nothing to look the slot up against, so this is
       'unknown' rather than a guess. */
    return 'unknown';
  }
  try {
    const current = await fetchTrainingEntryForSession(db, athleteId, item.input.session_id);
    return current?.id === item.input.id ? 'delivered' : 'conflict';
  } catch {
    return 'unknown';
  }
}

async function resolveNutritionConflict(
  db: Db,
  athleteId: string,
  item: PendingNutritionCheckin,
): Promise<ConflictOutcome> {
  try {
    const current = await fetchCheckinForWeek(db, athleteId, item.input.week_start);
    return current?.id === item.input.id ? 'delivered' : 'conflict';
  } catch {
    return 'unknown';
  }
}


export type FlushIdentity = { orgId: string; athleteId: string; userId: string };

/** How many entries are still trying (flagged conflicts excluded). */
export function pendingOutboxCount(): number {
  return (
    pendingWellness().filter((item) => !item.conflictAt).length +
    pendingTraining().filter((item) => !item.conflictAt).length +
    pendingNutritionCheckins().filter((item) => !item.conflictAt).length +
    new Set(pendingGymSetLogs().filter((item) => !item.conflictAt).map((item) => item.input.gym_session_log_id)).size
  );
}

/** Try everything once. A plain no-signal failure leaves the item queued for
 *  the next attempt and is never an error: the athlete has already done the
 *  thing. A slot conflict is flagged (shown on Today, never retried); a policy
 *  refusal on a check-in is flagged as the week having closed (PATTERN-S6
 *  C10). Records the send for the queue screen's empty state when anything
 *  landed. Returns what was sent. */
export async function flushOutbox(db: Db, { orgId, athleteId, userId }: FlushIdentity): Promise<{ sent: number }> {
  const wellnessItems = pendingWellness().filter((item) => !item.conflictAt);
  const trainingItems = pendingTraining().filter((item) => !item.conflictAt);
  const nutritionItems = pendingNutritionCheckins().filter((item) => !item.conflictAt);
  const gymSetCount = pendingGymSetLogs().filter((item) => !item.conflictAt).length;
  if (wellnessItems.length === 0 && trainingItems.length === 0 && nutritionItems.length === 0 && gymSetCount === 0) {
    return { sent: 0 };
  }

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
      if (isDuplicateKeyError(err)) {
        const outcome = await resolveWellnessConflict(db, athleteId, item);
        if (outcome === 'delivered') {
          dequeueWellness(item.input.id);
          sent += 1;
        } else if (outcome === 'conflict') {
          markWellnessConflict(item.input.id);
        }
        /* 'unknown': the lookup itself needed signal too. Falls through
           to still queued, retried next time, same as below. */
      }
      /* Otherwise: still no signal. It stays queued and is tried again
         next time. */
    }
  }

  for (const item of trainingItems) {
    try {
      /* queuedAt travels as submitted_at (§0ad, Builder Q6): the rating
         was made when it was queued, not when the phone reconnected.
         0105's trigger decides whether to believe the phone's clock. */
      await submitTrainingEntry(
        db,
        item.input,
        {
          orgId,
          athleteId,
          userId,
        },
        { submittedAt: item.queuedAt },
      );
      dequeueTraining(item.input.id);
      sent += 1;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const outcome = await resolveTrainingConflict(db, athleteId, item);
        if (outcome === 'delivered') {
          dequeueTraining(item.input.id);
          sent += 1;
        } else if (outcome === 'conflict') {
          markTrainingConflict(item.input.id);
        }
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
      /* PATTERN-S6 C10 (batch A20): the insert policy admits the ISO week
         just ended and the two before it; a check-in queued for longer
         than that is refused by policy (42501), for ever — no retry can
         land it. Flagged once, off the queue count, Discard the way out. */
      if (isPolicyRefusal(err)) {
        markNutritionCheckinClosed(item.input.id);
        continue;
      }
      if (isDuplicateKeyError(err)) {
        const outcome = await resolveNutritionConflict(db, athleteId, item);
        if (outcome === 'delivered') {
          dequeueNutritionCheckin(item.input.id);
          sent += 1;
        } else if (outcome === 'conflict') {
          markNutritionCheckinConflict(item.input.id);
        }
      }
      /* Same reasoning again. */
    }
  }

  /* The gym loop — §0aa's fetch-before-conclude guard included — is
     flushGymSets, shared with the logger (ATH-ADULT-09 C4). */
  const gym = await flushGymSets(db, orgId, athleteId);
  sent += gym.sent;

  if (sent > 0) {
    /* PATTERN-S6 C1: the queue screen's empty state names the last send. */
    recordLastSent({ count: sent, at: new Date().toISOString() });
  }
  return { sent };
}
