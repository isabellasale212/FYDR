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
 *  UNIT IS RENDERED INERT, ON PURPOSE. The design puts a Unit picker beside
 *  Primary muscle. There is no `exercises.unit` column (04-data-model.md's
 *  exercises table and the generated Database type both stop at name,
 *  category, primary_muscle, equipment, is_unilateral, video_url, cues and
 *  one_rm_test_definition_id) and `createExercise` has nowhere to put one, so
 *  a live picker here would take a coach's choice and silently drop it on
 *  submit. It is drawn, disabled, with a caption saying why — the light-theme
 *  handoff §9's own rule for an option that is genuinely unavailable — rather
 *  than either omitted from the layout or faked. A unit in this product is
 *  today a property of the prescription's load basis, not of the exercise
 *  (programme-builder.md §709's Basis/Value/Unit table). Enabling it needs a
 *  migration and a `createExercise` change, which is a product decision.
 */
export function ExerciseForm({ orgId, strengthTests }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('squat');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [cues, setCues] = useState('');
  const [oneRmTestDefinitionId, setOneRmTestDefinitionId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setName('');
    setCategory('squat');
    setPrimaryMuscle('');
    setCues('');
    setOneRmTestDefinitionId('');
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
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setName('');
      setPrimaryMuscle('');
      setCues('');
      setOneRmTestDefinitionId('');
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
            <span className="exlib-flabel">Unit</span>
            <select className="field" defaultValue="kg" disabled aria-disabled="true">
              <option value="kg">kg</option>
            </select>
          </label>
        </div>
        <p className="exlib-fhint">
          Unit is fixed: a unit belongs to a prescription&rsquo;s load basis, not to the exercise
          itself, so it is set in the programme builder.
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
