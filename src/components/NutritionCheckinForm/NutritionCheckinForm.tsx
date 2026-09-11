'use client';

import Link from 'next/link';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { submitCheckin, reviseCheckin } from '@/lib/queries/nutrition';
import { enqueueNutritionCheckin, dequeueNutritionCheckin } from '@/lib/outbox';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
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
  timezone: string;
  weekStart: string;
  correction?: Correction;
};

/** screens/nutrition-checkin.md. One question, three answers, an optional note,
 *  under 10 seconds. "Roughly" is deliberately the vague middle option — no
 *  arithmetic required. No colour-codes the three rows: colouring Yes green
 *  and No red tells an athlete which answer the app wants, which the spec
 *  calls out by name as the exact pressure that turns a self-report into
 *  self-presentation. */
export function NutritionCheckinForm({ orgId, athleteId, userId, timezone, weekStart, correction }: Props) {
  const router = useRouter();
  const [answer, setAnswer] = useState<'yes' | 'roughly' | 'no' | null>(
    correction?.initialAnswer ?? null,
  );
  const [note, setNote] = useState(correction?.initialNote ?? '');
  const [noteOpen, setNoteOpen] = useState(!!correction?.initialNote);
  const [error, setError] = useState<string | null>(null);
  /* Blocked until one of the three answers is chosen (A2); `pending`, below,
   * only while the send is in flight. */
  const blocked = !answer;

  /* Same offline contract as the wellness check-in (audit S5 / athlete
   * finding 18 was this exact form hanging on "Saving…" and losing the
   * answer): the check-in is queued on the phone before the send, the
   * athlete is on their way immediately, and if the send fails the entry
   * stays queued and /today's OutboxFlusher retries it. The insert is
   * idempotent under its client uuid, which is what makes the replay safe. */
  const submitMutation = useMutation({
    mutationFn: async (input: NutritionCheckinInput) => {
      await submitCheckin(createClient(), input, { orgId, athleteId, userId });
      return input;
    },
    onMutate: (input) => {
      enqueueNutritionCheckin(input);
    },
    onSuccess: (input) => {
      dequeueNutritionCheckin(input.id);
    },
    onError: () => {
      /* Deliberately silent: the answer is in the outbox and /today retries
         it. The athlete has already done the thing. */
    },
  });

  /* Corrections are online-only — a replayed revise cannot be told apart
   * from "already corrected" (see lib/outbox.ts) — so this path is bounded
   * instead: ten seconds to confirm, then a visible, human error with the
   * answer still on screen and the button live again. */
  const correctionMutation = useMutation({
    mutationFn: async () => {
      if (!correction || !answer) return;
      const result = await withWriteTimeout(
        reviseCheckin(createClient(), correction.originalId, answer, note.trim()),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => router.push('/my-data?tab=nutrition'),
    onError: (err: Error) => setError(toUserMessage(err, 'athlete')),
  });

  /* submitMutation.isPending closes the same double-submit race the
   * correction branch's correctionMutation.isPending already closed — see
   * CheckInForm's identical guard for the full reasoning. Without it a fast
   * double-tap enqueues two outbox rows for the same (athlete_id,
   * week_start) slot and the loser's insert dies on
   * nutrition_checkins_one_live_per_week. Reusing this same `pending` flag
   * for both `disabled` and the button label is deliberate: it is exactly
   * the same "Saving…" honesty the correction path already shows, now true
   * for the plain path too. */
  const pending = correction ? correctionMutation.isPending : submitMutation.isPending;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked) return;
    if (pending) return;
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
    /* On our way immediately, same as the wellness check-in: the answer is
       queued on the phone whatever the network does next. */
    router.push(`/today?submitted=nutrition&week=${weekStart}`);
  }

  const weekEnd = addDays(weekStart, 6);

  return (
    <form onSubmit={onSubmit} noValidate>
      {correction ? (
        <div className="banner" role="status" style={{ marginBottom: 'var(--sp-14)' }}>
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
        Week {isoWeekInfo(weekStart).isoWeek} · {formatDate(weekStart, timezone)} to {formatDate(weekEnd, timezone)}
      </p>
      <p className="dir" style={{ marginTop: 'var(--sp-8)' }}>
        Did you hit your protein target most days this week?
      </p>

      <div className="stack" style={{ marginTop: 'var(--sp-14)', gap: 'var(--sp-10)' }}>
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
        <div style={{ marginTop: 'var(--sp-14)' }}>
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
          {/* THIS POINTED AT A CONTROL THAT NO LONGER EXISTS. It sent an athlete
              with a medical concern to "Something not right?" on Today — a row
              the athlete redesign removed, and whose absence test-today-redesign.ts
              now asserts. So the sentence failed exactly the athlete most likely
              to follow it. Report a problem's only remaining entrance is the row
              on Me, so it names that, and links straight there rather than
              describing where to go. Guarded by test-control-names-resolve.ts. */}
          <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
            This note is visible to coaching staff. It is not a clinical field. For a
            medical matter, use{' '}
            <Link href="/report-problem">Report a problem</Link> under Me.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 'var(--sp-14)', width: '100%' }}
          onClick={() => setNoteOpen(true)}
        >
          Add a note (optional)
        </button>
      )}

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {error}
        </p>
      ) : null}

      {/* The shared footer — ATH-ADULT-03 A1/A2, 2026-09-11: count on its own
          line, blocked action aria-disabled in the kit secondary, nothing
          dimmed. THE LINE BENEATH IS UNCHANGED ON PURPOSE (D7): the board's
          addendum says this form's footer copy is defined by the ATH-ADULT-3b
          board, because a nutrition answer CAN be corrected; until that board
          is final the existing sentence stays. */}
      <div className="subm">
        <p className="subm-count" data-complete={blocked ? undefined : ''}>
          {blocked ? '0 of 1 answered · 1 to go' : 'Answered'}
        </p>
        <button
          className={blocked ? 'btn-ghost' : 'btn-primary'}
          type="submit"
          disabled={pending}
          aria-disabled={blocked || undefined}
          onClick={(event) => {
            if (blocked) event.preventDefault();
          }}
          style={{ width: '100%', minHeight: 56 }}
        >
          {pending ? 'Saving…' : 'Done'}
        </button>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
          {correction
            ? 'Corrections send straight away and need signal. If it can’t get through, you’ll see an error here and your answer stays put.'
            : 'Saved on this phone first — it sends even if your signal drops.'}
        </p>
      </div>
    </form>
  );
}
