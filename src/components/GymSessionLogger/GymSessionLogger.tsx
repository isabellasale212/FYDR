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
  /* The athlete's chosen weight per exercise, keyed by programme_exercise_id.
     Empty until they touch a stepper — the recommendation is the value until
     then, so an untouched exercise shows the coach's number rather than a copy
     of it that has stopped tracking changes. */
  const [weights, setWeights] = useState<Record<string, number>>({});
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

  /* One plate a side on a barbell. The brief does not name a step; 2.5 is the
     smallest change most gyms can actually make. */
  const WEIGHT_STEP_KG = 2.5;

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
      router.push('/programme?submitted=gym');
      router.refresh();
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
                  return (
                    <div className="gym-weight">
                      <div className="gym-weight-label">
                        <div className="k">{overridden ? 'Your weight' : 'Recommended'}</div>
                        <div className="n" data-warn={overridden ? '' : undefined}>
                          {overridden ? (
                            <>
                              recommended <span className="num">{rec}</span> kg
                            </>
                          ) : (
                            'change it if it is not right today'
                          )}
                        </div>
                      </div>
                      <div className="gym-stepper">
                        <button
                          type="button"
                          onClick={() => bumpWeight(ex, -WEIGHT_STEP_KG)}
                          aria-label={`Decrease the weight for ${ex.exercise_name}`}
                        >
                          &minus;
                        </button>
                        <span className="v num">
                          {cur}
                          <small>kg</small>
                        </span>
                        <button
                          type="button"
                          onClick={() => bumpWeight(ex, WEIGHT_STEP_KG)}
                          aria-label={`Increase the weight for ${ex.exercise_name}`}
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
