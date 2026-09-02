'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  dequeueGymSetLog,
  dequeueNutritionCheckin,
  dequeueTraining,
  dequeueWellness,
  markNutritionCheckinConflict,
  markTrainingConflict,
  markWellnessConflict,
  pendingGymSetLogs,
  pendingNutritionCheckins,
  pendingTraining,
  pendingWellness,
  type PendingNutritionCheckin,
  type PendingTraining,
  type PendingWellness,
} from '@/lib/outbox';
import { submitWellnessEntry, fetchWellnessDay } from '@/lib/queries/wellness';
import { submitTrainingEntry, fetchTrainingEntryForSession } from '@/lib/queries/training';
import { submitCheckin, fetchCheckinForWeek } from '@/lib/queries/nutrition';
import { submitGymSetLog } from '@/lib/queries/programmes';
import { createClient } from '@/lib/supabase/client';
import type { Db } from '@/lib/queries/groups';
import { formatDate } from '@/lib/format';

type Props = { orgId: string; athleteId: string; userId: string; timezone: string };

/** A duplicate-key hit on a plain insert has two causes a bare substring
 *  match cannot tell apart: (a) this exact id already landed on an earlier
 *  attempt whose response was lost — a safe replay — or (b) a DIFFERENT id
 *  already holds the slot (the table's "one live per day/session/week"
 *  partial index, not the primary key) — a genuine second submission for the
 *  same slot. The disabled-button guard now on each plain-submit form
 *  (CheckInForm/RpeForm/NutritionCheckinForm) prevents the fast-double-tap
 *  route to (b) at the source; this is defence in depth for the case it
 *  still happens across two tabs or two devices. */
function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('duplicate key');
}

type ConflictOutcome = 'delivered' | 'conflict' | 'unknown';

/** Disambiguates (a) from (b) above by asking the *_current view, keyed by
 *  the same identity the slot's own unique index is built from, which id is
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

type ConflictDomain = 'wellness' | 'training' | 'nutrition';
type ConflictItem = { domain: ConflictDomain; id: string; label: string };

/** Reads every domain's queue fresh from localStorage and splits it into
 *  "still trying" (the pending count) and "flagged as a real, unresolved
 *  conflict" (see PendingWellness's own conflictAt comment in lib/outbox.ts).
 *  Gym set logs have no conflictAt (this pass's disambiguation is scoped to
 *  the three plain-submit forms named in the integration audit's majors fix,
 *  not gym logging's own separate UI), so every queued gym item still counts
 *  as plain "pending". Module scope, not a hook: it closes over nothing
 *  reactive, so defining it once here keeps it a stable reference for both
 *  the flush effect and the discard handler below without an
 *  exhaustive-deps concern. */
function snapshot(timezone: string): { pendingCount: number; conflicts: ConflictItem[] } {
  const wellness = pendingWellness();
  const training = pendingTraining();
  const nutrition = pendingNutritionCheckins();
  const gym = pendingGymSetLogs();

  const conflicts: ConflictItem[] = [
    ...wellness
      .filter((item) => item.conflictAt)
      .map((item) => ({
        domain: 'wellness' as const,
        id: item.input.id,
        label: `your check-in for ${formatDate(item.input.entry_date, timezone)}`,
      })),
    ...training
      .filter((item) => item.conflictAt)
      .map((item) => ({
        domain: 'training' as const,
        id: item.input.id,
        label: `your rating for ${formatDate(item.input.entry_date, timezone)}`,
      })),
    ...nutrition
      .filter((item) => item.conflictAt)
      .map((item) => ({
        domain: 'nutrition' as const,
        id: item.input.id,
        label: `your check-in for the week of ${formatDate(item.input.week_start, timezone)}`,
      })),
  ];

  const pendingCount =
    wellness.filter((item) => !item.conflictAt).length +
    training.filter((item) => !item.conflictAt).length +
    nutrition.filter((item) => !item.conflictAt).length +
    gym.length;

  return { pendingCount, conflicts };
}

function discardConflict(domain: ConflictDomain, id: string): void {
  if (domain === 'wellness') dequeueWellness(id);
  if (domain === 'training') dequeueTraining(id);
  if (domain === 'nutrition') dequeueNutritionCheckin(id);
}

/** Retries anything a check-in, an RPE rating, the weekly nutrition check-in
 *  or a gym set could not send. Runs once on load and again when the browser
 *  says it is back online. A plain no-signal failure is never shown as an
 *  error: the athlete has already done the thing, and it stays queued for
 *  the next attempt. A genuine slot conflict (see isDuplicateKeyError /
 *  resolve*Conflict above) is the one queued-write outcome that IS shown,
 *  because unlike "no signal yet" it will never resolve itself by retrying —
 *  the athlete needs to know one of their entries did not actually save. */
export function OutboxFlusher({ orgId, athleteId, userId, timezone }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function flush() {
      const before = snapshot(timezone);
      if (!cancelled) {
        setPending(before.pendingCount);
        setConflicts(before.conflicts);
      }

      // Items already flagged as a conflict are excluded from retry: retrying
      // would just repeat the same collision every flush until the athlete
      // discards it (see lib/outbox.ts's conflictAt comment).
      const wellnessItems = pendingWellness().filter((item) => !item.conflictAt);
      const trainingItems = pendingTraining().filter((item) => !item.conflictAt);
      const nutritionItems = pendingNutritionCheckins().filter((item) => !item.conflictAt);
      const gymSetItems = pendingGymSetLogs();
      if (
        wellnessItems.length === 0 &&
        trainingItems.length === 0 &&
        nutritionItems.length === 0 &&
        gymSetItems.length === 0
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
          await submitTrainingEntry(db, item.input, {
            orgId,
            athleteId,
            userId,
          });
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

      for (const item of gymSetItems) {
        try {
          await submitGymSetLog(db, orgId, item.input);
          dequeueGymSetLog(item.input.id);
          sent += 1;
        } catch (err) {
          if (isDuplicateKeyError(err)) {
            dequeueGymSetLog(item.input.id);
            sent += 1;
          }
          /* Gym set logs keep the original assume-it's-my-own-replay
             behaviour: this pass's disambiguation (integration-audit majors
             fix) is scoped to the three plain-submit forms with the button
             double-tap race — CheckInForm, RpeForm, NutritionCheckinForm.
             GymSessionLogger is a different UI, not covered here; applying
             the same fetch-before-conclude guard to gym_set_logs_current is
             a reasonable follow-up but a separate, out-of-scope change. */
        }
      }

      if (cancelled) return;
      const after = snapshot(timezone);
      setPending(after.pendingCount);
      setConflicts(after.conflicts);
      if (sent > 0) router.refresh();
    }

    void flush();
    window.addEventListener('online', flush);
    return () => {
      cancelled = true;
      window.removeEventListener('online', flush);
    };
  }, [orgId, athleteId, userId, timezone, router]);

  function handleDiscard(domain: ConflictDomain, id: string) {
    discardConflict(domain, id);
    const after = snapshot(timezone);
    setPending(after.pendingCount);
    setConflicts(after.conflicts);
  }

  if (pending === 0 && conflicts.length === 0) return null;

  return (
    <>
      {conflicts.map((c) => (
        <p
          key={`${c.domain}-${c.id}`}
          className="banner"
          role="alert"
          style={{ marginBottom: 12, borderColor: 'var(--warn)' }}
        >
          <span className="g g-warn" aria-hidden="true">
            !
          </span>
          <span>
            One saved entry could not be sent: you already have {c.label} from
            another tab or device, and that one is what is showing.{' '}
            <button type="button" className="btn-ghost" onClick={() => handleDiscard(c.domain, c.id)}>
              Discard this one
            </button>
          </span>
        </p>
      ))}
      {pending > 0 ? (
        <p className="tiny" role="status">
          <span aria-hidden="true">☁ </span>
          <span className="num">{pending}</span> entr
          {pending === 1 ? 'y is' : 'ies are'} saved on this phone and will send when
          you have signal.
        </p>
      ) : null}
    </>
  );
}
