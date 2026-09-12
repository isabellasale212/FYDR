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
import { flushGymSets, queuedGymSets } from '@/lib/gymOutboxFlush';
import { GymSetLogInput } from '@/lib/validation/gym';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { loadLabel, schemeLine } from '@/lib/gymPrescription';
import { acquireWakeLock, buzz, releaseWakeLock } from '@/lib/wakeLock';
import { bestSetsByExercise, formatKg, minutesBetween, newBests, sessionVolumeKg, setsLine, type PriorBest } from '@/lib/gymSummary';
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
  totalSets: number;
  timezone: string;
  exercises: readonly ResolvedExercise[];
  loggedSets: readonly LoggedSet[];
  alreadyComplete: boolean;
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

/**
 * Full screen, not a sheet — ATHLETE-APP-SPEC.md §9 is explicit this is a
 * place used repeatedly through a session, not a task that opens and
 * closes once. Kept real over pixel-literal in one place: the spec's set
 * rows read as fixed prescribed values ticked off; this app lets an
 * athlete log the reps and load they actually did (prefilled from the
 * prescription, editable), because a gym log that can't record "I only
 * got 6 of the 8 reps" is not a useful one. Per-set RPE, which the schema
 * supports, is dropped from this quick-log row to keep it to the spec's
 * own 4-column grid — session RPE at the end still covers the whole
 * session, which is what §9's own footer asks for.
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
  totalSets,
  timezone,
  exercises,
  loggedSets,
  alreadyComplete,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  /* Typed-but-not-yet-ticked reps and loads.
   *
   * These used to be React state and nothing else, so an athlete who typed a
   * set and then took a phone call lost it with no warning — the one real
   * data-loss path on this screen. Logged sets themselves were never at
   * risk: each tick writes immediately (see logMutation below) and a failed
   * write stays in the outbox. It was only the in-progress row.
   *
   * Persisted per gym_session_log_id so two sessions cannot bleed into each
   * other, and cleared as soon as the set is logged or the session is
   * finished. localStorage rather than the database on purpose: this is an
   * unsubmitted draft, and rule 6's immutability applies to entries that
   * exist, not to a half-typed row. Every access is guarded — private
   * windows and blocked site data throw rather than return null. */
  const draftKey = `fydr-gym-draft-${gymSessionLogId}`;
  const [drafts, setDrafts] = useState<Record<string, { reps: string; load: string }>>({});

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
      if (raw) setDrafts(JSON.parse(raw) as Record<string, { reps: string; load: string }>);
    } catch {
      /* Unreadable or malformed storage: start empty. A lost draft is bad;
       * a screen that will not render because of one is worse. */
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      const hasContent = Object.values(drafts).some((d) => d.reps !== '' || d.load !== '');
      if (hasContent) window.localStorage.setItem(draftKey, JSON.stringify(drafts));
      else window.localStorage.removeItem(draftKey);
    } catch {
      /* Storage unavailable. The draft still lives in React for this
       * session; it just will not survive the app closing. */
    }
  }, [drafts, draftKey]);
  const [sessionRpe, setSessionRpe] = useState('');
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  /* screens/gym-logging.md: "Tap a completed set row: re-opens it as active for
   * correction." correcting holds the LoggedSet.id currently open for correction, in
   * place, mid-session or on the completed review — this build has no ConfirmSheet, so
   * both cases behave the same way, a real, small simplification against the fuller spec. */
  const [correcting, setCorrecting] = useState<string | null>(null);
  /* The athlete's chosen weight per exercise, keyed by programme_exercise_id.
     Empty until they touch a stepper — the recommendation is the value until
     then, so an untouched exercise shows the coach's number rather than a copy
     of it that has stopped tracking changes. */
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, { reps: string; load: string }>>({});

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
     gives way to a summary; "Correct a set" brings the list back beneath it.
     The two must not be mistaken for each other: complete is the one screen
     allowed to be pleased — total volume first (MET-041, the number that
     grows over a block), sets done, then the new bests with what they beat
     and when (MET-040) so the claim is checkable; early has a different
     title, a dashed card, per-exercise rows that read "Not logged", and no
     totals block at all. No gradient, no confetti, no praise copy. */
  const [showSets, setShowSets] = useState(false);
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

  /* The exercise being worked on, 23g's gold-bordered card: the FIRST with
     sets still to log, in prescribed order. First rather than "the one most
     recently touched" because a programme is an order — the athlete works
     down it — and because "most recent" would move the highlight backwards
     the moment somebody corrected an earlier set. Once every exercise is
     complete nothing is active, which is correct: there is nothing to do. */
  const activeExerciseId =
    exercises.find((ex) => (setsByExercise.get(ex.programme_exercise_id) ?? []).length < ex.sets)
      ?.programme_exercise_id ?? null;

  /* WHAT THE REFERENCE SHOWS AND WHAT IT COLLAPSES (screens 09/10).
   *
   * The drawing shows Back squat mid-set, Romanian deadlift whole and unstarted
   * below it, and "1 more · Nordic curl" as a single row after that — so the
   * rule is not "unstarted exercises collapse", which would have hidden the
   * Romanian deadlift too. It is the exercise you are ON and the one you are
   * going TO, then everything after that folded away.
   *
   * A whole-session view is still one tap away, which is why this is a
   * disclosure rather than a truncation: an athlete checking what is left in
   * the session, or how heavy the last lift will be, is asking a fair question
   * and the old screen answered it by scrolling. */
  const activeIndex = exercises.findIndex((ex) => ex.programme_exercise_id === activeExerciseId);
  /* -1 (nothing left to log) shows everything: at the end of a session the
     list is a record of what was done, and folding most of it away turns the
     one screen that reviews the work into a summary of two exercises. */
  const visibleCount = activeIndex < 0 ? exercises.length : Math.min(exercises.length, activeIndex + 2);
  const shownExercises = showAllExercises ? exercises : exercises.slice(0, visibleCount);
  const hiddenExercises = exercises.slice(shownExercises.length);

  /* Bounded (ten seconds) and has a real onError — before this, a thrown network failure
   * showed nothing at all and a hung request pinned the tick button disabled forever
   * (audit S5's shape, on the screen whose footer promises "sets save as you log them").
   * A failed set stays on screen as the next set to log: tapping the tick again is the
   * retry, now safely idempotent (migration 0044's gym_set_logs_one_live_per_slot index).
   *
   * Also enqueued into the offline outbox (blocker B4): onMutate queues it before the
   * write is even attempted, onSuccess dequeues it. If the write fails, the item stays
   * queued and OutboxFlusher (mounted on /today) retries it later even if the athlete
   * never taps the tick again or the app is closed mid-set — the visible error and the
   * tap-to-retry above are the fast path, the queue is the safety net underneath it, not
   * a replacement for it: unlike a one-shot form (NutritionCheckinForm), this screen stays
   * open for up to 45 minutes and the athlete needs to know, right now, whether the set
   * they just tapped actually saved. */
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
      // The row is real now, so its draft is no longer the only copy.
      // programme_exercise_id is nullable on the input (an ad-hoc set belongs
      // to no prescribed exercise); drafts are only ever keyed by a real one,
      // so a null here simply has no draft to clear.
      const draftedExercise = input.programme_exercise_id;
      if (draftedExercise !== null) {
        setDrafts((d) => {
          const next = { ...d };
          delete next[draftedExercise];
          return next;
        });
      }
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'athlete')),
    /* Sent or not, the waiting count is read back from the outbox: a failed
       set is now "waiting to send" on the progress row as well as an error. */
    onSettled: () => setWaiting(queuedGymSets(gymSessionLogId)),
  });

  /* The step is the exercise's own (ex.weight_step_kg, migration 0108 —
     ATH-ADULT-09 C3): 2.5 a plate a side, 2 for a dumbbell, 1.25 microloaded.
     It used to be a constant 2.5 here for every movement. */

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
    const own = weights[ex.programme_exercise_id];
    return own !== undefined ? own : recommendedFor(ex);
  }

  function bumpWeight(ex: ResolvedExercise, delta: number) {
    const base = weightFor(ex);
    if (base === null) return;
    // Never below zero, and rounded to the step so a chain of taps cannot
    // drift onto 0.30000000000000004.
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setWeights((w) => ({ ...w, [ex.programme_exercise_id]: next }));
  }

  const correctingRow = correcting ? (loggedSets.find((r) => r.id === correcting) ?? null) : null;

  function openCorrection(row: LoggedSet) {
    setError(null);
    setCorrectionDrafts((d) => ({
      ...d,
      [row.id]: {
        reps: row.reps_completed !== null ? String(row.reps_completed) : '',
        load: row.load_kg !== null ? String(row.load_kg) : '',
      },
    }));
    setCorrecting(row.id);
  }

  function buildSetInput(
    ex: ResolvedExercise,
    setNumber: number,
    reps: string,
    load: string,
  ): GymSetLogInput | null {
    const candidate = {
      id: crypto.randomUUID(),
      gym_session_log_id: gymSessionLogId,
      programme_exercise_id: ex.programme_exercise_id,
      exercise_id: ex.exercise_id,
      set_number: setNumber,
      reps_completed: reps.trim() === '' ? null : Number(reps),
      load_kg: load.trim() === '' ? null : Number(load),
      rpe: null,
    };
    const parsed = GymSetLogInput.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  }

  /* The sanctioned correction path (ADR-005, migration 0044) — online only, not queued,
   * same reasoning as every other revise_* call site: a replayed revise cannot be told
   * apart from "already corrected" (lib/outbox.ts's own header). */
  const correctionMutation = useMutation({
    mutationFn: async (input: { id: string; reps: string; load: string }) => {
      const result = await withWriteTimeout(
        reviseGymSetLog(createClient(), input.id, {
          reps_completed: input.reps.trim() === '' ? null : Number(input.reps),
          load_kg: input.load.trim() === '' ? null : Number(input.load),
          rpe: null,
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setError(null);
      setCorrecting(null);
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
      // The session is closed; any leftover half-typed row is dead weight and
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
      {/* ONE EYEBROW AND THE TITLE, per screens 09/10.
       *
       * THE CLOSE/TIMER LINE ABOVE THIS IS GONE, and it was defended in this
       * file until today: "leaving a session and knowing how long you have been
       * in it are both real, and a picture cannot show that they are missing."
       * Half of that still holds and half of it does not.
       *
       * Close was redundant, and the new screenshots are what show it — the
       * athlete tab bar is rendered on this route (src/app/(athlete)/layout.tsx
       * mounts it under every athlete page, and 09/10 draw it with Gym lit), so
       * there has always been a way out one row below the one Close occupied.
       *
       * The running clock is a real loss and is recorded as one. What replaces
       * it is the eyebrow's own planned duration ("55 MIN"), which is the
       * session's shape rather than the athlete's elapsed time in it. The
       * once-a-second setInterval that drove it went with it rather than being
       * left to re-render a component nothing displays. */}
      <div className="gym-head">
        {sessionMeta ? <div className="gym-head-eyebrow">{sessionMeta}</div> : null}
        <h1 className="gym-head-title">{sessionName}</h1>
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
            {/* On the progress row, not on a utility line of its own: the clock
                is back without the Close/timer bar the reference removed. */}
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

          {(!alreadyComplete || showSets ? shownExercises : []).map((ex) => {
            const done = setsByExercise.get(ex.programme_exercise_id) ?? [];
            const isActive = ex.programme_exercise_id === activeExerciseId;
            /* The prescription IS the prefill now, read at the moment a set
               key is tapped (recommendedFor / reps_min) rather than copied into
               a per-exercise draft first. The draft existed to hold what the
               athlete typed into two inputs a set; there are no such inputs
               any more. */
            const nextSetNumber = done.length + 1;

            return (
              <div
                key={ex.programme_exercise_id}
                className="gym-ex-card"
                data-active={isActive ? '' : undefined}
              >
                <div className="gym-ex-head">
                  <div style={{ minWidth: 0 }}>
                    <span className="nm">{ex.exercise_name}</span>
                    <span className="scheme num">{schemeLine(ex, timezone)}</span>
                  </div>
                  {/* 23g's per-exercise pill. Three states, because the count
                      only means something once there is something to count:
                      nothing logged says how many are PRESCRIBED, part-done
                      says how far through, finished says so in the good tone.
                      "0 of 3" would be a progress reading of a thing not
                      started, which is not the same statement. */}
                  <span
                    className={
                      done.length === 0
                        ? 'pill pill-neutral'
                        : done.length >= ex.sets
                          ? 'pill pill-good'
                          : 'pill pill-warn'
                    }
                  >
                    {done.length === 0 ? (
                      <>
                        <span className="num">{ex.sets}</span> {ex.sets === 1 ? 'set' : 'sets'}
                      </>
                    ) : (
                      <>
                        <span className="num">{done.length}</span> of{' '}
                        <span className="num">{ex.sets}</span>
                      </>
                    )}
                  </span>
                </div>

                {/* 23g's SET KEYS. One box a set, tapped to log — not a row of
                    reps and load inputs a set.

                    What this changes about what is recorded, stated plainly
                    because it is the reason this was not built the first two
                    times it was asked for: a tap logs the PRESCRIBED reps and
                    the weight shown below, rather than making the athlete type
                    what they actually did. The prescription is right on the
                    overwhelming majority of sets — that is what a prescription
                    is — and the athlete is standing under a bar with cold hands.
                    Nothing is lost, because a logged key stays tappable and
                    re-opens the set for correction underneath (ADR-005's
                    revise path, unchanged), so a set that went 3 reps instead
                    of 5 is two taps from being right. Fast by default, exact on
                    demand, instead of slow always. */}
                <div className="gym-set-keys">
                  {Array.from({ length: ex.sets }, (_, i) => {
                    const setNumber = i + 1;
                    const loggedRow = done.find((s) => s.set_number === setNumber);
                    const isNext = !alreadyComplete && setNumber === nextSetNumber;
                    return (
                      <button
                        key={setNumber}
                        type="button"
                        className="gym-set-key"
                        data-logged={loggedRow ? '' : undefined}
                        data-next={!loggedRow && isNext ? '' : undefined}
                        aria-pressed={!!loggedRow}
                        disabled={!loggedRow && (!isNext || logMutation.isPending)}
                        aria-label={
                          loggedRow
                            ? `Set ${setNumber} logged, ${loggedRow.reps_completed ?? 'no'} reps at ${
                                loggedRow.load_kg !== null ? `${loggedRow.load_kg} kg` : 'no load'
                              }. Correct it.`
                            : `Log set ${setNumber} of ${ex.sets}, ${ex.exercise_name}`
                        }
                        onClick={() => {
                          if (loggedRow) {
                            openCorrection(loggedRow);
                            return;
                          }
                          const input = buildSetInput(
                            ex,
                            setNumber,
                            ex.reps_min !== null ? String(ex.reps_min) : '',
                            weightFor(ex) !== null ? String(weightFor(ex)) : '',
                          );
                          if (!input) {
                            setError('Something on this set did not check out. Try again.');
                            return;
                          }
                          logMutation.mutate(input);
                        }}
                      >
                        {loggedRow ? '\u2713' : setNumber}
                      </button>
                    );
                  })}
                </div>

                {/* The correction, inline and only for the set being corrected.
                    23g has no such row because nothing in a still needs
                    correcting; removing it would have made a mis-logged set
                    unfixable until the session was closed, since the correction
                    screen only lists COMPLETED sessions. */}
                {correctingRow && correctingRow.programme_exercise_id === ex.programme_exercise_id ? (
                  <div className="gym-correct">
                    <p className="gym-correct-k">
                      Correcting set <span className="num">{correctingRow.set_number}</span>
                    </p>
                    <div className="gym-correct-fields">
                      <label>
                        <span className="label">Reps</span>
                        <input
                          className="field num"
                          type="number"
                          inputMode="numeric"
                          value={correctionDrafts[correctingRow.id]?.reps ?? ''}
                          onChange={(e) =>
                            setCorrectionDrafts((d) => ({
                              ...d,
                              [correctingRow.id]: {
                                reps: e.target.value,
                                load: d[correctingRow.id]?.load ?? '',
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span className="label">Load (kg)</span>
                        <input
                          className="field num"
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          value={correctionDrafts[correctingRow.id]?.load ?? ''}
                          onChange={(e) =>
                            setCorrectionDrafts((d) => ({
                              ...d,
                              [correctingRow.id]: {
                                reps: d[correctingRow.id]?.reps ?? '',
                                load: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="gym-correct-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={correctionMutation.isPending}
                        onClick={() =>
                          correctionMutation.mutate({
                            id: correctingRow.id,
                            reps: correctionDrafts[correctingRow.id]?.reps ?? '',
                            load: correctionDrafts[correctingRow.id]?.load ?? '',
                          })
                        }
                      >
                        Save correction
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setCorrecting(null)}>
                        Cancel
                      </button>
                    </div>
                    <p className="cap" style={{ margin: '8px 0 0' }}>
                      The original is kept. My data marks the day corrected and shows what you
                      first reported.
                    </p>
                  </div>
                ) : null}

                {/* 23g's weight row, and §9 rule 4 — an override never rewrites
                    the parent. When the athlete has moved off the prescription
                    BOTH numbers stay on screen: theirs as the value, the
                    coach's as the note. */}
                {(() => {
                  const rec = recommendedFor(ex);
                  const cur = weightFor(ex);
                  if (cur === null) {
                    return (
                      <div className="gym-weight">
                        <div className="gym-weight-label">
                          <div className="k">{ex.load_basis === 'none' ? 'Bodyweight' : 'No load set'}</div>
                          <div className="n">
                            {ex.load_basis === 'none' ? 'no weight to set' : loadLabel(ex, timezone)}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const overridden = rec !== null && cur !== rec;
                  /* The deviation as a signed figure with a real minus sign
                     (09 D4): "prescribed 100 kg · +2.5" / "· −2.5". */
                  const deviation =
                    rec !== null && cur !== null ? `${cur - rec >= 0 ? '+' : '\u2212'}${Math.abs(cur - rec)}` : '';
                  return (
                    <div className="gym-weight">
                      <div className="gym-weight-label">
                        <div className="k">{overridden ? 'Your weight' : 'Recommended'}</div>
                        <div className="n" data-warn={overridden ? '' : undefined}>
                          {overridden ? (
                            <>
                              prescribed <span className="num">{rec}</span> kg · {deviation}
                            </>
                          ) : (
                            'change it if it is not right today'
                          )}
                        </div>
                      </div>
                      <div className="gym-stepper">
                        <button
                          type="button"
                          onClick={() => bumpWeight(ex, -ex.weight_step_kg)}
                          aria-label={`Decrease the weight for ${ex.exercise_name} by ${ex.weight_step_kg} kg`}
                        >
                          &minus;
                        </button>
                        <span className="v num">
                          {cur}
                          <small>kg</small>
                        </span>
                        <button
                          type="button"
                          onClick={() => bumpWeight(ex, ex.weight_step_kg)}
                          aria-label={`Increase the weight for ${ex.exercise_name} by ${ex.weight_step_kg} kg`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {hiddenExercises.length > 0 && (!alreadyComplete || showSets) ? (
            <button
              type="button"
              className="gym-more"
              onClick={() => setShowAllExercises(true)}
              aria-expanded={false}
            >
              <span>
                <span className="num">{hiddenExercises.length}</span> more &middot;{' '}
                {hiddenExercises.map((ex) => ex.exercise_name).join(', ')}
              </span>
              <span className="chev" aria-hidden="true">
                &rsaquo;
              </span>
            </button>
          ) : null}

          {!alreadyComplete ? (
            <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
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
          ) : (
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
          )}

          {/* THE FINISH CONTROL, NO LONGER FLOATING — which is what the
              changelog objects to, and as far as this goes.

              It could not simply be deleted. This button holds the ONLY call to
              completeMutation on the screen; without it an athlete can start a
              session and never finish one, every session they open stays open
              for ever, and `alreadyComplete` never becomes true for any of
              them. The reference is a still of a session in progress and cannot
              show that, in the same way it could not show a missing Close link.
              So the sticky bar goes and the same button is rendered here, at the
              end of the list, where a person who has finished their last set
              arrives anyway.

              "Finish early" keeps its wording when sets are outstanding. It is a
              real thing athletes do and naming it plainly is what stops it
              reading as an error. */}
          {!alreadyComplete ? (
            <>
              {/* ATH-ADULT-10 (2026-09-12): finishing early is not shaped like
                  logging a set. While sets are outstanding this is a dashed
                  neutral outline — no fill, --muted — so the accent primary is
                  reserved for the act that completes the work; once every set
                  is logged, "Finish session" is the primary as before. Same
                  place, same call: the header placement and the confirmation
                  the board draws are recorded, not built. */}
              <button
                type="button"
                className={doneCount >= totalSets ? 'btn-primary' : 'btn-ghost gym-finish-early'}
                style={{ width: '100%', marginTop: 'var(--sp-14)' }}
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
              >
                {doneCount >= totalSets
                  ? 'Finish session'
                  : `Finish early · ${doneCount} of ${totalSets}`}
              </button>
              <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
                Sets save as you log them.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
