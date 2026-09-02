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
import { GymSetLogInput } from '@/lib/validation/gym';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { formatDate } from '@/lib/format';

type Props = {
  orgId: string;
  gymSessionLogId: string;
  sessionName: string;
  /** Programme, block, week and day — the design's eyebrow above the name. */
  sessionMeta: string | null;
  startedAt: string | null;
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
function loadLabel(ex: ResolvedExercise, timezone: string): string {
  if (ex.load_basis === 'none') return 'No prescribed load';
  if (ex.load_basis === 'absolute') {
    if (ex.load_value === null) return 'Load not set';
    const bare = ex.category === 'plyo' || ex.category === 'conditioning' || ex.category === 'mobility';
    return bare ? String(ex.load_value) : `${ex.load_value} kg`;
  }
  if (ex.load_basis === 'percent_bw') return ex.load_value !== null ? `${ex.load_value}% bodyweight` : 'Not set';
  if (ex.load_basis === 'rpe') return ex.load_value !== null ? `Target RPE ${ex.load_value}` : 'Target RPE not set';
  // percent_1rm, resolved (migration 0043) against the athlete's own latest
  // 1RM test result — a real number, never estimated (O-389 stays open on
  // purpose). Missing means missing, in one of two distinct honest shapes:
  // the exercise has no 1RM test linked at all, or it does and this athlete
  // simply has no result on file yet. screens/gym-logging.md's own copy for
  // the second case, kept verbatim.
  if (ex.resolved_load_kg !== null) {
    return `${ex.resolved_load_kg} kg (${ex.load_value}% of your 1RM${ex.one_rm_test_date ? `, tested ${formatDate(ex.one_rm_test_date, timezone)}` : ''})`;
  }
  if (!ex.one_rm_linked) return 'No 1RM test linked to this exercise yet.';
  return 'No one rep max on file. Log the load you lift.';
}

function schemeLabel(ex: ResolvedExercise): string {
  const reps =
    ex.reps_max !== null && ex.reps_max !== ex.reps_min ? `${ex.reps_min}–${ex.reps_max}` : `${ex.reps_min ?? '?'}`;
  return `${ex.sets} × ${reps}`;
}

function elapsed(startedAt: string | null, now: number): string {
  if (!startedAt) return '00:00';
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:00` : `${String(m).padStart(2, '0')}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
}

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
  gymSessionLogId,
  sessionName,
  sessionMeta,
  startedAt,
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
  const [now, setNow] = useState<number | null>(null);
  /* screens/gym-logging.md: "Tap a completed set row: re-opens it as active for
   * correction." correcting holds the LoggedSet.id currently open for correction, in
   * place, mid-session or on the completed review — this build has no ConfirmSheet, so
   * both cases behave the same way, a real, small simplification against the fuller spec. */
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, { reps: string; load: string }>>({});

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

  /* The exercise being worked on, 23g's gold-bordered card: the FIRST with
     sets still to log, in prescribed order. First rather than "the one most
     recently touched" because a programme is an order — the athlete works
     down it — and because "most recent" would move the highlight backwards
     the moment somebody corrected an earlier set. Once every exercise is
     complete nothing is active, which is correct: there is nothing to do. */
  const activeExerciseId =
    exercises.find((ex) => (setsByExercise.get(ex.programme_exercise_id) ?? []).length < ex.sets)
      ?.programme_exercise_id ?? null;

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
  });

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
      router.push('/programme?submitted=gym');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'athlete')),
  });

  function draftFor(exerciseId: string, prefillReps: string, prefillLoad: string) {
    return drafts[exerciseId] ?? { reps: prefillReps, load: prefillLoad };
  }

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
      {/* Fydr Athlete App.dc.html 23g: the eyebrow and the session's name run
          left, at size, and the count sits beside the bar it belongs to
          rather than under the title. The centred title this replaces put
          "Lower A" between a Close link and a running clock, which read as a
          modal's chrome — three competing things on one line, none of them
          the thing the screen is for.

          Close and the clock stay, on a utility line of their own. Neither is
          in the design because the design is a still; leaving a session and
          knowing how long you have been in it are both real, and a picture
          cannot show that they are missing. */}
      <div className="gym-head">
        <div className="gym-head-row">
          <Link href="/programme" className="gym-close" aria-label="Close">
            Close
          </Link>
          <span className="gym-clock num">{now !== null ? elapsed(startedAt, now) : '·'}</span>
        </div>
        {sessionMeta ? <div className="gym-head-eyebrow">{sessionMeta}</div> : null}
        <h1 className="gym-head-title">{sessionName}</h1>
        <div className="gym-progress">
          <div className="gym-progress-track">
            <div className="gym-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="prog num">
            {doneCount} of {totalSets} sets
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

          {exercises.map((ex) => {
            const done = setsByExercise.get(ex.programme_exercise_id) ?? [];
            const isActive = ex.programme_exercise_id === activeExerciseId;
            const prefillReps = ex.reps_min !== null ? String(ex.reps_min) : '';
            // Prefilled from a real number in both cases: the prescribed
            // absolute kg, or (migration 0043) the athlete's own resolved
            // percent_1rm figure. Never prefilled from a guess — an
            // unresolved percent_1rm leaves the field blank, same as before.
            const prefillLoad =
              ex.load_basis === 'absolute' && ex.load_value !== null
                ? String(ex.load_value)
                : ex.load_basis === 'percent_1rm' && ex.resolved_load_kg !== null
                  ? String(ex.resolved_load_kg)
                  : '';
            const draft = draftFor(ex.programme_exercise_id, prefillReps, prefillLoad);
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
                    <span className="scheme num">
                      {schemeLabel(ex)} @ {loadLabel(ex, timezone)}
                      {ex.rest_seconds ? ` · ${ex.rest_seconds}s rest` : ''}
                    </span>
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

                {Array.from({ length: ex.sets }, (_, i) => {
                  const setNumber = i + 1;
                  const loggedRow = done.find((s) => s.set_number === setNumber);
                  const isNext = !alreadyComplete && setNumber === nextSetNumber;
                  const isCorrecting = !!loggedRow && correcting === loggedRow.id;
                  const correctionDraft = loggedRow
                    ? (correctionDrafts[loggedRow.id] ?? {
                        reps: loggedRow.reps_completed !== null ? String(loggedRow.reps_completed) : '',
                        load: loggedRow.load_kg !== null ? String(loggedRow.load_kg) : '',
                      })
                    : null;

                  function openCorrection() {
                    if (!loggedRow) return;
                    setError(null);
                    setCorrectionDrafts((d) => ({
                      ...d,
                      [loggedRow.id]: {
                        reps: loggedRow.reps_completed !== null ? String(loggedRow.reps_completed) : '',
                        load: loggedRow.load_kg !== null ? String(loggedRow.load_kg) : '',
                      },
                    }));
                    setCorrecting(loggedRow.id);
                  }

                  return (
                    <div key={setNumber} className="gym-set-row" data-done={!!loggedRow}>
                      {isCorrecting ? (
                        <button
                          type="button"
                          className="n num"
                          aria-label={`Cancel correcting set ${setNumber}`}
                          onClick={() => setCorrecting(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            color: 'inherit',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          {setNumber}
                        </button>
                      ) : (
                        <span className="n num">{setNumber}</span>
                      )}
                      {loggedRow && isCorrecting ? (
                        <>
                          <input
                            className="field"
                            type="number"
                            inputMode="numeric"
                            aria-label={`Set ${setNumber} corrected reps`}
                            value={correctionDraft?.reps ?? ''}
                            onChange={(e) =>
                              setCorrectionDrafts((d) => ({
                                ...d,
                                [loggedRow.id]: { ...(correctionDraft ?? { reps: '', load: '' }), reps: e.target.value },
                              }))
                            }
                          />
                          <input
                            className="field"
                            type="number"
                            step="0.5"
                            inputMode="decimal"
                            aria-label={`Set ${setNumber} corrected load in kg`}
                            value={correctionDraft?.load ?? ''}
                            onChange={(e) =>
                              setCorrectionDrafts((d) => ({
                                ...d,
                                [loggedRow.id]: { ...(correctionDraft ?? { reps: '', load: '' }), load: e.target.value },
                              }))
                            }
                          />
                        </>
                      ) : loggedRow ? (
                        <>
                          {/* screens/gym-logging.md: "Tapping [a completed set row]
                           * re-opens it for correction." Buttons, not a click handler on
                           * the display span alone, so this is reachable without a mouse. */}
                          <button
                            type="button"
                            className="num"
                            onClick={openCorrection}
                            aria-label={`Correct set ${setNumber}, logged ${loggedRow.reps_completed ?? 'no'} reps`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              font: 'inherit',
                              color: 'inherit',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            {loggedRow.reps_completed ?? '—'} reps
                          </button>
                          <button
                            type="button"
                            className="num"
                            onClick={openCorrection}
                            aria-label={`Correct set ${setNumber}, logged ${loggedRow.load_kg !== null ? `${loggedRow.load_kg} kg` : 'no load'}`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              font: 'inherit',
                              color: 'inherit',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            {loggedRow.load_kg !== null ? `${loggedRow.load_kg} kg` : '—'}
                          </button>
                        </>
                      ) : isNext ? (
                        <>
                          <input
                            className="field"
                            type="number"
                            inputMode="numeric"
                            aria-label={`Set ${setNumber} reps`}
                            value={draft.reps}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [ex.programme_exercise_id]: { ...draft, reps: e.target.value },
                              }))
                            }
                          />
                          <input
                            className="field"
                            type="number"
                            step="0.5"
                            inputMode="decimal"
                            aria-label={`Set ${setNumber} load in kg`}
                            value={draft.load}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [ex.programme_exercise_id]: { ...draft, load: e.target.value },
                              }))
                            }
                          />
                        </>
                      ) : (
                        <>
                          <span className="num" style={{ color: 'var(--faint)' }}>
                            ·
                          </span>
                          <span className="num" style={{ color: 'var(--faint)' }}>
                            ·
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={
                          isCorrecting
                            ? `Save correction for set ${setNumber}`
                            : loggedRow
                              ? `Set ${setNumber} logged`
                              : `Log set ${setNumber}`
                        }
                        aria-pressed={!!loggedRow && !isCorrecting}
                        disabled={isCorrecting ? correctionMutation.isPending : !isNext || logMutation.isPending}
                        onClick={() => {
                          if (isCorrecting && loggedRow) {
                            correctionMutation.mutate({
                              id: loggedRow.id,
                              reps: correctionDraft?.reps ?? '',
                              load: correctionDraft?.load ?? '',
                            });
                            return;
                          }
                          const input = buildSetInput(ex, setNumber, draft.reps, draft.load);
                          if (!input) {
                            setError('Something on this set did not check out. Try again.');
                            return;
                          }
                          logMutation.mutate(input);
                        }}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          border: `2px solid ${loggedRow ? 'var(--accent)' : 'var(--border-strong)'}`,
                          background: loggedRow ? 'var(--accent)' : 'transparent',
                          color: 'var(--on-accent)',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          cursor: isNext || isCorrecting ? 'pointer' : 'default',
                          justifySelf: 'center',
                        }}
                      >
                        {isCorrecting ? '↵' : loggedRow ? '✓' : ''}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {!alreadyComplete ? (
            <div className="card" style={{ marginTop: 4 }}>
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
            <p className="cap">This session is done.</p>
          )}
        </div>
      </div>

      {!alreadyComplete ? (
        <div className="gym-footer">
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {doneCount >= totalSets
              ? 'Finish session'
              : `Finish early · ${doneCount} of ${totalSets}`}
          </button>
          <p className="tiny" style={{ textAlign: 'center', marginTop: 8 }}>
            Sets save as you log them.
          </p>
        </div>
      ) : null}
    </div>
  );
}
