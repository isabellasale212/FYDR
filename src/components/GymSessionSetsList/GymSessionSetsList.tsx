'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { reviseGymSetLog, type GymSessionSetDetail } from '@/lib/queries/programmes';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = {
  sets: readonly GymSessionSetDetail[];
};

/** My Data, gym tab, session detail — my-data/page.tsx's own header comment named this
 *  the one segment with no history view at all. Deliberately minimal: a flat list of sets
 *  with an inline "Correct" affordance per row, same revise_gym_set_log path
 *  GymSessionLogger's own completed-row correction uses, no rest timer or previous-
 *  performance context (this is a read of history, not mid-workout). */
export function GymSessionSetsList({ sets }: Props) {
  const router = useRouter();
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { reps: string; load: string }>>({});
  const [error, setError] = useState<string | null>(null);

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

  function openCorrection(s: GymSessionSetDetail) {
    setError(null);
    setDrafts((d) => ({
      ...d,
      [s.id]: {
        reps: s.reps_completed !== null ? String(s.reps_completed) : '',
        load: s.load_kg !== null ? String(s.load_kg) : '',
      },
    }));
    setCorrecting(s.id);
  }

  if (sets.length === 0) {
    return <p className="cap">No sets were logged for this session.</p>;
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <caption className="visually-hidden">Sets logged in this session</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Exercise</th>
              <th scope="col" className="r">
                Reps
              </th>
              <th scope="col" className="r">
                Load
              </th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => {
              const draft = drafts[s.id] ?? {
                reps: s.reps_completed !== null ? String(s.reps_completed) : '',
                load: s.load_kg !== null ? String(s.load_kg) : '',
              };
              const isCorrecting = correcting === s.id;
              return (
                <tr key={s.id}>
                  <td className="mono sub">{s.set_number}</td>
                  <td className="nm">{s.exercise_name}</td>
                  {isCorrecting ? (
                    <>
                      <td className="r">
                        <input
                          className="field"
                          type="number"
                          inputMode="numeric"
                          aria-label={`Set ${s.set_number} corrected reps`}
                          value={draft.reps}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [s.id]: { ...draft, reps: e.target.value } }))
                          }
                          style={{ width: 64, textAlign: 'right' }}
                        />
                      </td>
                      <td className="r">
                        <input
                          className="field"
                          type="number"
                          step="0.5"
                          inputMode="decimal"
                          aria-label={`Set ${s.set_number} corrected load in kg`}
                          value={draft.load}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [s.id]: { ...draft, load: e.target.value } }))
                          }
                          style={{ width: 72, textAlign: 'right' }}
                        />
                      </td>
                      <td className="sub">
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={correctionMutation.isPending}
                          onClick={() =>
                            correctionMutation.mutate({ id: s.id, reps: draft.reps, load: draft.load })
                          }
                          style={{ marginInlineEnd: 6 }}
                        >
                          {correctionMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={correctionMutation.isPending}
                          onClick={() => setCorrecting(null)}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="r mono">{s.reps_completed ?? '—'}</td>
                      <td className="r mono">{s.load_kg !== null ? `${s.load_kg} kg` : '—'}</td>
                      <td className="sub">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => openCorrection(s)}
                        >
                          Correct
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tiny">
        Correcting a set keeps the original, marks it superseded, and records a linked
        revision — nothing is overwritten.
      </p>
    </div>
  );
}
