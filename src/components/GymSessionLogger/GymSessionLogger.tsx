'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { completeSessionLog, logSet, type LoggedSet, type ResolvedExercise } from '@/lib/queries/programmes';
import { enumLabel } from '@/lib/format';

type Props = {
  orgId: string;
  gymSessionLogId: string;
  exercises: readonly ResolvedExercise[];
  loggedSets: readonly LoggedSet[];
  alreadyComplete: boolean;
};

function loadLabel(ex: ResolvedExercise): string {
  if (ex.load_basis === 'none') return 'No prescribed load';
  if (ex.load_basis === 'absolute') return ex.load_value !== null ? `${ex.load_value} kg` : 'Load not set';
  if (ex.load_basis === 'percent_bw') return ex.load_value !== null ? `${ex.load_value}% bodyweight` : 'Not set';
  if (ex.load_basis === 'rpe') return ex.load_value !== null ? `Target RPE ${ex.load_value}` : 'Target RPE not set';
  // percent_1rm: this pass has no test_definitions/test_results to resolve against.
  // Honest, not a guess — screens/gym-logging.md's own copy for this exact case.
  return 'No one rep max on file. Log the load you lift.';
}

export function GymSessionLogger({ orgId, gymSessionLogId, exercises, loggedSets, alreadyComplete }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { reps: string; load: string; rpe: string }>>({});
  const [sessionRpe, setSessionRpe] = useState('');

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

  const logMutation = useMutation({
    mutationFn: (input: { programmeExerciseId: string; exerciseId: string; setNumber: number; reps: string; load: string; rpe: string }) =>
      logSet(createClient(), orgId, {
        gymSessionLogId,
        programmeExerciseId: input.programmeExerciseId,
        exerciseId: input.exerciseId,
        setNumber: input.setNumber,
        repsCompleted: input.reps.trim() === '' ? null : Number(input.reps),
        loadKg: input.load.trim() === '' ? null : Number(input.load),
        rpe: input.rpe.trim() === '' ? null : Number(input.rpe),
      }),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeSessionLog(createClient(), gymSessionLogId, sessionRpe.trim() === '' ? null : Number(sessionRpe)),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.push('/programme');
      router.refresh();
    },
  });

  function draftFor(exerciseId: string) {
    return drafts[exerciseId] ?? { reps: '', load: '', rpe: '' };
  }

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {exercises.map((ex) => {
        const done = setsByExercise.get(ex.programme_exercise_id) ?? [];
        const draft = draftFor(ex.programme_exercise_id);
        const nextSet = done.length + 1;
        return (
          <section key={ex.programme_exercise_id} className="card">
            <h2 className="card-title">{ex.exercise_name}</h2>
            <p className="tiny">
              {ex.sets} sets × {ex.reps_min ?? '?'}
              {ex.reps_max && ex.reps_max !== ex.reps_min ? `–${ex.reps_max}` : ''} reps · {loadLabel(ex)}
              {ex.rest_seconds ? ` · ${ex.rest_seconds}s rest` : ''}
            </p>
            {ex.notes ? <p className="tiny">{ex.notes}</p> : null}

            {done.length > 0 ? (
              <div className="stack" style={{ gap: 4, marginTop: 8 }}>
                {done.map((s) => (
                  <div key={s.id} className="tiny mono">
                    Set {s.set_number}: {s.reps_completed ?? '—'} reps
                    {s.load_kg !== null ? ` @ ${s.load_kg}kg` : ''}
                    {s.rpe !== null ? ` RPE ${s.rpe}` : ''}
                  </div>
                ))}
              </div>
            ) : null}

            {!alreadyComplete && nextSet <= ex.sets ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
                <label style={{ flex: 1 }}>
                  <span className="label">Reps</span>
                  <input
                    className="field"
                    type="number"
                    value={draft.reps}
                    onChange={(e) => setDrafts((d) => ({ ...d, [ex.programme_exercise_id]: { ...draft, reps: e.target.value } }))}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  <span className="label">Load (kg)</span>
                  <input
                    className="field"
                    type="number"
                    step="0.5"
                    value={draft.load}
                    onChange={(e) => setDrafts((d) => ({ ...d, [ex.programme_exercise_id]: { ...draft, load: e.target.value } }))}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  <span className="label">RPE</span>
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max="10"
                    value={draft.rpe}
                    onChange={(e) => setDrafts((d) => ({ ...d, [ex.programme_exercise_id]: { ...draft, rpe: e.target.value } }))}
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={logMutation.isPending}
                  onClick={() =>
                    logMutation.mutate({
                      programmeExerciseId: ex.programme_exercise_id,
                      exerciseId: ex.exercise_id,
                      setNumber: nextSet,
                      reps: draft.reps,
                      load: draft.load,
                      rpe: draft.rpe,
                    })
                  }
                >
                  Set {nextSet}
                </button>
              </div>
            ) : !alreadyComplete ? (
              <p className="tiny" style={{ marginTop: 8 }}>
                All {ex.sets} sets logged.
              </p>
            ) : null}
          </section>
        );
      })}

      {!alreadyComplete ? (
        <section className="card">
          <label>
            <span className="label">Session RPE (optional)</span>
            <input className="field" type="number" min="1" max="10" value={sessionRpe} onChange={(e) => setSessionRpe(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 10 }}
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {completeMutation.isPending ? 'Finishing…' : 'Finish session'}
          </button>
        </section>
      ) : (
        <p className="cap">{enumLabel('complete')} — this session is done.</p>
      )}
    </div>
  );
}
