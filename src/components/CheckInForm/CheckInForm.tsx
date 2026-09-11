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
  BODY_MASS_RANGE,
  RESTING_HR_RANGE,
  WELLNESS_SCALES,
  WellnessEntryInput,
  fieldHelp,
  fieldProblem,
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

/** Where the sleep stepper lands on its first tap. Not a default: nothing is
 *  submitted until the athlete has touched it (see the state below). */
const SLEEP_START = 7;
/** The five scales plus sleep. "All six answered" spells this out. */
const TOTAL_QUESTIONS = WELLNESS_SCALES.length + 1;

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

  /* SLEEP STARTS EMPTY — ATH-ADULT-03 C-c, decided 2026-09-11. It opened at
   * 7.0, which is a plausible answer presented as a fact: an athlete who tapped
   * nothing submitted a number they never gave, and seven hours is exactly the
   * value unremarkable enough to survive review. It reads "–" until the first
   * tap on + or −, which starts it at SLEEP_START; because it is unanswered
   * rather than pre-filled it COUNTS, so the footer reads "0 of 6 answered".
   *
   * No prefill and therefore no rounding. The half-hour rounding that used to
   * guard this line belonged to the correction mode — a prefilled sleep_hours
   * of 7.9 (real in this database, finer than the stepper can express) was
   * rejected by the same schema that filled it in. That bug moved with the
   * prefill, to the coach's EntryCorrectionPanel, which guards it differently
   * and for a reason: that form diffs every field against the original before
   * sending, so rounding 7.9 to 8.0 would read as a change the coach never
   * made. See the note above the forms in EntryCorrectionPanel.tsx. */
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [restingHr, setRestingHr] = useState('');
  const [bodyMassKg, setBodyMassKg] = useState('');
  const [comment, setComment] = useState('');
  const [scales, setScales] = useState<Scales>(EMPTY);
  const [invalid, setInvalid] = useState<string | null>(null);

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

  const answered =
    WELLNESS_SCALES.filter((s) => scales[s] !== null).length + (sleepHours === null ? 0 : 1);
  const remaining = TOTAL_QUESTIONS - answered;

  /* C-e: the two optional numbers are checked as they are typed, against the
   * same field schema that runs at submit (validation/wellness.ts). A problem
   * blocks the action exactly as an unanswered question does, and the field
   * says what is wrong beside itself instead of the footer saying something
   * generic afterwards. */
  const hrProblem = fieldProblem('resting_hr', restingHr);
  const bmProblem = fieldProblem('body_mass_kg', bodyMassKg);
  const problems = (hrProblem ? 1 : 0) + (bmProblem ? 1 : 0);
  const blocked = remaining > 0 || problems > 0;
  const pending = submitMutation.isPending;

  const countText =
    remaining > 0
      ? `${answered} of ${TOTAL_QUESTIONS} answered · ${remaining} to go`
      : problems > 0
        ? problems === 1
          ? 'Fix one field to submit'
          : 'Fix two fields to submit'
        : 'All six answered';

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    /* Refused here as well as at the control (A2): the button is aria-disabled
     * while blocked, not `disabled`, so Enter in a field still submits the
     * form — and it must do nothing, not send five answers and a dash. */
    if (blocked) return;
    if (pending) return;

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
          {/* Either key starts an empty stepper at SLEEP_START; neither counts
              as a step away from nothing. After that they step by half an hour
              within the schema's 0 to 14. */}
          <button
            type="button"
            className="btnc"
            onClick={() => setSleepHours((h) => (h === null ? SLEEP_START : Math.max(0, h - 0.5)))}
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
              data-empty={sleepHours === null ? '' : undefined}
            >
              {sleepHours === null ? '–' : sleepHours.toFixed(1)}
            </div>
            <div className="u">hours</div>
          </div>
          <button
            type="button"
            className="btnc"
            onClick={() => setSleepHours((h) => (h === null ? SLEEP_START : Math.min(14, h + 0.5)))}
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
        {/* The field-error pattern (A7, C-e): the range as helper text UNDER
            the field — not a placeholder, so it stays readable once a value is
            typed — and, when the value would be refused, the field marked
            invalid with the sentence beside it. Both read the validator's own
            numbers through fieldHelp/fieldProblem, so this copy cannot say
            "25 to 120" while the schema refuses 25. */}
        <div className="disclose-body">
          <div>
            <label className="label" htmlFor="ci-hr">
              Resting heart rate (bpm)
            </label>
            <input
              id="ci-hr"
              className="field"
              type="number"
              inputMode="numeric"
              min={RESTING_HR_RANGE.min}
              max={RESTING_HR_RANGE.max}
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
              aria-invalid={hrProblem ? true : undefined}
              aria-describedby="ci-hr-help ci-hr-error"
            />
            {hrProblem ? (
              <p id="ci-hr-error" className="err-line" role="alert">
                <span aria-hidden="true" className="err-dot">
                  !
                </span>
                <span>{hrProblem}</span>
              </p>
            ) : null}
            <p id="ci-hr-help" className="help-line">
              {fieldHelp('resting_hr')}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="ci-bm">
              Body mass (kg)
            </label>
            <input
              id="ci-bm"
              className="field"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={BODY_MASS_RANGE.min}
              max={BODY_MASS_RANGE.max}
              value={bodyMassKg}
              onChange={(e) => setBodyMassKg(e.target.value)}
              aria-invalid={bmProblem ? true : undefined}
              aria-describedby="ci-bm-help ci-bm-error"
            />
            {bmProblem ? (
              <p id="ci-bm-error" className="err-line" role="alert">
                <span aria-hidden="true" className="err-dot">
                  !
                </span>
                <span>{bmProblem}</span>
              </p>
            ) : null}
            <p id="ci-bm-help" className="help-line">
              {fieldHelp('body_mass_kg')}
            </p>
          </div>
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
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {invalid}
        </p>
      ) : null}

      {/* THE FOOTER — ATH-ADULT-03 A1–A4, 2026-09-11. Pinned to the viewport
          (.subm is sticky against the document now that the shell no longer
          declares a dead scroll pane), so the count and the action are on
          screen from the first question. The count is its own line at full
          --text: it used to live inside a button dimmed twice, at 1.24:1
          (§0s). It becomes a good-tone chip on the last answer (A3). */}
      <div className="subm">
        <p className="subm-count" data-complete={blocked ? undefined : ''}>
          {countText}
        </p>
        {/* Irreversibility as one line (A4), with the reasoning — who corrects
            a wrong number, and that My Data shows both versions — behind a
            native disclosure (C-d) rather than spelled out under every submit.
            Said before the tap, not after: the rule is learned at the moment it
            matters rather than discovered on a screen with no button. */}
        <details className="subm-why">
          <summary>
            <span className="subm-note">You can&rsquo;t change this after you submit.</span>
            <span className="subm-why-link">Why can&rsquo;t I edit it?</span>
          </summary>
          <p className="tiny subm-why-body">
            If you get a number wrong, tell your coach &mdash; they can record a correction, and
            My Data will show you both what they changed it to and what you first reported.
          </p>
        </details>
        {/* BLOCKED IS aria-disabled, NOT disabled (A2) — the treatment
         * ATH-ADULT-01 built for Locked. A disabled button leaves the tab
         * order and was dimmed to unreadable; aria-disabled keeps it focusable
         * and announced with its label, wearing the kit secondary (.btn-ghost)
         * so it reads as not-yet-the-action rather than a faded copy of it.
         * The press is refused here at the control and again in onSubmit.
         *
         * `disabled` is kept for the PENDING moment only, and that one is
         * real: a fast double-tap fires two onSubmit calls, each minting its
         * own crypto.randomUUID() and enqueuing a distinct outbox row (see
         * lib/outbox.ts) before either network call resolves. Without it both
         * rows race wellness_entries_one_live_per_day; the loser's insert dies
         * on the unique index and, before OutboxFlusher's disambiguation, was
         * dequeued as "delivered" anyway — a real submission silently dropped.
         * Disabling on isPending makes the second tap impossible to register
         * as a second attempt in the first place. */}
        <button
          className={blocked ? 'btn-ghost' : 'btn-primary'}
          type="submit"
          disabled={pending}
          aria-disabled={blocked || undefined}
          onClick={(event) => {
            if (blocked) event.preventDefault();
          }}
          style={{ width: '100%' }}
        >
          Submit entry
        </button>
      </div>
    </form>
  );
}
