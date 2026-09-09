'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createOverride, type Exercise, type ProgrammeExerciseOption } from '@/lib/queries/programmes';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { OverrideType } from '@/lib/types/database';

type Props = {
  orgId: string;
  userId: string;
  athleteId: string;
  exerciseOptions: readonly ProgrammeExerciseOption[];
  substituteOptions: readonly Exercise[];
};

const TYPE_COPY: Record<OverrideType, string> = {
  exempt: 'Remove this exercise for this athlete',
  substitute: 'Swap this exercise for another',
  volume: 'Change sets and reps',
  load_cap: 'Cap the load — if the programme prescribes less, the programme wins',
  note: 'Add a note this athlete will see',
};

/** screens/programme-builder.md "Tailoring", the five override types in the
 *  spec's own precedence order. Reason is required on exempt, substitute and
 *  load_cap per that section ("an unexplained exemption is unreadable to the
 *  next coach"); optional on volume and note. Expiry offers two fixed windows
 *  plus none — "End of block" from the fuller spec needs a block start date
 *  this schema does not carry, so it is not offered (a real, small cut). */
export function OverrideForm({ orgId, userId, athleteId, exerciseOptions, substituteOptions }: Props) {
  const router = useRouter();
  const [programmeExerciseId, setProgrammeExerciseId] = useState(exerciseOptions[0]?.id ?? '');
  const [overrideType, setOverrideType] = useState<OverrideType>('load_cap');
  const [substituteExerciseId, setSubstituteExerciseId] = useState(substituteOptions[0]?.id ?? '');
  const [sets, setSets] = useState('');
  const [repsMin, setRepsMin] = useState('');
  const [repsMax, setRepsMax] = useState('');
  const [loadValue, setLoadValue] = useState('');
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState<'none' | '2w' | '4w'>('none');
  const [error, setError] = useState<string | null>(null);

  const requiresReason = overrideType === 'exempt' || overrideType === 'substitute' || overrideType === 'load_cap';

  const mutation = useMutation({
    mutationFn: () => {
      const expiresAt =
        expiry === 'none'
          ? null
          : new Date(Date.now() + (expiry === '2w' ? 14 : 28) * 24 * 60 * 60 * 1000).toISOString();
      return withWriteTimeout(
        createOverride(createClient(), orgId, userId, {
          programmeExerciseId,
          athleteId,
          overrideType,
          substituteExerciseId: overrideType === 'substitute' ? substituteExerciseId || null : null,
          sets: overrideType === 'volume' && sets.trim() !== '' ? Number(sets) : null,
          repsMin: overrideType === 'volume' && repsMin.trim() !== '' ? Number(repsMin) : null,
          repsMax: overrideType === 'volume' && repsMax.trim() !== '' ? Number(repsMax) : null,
          loadValue: overrideType === 'load_cap' && loadValue.trim() !== '' ? Number(loadValue) : null,
          reason: reason.trim() || null,
          expiresAt,
        }),
      );
    },
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setReason('');
      setSets('');
      setRepsMin('');
      setRepsMax('');
      setLoadValue('');
      setExpiry('none');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  if (exerciseOptions.length === 0) {
    return <p className="tiny">No exercises prescribed in this programme yet — nothing to tailor.</p>;
  }

  return (
    <form
      className="stack"
      style={{ gap: 'var(--sp-8)' }}
      onSubmit={(event) => {
        event.preventDefault();
        if (requiresReason && !reason.trim()) return setError('A reason is required for this override type.');
        if (overrideType === 'substitute' && !substituteExerciseId) return setError('Pick a replacement exercise.');
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
        <span className="label">Exercise</span>
        <select className="field" value={programmeExerciseId} onChange={(e) => setProgrammeExerciseId(e.target.value)}>
          {exerciseOptions.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.session_name} — {ex.exercise_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Override type</span>
        <select className="field" value={overrideType} onChange={(e) => setOverrideType(e.target.value as OverrideType)}>
          {(Object.keys(TYPE_COPY) as OverrideType[]).map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>
        <p className="cap" style={{ marginTop: 'var(--sp-4)' }}>
          {TYPE_COPY[overrideType]}
        </p>
      </label>

      {overrideType === 'substitute' ? (
        <label>
          <span className="label">Replacement exercise</span>
          <select className="field" value={substituteExerciseId} onChange={(e) => setSubstituteExerciseId(e.target.value)}>
            {substituteOptions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {overrideType === 'volume' ? (
        <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
          <label style={{ flex: 1 }}>
            <span className="label">Sets</span>
            <input className="field" type="number" inputMode="numeric" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            <span className="label">Reps min</span>
            <input className="field" type="number" inputMode="numeric" min="0" value={repsMin} onChange={(e) => setRepsMin(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            <span className="label">Reps max</span>
            <input className="field" type="number" inputMode="numeric" min="0" value={repsMax} onChange={(e) => setRepsMax(e.target.value)} />
          </label>
        </div>
      ) : null}

      {overrideType === 'load_cap' ? (
        <label>
          <span className="label">Cap value, in the parent&rsquo;s own unit (kg, % or RPE)</span>
          <input className="field" type="number" step="0.5" inputMode="decimal" value={loadValue} onChange={(e) => setLoadValue(e.target.value)} />
        </label>
      ) : null}

      <label>
        <span className="label">{overrideType === 'note' ? 'Note' : `Reason${requiresReason ? '' : ' (optional)'}`}</span>
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>

      <label>
        <span className="label">Expires</span>
        <select className="field" value={expiry} onChange={(e) => setExpiry(e.target.value as typeof expiry)}>
          <option value="none">No expiry</option>
          <option value="2w">2 weeks</option>
          <option value="4w">4 weeks</option>
        </select>
      </label>

      <button type="submit" className="btn-primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Add override'}
      </button>
    </form>
  );
}
