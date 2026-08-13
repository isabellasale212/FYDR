'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createExercise } from '@/lib/queries/programmes';
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

export function ExerciseForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('squat');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [cues, setCues] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        createExercise(createClient(), orgId, {
          name,
          category,
          primaryMuscle: primaryMuscle.trim() || null,
          cues: cues.trim() || null,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setName('');
      setPrimaryMuscle('');
      setCues('');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return setError('Name it first.');
        setError(null);
        mutation.mutate();
      }}
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <label>
        <span className="label">Name</span>
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Back squat" />
      </label>
      <label>
        <span className="label">Category</span>
        <select className="field" value={category} onChange={(event) => setCategory(event.target.value as ExerciseCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {enumLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Primary muscle (optional)</span>
        <input className="field" value={primaryMuscle} onChange={(event) => setPrimaryMuscle(event.target.value)} />
      </label>
      <label>
        <span className="label">Coaching cues (optional)</span>
        <input className="field" value={cues} onChange={(event) => setCues(event.target.value)} />
      </label>
      <button type="submit" className="btn-primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Adding…' : 'Add exercise'}
      </button>
    </form>
  );
}
