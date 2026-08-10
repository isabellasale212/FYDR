'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { submitCheckin, reviseCheckin } from '@/lib/queries/nutrition';
import { NutritionCheckinInput } from '@/lib/validation/nutrition';
import { isoWeekInfo, formatDate, addDays } from '@/lib/format';

const ANSWERS = [
  { value: 'yes', label: 'Yes' },
  { value: 'roughly', label: 'Roughly' },
  { value: 'no', label: 'No' },
] as const;

type Correction = { originalId: string; initialAnswer: 'yes' | 'roughly' | 'no'; initialNote: string };

type Props = {
  orgId: string;
  athleteId: string;
  userId: string;
  weekStart: string;
  correction?: Correction;
};

/** screens/nutrition-checkin.md. One question, three answers, an optional note,
 *  under 10 seconds. "Roughly" is deliberately the vague middle option — no
 *  arithmetic required. No colour-codes the three rows: colouring Yes green
 *  and No red tells an athlete which answer the app wants, which the spec
 *  calls out by name as the exact pressure that turns a self-report into
 *  self-presentation. */
export function NutritionCheckinForm({ orgId, athleteId, userId, weekStart, correction }: Props) {
  const router = useRouter();
  const [answer, setAnswer] = useState<'yes' | 'roughly' | 'no' | null>(
    correction?.initialAnswer ?? null,
  );
  const [note, setNote] = useState(correction?.initialNote ?? '');
  const [noteOpen, setNoteOpen] = useState(!!correction?.initialNote);
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (input: NutritionCheckinInput) => {
      await submitCheckin(createClient(), input, { orgId, athleteId, userId });
    },
    onSuccess: () => router.push(`/today?submitted=nutrition&week=${weekStart}`),
    onError: (err: Error) => setError(err.message),
  });

  const correctionMutation = useMutation({
    mutationFn: async () => {
      if (!correction || !answer) return;
      const result = await reviseCheckin(createClient(), correction.originalId, answer, note.trim());
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => router.push('/my-data?tab=nutrition'),
    onError: (err: Error) => setError(err.message),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer) return setError('Choose an answer.');
    setError(null);

    if (correction) {
      correctionMutation.mutate();
      return;
    }

    const { isoYear, isoWeek } = isoWeekInfo(weekStart);
    const candidate = {
      id: crypto.randomUUID(),
      week_start: weekStart,
      iso_year: isoYear,
      iso_week: isoWeek,
      answer,
      note: note.trim() ? note.trim() : null,
    };
    const parsed = NutritionCheckinInput.safeParse(candidate);
    if (!parsed.success) {
      setError('Something on this answer did not check out. Try again.');
      return;
    }
    submitMutation.mutate(parsed.data);
  }

  const pending = correction ? correctionMutation.isPending : submitMutation.isPending;
  const weekEnd = addDays(weekStart, 6);

  return (
    <form onSubmit={onSubmit} noValidate>
      {correction ? (
        <div className="banner" role="status" style={{ marginBottom: 14 }}>
          <span className="g g-faint" aria-hidden="true">
            ⓘ
          </span>
          <div>
            Correcting your answer for this week. This creates a new revision; the
            original is kept, not overwritten.
          </div>
        </div>
      ) : null}

      <p className="eyebrow">
        Week {isoWeekInfo(weekStart).isoWeek} · {formatDate(weekStart)} to {formatDate(weekEnd)}
      </p>
      <p className="dir" style={{ marginTop: 8 }}>
        Did you hit your protein target most days this week?
      </p>

      <div className="stack" style={{ marginTop: 14, gap: 10 }}>
        {ANSWERS.map((a) => (
          <button
            key={a.value}
            type="button"
            className="nut-answer"
            aria-pressed={answer === a.value}
            onClick={() => setAnswer(a.value)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {noteOpen ? (
        <div style={{ marginTop: 14 }}>
          <label className="label" htmlFor="nutrition-note">
            Add a note
          </label>
          <textarea
            id="nutrition-note"
            className="field"
            rows={3}
            maxLength={280}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <p className="tiny" style={{ marginTop: 4 }}>
            This note is visible to coaching staff. It is not a clinical field &mdash;
            for a medical matter, use &ldquo;Something not right?&rdquo; on Today instead.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 14, width: '100%' }}
          onClick={() => setNoteOpen(true)}
        >
          Add a note (optional)
        </button>
      )}

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <div className="subm">
        <button
          className="btn-primary"
          type="submit"
          disabled={!answer || pending}
          style={{ width: '100%', minHeight: 56 }}
        >
          {pending ? 'Saving…' : answer ? 'Done' : 'Choose an answer'}
        </button>
      </div>
    </form>
  );
}
