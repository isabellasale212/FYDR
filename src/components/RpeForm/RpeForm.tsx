'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CR10List } from '@/components/CR10List/CR10List';
import { createClient } from '@/lib/supabase/client';
import { submitTrainingEntry } from '@/lib/queries/training';
import { qk } from '@/lib/queries/keys';
import { dequeueTraining, enqueueTraining } from '@/lib/outbox';
import { TrainingEntryInput } from '@/lib/validation/training';

/* The correction mode is gone, for the reasons written out at the top of
 * CheckInForm.tsx — the same club instruction, the same migration (0058, which
 * narrowed `revise_training_entry` to coach/medical), and the same refusal to
 * leave behind a form that would take an athlete's answers and then be refused
 * by the database. Coaches correct a rating on the player profile instead
 * (components/EntryCorrectionPanel). */

type Props = {
  orgId: string;
  athleteId: string;
  userId: string;
  sessionId: string;
  entryDate: string;
  scheduledDurationMin: number | null;
  /** For the toast on Today after a fresh submit — ATHLETE-APP-SPEC.md
   *  §13's literal copy names the session ("RPE 6.0 submitted for Team
   *  run"), which needs the title, not just the id this form otherwise
   *  only needs for the mutation. */
  sessionTitle: string;
};

const MIN_DURATION = 5;
const MAX_DURATION = 240;
const STEP = 5;

/**
 * How hard was it. One CR10 rating, a duration confirmation, an optional
 * note. screens/training-entry.md target: under 20 seconds.
 *
 * Simplified from the full spec for this pass: single session only (no
 * multi-session stepper, which is a push-notification bundling concern that
 * does not arise from a web route carrying one session id), no long-duration
 * or scheduled-mismatch soft confirmations, and no org-default duration
 * fallback (O-50 in 08-notifications.md is still open on what that default
 * even is). This form submits; it does not correct.
 */
export function RpeForm({
  orgId,
  athleteId,
  userId,
  sessionId,
  entryDate,
  scheduledDurationMin,
  sessionTitle,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  /* No prefill and therefore no rounding. The CR10-stop rounding that used to
   * sit here existed only for the correction mode: `training_entries.rpe` is
   * numeric(3,1) and 246 real rows carry a half point, which this screen's
   * whole-number CR10List and schema (O-411, validation/training.ts) cannot
   * express. Those halves are now only ever edited from the coach's panel,
   * whose own schema allows 0.5 steps precisely so they survive a correction. */
  const [rpe, setRpe] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(scheduledDurationMin);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (input: TrainingEntryInput) => {
      await submitTrainingEntry(createClient(), input, { orgId, athleteId, userId });
      return input;
    },
    onMutate: (input) => {
      enqueueTraining(input);
    },
    onSuccess: (input) => {
      dequeueTraining(input.id);
      void queryClient.invalidateQueries({
        queryKey: qk.training.entryForSession(orgId, athleteId, sessionId),
      });
    },
    onError: () => {
      /* Deliberately silent, same reasoning as CheckInForm: the entry is in
         the outbox and /today retries it. */
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rpe === null) {
      setInvalid('Choose a rating.');
      return;
    }
    if (duration === null) {
      setInvalid('Add a duration.');
      return;
    }

    const candidate = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      entry_date: entryDate,
      rpe,
      duration_min: duration,
      comment: note.trim() ? note.trim() : null,
      /* See CheckInForm's identical line: revision_of is never set from a client
       * form any more. Only revise_training_entry writes it, server side. */
    };

    const parsed = TrainingEntryInput.safeParse(candidate);
    if (!parsed.success) {
      setInvalid('Something on this rating did not check out. Try again.');
      return;
    }

    setInvalid(null);
    submitMutation.mutate(parsed.data);
    router.push(
      `/today?submitted=rpe&rpe=${rpe}&session=${encodeURIComponent(sessionTitle)}`,
    );
  }

  const submitLabel = rpe === null ? 'Choose a rating' : 'Submit rating';

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="dir">Rate the whole session, not the hardest bit.</p>

      <CR10List value={rpe} onChange={setRpe} />

      <div className="sc-h" style={{ paddingTop: 'var(--sp-14)' }}>
        <span className="sc-l" id="duration-label">
          How long were you training?
        </span>
      </div>
      <div className="step">
        <button
          type="button"
          className="btnc"
          onClick={() =>
            setDuration((d) => Math.max(MIN_DURATION, (d ?? MIN_DURATION) - STEP))
          }
          aria-label="5 minutes less"
        >
          &minus;
        </button>
        <div className="val">
          <div
            className="v num"
            role="status"
            aria-live="polite"
            aria-labelledby="duration-label"
          >
            {duration ?? '·'}
          </div>
          <div className="u">MINUTES</div>
        </div>
        <button
          type="button"
          className="btnc"
          onClick={() =>
            setDuration((d) => Math.min(MAX_DURATION, (d ?? 0) + STEP))
          }
          aria-label="5 minutes more"
        >
          +
        </button>
      </div>
      <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-2)' }}>
        {scheduledDurationMin !== null
          ? `Scheduled for ${scheduledDurationMin} min`
          : 'No scheduled length. Set how long you trained.'}
      </p>

      {noteOpen ? (
        <div style={{ marginTop: 'var(--sp-14)' }}>
          <label className="label" htmlFor="rpe-note">
            Add a note
          </label>
          <textarea
            id="rpe-note"
            className="field"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      ) : (
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 'var(--sp-14)', width: '100%' }}
          onClick={() => setNoteOpen(true)}
        >
          Add a note
        </button>
      )}

      {invalid ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {invalid}
        </p>
      ) : null}

      <div className="subm">
        {/* submitMutation.isPending closes a double-submit race — see
         * CheckInForm's identical guard for the full reasoning. Without it a
         * fast double-tap enqueues two outbox rows for the same
         * (athlete_id, entry_date, session_id) slot and the loser's insert
         * dies on training_entries_one_live_per_session. */}
        <button
          className="btn-primary"
          type="submit"
          disabled={rpe === null || submitMutation.isPending}
          style={{ width: '100%', minHeight: 56 }}
        >
          {submitLabel}
        </button>
        {/* Same sentence as the check-in form's, for the same reason: the rule
         * is easier to accept before submitting than to discover afterwards. */}
        <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
          Once this is sent it can&rsquo;t be edited. If the rating or the minutes
          are wrong, tell your coach &mdash; they can record a correction, and My
          Data will show you both what they changed it to and what you first sent.
        </p>
      </div>
    </form>
  );
}
