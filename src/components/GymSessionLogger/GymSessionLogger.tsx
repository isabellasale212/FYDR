'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  completeSessionLog,
  reviseGymSetLog,
  submitGymSetLog,
  type LoggedSet,
  type ResolvedExercise,
} from '@/lib/queries/programmes';
import { enqueueGymSetLog, dequeueGymSetLog } from '@/lib/outbox';
import { flagClosedGymSet, flushGymSets, isClosedLogError, queuedGymSets } from '@/lib/gymOutboxFlush';
import { GymSetLogInput } from '@/lib/validation/gym';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { loadLabel, schemeLine } from '@/lib/gymPrescription';
import { acquireWakeLock, buzz, releaseWakeLock } from '@/lib/wakeLock';
import { bestSetsByExercise, formatKg, minutesBetween, newBests, sessionVolumeKg, setsLine, wasLine, type PriorBest } from '@/lib/gymSummary';
import { formatDate } from '@/lib/format';

function elapsed(startedAt: string | null, now: number): string {
  if (!startedAt) return '00:00';
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

type Props = {
  orgId: string;
  /** For the queued-set retry's conflict lookup (lib/gymOutboxFlush.ts). */
  athleteId: string;
  gymSessionLogId: string;
  sessionName: string;
  /** Programme, block, week and day — the design's eyebrow above the name. */
  sessionMeta: string | null;
  /** When the session log was opened.
   *
   *  RESTORED 8 September 2026. The redesign dropped the elapsed clock with the
   *  Close link, on the argument that the eyebrow's planned duration covers it.
   *  It does not: "55 MIN" is what the session is meant to take, and an athlete
   *  forty minutes into it has no way to know that from the plan. */
  startedAt: string | null;
  /** When the session was finished — the "52 min" on the summary. */
  completedAt: string | null;
  /** MET-040 before today, per exercise, read by the page only for a
   *  complete session (ATH-ADULT-09 C6). An array, not a Map: it crosses the
   *  server → client boundary. */
  priorBests: readonly (PriorBest & { exercise_id: string })[];
  /** ATH-ADULT-11 C2: each live set that is a correction, with the values it
   *  replaced — the strip "Set 1 corrected · was 100 kg × 8". */
  corrections: readonly { id: string; was: { reps_completed: number | null; load_kg: number | null } }[];
  totalSets: number;
  timezone: string;
  exercises: readonly ResolvedExercise[];
  loggedSets: readonly LoggedSet[];
  alreadyComplete: boolean;
  /** ATH-ADULT-13 C2 (2026-09-13): open on this set's correction — the
   *  history's row-tap. Resolved against the logged sets; a stale id opens
   *  nothing. */
  openCorrectionId?: string | null;
};

/* 'kg' is only a safe assumption for absolute loads on genuinely loaded
 * categories — audit finding 31's confirmed example is live data: Box jump
 * is prescribed absolute=60 where 60 is a box height in cm, not a kg load.
 * plyo/conditioning/mobility exercises show the bare number instead of
 * asserting a unit the schema does not track; notes (shown separately by the
 * caller, if present) carry the real unit until this domain has a
 * measurement_type column — real, open gap, too large for this pass. */
/* loadLabel, schemeLabel and the head's line live in lib/gymPrescription.ts
   since §0u (2026-09-12): the line carries a load VALUE or nothing, the
   weight row carries the reason there is none. */

/** "102.5 kg × 8" / "8 reps" / "" — what a tap will write, on the button. */
function setWords(weight: number | null, reps: number | null): string {
  if (weight !== null && reps !== null) return `${formatKg(weight)} kg × ${reps}`;
  if (weight !== null) return `${formatKg(weight)} kg`;
  if (reps !== null) return `${reps} rep${reps === 1 ? '' : 's'}`;
  return '';
}

/** A real minus sign, never a hyphen: "+2.5" / "−2.5". */
function signed(delta: number): string {
  const v = Math.round(Math.abs(delta) * 100) / 100;
  return `${delta >= 0 ? '+' : '−'}${formatKg(v)}`;
}

/**
 * The athlete gym logger — rebuilt set by set on 2026-09-12 (ATH-ADULT-09
 * C1, approved by Isabella with two new tokens, --hit-lg 56px and --hit-md
 * 52px; ATH-ADULT-10 C1 moves Finish early into the header; ATH-ADULT-11 C1
 * swaps the footer for Save correction / Cancel while a correction is open).
 *
 * THE TWO NUMBERS ARE THE SCREEN. One exercise at a time: its set chips as
 * the state display (logged = accent + ✓ and the correction target; current
 * = accent tint with the ring; not reached = --faint on --surf2 and not a
 * control), then the weight and the reps at --fs-48 in tabular figures
 * between two 52px steppers each, with the prescription beneath as
 * reference ("Prescribed 100 kg · +2.5" in --muted when the athlete moves
 * off it — information, not a warning). Bodyweight exercises log reps only.
 * The footer holds the one primary, labelled with what it writes: "Log set
 * 2 · 100 kg × 8" at 56px. What is next is stated beneath the card ("THEN
 * Romanian deadlift · 3 × 8 · 80 kg"), never behind a disclosure. The header
 * never scrolls away; Finish early lives there, dashed and neutral, while
 * sets remain; "Finish session" takes the footer once every set is logged.
 *
 * Full screen, not a sheet — ATHLETE-APP-SPEC.md §9 is explicit this is a
 * place used repeatedly through a session. What the athlete logs is what
 * they did: the prescription is the prefill, the steppers move it.
 *
 * Kept from before the rebuild, unchanged in what they do: the offline
 * outbox (a tap queues the set before the write, the logger and Today
 * retry it), the Wake Lock and the haptic (C5), the correction path
 * (ADR-005's revise, online only), the summaries (C6 / 10 C3), the
 * corrected strip (11 C2), the elapsed clock.
 */
export function GymSessionLogger({
  orgId,
  athleteId,
  gymSessionLogId,
  sessionName,
  sessionMeta,
  startedAt,
  completedAt,
  priorBests,
  corrections,
  totalSets,
  timezone,
  exercises,
  loggedSets,
  alreadyComplete,
  openCorrectionId = null,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  /* The athlete's adjusted weight and reps per exercise, keyed by
   * programme_exercise_id. Empty until they touch a stepper — the
   * prescription is the value until then, so an untouched exercise shows the
   * coach's number rather than a copy of it that has stopped tracking
   * changes. Persisted per gym_session_log_id so an athlete who takes a
   * phone call mid-set finds their adjustment where they left it; cleared
   * when the session is finished. localStorage rather than the database on
   * purpose: an unlogged adjustment is a draft, not an entry. Every access
   * is guarded — private windows and blocked site data throw. */
  const draftKey = `fydr-gym-draft-${gymSessionLogId}`;
  type Adjust = { weight?: number; reps?: number };
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});

  /* The screen stays on for the session (ATH-ADULT-09 C5, approved
     2026-09-12): a phone that dims between sets is the phone the athlete
     has to unlock twelve times. Feature-detected in lib/wakeLock.ts — absent
     or refused means the screen dims as it always did. The browser drops a
     lock when the tab hides, so it is asked for again when the tab is back;
     released on leaving the screen. */
  useEffect(() => {
    let sentinel: Awaited<ReturnType<typeof acquireWakeLock>> = null;
    let gone = false;
    const acquire = async () => {
      if (gone || document.visibilityState !== 'visible') return;
      sentinel = await acquireWakeLock(navigator);
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVisible);
      void releaseWakeLock(sentinel);
    };
  }, []);

  /* ATH-ADULT-09 C4 (2026-09-12): this session's queued sets are retried
     from here — on open, and the moment the browser says it is back online
     — not only by Today's flusher. `waiting` is what the progress row calls
     "· 2 waiting to send"; it is read from the outbox in an effect so the
     server render and the first client render agree (the server has no
     outbox). A retry that lands refreshes the page so the sets appear as
     logged rows. */
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let gone = false;
    const retry = async () => {
      setWaiting(queuedGymSets(gymSessionLogId));
      if (queuedGymSets(gymSessionLogId) === 0) return;
      const { sent } = await flushGymSets(createClient(), orgId, athleteId, { sessionLogId: gymSessionLogId });
      if (gone) return;
      setWaiting(queuedGymSets(gymSessionLogId));
      if (sent > 0) {
        /* The "check your signal" line from the failed tap is stale once the
           set has landed — measured: it stayed on screen after the retry. */
        setError(null);
        router.refresh();
      }
    };
    void retry();
    window.addEventListener('online', retry);
    return () => {
      gone = true;
      window.removeEventListener('online', retry);
    };
  }, [orgId, athleteId, gymSessionLogId, router]);

  // Restored in an effect, not in the initial state, so the server render and
  // the first client render agree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) setAdjust(JSON.parse(raw) as Record<string, Adjust>);
    } catch {
      /* Unreadable or malformed storage: start empty. A lost adjustment is
       * a nuisance; a screen that will not render because of one is worse. */
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      const hasContent = Object.values(adjust).some((a) => a.weight !== undefined || a.reps !== undefined);
      if (hasContent) window.localStorage.setItem(draftKey, JSON.stringify(adjust));
      else window.localStorage.removeItem(draftKey);
    } catch {
      /* Storage unavailable. The adjustment still lives in React for this
       * session; it just will not survive the app closing. */
    }
  }, [adjust, draftKey]);

  const [sessionRpe, setSessionRpe] = useState('');
  const [now, setNow] = useState<number | null>(null);
  /* The set being corrected, by its live id — reached from a logged chip.
     While it is open the two numbers edit the correction and the footer
     reads Save correction / Cancel (ATH-ADULT-11 C1). */
  const openRow = openCorrectionId ? (loggedSets.find((r) => r.id === openCorrectionId) ?? null) : null;
  const [correcting, setCorrecting] = useState<string | null>(openRow?.id ?? null);
  const [corr, setCorr] = useState<{ weight: number | null; reps: number | null }>(
    openRow ? { weight: openRow.load_kg, reps: openRow.reps_completed } : { weight: null, reps: null },
  );
  /* The set that just landed, for the "Set 2 logged · 102.5 kg × 8 · Correct
     it" strip above the card. */
  const [lastLoggedId, setLastLoggedId] = useState<string | null>(null);

  /* Ticks only while the session is open and only when there is a start to
     count from, so a completed session does not keep a timer alive. */
  useEffect(() => {
    if (alreadyComplete || !startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [alreadyComplete, startedAt]);

  const setsByExercise = useMemo(() => {
    const map = new Map<string, LoggedSet[]>();
    for (const s of loggedSets) {
      const key = s.programme_exercise_id ?? s.exercise_id;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [loggedSets]);

  const doneCount = loggedSets.length;
  const pct = totalSets > 0 ? Math.round((doneCount / totalSets) * 100) : 0;

  /* THE SUMMARIES — ATH-ADULT-09 C6 (session complete) and ATH-ADULT-10 C3
     (finished early), 2026-09-12. Once the session is closed the set list
     gives way to a summary; "Correct a set" brings the exercises back beneath
     it. The two must not be mistaken for each other: complete is the one
     screen allowed to be pleased — total volume first (MET-041, the number
     that grows over a block), sets done, then the new bests with what they
     beat and when (MET-040) so the claim is checkable; early has a different
     title, a dashed card, per-exercise rows that read "Not logged", and no
     totals block at all. No gradient, no confetti, no praise copy. */
  const [showSets, setShowSets] = useState(openRow !== null);
  const finishedEarly = alreadyComplete && doneCount < totalSets;
  const summarySets = loggedSets.map((r) => ({
    exercise_id: r.exercise_id,
    set_number: r.set_number,
    reps_completed: r.reps_completed,
    load_kg: r.load_kg,
  }));
  const volumeKg = sessionVolumeKg(summarySets);
  const priorByExercise = new Map(priorBests.map((b) => [b.exercise_id, b]));
  const bests = newBests(
    exercises.map((ex) => ex.exercise_id),
    summarySets,
    priorByExercise,
  );
  const bestToday = bestSetsByExercise(summarySets);
  const minutes = minutesBetween(startedAt, completedAt);
  const setsFor = (ex: ResolvedExercise) => summarySets.filter((r) => r.exercise_id === ex.exercise_id);
  const nameById = new Map(exercises.map((ex) => [ex.exercise_id, ex.exercise_name]));
  const correctedIds = new Set(corrections.map((c) => c.id));

  /* The exercise being worked on: the FIRST with sets still to log, in
     prescribed order. First rather than "the one most recently touched"
     because a programme is an order — the athlete works down it — and
     because "most recent" would move the highlight backwards the moment
     somebody corrected an earlier set. Once every exercise is complete
     nothing is active: there is nothing to do, and the footer says so. */
  const activeIndex = exercises.findIndex((ex) => (setsByExercise.get(ex.programme_exercise_id) ?? []).length < ex.sets);
  const active = activeIndex >= 0 ? (exercises[activeIndex] ?? null) : null;
  const nextExercises = activeIndex >= 0 ? exercises.slice(activeIndex + 1) : [];
  /* A logged set of an exercise that is no longer active (the last set of
     the exercise before) is corrected from the strip; the card it belongs
     to is drawn for the correction so the numbers have somewhere to be. */
  const correctingRow = correcting ? (loggedSets.find((r) => r.id === correcting) ?? null) : null;
  const correctingExercise = correctingRow
    ? (exercises.find((ex) => ex.programme_exercise_id === correctingRow.programme_exercise_id) ?? null)
    : null;
  const card = correctingExercise ?? active;

  /* Bounded (ten seconds) and has a real onError — before this, a thrown network failure
   * showed nothing at all and a hung request pinned the tick button disabled forever
   * (audit S5's shape, on the screen whose footer promises "sets save as you log them").
   * A failed set stays on screen as the next set to log: tapping the primary again is the
   * retry, now safely idempotent (migration 0044's gym_set_logs_one_live_per_slot index).
   *
   * Also enqueued into the offline outbox (blocker B4): onMutate queues it before the
   * write is even attempted, onSuccess dequeues it. If the write fails, the item stays
   * queued and the retry — from this screen on `online` (C4), or from Today — sends it
   * later even if the athlete never taps again or the app is closed mid-set. The visible
   * error and the tap-to-retry are the fast path, the queue is the safety net underneath
   * it: this screen stays open for up to 45 minutes and the athlete needs to know, right
   * now, whether the set they just tapped actually saved. */
  const logMutation = useMutation({
    mutationFn: async (input: GymSetLogInput) => {
      await withWriteTimeout(submitGymSetLog(createClient(), orgId, input));
    },
    onMutate: (input) => {
      enqueueGymSetLog(input);
    },
    onSuccess: (_void, input) => {
      dequeueGymSetLog(input.id);
      /* Felt, not heard: a 10 ms buzz where the browser has one (Android
         Chrome), nothing on iPhone Safari — ATH-ADULT-09 C5. */
      buzz(navigator);
      setLastLoggedId(input.id);
      setError(null);
      router.refresh();
    },
    onError: (err, input) => {
      setError(toUserMessage(err, 'athlete'));
      /* §0bc: the session was finished — from another tab, or this one before
         the set landed. The database will refuse this set every time, so it
         is flagged rather than left "waiting to send": Today shows the
         numbers once with a Discard, the same shape as §0aa's conflict. */
      if (isClosedLogError(err)) void flagClosedGymSet(createClient(), { input, queuedAt: new Date().toISOString() });
    },
    /* Sent or not, the waiting count is read back from the outbox: a failed
       set is now "waiting to send" on the progress row as well as an error. */
    onSettled: () => setWaiting(queuedGymSets(gymSessionLogId)),
  });

  /* What the coach set, resolved for this athlete: an absolute kg prescription,
     or a percent_1rm already resolved against their own latest 1RM (migration
     0043). Every other basis — bodyweight, percent of bodyweight, an RPE target
     — has no kilogram to show, and returns null rather than a number this
     screen would be inventing. */
  function recommendedFor(ex: ResolvedExercise): number | null {
    if (ex.load_basis === 'absolute') return ex.load_value;
    if (ex.load_basis === 'percent_1rm') return ex.resolved_load_kg;
    return null;
  }

  function weightFor(ex: ResolvedExercise): number | null {
    const own = adjust[ex.programme_exercise_id]?.weight;
    return own !== undefined ? own : recommendedFor(ex);
  }

  /* The prescribed reps are the prefill; reps_min when a range is set. */
  function prescribedReps(ex: ResolvedExercise): number | null {
    return ex.reps_min ?? ex.reps_max ?? null;
  }

  function repsFor(ex: ResolvedExercise): number | null {
    const own = adjust[ex.programme_exercise_id]?.reps;
    return own !== undefined ? own : prescribedReps(ex);
  }

  /* The step is the exercise's own (ex.weight_step_kg, migration 0108 —
     ATH-ADULT-09 C3): 2.5 a plate a side, 2 for a dumbbell, 1.25 microloaded.
     Never below zero, and rounded so a chain of taps cannot drift onto
     0.30000000000000004. */
  function bumpWeight(ex: ResolvedExercise, delta: number) {
    const base = weightFor(ex);
    if (base === null) return;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setAdjust((a) => ({ ...a, [ex.programme_exercise_id]: { ...a[ex.programme_exercise_id], weight: next } }));
  }

  function bumpReps(ex: ResolvedExercise, delta: number) {
    const base = repsFor(ex) ?? 0;
    const next = Math.max(0, base + delta);
    setAdjust((a) => ({ ...a, [ex.programme_exercise_id]: { ...a[ex.programme_exercise_id], reps: next } }));
  }

  function openCorrection(row: LoggedSet) {
    setError(null);
    setCorr({ weight: row.load_kg, reps: row.reps_completed });
    setCorrecting(row.id);
  }

  function closeCorrection() {
    setCorrecting(null);
    setCorr({ weight: null, reps: null });
  }

  function buildSetInput(ex: ResolvedExercise, setNumber: number, reps: number | null, load: number | null): GymSetLogInput | null {
    const candidate = {
      id: crypto.randomUUID(),
      gym_session_log_id: gymSessionLogId,
      programme_exercise_id: ex.programme_exercise_id,
      exercise_id: ex.exercise_id,
      set_number: setNumber,
      reps_completed: reps,
      load_kg: load,
      rpe: null,
      /* PATTERN-S5 C1 (0111): the prescription this set is logged against,
         as resolved for this athlete right now — the reference line's own
         numbers (recommendedFor / prescribedReps) and the exercise's step —
         kept on the row so a block edited later never rewrites it. */
      prescribed_reps: prescribedReps(ex),
      prescribed_load_kg: recommendedFor(ex),
      prescribed_step_kg: ex.weight_step_kg,
    };
    const parsed = GymSetLogInput.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  }

  /* The sanctioned correction path (ADR-005, migration 0044) — online only, not queued,
   * same reasoning as every other revise_* call site: a replayed revise cannot be told
   * apart from "already corrected" (lib/outbox.ts's own header). */
  const correctionMutation = useMutation({
    mutationFn: async (input: { id: string; reps: number | null; load: number | null }) => {
      const result = await withWriteTimeout(
        reviseGymSetLog(createClient(), input.id, {
          reps_completed: input.reps,
          load_kg: input.load,
          rpe: null,
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setError(null);
      closeCorrection();
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'athlete')),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        completeSessionLog(createClient(), gymSessionLogId, sessionRpe.trim() === '' ? null : Number(sessionRpe)),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setError(null);
      // The session is closed; any leftover adjustment is dead weight and
      // must not resurface if the athlete reopens this log.
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* Nothing to clean up if storage is unavailable. */
      }
      /* ATH-ADULT-09 C6 / 10 C3 (2026-09-12): the session stays on screen as
         its summary — the server re-reads the closed log and renders it — in
         place of the old jump to /programme?submitted=gym. The spec's §6 row
         always said "stays". */
      router.refresh();
      window.scrollTo({ top: 0 });
    },
    onError: (err) => setError(toUserMessage(err, 'athlete')),
  });

  /* The numbers the two blocks show and the footer writes: the correction's
     while one is open, otherwise the active exercise's adjusted values. */
  const cardDone = card ? (setsByExercise.get(card.programme_exercise_id) ?? []) : [];
  const nextSetNumber = card ? cardDone.length + 1 : 0;
  const showWeight = card ? (correcting ? true : weightFor(card) !== null) : false;
  const weightShown = card ? (correcting ? corr.weight : weightFor(card)) : null;
  const repsShown = card ? (correcting ? corr.reps : repsFor(card)) : null;
  /* PATTERN-S5 C1 (0111): while correcting, the reference is the set's OWN
     snapshot — what it was asked for on the day — not today's programme; a
     set logged before the snapshot existed falls back to the live value. */
  const rec = card
    ? correctingRow && correctingRow.prescribed_load_kg !== null
      ? correctingRow.prescribed_load_kg
      : recommendedFor(card)
    : null;
  const recReps = card
    ? correctingRow && correctingRow.prescribed_reps !== null
      ? correctingRow.prescribed_reps
      : prescribedReps(card)
    : null;
  const lastLogged = lastLoggedId ? (loggedSets.find((r) => r.id === lastLoggedId) ?? null) : null;
  const lastLoggedExercise = lastLogged
    ? (exercises.find((ex) => ex.programme_exercise_id === lastLogged.programme_exercise_id) ?? null)
    : null;
  const allLogged = doneCount >= totalSets;

  function stepValue(kind: 'weight' | 'reps', delta: number) {
    if (!card) return;
    if (correcting) {
      /* A value that was never logged stays "Not set" under a minus: there
         is nothing to go below. A plus starts it from zero — measured: the
         first cut let a minus turn "Not set" into a 0 kg load. */
      setCorr((c) =>
        kind === 'weight'
          ? c.weight === null && delta < 0
            ? c
            : { ...c, weight: Math.max(0, Math.round(((c.weight ?? 0) + delta) * 100) / 100) }
          : c.reps === null && delta < 0
            ? c
            : { ...c, reps: Math.max(0, (c.reps ?? 0) + delta) },
      );
      return;
    }
    if (kind === 'weight') bumpWeight(card, delta);
    else bumpReps(card, delta);
  }

  const chipsFor = (ex: ResolvedExercise) => {
    const done = setsByExercise.get(ex.programme_exercise_id) ?? [];
    const isCard = card?.programme_exercise_id === ex.programme_exercise_id;
    return (
      <div className="gym-set-keys" role="list" aria-label={`Sets of ${ex.exercise_name}`}>
        {Array.from({ length: ex.sets }, (_, i) => {
          const setNumber = i + 1;
          const loggedRow = done.find((s) => s.set_number === setNumber);
          const isNext = !loggedRow && isCard && setNumber === done.length + 1 && !alreadyComplete;
          if (loggedRow) {
            /* Logged = the accent with a tick, and the correction target. */
            return (
              <button
                key={setNumber}
                type="button"
                role="listitem"
                className="gym-set-key"
                data-logged=""
                data-correcting={correcting === loggedRow.id ? '' : undefined}
                aria-label={`Set ${setNumber} logged${correctedIds.has(loggedRow.id) ? ', corrected' : ''}, ${loggedRow.reps_completed ?? 'no'} reps at ${
                  loggedRow.load_kg !== null ? `${loggedRow.load_kg} kg` : 'no load'
                }. Correct it.`}
                onClick={() => openCorrection(loggedRow)}
              >
                {'✓'}
              </button>
            );
          }
          /* Current = the accent tint with the ring; not reached = --faint on
             --surf2. Neither is a control: no disabled attribute anywhere. */
          return (
            <span
              key={setNumber}
              role="listitem"
              className="gym-set-key"
              data-next={isNext ? '' : undefined}
              aria-current={isNext ? 'step' : undefined}
              aria-label={isNext ? `Set ${setNumber} of ${ex.sets}, next` : `Set ${setNumber} of ${ex.sets}, not reached`}
            >
              {setNumber}
            </span>
          );
        })}
      </div>
    );
  };

  const numberBlock = (kind: 'weight' | 'reps') => {
    if (!card) return null;
    const value = kind === 'weight' ? weightShown : repsShown;
    const step = kind === 'weight' ? card.weight_step_kg : 1;
    const label = kind === 'weight' ? 'Weight' : 'Reps';
    /* Going off the prescription is information, not an error: the coach's
       number stays underneath as reference, with the difference in bold and
       a real minus sign, in --muted. */
    const reference =
      kind === 'weight'
        ? rec === null
          ? loadLabel(card, timezone)
          : value !== null && value !== rec
            ? (
                <>
                  Prescribed {formatKg(rec)} kg · <b>{signed(value - rec)}</b>
                </>
              )
            : `Prescribed ${formatKg(rec)} kg`
        : recReps === null
          ? 'No reps prescribed'
          : value !== null && value !== recReps
            ? (
                <>
                  Prescribed {recReps} · <b>{signed(value - recReps)}</b>
                </>
              )
            : `Prescribed ${recReps}`;
    return (
      <div className="gl-num" data-kind={kind}>
        <button
          type="button"
          className="gl-step"
          onClick={() => stepValue(kind, -step)}
          aria-label={`Decrease the ${kind} for ${card.exercise_name} by ${kind === 'weight' ? `${step} kg` : '1'}`}
        >
          &minus;
        </button>
        <div className="gl-num-mid">
          <div className="gl-num-k">{label}</div>
          {/* An absent value is words, at the words' size — never a dash,
              never a zero. */}
          <div className="gl-num-v num" data-words={value === null ? '' : undefined}>
            {value === null ? 'Not set' : kind === 'weight' ? formatKg(value) : value}
            {kind === 'weight' && value !== null ? <small>kg</small> : null}
          </div>
          <div className="gl-num-ref num">{reference}</div>
        </div>
        <button
          type="button"
          className="gl-step"
          onClick={() => stepValue(kind, step)}
          aria-label={`Increase the ${kind} for ${card.exercise_name} by ${kind === 'weight' ? `${step} kg` : '1'}`}
        >
          +
        </button>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--surf)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* THE HEADER NEVER SCROLLS AWAY: one eyebrow, the title with Finish
          early beside it (ATH-ADULT-10 C1 — dashed, neutral, 44px, in the
          header while sets remain), and the running count with the clock.
          The tab bar beneath the screen is the way out; there is no Close. */}
      <div className="gym-head">
        {sessionMeta ? <div className="gym-head-eyebrow">{sessionMeta}</div> : null}
        <div className="gym-head-row2">
          <h1 className="gym-head-title">{sessionName}</h1>
          {!alreadyComplete && !allLogged ? (
            <button
              type="button"
              className="btn-ghost gym-finish-early"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
              aria-label={`Finish early · ${doneCount} of ${totalSets} sets`}
            >
              Finish early
            </button>
          ) : null}
        </div>
        <div className="gym-progress">
          <div className="gym-progress-track">
            <div className="gym-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="prog num">
            {finishedEarly ? (
              <>
                {doneCount} of {totalSets} sets logged &middot; {totalSets - doneCount} not logged
              </>
            ) : (
              <>
                {doneCount} of {totalSets} sets
              </>
            )}
            {/* C4: what has not reached the server yet, on the same row —
                "6 of 12 sets · 2 waiting to send". */}
            {waiting > 0 ? (
              <>
                {' '}&middot; {waiting} waiting to send
              </>
            ) : null}
            {!alreadyComplete && startedAt ? (
              <>
                {' '}&middot; {now !== null ? elapsed(startedAt, now) : '·'}
              </>
            ) : null}
          </span>
        </div>
      </div>

      <div className="phone-body" style={{ paddingTop: 0 }}>
        <div className="gym-body">
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          {alreadyComplete && !finishedEarly ? (
            <>
              <div className="card gym-sum">
                <h2 className="gym-sum-title">
                  Session complete · {doneCount} of {totalSets} sets
                </h2>
                <p className="gym-sum-sub">Every prescribed set is logged and saved.</p>
              </div>
              <div className="card gym-sum-totals">
                <div className="gym-sum-grid">
                  <div>
                    <div className="gym-sum-k">Total volume</div>
                    <div className="gym-sum-num num">
                      {formatKg(volumeKg)}
                      <small>kg</small>
                    </div>
                    <div className="gym-sum-der">Weight × reps across {doneCount} sets</div>
                  </div>
                  <div>
                    <div className="gym-sum-k">Sets done</div>
                    <div className="gym-sum-num num">
                      {doneCount}
                      <small>of {totalSets}</small>
                    </div>
                    <div className="gym-sum-der">
                      {exercises.length} exercises
                      {minutes !== null ? ` · ${minutes} min` : ''}
                    </div>
                  </div>
                </div>
                {bests.length > 0 ? (
                  <div className="gym-sum-bests">
                    <div className="gym-sum-k">Best you have logged</div>
                    {bests.map((nb) => (
                      <div key={nb.exercise_id} className="gym-sum-best">
                        <div className="gym-sum-best-row">
                          <span className="nm">{nameById.get(nb.exercise_id) ?? 'Exercise'}</span>
                          <span className="gym-sum-best-val num">
                            {formatKg(nb.best.load_kg)} kg × {nb.best.reps}
                          </span>
                        </div>
                        <div className="gym-sum-der num">
                          Best before today {formatKg(nb.prior.load_kg)} kg × {nb.prior.reps} · {formatDate(nb.prior.entry_date, timezone)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="card gym-sum-all">
                <div className="gym-sum-all-head">
                  <span className="nm">All {exercises.length} exercises</span>
                  <span className="pill pill-accent num">
                    {doneCount} of {totalSets}
                  </span>
                </div>
                <p className="gym-sum-der num">
                  {exercises
                    .map((ex) => {
                      const best = bestToday.get(ex.exercise_id);
                      const done = setsFor(ex);
                      /* No working set with a load: a bodyweight movement says
                         so; anything else says the load was not logged —
                         "bodyweight" would be a reading for a bench press
                         whose 1RM was never linked. */
                      const load = best
                        ? `${formatKg(best.load_kg)} kg`
                        : done.length === 0
                          ? 'not logged'
                          : ex.load_basis === 'none'
                            ? 'bodyweight'
                            : 'no load logged';
                      return `${ex.exercise_name} ${load}`;
                    })
                    .join(' · ')}
                </p>
              </div>
              <p className="cap">This session is in My data, set by set. You can still correct any logged set.</p>
            </>
          ) : null}

          {finishedEarly ? (
            <>
              <div className="card gym-sum gym-sum-early">
                <h2 className="gym-sum-title">
                  Finished early · {doneCount} of {totalSets} sets
                </h2>
                <p className="gym-sum-sub">
                  Everything you logged is saved. The {totalSets - doneCount} sets you did not log are recorded as not logged, not as zero.
                </p>
              </div>
              {exercises.map((ex) => {
                const done = setsFor(ex);
                return (
                  <div key={ex.programme_exercise_id} className="card gym-sum-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{ex.exercise_name}</div>
                      <div className="gym-sum-der num">{setsLine(done)}</div>
                    </div>
                    <span className={`pill num ${done.length >= ex.sets ? 'pill-accent' : 'gym-sum-pill-short'}`}>
                      {done.length} of {ex.sets}
                    </span>
                  </div>
                );
              })}
              <p className="cap">This session is in My data, marked finished early. You can still correct any logged set.</p>
            </>
          ) : null}

          {/* THE LOGGER. One exercise at a time; every exercise once the
              session is closed and "Correct a set" has been pressed, so a
              logged chip is always reachable. */}
          {!alreadyComplete || showSets ? (
            <>
              {/* The set that just landed, above the card, with its way back
                  (the board's "Set 2 logged · 102.5 kg × 8 · Correct it"). */}
              {!alreadyComplete && lastLogged && lastLoggedExercise && !correcting ? (
                <div className="gl-strip" role="status">
                  <span className="num">
                    {lastLoggedExercise.exercise_name} set {lastLogged.set_number} logged ·{' '}
                    {setWords(lastLogged.load_kg, lastLogged.reps_completed) || 'nothing recorded'}
                  </span>
                  <button type="button" className="gl-strip-link" onClick={() => openCorrection(lastLogged)}>
                    Correct it
                  </button>
                </div>
              ) : null}

              {(alreadyComplete && showSets ? exercises : card ? [card] : []).map((ex) => {
                const done = setsByExercise.get(ex.programme_exercise_id) ?? [];
                const isCard = card?.programme_exercise_id === ex.programme_exercise_id;
                const position =
                  correcting && correctingRow && isCard
                    ? `Correcting set ${correctingRow.set_number} · was ${wasLine({ reps_completed: correctingRow.reps_completed, load_kg: correctingRow.load_kg })}`
                    : done.length >= ex.sets
                      ? `${ex.sets} of ${ex.sets} logged`
                      : `Set ${done.length + 1} of ${ex.sets}${ex.rest_seconds ? ` · Rest ${ex.rest_seconds}s` : ''}`;
                return (
                  <div key={ex.programme_exercise_id} className="gl-card" data-active={isCard ? '' : undefined}>
                    <div className="gl-card-head">
                      <h2 className="gl-card-name">{ex.exercise_name}</h2>
                      <span className="gl-card-pos num">{position}</span>
                    </div>
                    {chipsFor(ex)}
                    {/* ATH-ADULT-11 C2 (2026-09-12): a corrected set says so
                        where it is, with what it was — the superseded row,
                        read by the page from the base table as My data does.
                        The neutral marker in words; no bar, no second colour. */}
                    {done.some((row) => correctedIds.has(row.id)) ? (
                      <div className="gym-corrected-strip num">
                        {done
                          .filter((row) => correctedIds.has(row.id))
                          .map((row) => {
                            const c = corrections.find((x) => x.id === row.id);
                            return c ? (
                              <div key={row.id}>
                                Set {row.set_number} corrected · was {wasLine(c.was)}
                              </div>
                            ) : null;
                          })}
                      </div>
                    ) : null}
                    {isCard && (correcting || !alreadyComplete) ? (
                      <>
                        {showWeight ? numberBlock('weight') : null}
                        {!showWeight && rec === null && !correcting ? (
                          <p className="gl-noload num">
                            {ex.load_basis === 'none' ? 'Bodyweight · reps only' : loadLabel(ex, timezone)}
                          </p>
                        ) : null}
                        {numberBlock('reps')}
                      </>
                    ) : null}
                  </div>
                );
              })}

              {/* What is next, stated beneath the card, never behind a
                  disclosure: one line when one exercise remains, rows with
                  their prescription and count otherwise. */}
              {!alreadyComplete && nextExercises.length === 1 && nextExercises[0] ? (
                <p className="gl-then-line">
                  <span className="gl-then-k">Then</span> <span className="nm">{nextExercises[0].exercise_name}</span>
                  {schemeLine(nextExercises[0], timezone) ? (
                    <span className="num"> · {schemeLine(nextExercises[0], timezone)}</span>
                  ) : null}
                </p>
              ) : !alreadyComplete && nextExercises.length > 1 ? (
                <>
                  <p className="gl-then-k">Then</p>
                  <div className="gl-then">
                    {nextExercises.map((ex) => {
                      const done = setsByExercise.get(ex.programme_exercise_id) ?? [];
                      return (
                        <div key={ex.programme_exercise_id} className="gl-then-row">
                          <div style={{ minWidth: 0 }}>
                            <div className="nm">{ex.exercise_name}</div>
                            <div className="gl-then-sub num">{schemeLine(ex, timezone)}</div>
                          </div>
                          <span className="gl-then-count num">
                            {done.length} of {ex.sets}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {!alreadyComplete ? (
                <div className="card" style={{ marginTop: 'var(--sp-14)' }}>
                  <label>
                    <span className="label">Session RPE (optional)</span>
                    <input
                      className="field"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="10"
                      value={sessionRpe}
                      onChange={(e) => setSessionRpe(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}

          {/* THE FOOTER: one primary, labelled with what it writes, at
              --hit-lg; Save correction / Cancel while a correction is open
              (ATH-ADULT-11 C1); "Finish session" once every set is logged;
              the summary's own exits once the session is closed. */}
          {alreadyComplete && !correcting ? (
            <div className="subm subm-stack">
              <p className="cap subm-caption">Sent to My data.</p>
              <Link href="/today" className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
                Back to today
              </Link>
              {!showSets ? (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 'var(--sp-8)' }}
                  onClick={() => setShowSets(true)}
                >
                  Correct a set
                </button>
              ) : null}
            </div>
          ) : correcting && correctingRow ? (
            <div className="subm">
              <p className="cap subm-caption">
                The original is kept. My data marks the session corrected and shows what you first logged.
              </p>
              <button
                type="button"
                className="btn-primary gl-primary"
                disabled={correctionMutation.isPending}
                onClick={() => correctionMutation.mutate({ id: correctingRow.id, reps: corr.reps, load: corr.weight })}
              >
                {correctionMutation.isPending ? 'Saving…' : `Save correction · ${setWords(corr.weight, corr.reps) || 'no values'}`}
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 'var(--sp-8)' }}
                onClick={closeCorrection}
              >
                Cancel
              </button>
            </div>
          ) : allLogged ? (
            <div className="subm">
              <p className="cap subm-caption">Every set is logged.</p>
              <button
                type="button"
                className="btn-primary gl-primary"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
              >
                Finish session
              </button>
            </div>
          ) : card ? (
            <div className="subm">
              <p className="cap subm-caption">Sets save as you log them.</p>
              <button
                type="button"
                className="btn-primary gl-primary"
                disabled={logMutation.isPending}
                onClick={() => {
                  const input = buildSetInput(card, nextSetNumber, repsFor(card), weightFor(card));
                  if (!input) {
                    setError('Something on this set did not check out. Try again.');
                    return;
                  }
                  logMutation.mutate(input);
                }}
              >
                {logMutation.isPending
                  ? 'Saving…'
                  : `Log set ${nextSetNumber}${setWords(weightFor(card), repsFor(card)) ? ` · ${setWords(weightFor(card), repsFor(card))}` : ''}`}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
