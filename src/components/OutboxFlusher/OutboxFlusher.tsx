'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  dequeueGymSetLog,
  dequeueNutritionCheckin,
  dequeueTraining,
  dequeueWellness,
  markGymSetConflict,
  markNutritionCheckinConflict,
  markTrainingConflict,
  markWellnessConflict,
  pendingGymSetLogs,
  pendingNutritionCheckins,
  pendingTraining,
  pendingWellness,
  type PendingGymSetLog,
  type PendingNutritionCheckin,
  type PendingTraining,
  type PendingWellness,
} from '@/lib/outbox';
import { submitWellnessEntry, fetchWellnessDay } from '@/lib/queries/wellness';
import { submitTrainingEntry, fetchTrainingEntryForSession } from '@/lib/queries/training';
import { submitCheckin, fetchCheckinForWeek } from '@/lib/queries/nutrition';
import { fetchGymSetForSlot, fetchGymSetNaming, reviseGymSetLog, submitGymSetLog } from '@/lib/queries/programmes';
import { classifyGymSetConflict, describeGymSet } from '@/lib/gymSetConflict';
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

/** The gym version — §0aa, decided 2026-09-12. Same shape as the three above,
 *  with one more thing to say: gym is the domain where "another row is live"
 *  can still mean the athlete's numbers are safe (a second tab logged the
 *  SAME set), and where a different row is a loss of their numbers, not just
 *  a duplicate. So the lookup returns the row's values, the decision compares
 *  them (lib/gymSetConflict.ts), and a real conflict stores what is live so
 *  Today can show both sets of numbers. */
async function resolveGymSetConflict(
  db: Db,
  athleteId: string,
  item: PendingGymSetLog,
): Promise<ConflictOutcome> {
  void athleteId; // RLS scopes gym_set_logs_current to the athlete's own rows
  try {
    const live = await fetchGymSetForSlot(db, item.input);
    if (classifyGymSetConflict(item.input, live) === 'delivered') return 'delivered';
    const naming = await fetchGymSetNaming(db, item.input.exercise_id, item.input.gym_session_log_id);
    markGymSetConflict(item.input.id, live ? { ...live, ...naming } : null);
    return 'conflict';
  } catch {
    return 'unknown';
  }
}

type ConflictDomain = 'wellness' | 'training' | 'nutrition' | 'gym';
type ConflictItem = {
  domain: ConflictDomain;
  id: string;
  label: string;
  /** Gym only: the two sets of numbers, and whether "Use my numbers" can be
   *  offered (it needs a live row to correct). */
  gym?: { queued: string; live: string | null; liveId: string | null };
};

/** Reads every domain's queue fresh from localStorage and splits it into
 *  "still trying" (the pending count) and "flagged as a real, unresolved
 *  conflict" (see PendingWellness's own conflictAt comment in lib/outbox.ts).
 *  Gym set logs joined the other three on 2026-09-12 (§0aa) — a flagged gym
 *  item is a conflict, not pending. Module scope, not a hook: it closes over nothing
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
    ...gym
      .filter((item) => item.conflictAt)
      .map((item) => {
        const live = item.conflictLive ?? null;
        const name = live?.exercise_name ?? 'this exercise';
        const day = live?.entry_date ? ` on ${formatDate(live.entry_date, timezone)}` : '';
        return {
          domain: 'gym' as const,
          id: item.input.id,
          label: `set ${item.input.set_number} of ${name}${day}`,
          gym: {
            queued: describeGymSet(item.input),
            live: live ? describeGymSet(live) : null,
            liveId: live?.id ?? null,
          },
        };
      }),
  ];

  const pendingCount =
    wellness.filter((item) => !item.conflictAt).length +
    training.filter((item) => !item.conflictAt).length +
    nutrition.filter((item) => !item.conflictAt).length +
    gym.filter((item) => !item.conflictAt).length;

  return { pendingCount, conflicts };
}

function discardConflict(domain: ConflictDomain, id: string): void {
  if (domain === 'wellness') dequeueWellness(id);
  if (domain === 'training') dequeueTraining(id);
  if (domain === 'nutrition') dequeueNutritionCheckin(id);
  if (domain === 'gym') dequeueGymSetLog(id);
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
      const gymSetItems = pendingGymSetLogs().filter((item) => !item.conflictAt);
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
            /* §0aa (2026-09-12): the same fetch-before-conclude guard as the
               three loops above. It used to dequeue here unconditionally —
               every collision read as the athlete's own replay — so a set
               queued offline whose slot another tab had since filled with
               different numbers was dropped without a word. */
            const outcome = await resolveGymSetConflict(db, athleteId, item);
            if (outcome === 'delivered') {
              dequeueGymSetLog(item.input.id);
              sent += 1;
            }
            /* 'conflict' is already marked by the resolver; 'unknown' stays
               queued for the next flush, like any other no-signal failure. */
          }
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

  /** Gym only: the athlete keeps THEIR numbers by correcting the live set
   *  with them — the same revise_gym_set_log path the logger and My data
   *  use, so the other tab's row is kept as superseded and My data marks
   *  the session corrected. Online only, as every correction is; a failure
   *  leaves the conflict on screen to try again or discard. */
  const [correcting, setCorrecting] = useState<string | null>(null);
  async function handleUseMine(id: string) {
    const item = pendingGymSetLogs().find((i) => i.input.id === id);
    const liveId = item?.conflictLive?.id;
    if (!item || !liveId) return;
    setCorrecting(id);
    try {
      const result = await reviseGymSetLog(createClient(), liveId, {
        reps_completed: item.input.reps_completed,
        load_kg: item.input.load_kg,
        rpe: item.input.rpe,
      });
      if (result.error) return;
      dequeueGymSetLog(id);
      const after = snapshot(timezone);
      setPending(after.pendingCount);
      setConflicts(after.conflicts);
      router.refresh();
    } finally {
      setCorrecting(null);
    }
  }

  if (pending === 0 && conflicts.length === 0) return null;

  return (
    <>
      {conflicts.map((c) => (
        <p
          key={`${c.domain}-${c.id}`}
          className="banner"
          role="alert"
          style={{ marginBottom: 'var(--sp-12)', borderColor: 'var(--warn)' }}
        >
          <span className="g g-warn" aria-hidden="true">
            !
          </span>
          <span>
            {c.gym ? (
              <>
                One saved set could not be sent: {c.label} is already logged
                {c.gym.live ? ` as ${c.gym.live}` : ''} from another tab or device, and that one
                is what is showing. Your queued numbers were {c.gym.queued}.
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-8)', marginTop: 'var(--sp-8)' }}>
                  {c.gym.liveId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={correcting === c.id}
                      onClick={() => void handleUseMine(c.id)}
                    >
                      {correcting === c.id ? 'Saving…' : 'Use my numbers'}
                    </button>
                  ) : null}
                  <button type="button" className="btn-ghost" onClick={() => handleDiscard(c.domain, c.id)}>
                    Keep what is showing
                  </button>
                </span>
              </>
            ) : (
              <>
                One saved entry could not be sent: you already have {c.label} from
                another tab or device, and that one is what is showing.{' '}
                <button type="button" className="btn-ghost" onClick={() => handleDiscard(c.domain, c.id)}>
                  Discard this one
                </button>
              </>
            )}
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
