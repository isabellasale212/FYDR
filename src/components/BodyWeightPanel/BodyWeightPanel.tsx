'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  logWeighIn,
  updateWeighIn,
  type BodyCompositionEntry,
} from '@/lib/queries/bodyComposition';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { formatDate, todayIso } from '@/lib/format';

type Props = {
  orgId: string;
  athleteId: string;
  userId: string;
  timezone: string;
  entries: BodyCompositionEntry[];
  canLog: boolean;
};

/* PLAYER-PROFILE-SPEC.md §10's Body weight card ships two of its three
 * action buttons for real: "+ Log weigh-in" (lib/queries/bodyComposition.ts's
 * logWeighIn, a real insert) and "Edit entries" (updateWeighIn, a real
 * update — see that file's header for why there is no delete). "Set target
 * range" stays disabled: there is no target-weight column anywhere in this
 * schema, and this component isn't the place to invent one.
 *
 * Sits inside the same "card" as the rest of the body weight section; the
 * server page renders the static value/sparkline/trend (nothing there
 * changes on a log or edit that doesn't touch history the sparkline
 * already redraws via router.refresh()), and hands this component just the
 * raw entries and the ids it needs to write. */
export function BodyWeightPanel({ orgId, athleteId, userId, timezone, entries, canLog }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'closed' | 'log' | 'edit'>('closed');

  return (
    <div>
      <div className="pp-weight-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={!canLog}
          aria-disabled={!canLog}
          title={canLog ? undefined : 'Only coaching or medical staff can log a weigh-in.'}
          onClick={() => setMode((m) => (m === 'log' ? 'closed' : 'log'))}
          aria-pressed={mode === 'log'}
        >
          + Log weigh-in
        </button>
        <button type="button" className="btn-ghost" disabled aria-disabled="true" title="No target-range column exists in this schema yet.">
          Set target range
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!canLog || entries.length === 0}
          aria-disabled={!canLog || entries.length === 0}
          title={
            !canLog
              ? 'Only coaching or medical staff can edit a weigh-in.'
              : entries.length === 0
                ? 'Nothing logged yet.'
                : undefined
          }
          onClick={() => setMode((m) => (m === 'edit' ? 'closed' : 'edit'))}
          aria-pressed={mode === 'edit'}
        >
          Edit entries
        </button>
      </div>

      {mode === 'log' ? (
        <LogForm
          orgId={orgId}
          athleteId={athleteId}
          userId={userId}
          timezone={timezone}
          onDone={() => {
            setMode('closed');
            router.refresh();
          }}
        />
      ) : null}

      {mode === 'edit' ? (
        <EditList
          orgId={orgId}
          entries={entries}
          onDone={() => {
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function LogForm({
  orgId,
  athleteId,
  userId,
  timezone,
  onDone,
}: {
  orgId: string;
  athleteId: string;
  userId: string;
  timezone: string;
  onDone: () => void;
}) {
  const [measuredOn, setMeasuredOn] = useState(todayIso(timezone));
  const [bodyMassKg, setBodyMassKg] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [method, setMethod] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        logWeighIn(createClient(), orgId, athleteId, userId, {
          measuredOn,
          bodyMassKg: Number(bodyMassKg),
          bodyFatPct: bodyFatPct === '' ? null : Number(bodyFatPct),
          method: method.trim() === '' ? null : method.trim(),
        }),
      ),
    onSuccess: (result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <form
      className="pp-weight-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        submit.mutate();
      }}
    >
      <div className="pp-weight-form-row">
        <label className="label" htmlFor="wi-date">
          Date
        </label>
        <input
          id="wi-date"
          className="field"
          type="date"
          value={measuredOn}
          max={todayIso(timezone)}
          onChange={(event) => setMeasuredOn(event.target.value)}
          required
        />
      </div>
      <div className="pp-weight-form-row">
        <label className="label" htmlFor="wi-mass">
          Body mass (kg)
        </label>
        <input
          id="wi-mass"
          className="field"
          type="number"
          step="0.1"
          min="0"
          inputMode="decimal"
          value={bodyMassKg}
          onChange={(event) => setBodyMassKg(event.target.value)}
          required
        />
      </div>
      <div className="pp-weight-form-row">
        <label className="label" htmlFor="wi-fat">
          Body fat % (optional)
        </label>
        <input
          id="wi-fat"
          className="field"
          type="number"
          step="0.1"
          min="0"
          max="99.9"
          inputMode="decimal"
          value={bodyFatPct}
          onChange={(event) => setBodyFatPct(event.target.value)}
        />
      </div>
      <div className="pp-weight-form-row">
        <label className="label" htmlFor="wi-method">
          Method (optional)
        </label>
        <input
          id="wi-method"
          className="field"
          type="text"
          placeholder="e.g. skinfold, bioimpedance"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        />
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary" disabled={submit.isPending} style={{ marginTop: 4 }}>
        {submit.isPending ? 'Saving…' : 'Save weigh-in'}
      </button>
    </form>
  );
}

function EditList({
  orgId,
  entries,
  onDone,
}: {
  orgId: string;
  entries: BodyCompositionEntry[];
  onDone: () => void;
}) {
  return (
    <div className="pp-weight-edit-list">
      {entries.map((entry) => (
        <EditRow key={entry.id} orgId={orgId} entry={entry} onDone={onDone} />
      ))}
    </div>
  );
}

function EditRow({
  orgId,
  entry,
  onDone,
}: {
  orgId: string;
  entry: BodyCompositionEntry;
  onDone: () => void;
}) {
  const [measuredOn, setMeasuredOn] = useState(entry.measured_on);
  const [bodyMassKg, setBodyMassKg] = useState(String(entry.body_mass_kg ?? ''));
  const [bodyFatPct, setBodyFatPct] = useState(entry.body_fat_pct !== null ? String(entry.body_fat_pct) : '');
  const [method, setMethod] = useState(entry.method ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        updateWeighIn(createClient(), orgId, {
          id: entry.id,
          measuredOn,
          bodyMassKg: Number(bodyMassKg),
          bodyFatPct: bodyFatPct === '' ? null : Number(bodyFatPct),
          method: method.trim() === '' ? null : method.trim(),
        }),
      ),
    onSuccess: (result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      onDone();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <div className="pp-weight-edit-row">
      <span className="mono tiny" style={{ minWidth: 78 }}>
        {formatDate(entry.measured_on)}
      </span>
      <input
        className="field"
        type="date"
        value={measuredOn}
        onChange={(event) => {
          setMeasuredOn(event.target.value);
          setSaved(false);
        }}
        aria-label={`Date for the ${formatDate(entry.measured_on)} entry`}
      />
      <input
        className="field"
        type="number"
        step="0.1"
        min="0"
        inputMode="decimal"
        value={bodyMassKg}
        onChange={(event) => {
          setBodyMassKg(event.target.value);
          setSaved(false);
        }}
        aria-label={`Body mass in kg for the ${formatDate(entry.measured_on)} entry`}
      />
      <input
        className="field"
        type="number"
        step="0.1"
        min="0"
        max="99.9"
        inputMode="decimal"
        value={bodyFatPct}
        onChange={(event) => {
          setBodyFatPct(event.target.value);
          setSaved(false);
        }}
        placeholder="fat %"
        aria-label={`Body fat percent for the ${formatDate(entry.measured_on)} entry`}
      />
      <input
        className="field"
        type="text"
        value={method}
        onChange={(event) => {
          setMethod(event.target.value);
          setSaved(false);
        }}
        placeholder="method"
        aria-label={`Method for the ${formatDate(entry.measured_on)} entry`}
      />
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          setError(null);
          save.mutate();
        }}
        disabled={save.isPending}
      >
        {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
      {error ? (
        <span className="form-error" role="alert" style={{ gridColumn: '1 / -1' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
