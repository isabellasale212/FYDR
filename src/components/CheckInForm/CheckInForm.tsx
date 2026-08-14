'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ScaleInput } from '@/components/ScaleInput/ScaleInput';
import { createClient } from '@/lib/supabase/client';
import { reviseWellnessEntry, submitWellnessEntry } from '@/lib/queries/wellness';
import { qk } from '@/lib/queries/keys';
import { dequeueWellness, enqueueWellness } from '@/lib/outbox';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import {
  WELLNESS_SCALES,
  WellnessEntryInput,
  type WellnessScale,
} from '@/lib/validation/wellness';
import { formatDate } from '@/lib/format';

type Correction = {
  originalId: string;
  initial: {
    sleep_hours: number | null;
    sleep_quality: number | null;
    fatigue: number | null;
    soreness: number | null;
    stress: number | null;
    mood: number | null;
  };
};

type Props = {
  orgId: string;
  athleteId: string;
  userId: string;
  /** IANA zone used to display all dates on this form in the organisation's local time. */
  timezone: string;
  entryDate: string;
  lastNightSleepHours: number | null;
  /** Present only when reached via "Correct this entry". Prefills every
   *  field from the entry being corrected and switches the submit path to
   *  the revision RPC instead of a plain insert — see
   *  wellness-entry.md's "Correcting" section and ADR-005. */
  correction?: Correction;
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
 * not his.
 */
export function CheckInForm({
  orgId,
  athleteId,
  userId,
  timezone,
  entryDate,
  lastNightSleepHours,
  correction,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  /* Rounded to the nearest half hour, the stepper's own resolution. Caught
   * live: an entry corrected here can have a sleep_hours value the stepper
   * itself could never produce (this app's seed data carries finer
   * decimals than the UI ever writes, e.g. 7.9), and the validation schema
   * requires a multiple of 0.5 — submitting the untouched prefill was
   * being rejected by the same schema that filled it in. */
  const [sleepHours, setSleepHours] = useState(
    correction ? Math.round((correction.initial.sleep_hours ?? 7) * 2) / 2 : 7,
  );
  const [restingHr, setRestingHr] = useState('');
  const [bodyMassKg, setBodyMassKg] = useState('');
  const [comment, setComment] = useState('');
  const [scales, setScales] = useState<Scales>(
    correction
      ? {
          sleep_quality: correction.initial.sleep_quality,
          fatigue: correction.initial.fatigue,
          soreness: correction.initial.soreness,
          stress: correction.initial.stress,
          mood: correction.initial.mood,
        }
      : EMPTY,
  );
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

  /* Corrections are online-only, deliberately: a replayed revise cannot be
   * told apart from "already corrected" (both raise entry_not_revisable),
   * so queuing one in the outbox could silently swallow or double-report a
   * fix — see lib/outbox.ts. The trade is that this path must be *bounded*
   * (audit S5 / athlete finding 11: this exact button once hung on "Saving
   * correction…" indefinitely): ten seconds to confirm, then a visible,
   * human error, the athlete's values still on screen, and the button live
   * again for a retry. */
  const correctionMutation = useMutation({
    mutationFn: async (input: WellnessEntryInput) => {
      if (!correction) throw new Error('Not in correction mode.');
      const result = await withWriteTimeout(
        reviseWellnessEntry(createClient(), correction.originalId, {
          sleep_hours: input.sleep_hours,
          sleep_quality: input.sleep_quality,
          fatigue: input.fatigue,
          soreness: input.soreness,
          stress: input.stress,
          mood: input.mood,
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.wellness.day(orgId, athleteId, entryDate),
      });
      router.push('/my-data?tab=wellness');
    },
    onError: (err: Error) => setInvalid(toUserMessage(err, 'athlete')),
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
      revision_of: correction?.originalId,
    };

    const parsed = WellnessEntryInput.safeParse(candidate);
    if (!parsed.success) {
      setInvalid('Answer all six before you send it. Nothing is optional here.');
      return;
    }

    setInvalid(null);
    if (correction) {
      correctionMutation.mutate(parsed.data);
    } else {
      submitMutation.mutate(parsed.data);
      router.push('/today?submitted=1');
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {correction ? (
        <div className="banner" role="status">
          <span className="g g-faint" aria-hidden="true">
            ⓘ
          </span>
          <div>
            Correcting your entry for {formatDate(entryDate, timezone)}. This creates a
            new revision; the original is kept, not overwritten.
          </div>
        </div>
      ) : null}

      <p className="dir">
        On every scale, <b>5 is the best you can feel.</b>
      </p>

      <div className="sleep-panel">
        <div className="sp-head">
          <span className="k" id="sleep-hours-label">
            Sleep
          </span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
            {sleepHours.toFixed(1)} h
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
              className="v mono"
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

        {lastNightSleepHours !== null ? (
          <span className="sleep-ref">
            Last night&rsquo;s entry: <span className="mono">{lastNightSleepHours}</span>
          </span>
        ) : null}
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
        <summary>Add heart rate, weight or a note</summary>
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
          <label>
            <span className="label">Note</span>
            <textarea
              className="field"
              rows={2}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
        </div>
      </details>

      {invalid ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {invalid}
        </p>
      ) : null}

      <div className="subm">
        <button
          className="btn-primary"
          type="submit"
          disabled={correction ? correctionMutation.isPending : remaining > 0}
          style={{ width: '100%' }}
        >
          {correction
            ? correctionMutation.isPending
              ? 'Saving correction…'
              : 'Submit correction'
            : remaining > 0
              ? `Submit entry · ${remaining} to go`
              : 'Submit entry'}
        </button>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 8 }}>
          {correction
            ? `For ${formatDate(entryDate, timezone)}. Corrections send straight away and need signal. If it can’t get through, you’ll see an error here and your answers stay put.`
            : 'Submitted entries cannot be edited. A correction creates a new revision.'}
        </p>
      </div>
    </form>
  );
}
