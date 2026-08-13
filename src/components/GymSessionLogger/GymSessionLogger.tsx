'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { completeSessionLog, logSet, type LoggedSet, type ResolvedExercise } from '@/lib/queries/programmes';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { formatDate } from '@/lib/format';

type Props = {
  orgId: string;
  gymSessionLogId: string;
  sessionName: string;
  startedAt: string | null;
  totalSets: number;
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
function loadLabel(ex: ResolvedExercise): string {
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
    return `${ex.resolved_load_kg} kg (${ex.load_value}% of your 1RM${ex.one_rm_test_date ? `, tested ${formatDate(ex.one_rm_test_date)}` : ''})`;
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
  startedAt,
  totalSets,
  exercises,
  loggedSets,
  alreadyComplete,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { reps: string; load: string }>>({});
  const [sessionRpe, setSessionRpe] = useState('');
  const [now, setNow] = useState<number | null>(null);

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

  /* Both writes are bounded (ten seconds) and both have a real onError —
   * before this, a thrown network failure showed nothing at all and a hung
   * request pinned the tick button disabled forever (audit S5's shape,
   * on the screen whose footer promises "sets save as you log them"). A
   * failed set stays on screen as the next set to log: tapping the tick
   * again is the retry. */
  const logMutation = useMutation({
    mutationFn: async (input: { programmeExerciseId: string; exerciseId: string; setNumber: number; reps: string; load: string }) => {
      const result = await withWriteTimeout(
        logSet(createClient(), orgId, {
          gymSessionLogId,
          programmeExerciseId: input.programmeExerciseId,
          exerciseId: input.exerciseId,
          setNumber: input.setNumber,
          repsCompleted: input.reps.trim() === '' ? null : Number(input.reps),
          loadKg: input.load.trim() === '' ? null : Number(input.load),
          rpe: null,
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setError(null);
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
      <div className="gym-head">
        <div className="gym-head-row">
          <Link href="/programme" className="gym-close" aria-label="Close">
            Close
          </Link>
          <div className="gym-head-mid">
            <div className="nm">{sessionName}</div>
            <div className="prog mono">
              {doneCount} of {totalSets} sets
            </div>
          </div>
          <span className="gym-clock mono">{now !== null ? elapsed(startedAt, now) : '·'}</span>
        </div>
        <div className="gym-progress-track">
          <div className="gym-progress-fill" style={{ width: `${pct}%` }} />
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
              <div key={ex.programme_exercise_id} className="gym-ex-card">
                <div className="gym-ex-head">
                  <span className="nm">{ex.exercise_name}</span>
                  <span className="scheme mono">
                    {schemeLabel(ex)} @ {loadLabel(ex)}
                    {ex.rest_seconds ? ` · ${ex.rest_seconds}s rest` : ''}
                  </span>
                </div>

                {Array.from({ length: ex.sets }, (_, i) => {
                  const setNumber = i + 1;
                  const loggedRow = done.find((s) => s.set_number === setNumber);
                  const isNext = !alreadyComplete && setNumber === nextSetNumber;

                  return (
                    <div key={setNumber} className="gym-set-row" data-done={!!loggedRow}>
                      <span className="n mono">{setNumber}</span>
                      {loggedRow ? (
                        <>
                          <span className="mono">{loggedRow.reps_completed ?? '—'} reps</span>
                          <span className="mono">{loggedRow.load_kg !== null ? `${loggedRow.load_kg} kg` : '—'}</span>
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
                          <span className="mono" style={{ color: 'var(--faint)' }}>
                            ·
                          </span>
                          <span className="mono" style={{ color: 'var(--faint)' }}>
                            ·
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={loggedRow ? `Set ${setNumber} logged` : `Log set ${setNumber}`}
                        aria-pressed={!!loggedRow}
                        disabled={!isNext || logMutation.isPending}
                        onClick={() =>
                          logMutation.mutate({
                            programmeExerciseId: ex.programme_exercise_id,
                            exerciseId: ex.exercise_id,
                            setNumber,
                            reps: draft.reps,
                            load: draft.load,
                          })
                        }
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          border: `2px solid ${loggedRow ? 'var(--accent)' : 'var(--border-strong)'}`,
                          background: loggedRow ? 'var(--accent)' : 'transparent',
                          color: 'var(--on-accent)',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          cursor: isNext ? 'pointer' : 'default',
                          justifySelf: 'center',
                        }}
                      >
                        {loggedRow ? '✓' : ''}
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
