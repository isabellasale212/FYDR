'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CR10List } from '@/components/CR10List/CR10List';
import { createClient } from '@/lib/supabase/client';
import { reviseTrainingEntry, submitTrainingEntry } from '@/lib/queries/training';
import { qk } from '@/lib/queries/keys';
import { dequeueTraining, enqueueTraining } from '@/lib/outbox';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { TrainingEntryInput } from '@/lib/validation/training';

type Correction = {
  originalId: string;
  initial: { rpe: number; duration_min: number };
};

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
  /** Present only when reached via "Correct this entry" — see
   *  CheckInForm's identical prop for the reasoning, which applies
   *  unchanged here. */
  correction?: Correction;
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
 * even is). Correction now shares the same mechanics as CheckInForm's: see
 * its comment on correctionMutation for why it is online-only.
 */
export function RpeForm({
  orgId,
  athleteId,
  userId,
  sessionId,
  entryDate,
  scheduledDurationMin,
  sessionTitle,
  correction,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  /* Rounded to the nearest whole CR10 stop. Caught live, same class of bug
   * as CheckInForm's sleep-hours rounding: `training_entries.rpe` is
   * numeric(3,1) so a staff-entered or imported value can carry a half
   * point (checked against real data: 246 rows do, including some marked
   * self_report), but this screen's CR10List and its validation schema are
   * whole numbers only, "per O-411" (see validation/training.ts). Without
   * rounding, correcting one of those entries submits the exact prefilled
   * value straight back through the same schema that rejects it. */
  const [rpe, setRpe] = useState<number | null>(
    correction ? Math.min(10, Math.max(1, Math.round(correction.initial.rpe))) : null,
  );
  const [duration, setDuration] = useState<number | null>(
    correction?.initial.duration_min ?? scheduledDurationMin,
  );
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

  /* Online-only and bounded, exactly like CheckInForm's correctionMutation —
   * see its comment for why corrections never queue and what the ten-second
   * ceiling buys (audit S5 / athlete finding 11). */
  const correctionMutation = useMutation({
    mutationFn: async (input: TrainingEntryInput) => {
      if (!correction) throw new Error('Not in correction mode.');
      const result = await withWriteTimeout(
        reviseTrainingEntry(createClient(), correction.originalId, {
          rpe: input.rpe,
          duration_min: input.duration_min,
          comment: input.comment,
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.training.entryForSession(orgId, athleteId, sessionId),
      });
      router.push('/my-data?tab=training');
    },
    onError: (err: Error) => setInvalid(toUserMessage(err, 'athlete')),
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
      revision_of: correction?.originalId,
    };

    const parsed = TrainingEntryInput.safeParse(candidate);
    if (!parsed.success) {
      setInvalid('Something on this rating did not check out. Try again.');
      return;
    }

    setInvalid(null);
    if (correction) {
      correctionMutation.mutate(parsed.data);
      return;
    }
    submitMutation.mutate(parsed.data);
    router.push(
      `/today?submitted=rpe&rpe=${rpe}&session=${encodeURIComponent(sessionTitle)}`,
    );
  }

  const submitLabel =
    rpe === null
      ? 'Choose a rating'
      : correction
        ? correctionMutation.isPending
          ? 'Saving correction…'
          : 'Submit correction'
        : 'Submit rating';

  return (
    <form onSubmit={onSubmit} noValidate>
      {correction ? (
        <div className="banner" role="status">
          <span className="g g-faint" aria-hidden="true">
            ⓘ
          </span>
          <div>
            Correcting this rating. This creates a new revision; the
            original is kept, not overwritten.
          </div>
        </div>
      ) : null}

      <p className="dir">Rate the whole session, not the hardest bit.</p>

      <CR10List value={rpe} onChange={setRpe} />

      <div className="sc-h" style={{ paddingTop: 14 }}>
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
            className="v mono"
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
      <p className="tiny" style={{ textAlign: 'center', marginTop: 2 }}>
        {scheduledDurationMin !== null
          ? `Scheduled for ${scheduledDurationMin} min`
          : 'No scheduled length. Set how long you trained.'}
      </p>

      {noteOpen ? (
        <div style={{ marginTop: 14 }}>
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
          style={{ marginTop: 14, width: '100%' }}
          onClick={() => setNoteOpen(true)}
        >
          Add a note
        </button>
      )}

      {invalid ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {invalid}
        </p>
      ) : null}

      <div className="subm">
        <button
          className="btn-primary"
          type="submit"
          disabled={rpe === null || (correction ? correctionMutation.isPending : false)}
          style={{ width: '100%', minHeight: 56 }}
        >
          {submitLabel}
        </button>
        {correction ? (
          <p className="tiny" style={{ textAlign: 'center', marginTop: 8 }}>
            Corrections send straight away and need signal. If it can&rsquo;t get
            through, you&rsquo;ll see an error here and your answers stay put.
          </p>
        ) : null}
      </div>
    </form>
  );
}
