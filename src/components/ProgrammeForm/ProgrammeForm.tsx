'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createProgramme } from '@/lib/queries/programmes';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { ProgrammeType } from '@/lib/types/database';

type Props = { orgId: string; userId: string; isCoach: boolean; isMedical: boolean };

export function ProgrammeForm({ orgId, userId, isCoach, isMedical }: Props) {
  const router = useRouter();
  const defaultType: ProgrammeType = isCoach ? 'gym' : 'rehab';
  const [programmeType, setProgrammeType] = useState<ProgrammeType>(defaultType);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        createProgramme(createClient(), orgId, userId, {
          name,
          programmeType,
          goal: goal.trim() || null,
          durationWeeks: durationWeeks.trim() === '' ? null : Number(durationWeeks),
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      if (result.id) {
        router.push(`/programmes/${result.id}`);
        router.refresh();
        return;
      }
      /* Neither an error nor an id used to fall through to nothing at all —
         a silent no-op success. Say something true instead. */
      setError('That didn’t save. Try again in a moment.');
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

      {isCoach && isMedical ? (
        <div>
          <p className="label">Type</p>
          <div className="chiprow">
            <button
              type="button"
              className="squad-chip"
              aria-pressed={programmeType === 'gym'}
              onClick={() => setProgrammeType('gym')}
            >
              Gym
            </button>
            <button
              type="button"
              className="squad-chip"
              aria-pressed={programmeType === 'rehab'}
              onClick={() => setProgrammeType('rehab')}
            >
              Rehab
            </button>
          </div>
        </div>
      ) : (
        <p className="tiny">
          {isCoach ? 'This will be a gym programme.' : 'This will be a rehab programme.'}
        </p>
      )}

      <label>
        <span className="label">Name</span>
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Pre-season strength" />
      </label>
      <label>
        <span className="label">Goal (optional)</span>
        <input className="field" value={goal} onChange={(event) => setGoal(event.target.value)} />
      </label>
      <label>
        <span className="label">Duration, weeks (optional)</span>
        <input
          className="field"
          type="number"
          inputMode="numeric"
          min="1"
          max="52"
          value={durationWeeks}
          onChange={(event) => setDurationWeeks(event.target.value)}
        />
      </label>

      <button type="submit" className="btn-primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create programme'}
      </button>
    </form>
  );
}
