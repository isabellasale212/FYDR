'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createExercise, type StrengthTestDefinition } from '@/lib/queries/programmes';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { ExerciseCategory } from '@/lib/types/database';
import { enumLabel } from '@/lib/format';

const CATEGORIES: ExerciseCategory[] = [
  'squat',
  'hinge',
  'push',
  'pull',
  'carry',
  'olympic',
  'plyo',
  'core',
  'mobility',
  'conditioning',
];

type Props = { orgId: string; strengthTests: readonly StrengthTestDefinition[] };

/** The exercise library's "Add an exercise" card. The <form> IS the card, so
 *  the actions can be pinned to its bottom edge with `margin-top: auto` and the
 *  card can stretch to the height of the list beside it — see .exlib-form in
 *  base.css.
 *
 *  THE SLOT BESIDE PRIMARY MUSCLE. The design drew a Unit picker there,
 *  rendered inert until 12 Sept 2026 because no `exercises.unit` column
 *  existed (a unit is a property of the prescription's load basis, not of
 *  the exercise — programme-builder.md §709's Basis/Value/Unit table). The
 *  slot now carries the one per-movement number the athlete app needs:
 *  the WEIGHT STEP (`exercises.weight_step_kg`, migration 0108, ATH-ADULT-09
 *  C3) — what the logger's stepper moves by. 2.5 kg by default, a plate a
 *  side; 2 for most dumbbells; 1.25 for a microloaded bar; 5 for a
 *  plate-loaded machine. Existing exercises keep 2.5 (there is no edit form
 *  for a library row yet — recorded on the decision sheet).
 */

/* Bare figures: the slot is half a row wide and a longer label truncates in
   the native select. What each is for is the hint beneath. */
const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5] as const;
export function ExerciseForm({ orgId, strengthTests }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('squat');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [cues, setCues] = useState('');
  const [oneRmTestDefinitionId, setOneRmTestDefinitionId] = useState('');
  const [weightStepKg, setWeightStepKg] = useState<number>(2.5);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setName('');
    setCategory('squat');
    setPrimaryMuscle('');
    setCues('');
    setOneRmTestDefinitionId('');
    setWeightStepKg(2.5);
  };

  const mutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        createExercise(createClient(), orgId, {
          name,
          category,
          primaryMuscle: primaryMuscle.trim() || null,
          cues: cues.trim() || null,
          oneRmTestDefinitionId: oneRmTestDefinitionId || null,
          weightStepKg,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setName('');
      setPrimaryMuscle('');
      setCues('');
      setOneRmTestDefinitionId('');
      setWeightStepKg(2.5);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <form
      className="card exlib-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return setError('Name it first.');
        setError(null);
        mutation.mutate();
      }}
    >
      <h2 className="exlib-form-title">Add an exercise</h2>
      <p className="exlib-form-help">
        Name and category are required. Everything else can be filled in later from the exercise
        itself.
      </p>

      {error ? (
        <p className="form-error exlib-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="exlib-fields">
        <label className="exlib-field">
          <span className="exlib-flabel">Name</span>
          <input
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Trap bar deadlift"
          />
        </label>

        <label className="exlib-field">
          <span className="exlib-flabel">Category</span>
          <select
            className="field"
            value={category}
            onChange={(event) => setCategory(event.target.value as ExerciseCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {enumLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <div className="exlib-2up">
          <label className="exlib-field">
            <span className="exlib-flabel">Primary muscle</span>
            <input
              className="field"
              value={primaryMuscle}
              onChange={(event) => setPrimaryMuscle(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="exlib-field">
            <span className="exlib-flabel">Weight step</span>
            <select
              className="field"
              value={String(weightStepKg)}
              onChange={(event) => setWeightStepKg(Number(event.target.value))}
            >
              {WEIGHT_STEPS.map((step) => (
                <option key={step} value={String(step)}>
                  {step} kg
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* One line: what the number is for, in the athlete's terms. */}
        <p className="exlib-fhint">
          What the athlete&rsquo;s weight stepper moves by: 2.5 a plate a side, 2 for dumbbells, 1.25 microloaded.
        </p>

        <label className="exlib-field">
          <span className="exlib-flabel">Coaching cues</span>
          <textarea
            className="field exlib-textarea"
            rows={2}
            value={cues}
            onChange={(event) => setCues(event.target.value)}
            placeholder="Optional · shown to the athlete under the set"
          />
        </label>

        <label className="exlib-field">
          <span className="exlib-flabel">
            1RM test <span className="exlib-fopt">optional</span>
          </span>
          <select
            className="field"
            value={oneRmTestDefinitionId}
            onChange={(event) => setOneRmTestDefinitionId(event.target.value)}
          >
            <option value="">Not linked</option>
            {strengthTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="exlib-note">
        Without a link, a “% of 1RM” prescription stays unavailable for this exercise rather than
        being guessed from a similar lift.
      </p>

      {strengthTests.length === 0 ? (
        <p className="exlib-note">
          No strength-category tests exist yet, so nothing can be linked as a 1RM source. Add one
          from Testing first if you want “% of 1RM” prescriptions to resolve to a real weight.
        </p>
      ) : null}

      <div className="exlib-actions">
        <button type="submit" className="btn-primary exlib-submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Adding…' : 'Add exercise'}
        </button>
        {/* There is no dialog to dismiss — the card is part of the page — so
            Cancel clears the draft rather than closing anything. */}
        <button type="button" className="btn-ghost exlib-cancel" onClick={clear} disabled={mutation.isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
