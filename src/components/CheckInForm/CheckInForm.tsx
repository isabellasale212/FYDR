'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ScaleInput } from '@/components/ScaleInput/ScaleInput';
import { createClient } from '@/lib/supabase/client';
import { submitWellnessEntry } from '@/lib/queries/wellness';
import { qk } from '@/lib/queries/keys';
import { dequeueWellness, enqueueWellness } from '@/lib/outbox';
import {
  WELLNESS_SCALES,
  WellnessEntryInput,
  type WellnessScale,
} from '@/lib/validation/wellness';

/* This form used to have a second mode. Reached as `/check-in?date=…&correct=1`,
 * it prefilled every control from an existing entry and submitted through
 * `revise_wellness_entry` instead of a plain insert. It is gone, and the club
 * asked for it to be: "the athlete shouldnt be able to edit an entry only the
 * coach should be able to do it on the system."
 *
 * The mode is removed rather than merely hidden because migration 0058 narrowed
 * that RPC to coach/medical. A hidden-but-reachable correction mode would render
 * a full form, take the athlete's six answers, and fail on submit with
 * not_permitted — the "visibly broken or lying affordance" that is worse than
 * having no affordance. There is now one submit path here, and it inserts.
 *
 * The athlete is not left mute. `/check-in` and `/my-data` both now say, in
 * plain words, that a wrong entry is fixed by asking a coach, and the coach has
 * a real place to do it (squad/[athleteId], EntryCorrectionPanel). What was
 * deliberately NOT built is an in-app "request a correction" queue: it needs a
 * table, a staff inbox and a notification to be honest, and a button that files
 * a request nobody is shown would be the same lie in a different shape. Recorded
 * as O-30 in docs/decisions/adr-005-immutable-entries.md. */

type Props = {
  orgId: string;
  athleteId: string;
  userId: string;
  entryDate: string;
  /** Last night's submitted sleep hours, or null.
   *
   *  RESTORED 8 September 2026. The redesign removed this reference because the
   *  reference screenshots show a plain sleep row with no chip beside it. What
   *  it removed was the only thing on the sheet that let an athlete notice they
   *  were about to submit last night's number again — the stepper opens on a
   *  default, and "7.0" reads identically whether it is tonight's answer or
   *  yesterday's. Shown as plain text on the row now rather than the boxed chip
   *  the redesign deleted, so the calmer row survives having the fact back. */
  lastNightSleepHours: number | null;
};

type Scales = Record<WellnessScale, number | null>;

const EMPTY: Scales = {
  sleep_quality: null,
  fatigue: null,
  soreness: null,
  stress: null,
  mood: null,
};

/**
 * The morning check-in. Six controls, one thumb, under 45 seconds.
 *
 * It never shows a network error. The entry is validated, queued locally and
 * sent; if the send fails the entry stays queued and the athlete is told it is
 * saved on this phone, which is true. Retrying is the application's problem,
 * not their.
 */
export function CheckInForm({
  orgId,
  athleteId,
  userId,
  entryDate,
  lastNightSleepHours,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  /* A plain 7-hour start. The half-hour rounding that used to guard this line
   * belonged to the correction mode — a prefilled sleep_hours of 7.9 (real in
   * this database, finer than the stepper can express) was rejected by the same
   * schema that filled it in. With no prefill there is nothing to round, so the
   * guard is not restored here; it would be dead code on a form that starts at 7.
   *
   * The bug it caught is NOT dead, though — it moved with the prefill, to the
   * coach's EntryCorrectionPanel. It is guarded there differently and for a
   * reason: that form diffs every field against the original before sending, so
   * rounding 7.9 to 8.0 would read as a change the coach never made. It matches
   * the input's step and the correction schema to sleep_hours' own numeric(3,1)
   * precision instead, and sets `noValidate` as this form does. See the note
   * above the forms in EntryCorrectionPanel.tsx. */
  const [sleepHours, setSleepHours] = useState(7);
  const [restingHr, setRestingHr] = useState('');
  const [bodyMassKg, setBodyMassKg] = useState('');
  const [comment, setComment] = useState('');
  const [scales, setScales] = useState<Scales>(EMPTY);
  const [invalid, setInvalid] = useState<string | null>(null);

  const remaining = WELLNESS_SCALES.filter((s) => scales[s] === null).length;

  const submitMutation = useMutation({
    mutationFn: async (input: WellnessEntryInput) => {
      await submitWellnessEntry(createClient(), input, {
        orgId,
        athleteId,
        userId,
      });
      return input;
    },
    onMutate: (input) => {
      enqueueWellness(input);
    },
    onSuccess: (input) => {
      dequeueWellness(input.id);
      void queryClient.invalidateQueries({
        queryKey: qk.compliance.mine(orgId, athleteId, entryDate),
      });
      void queryClient.invalidateQueries({
        queryKey: qk.wellness.day(orgId, athleteId, entryDate),
      });
    },
    onError: () => {
      /* Deliberately silent. The entry is in the outbox and /today retries it.
         An athlete on a training pitch does not need a stack trace. */
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const candidate = {
      id: crypto.randomUUID(),
      entry_date: entryDate,
      sleep_hours: sleepHours,
      ...scales,
      resting_hr: restingHr.trim() === '' ? null : Number(restingHr),
      body_mass_kg: bodyMassKg.trim() === '' ? null : Number(bodyMassKg),
      comment: comment.trim() ? comment.trim() : null,
      /* revision_of is left unset for good now. This form only ever inserts an
       * original; the one path that produces a revision is the coach's, and it
       * sets revision_of server side inside revise_wellness_entry. */
    };

    const parsed = WellnessEntryInput.safeParse(candidate);
    if (!parsed.success) {
      setInvalid('Answer all six before you send it. Nothing is optional here.');
      return;
    }

    setInvalid(null);
    submitMutation.mutate(parsed.data);
    router.push('/today?submitted=1');
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* 23c's directive — how long it takes, then the one rule that makes
          every scale readable — now sits in the sheet header where §7.2 puts
          it, immediately under the title. "always" is the design's own word and
          is what lets a reader work out that 5 on Soreness means none, without
          a label under every scale. */}

      <div className="sleep-panel">
        {/* Spec §7.2: "Sleep" at 16/700 with "hours last night" beside it. The
            figure it replaces restated the number the stepper shows two rows
            down. */}
        <div className="sp-head">
          <span className="k" id="sleep-hours-label">
            Sleep
          </span>
          {/* Plain text on the head row, not the boxed .sleep-ref chip the
              redesign deleted: the fact is back, the box is not. */}
          <span className="h">
            hours last night
            {lastNightSleepHours !== null ? (
              <>
                {' '}&middot; last night you put <span className="num">{lastNightSleepHours}</span>
              </>
            ) : null}
          </span>
        </div>

        <div className="step">
          <button
            type="button"
            className="btnc"
            onClick={() => setSleepHours((h) => Math.max(0, h - 0.5))}
            aria-label="Half an hour less sleep"
          >
            &minus;
          </button>
          <div className="val">
            <div
              className="v num"
              role="status"
              aria-live="polite"
              aria-labelledby="sleep-hours-label"
            >
              {sleepHours.toFixed(1)}
            </div>
            <div className="u">hours</div>
          </div>
          <button
            type="button"
            className="btnc"
            onClick={() => setSleepHours((h) => Math.min(14, h + 0.5))}
            aria-label="Half an hour more sleep"
          >
            +
          </button>
        </div>
      </div>

      {WELLNESS_SCALES.map((scale) => (
        <ScaleInput
          key={scale}
          name={scale}
          value={scales[scale]}
          onChange={(value) =>
            setScales((current) => ({ ...current, [scale]: value }))
          }
        />
      ))}

      <details className="disclose">
        <summary>Add heart rate or weight</summary>
        <div className="disclose-body">
          <label>
            <span className="label">Resting heart rate (bpm)</span>
            <input
              className="field"
              type="number"
              inputMode="numeric"
              min={25}
              max={120}
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
            />
          </label>
          <label>
            <span className="label">Body mass (kg)</span>
            <input
              className="field"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={30}
              max={200}
              value={bodyMassKg}
              onChange={(e) => setBodyMassKg(e.target.value)}
            />
          </label>
        </div>
      </details>

      {/* Out of the disclosure and onto the sheet, per
          CHANGELOG-athlete-app-edits.md. Heart rate and body mass are
          occasional; "something hurts" is the one thing an athlete may need to
          say on any given morning, and it was two taps down behind a summary
          that did not mention injuries at all. The state and the payload are
          unchanged — this only moves where the field is and what it is
          called. */}
      <label className="ci-comment">
        <span className="label">Comment or injury issue (optional)</span>
        <textarea
          className="field"
          rows={3}
          maxLength={500}
          placeholder="Anything you want your coach or medical staff to know."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      {invalid ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {invalid}
        </p>
      ) : null}

      <div className="subm">
        {/* submitMutation.isPending: a fast double-tap fires two onSubmit calls,
         * each minting its own crypto.randomUUID() and enqueuing a distinct
         * outbox row (see lib/outbox.ts) before either network call resolves.
         * Without this, both rows race wellness_entries_one_live_per_day; the
         * loser's insert dies on the unique index and, before OutboxFlusher's
         * disambiguation below, was dequeued as "delivered" anyway — a real
         * submission silently dropped with no trace. Disabling on isPending
         * makes the second tap impossible to register as a second attempt in
         * the first place. */}
        <button
          className="btn-primary"
          type="submit"
          disabled={remaining > 0 || submitMutation.isPending}
          style={{ width: '100%' }}
        >
          {remaining > 0 ? `Submit entry · ${remaining} to go` : 'Submit entry'}
        </button>
        {/* Said before the tap, not after. The old copy ("a correction creates a
         * new revision") was true but described something the athlete could do;
         * this one tells them who does it now, so the rule is learned at the
         * moment it matters rather than discovered on a screen with no button. */}
        <p className="tiny" style={{ textAlign: 'center', marginTop: 8 }}>
          Once this is sent it can&rsquo;t be edited. If you get a number wrong,
          tell your coach &mdash; they can record a correction, and My Data will
          show you both what they changed it to and what you first reported.
        </p>
      </div>
    </form>
  );
}
