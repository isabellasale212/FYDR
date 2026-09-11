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
/* One panel is open at a time, so one id is enough and it can be a constant
   rather than derived from the set. */
const CORRECTION_ERROR_ID = 'gym-correction-error';

export function GymSessionSetsList({ sets }: Props) {
  const router = useRouter();
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { reps: string; load: string }>>({});
  const [error, setError] = useState<string | null>(null);
  /* Separate from `error` on purpose: a failed mutation sets a message with no
     field to blame, and marking an input invalid for a network error would be
     a lie told to the people who cannot check it. */
  const [invalidField, setInvalidField] = useState<'reps' | 'load' | null>(null);

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

  /** Why a correction cannot be sent, or null if it can.
   *
   *  A BLANK FIELD IS THE SUBTLE ONE. Migration 0045's revise_gym_set_log reads
   *  the payload with `coalesce((p_payload ->> 'reps')::int, v_original.reps)`,
   *  so null means "keep the original" — the RPC succeeds, changes nothing, and
   *  the panel closed on success. The athlete was told their correction landed
   *  when it had not. Blanks are refused here rather than silently ignored, and
   *  the message says what a blank actually does.
   *
   *  A NEGATIVE IS THE DANGEROUS ONE. gym_set_logs has no check constraint on
   *  reps_completed or load_kg, and volume_kg is generated from their product —
   *  so a stray minus sign would have written negative tonnage into a stored
   *  aggregate. This is the only guard on that path. */
  /* RETURNS THE FIELD, not just the message. It used to return a bare string,
     which read fine on screen and told a screen reader nothing: the message
     said "Reps has to be a whole number" while both inputs looked equally
     valid to assistive tech. The field name is what lets the wrong input carry
     aria-invalid, so the person who cannot see the red text still knows which
     box to go back to. */
  function validateCorrection(
    reps: string,
    load: string,
    original: GymSessionSetDetail,
  ): { field: 'reps' | 'load'; message: string } | null {
    if (reps.trim() === '') {
      return { field: 'reps', message: 'Enter the number of reps. A blank field leaves the set unchanged.' };
    }
    const r = Number(reps);
    if (!Number.isInteger(r) || r < 0) {
      return { field: 'reps', message: 'Reps has to be a whole number, 0 or more.' };
    }
    if (load.trim() === '' && original.load_kg !== null) {
      return { field: 'load', message: 'Enter the load, or cancel. A blank field leaves the set unchanged.' };
    }
    if (load.trim() !== '') {
      const l = Number(load);
      if (!Number.isFinite(l) || l < 0) return { field: 'load', message: 'Load has to be 0 kg or more.' };
      if (l > 9999.99) {
        return { field: 'load', message: 'That load is higher than this app records. Check the number.' };
      }
    }
    return null;
  }

  function openCorrection(s: GymSessionSetDetail) {
    setError(null);
    setInvalidField(null);
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
    <div className="stack" style={{ gap: 'var(--sp-10)' }}>
      {error ? (
        <p className="form-error" role="alert" id={CORRECTION_ERROR_ID}>
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
                  <td className="num sub">{s.set_number}</td>
                  <td className="nm">{s.exercise_name}</td>
                  {isCorrecting ? (
                    <>
                      <td className="r">
                        <input
                          className="field"
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          aria-label={`Set ${s.set_number} corrected reps`}
                          aria-invalid={invalidField === 'reps' || undefined}
                          aria-describedby={invalidField === 'reps' ? CORRECTION_ERROR_ID : undefined}
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
                          min="0"
                          step="0.5"
                          inputMode="decimal"
                          aria-label={`Set ${s.set_number} corrected load in kg`}
                          aria-invalid={invalidField === 'load' || undefined}
                          aria-describedby={invalidField === 'load' ? CORRECTION_ERROR_ID : undefined}
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
                            {
                              const problem = validateCorrection(draft.reps, draft.load, s);
                              if (problem) {
                                setError(problem.message);
                                setInvalidField(problem.field);
                                return;
                              }
                              setError(null);
                              setInvalidField(null);
                              correctionMutation.mutate({ id: s.id, reps: draft.reps, load: draft.load });
                            }
                          }
                          style={{ marginInlineEnd: 6 }}
                        >
                          {correctionMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={correctionMutation.isPending}
                          /* Clears the error too. Cancel used to leave a
                             validation message on screen with no panel under it
                             — an error about a form the athlete had just closed,
                             which is its own small piece of nonsense. */
                          onClick={() => {
                            setError(null);
                            setInvalidField(null);
                            setCorrecting(null);
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Words for an absent number, never a dash — ATH-ADULT-12/13,
                          the rule the rest of My data follows. */}
                      <td className="r num" data-missing={s.reps_completed === null ? '' : undefined}>
                        {s.reps_completed ?? 'Not logged'}
                      </td>
                      <td className="r num" data-missing={s.load_kg === null ? '' : undefined}>
                        {s.load_kg !== null ? `${s.load_kg} kg` : 'Not logged'}
                      </td>
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
      {/* The board's two sentences (ATH-ADULT-13). Both true of revise_gym_set_log
          (0044/0045): the original row is kept as superseded, and nothing limits
          how long after a session a set can be corrected. */}
      <p className="tiny">
        A correction keeps the original. Corrections stay open on a finished
        session.
      </p>
    </div>
  );
}
