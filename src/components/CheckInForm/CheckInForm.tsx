'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ScaleInput } from '@/components/ScaleInput/ScaleInput';
import { createClient } from '@/lib/supabase/client';
import { reviseWellnessEntry, submitWellnessEntry } from '@/lib/queries/wellness';
import { qk } from '@/lib/queries/keys';
import { dequeueWellness, enqueueWellness } from '@/lib/outbox';
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

  /* Corrections are online-only: unlike a fresh entry, there is no outbox
   * "revise" operation for wellness yet (only submission is queued today),
   * so this mutation is awaited and its result shown, rather than fired
   * optimistically like submitMutation above. A real, documented gap, not a
   * silent one — an athlete correcting an entry pitchside with no signal
   * will see an error rather than a silently queued fix. */
  const correctionMutation = useMutation({
    mutationFn: async (input: WellnessEntryInput) => {
      if (!correction) throw new Error('Not in correction mode.');
      const result = await reviseWellnessEntry(createClient(), correction.originalId, {
        sleep_hours: input.sleep_hours,
        sleep_quality: input.sleep_quality,
        fatigue: input.fatigue,
        soreness: input.soreness,
        stress: input.stress,
        mood: input.mood,
      });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.wellness.day(orgId, athleteId, entryDate),
      });
      router.push('/my-data?tab=wellness');
    },
    onError: (err: Error) => setInvalid(err.message),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const candidate = {
      id: crypto.randomUUID(),
      entry_date: entryDate,
      sleep_hours: sleepHours,
      ...scales,
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
            Correcting your entry for {formatDate(entryDate)}. This creates a
            new revision; the original is kept, not overwritten.
          </div>
        </div>
      ) : null}

      <p className="dir">
        On every scale, <b>5 is the best you can feel.</b>
      </p>

      <div className="sc-h" style={{ paddingTop: 2 }}>
        <span className="sc-l" id="sleep-hours-label">
          Sleep
        </span>
        {lastNightSleepHours !== null ? (
          <span className="tiny">
            Last time <span className="mono">{lastNightSleepHours}</span> h
          </span>
        ) : null}
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
          <div className="u">HOURS</div>
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

      {invalid ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {invalid}
        </p>
      ) : null}

      <div className="subm">
        <button
          className="btn-primary"
          type="submit"
          disabled={correction ? correctionMutation.isPending : false}
          style={{ width: '100%', minHeight: 56 }}
        >
          {correction
            ? correctionMutation.isPending
              ? 'Saving correction…'
              : 'Submit correction'
            : 'Submit entry'}
          {remaining > 0 ? (
            <span
              className="tiny"
              style={{ fontWeight: 600, marginInlineStart: 8 }}
            >
              · <span className="mono">{remaining}</span> to go
            </span>
          ) : null}
        </button>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 8 }}>
          {correction
            ? `For ${formatDate(entryDate)}. This needs a connection: corrections are not queued offline yet.`
            : `For ${formatDate(entryDate)}. Saved on this phone first, sent when you have signal.`}
        </p>
      </div>
    </form>
  );
}
