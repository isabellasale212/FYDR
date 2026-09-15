'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  dequeueGymSetLog,
  dequeueNutritionCheckin,
  dequeueTraining,
  dequeueWellness,
  pendingGymSetLogs,
  pendingNutritionCheckins,
  pendingTraining,
  pendingWellness,
} from '@/lib/outbox';
import { reviseGymSetLog } from '@/lib/queries/programmes';
import { describeGymSet } from '@/lib/gymSetConflict';
import { flushOutbox } from '@/lib/outboxFlush';
import { createClient } from '@/lib/supabase/client';
import { clockHM, formatDate } from '@/lib/format';

type Props = { orgId: string; athleteId: string; userId: string; timezone: string };

/* The resolvers and the flush itself are lib/outboxFlush.ts since 2026-09-14
   (the queue screen's Send now runs the same function). */
/* The gym version — §0aa — is resolveGymSetConflict in lib/gymOutboxFlush.ts,
   shared with the logger since ATH-ADULT-09 C4. */

type ConflictDomain = 'wellness' | 'training' | 'nutrition' | 'gym';
type ConflictItem = {
  domain: ConflictDomain;
  id: string;
  label: string;
  /** Nutrition only (PATTERN-S6 C10): the week had closed when the check-in
   *  reached the database. Not a conflict with a live row — nothing is
   *  showing instead — so the sentence says what happened and the only
   *  control is the discard. */
  closedWeek?: boolean;
  /** Gym only: the two sets of numbers, and whether "Use my numbers" can be
   *  offered (it needs a live row to correct). */
  gym?: { queued: string; live: string | null; liveId: string | null; closedLog: boolean };
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
        closedWeek: item.closedWeek === true,
      })),
    ...gym
      .filter((item) => item.conflictAt)
      .map((item) => {
        const live = item.conflictLive ?? null;
        const naming = live ?? item.closedLog ?? null;
        const name = naming?.exercise_name ?? 'this exercise';
        const day = naming?.entry_date ? ` on ${formatDate(naming.entry_date, timezone)}` : '';
        return {
          domain: 'gym' as const,
          id: item.input.id,
          label: `set ${item.input.set_number} of ${name}${day}`,
          gym: {
            queued: describeGymSet(item.input),
            live: live ? describeGymSet(live) : null,
            liveId: live?.id ?? null,
            closedLog: item.closedLog !== undefined,
          },
        };
      }),
  ];

  /* Entries, not writes (PATTERN-S6 C1, 2026-09-13): a gym session's queued
     sets are one entry however many there are — the count here is the count
     the queue screen heads with ("4 entries · 5 writes"), so the two agree. */
  const pendingCount =
    wellness.filter((item) => !item.conflictAt).length +
    training.filter((item) => !item.conflictAt).length +
    nutrition.filter((item) => !item.conflictAt).length +
    new Set(gym.filter((item) => !item.conflictAt).map((item) => item.input.gym_session_log_id)).size;

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
  /* PATTERN-S6 A1 (2026-09-12): a send that worked changes the count in
     place, once — "3 entries sent at 12:04. Nothing is waiting." in the same
     status region the waiting line used, then gone on the next load. Set
     only by a flush that sent something, so it is keyed to the state (what
     landed), not to the event: a second `online` with nothing to send shows
     nothing, and it can never appear twice for one send. Never a toast. */
  const [sentAt, setSentAt] = useState<{ count: number; at: string } | null>(null);

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
      const { sent } = await flushOutbox(createClient(), { orgId, athleteId, userId });

      if (cancelled) return;
      const after = snapshot(timezone);
      setPending(after.pendingCount);
      setConflicts(after.conflicts);
      if (sent > 0) {
        setSentAt({
          count: sent,
          at: clockHM(new Date(), timezone),
        });
        router.refresh();
      }
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

  if (pending === 0 && conflicts.length === 0 && sentAt === null) return null;

  return (
    <>
      {/* PATTERN-S6 B2: a conflict is a lost answer, not a caution — the bad
          tone, not warn. "Discard this one" / "Keep what is showing" stay
          ghost controls inside the notice and nowhere else.

          PATTERN-S6 C9 (2026-09-13): ONE alert region for all of them, not one
          per conflict. Two conflicts landing in one flush used to mount two
          role="alert" nodes at once and announce twice; the region now wraps
          the list and announces once per transition (a discard changes its
          content and is announced once; the last discard removes it). The
          per-conflict banners keep their look and lose their role. Absent
          entirely with nothing in conflict — no empty region. */}
      {conflicts.length > 0 ? (
        <div role="alert">
        {conflicts.map((c) => (
          <p
            key={`${c.domain}-${c.id}`}
            className="banner outbox-conflict"
            style={{ marginBottom: 'var(--sp-12)' }}
          >
            <span className="g g-bad" aria-hidden="true">
              !
            </span>
            <span>
              {c.gym?.closedLog ? (
                /* §0bc (0110): the session was complete when the set arrived.
                   No live row to correct with these numbers, so no "Use my
                   numbers" — the numbers are said, the way out is named, and
                   the only control is the discard. */
                <>
                  One saved set could not be sent: the session was finished before this set was sent, so
                  the database refused {c.label}. Your queued numbers were {c.gym.queued} — correct a logged
                  set from My data if they belong there.
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-8)', marginTop: 'var(--sp-8)' }}>
                    <button type="button" className="btn-ghost" onClick={() => handleDiscard(c.domain, c.id)}>
                      Discard this one
                    </button>
                  </span>
                </>
              ) : c.gym ? (
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
              ) : c.closedWeek ? (
                /* PATTERN-S6 C10: refused by policy, not by a live row. Said
                   once, with the one control that makes sense. */
                <>
                  One saved check-in could not be sent: the week has closed, so the database refused {c.label}.
                  A check-in can be sent for the week just ended and the two before it, not for one older than
                  that.{' '}
                  <button type="button" className="btn-ghost" onClick={() => handleDiscard(c.domain, c.id)}>
                    Discard this one
                  </button>
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
        </div>
      ) : null}
      {/* ONE status region, whichever line it carries: the waiting count
          (B1, the good-tone card — held is a promise kept, not a warning;
          the sentence is unchanged) or, after a flush that sent, the sent
          line (A1, a plain --surf card: information, not a state). With
          nothing waiting and nothing just sent there is no region at all —
          the screen does not offer an empty list. */}
      {pending > 0 ? (
        <p className="banner outbox-waiting" role="status" style={{ marginBottom: 'var(--sp-12)' }}>
          <span className="g g-good" aria-hidden="true">
            ☁
          </span>
          <span>
            <span className="num">{pending}</span> entr
            {pending === 1 ? 'y is' : 'ies are'} saved on this phone and will send when
            you have signal.
            {/* PATTERN-S6 C1 (2026-09-13): the only route to the queue screen,
                under the count, absent with nothing waiting. */}
            <Link href="/today/waiting" className="linklike" style={{ display: 'block', marginTop: 'var(--sp-4)' }}>
              See what is waiting
            </Link>
          </span>
        </p>
      ) : sentAt ? (
        <p className="banner outbox-sent" role="status" style={{ marginBottom: 'var(--sp-12)' }}>
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            <span className="num">{sentAt.count}</span> entr{sentAt.count === 1 ? 'y' : 'ies'} sent at{' '}
            <span className="num">{sentAt.at}</span>. Nothing is waiting.
          </span>
        </p>
      ) : null}
    </>
  );
}
