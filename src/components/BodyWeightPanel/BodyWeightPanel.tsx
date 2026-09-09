'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  logWeighIn,
  deleteWeighIn,
  updateWeighIn,
  type BodyCompositionEntry,
} from '@/lib/queries/bodyComposition';
import {
  retractTargetRange,
  setTargetRange,
  type BodyMassTargetRangeWithSetter,
} from '@/lib/queries/bodyMassTargetRange';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { addDays, dateInTz, formatDate, todayIso } from '@/lib/format';

type Props = {
  orgId: string;
  athleteId: string;
  userId: string;
  timezone: string;
  entries: BodyCompositionEntry[];
  canLog: boolean;
  /** Newest first, closed rows included — fetchTargetRangeHistory. The live one is the
   *  row with effective_to === null, and there is at most one (0060's unique index). */
  targetRanges: BodyMassTargetRangeWithSetter[];
};

/* PLAYER-PROFILE-SPEC.md §10's Body weight card. All THREE of its action
 * buttons are real now: "+ Log weigh-in" (lib/queries/bodyComposition.ts's
 * logWeighIn, a real insert), "Edit entries" (updateWeighIn, a real update —
 * see that file's header for why there is no delete), and "Set target range".
 *
 * "Set target range" was disabled from this component's first version with the
 * note "there is no target-weight column anywhere in this schema, and this
 * component isn't the place to invent one". That was true and is no longer:
 * migration 0060 added body_mass_target_ranges, its own staff-only table,
 * BECAUSE the column could not honestly live on athletes or body_composition —
 * both of those grant the athlete a row select and RLS is row-level, so the
 * range would have been readable by the athlete it is about. The stale comment
 * is corrected rather than left to re-cut the feature a fourth time.
 *
 * THE TARGET RANGE IS NEVER SHOWN TO THE ATHLETE. This component renders only
 * under src/app/(staff)/, and the table grants an athlete session no rows at
 * all. Both halves matter: do not lift this panel, or the range prop, into an
 * athlete route.
 *
 * A range is SET, never edited. The database refuses an in-place change to the
 * bounds (0060's guard trigger), so "Set target range" on an athlete who
 * already has one supersedes it and keeps the old row as history — which the
 * form says out loud, because a control that silently discards last month's
 * target would be a worse lie than the disabled button was.
 *
 * Sits inside the same "card" as the rest of the body weight section; the
 * server page renders the static value/sparkline/trend (nothing there
 * changes on a log or edit that doesn't touch history the sparkline
 * already redraws via router.refresh()), and hands this component just the
 * raw entries and the ids it needs to write. */
export function BodyWeightPanel({
  orgId,
  athleteId,
  userId,
  timezone,
  entries,
  canLog,
  targetRanges,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'closed' | 'log' | 'edit' | 'target'>('closed');
  const live = targetRanges.find((r) => r.effective_to === null) ?? null;

  return (
    <div>
      <div className="pp-weight-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={!canLog}
          aria-disabled={!canLog}
          title={canLog ? undefined : 'Logging a weigh-in belongs to the sport scientist, the medic, the S&C and the nutritionist.'}
          onClick={() => setMode((m) => (m === 'log' ? 'closed' : 'log'))}
          aria-pressed={mode === 'log'}
        >
          + Log weigh-in
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!canLog}
          aria-disabled={!canLog}
          title={
            canLog
              ? 'Staff only — an athlete never sees their target range.'
              : 'Setting a body-mass target range belongs to the sport scientist and the nutritionist.'
          }
          onClick={() => setMode((m) => (m === 'target' ? 'closed' : 'target'))}
          aria-pressed={mode === 'target'}
        >
          {live ? 'Change target range' : 'Set target range'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!canLog || entries.length === 0}
          aria-disabled={!canLog || entries.length === 0}
          title={
            !canLog
              ? 'Editing a weigh-in belongs to the sport scientist, the medic, the S&C and the nutritionist.'
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

      {mode === 'target' ? (
        <TargetRangeForm
          orgId={orgId}
          athleteId={athleteId}
          userId={userId}
          timezone={timezone}
          live={live}
          history={targetRanges.filter((r) => r.effective_to !== null)}
          onDone={() => {
            setMode('closed');
            router.refresh();
          }}
        />
      ) : null}

      {mode === 'edit' ? (
        <EditList
          orgId={orgId}
          timezone={timezone}
          entries={entries}
          onDone={() => {
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* The staff-only target-range control.
 *
 * Three things this form says that a bare pair of number inputs would not, each
 * because getting it wrong is a real failure mode rather than a nicety:
 *
 *   1. It states, on screen, that the athlete never sees this. The whole reason
 *      the range needed its own table is that "the UI won't show it" is not a
 *      security property; the person typing a number in should know which kind
 *      of note they are writing, because a range the athlete could read would be
 *      written differently, or not at all. Same argument migration 0055 makes
 *      about a medic's triage notes.
 *   2. It says the current range will be KEPT as history, not overwritten. The
 *      database enforces that (0060's guard trigger refuses an in-place edit),
 *      so the copy is describing what actually happens rather than promising it.
 *   3. It shows the previous ranges with who set them and when. "What were we
 *      asking of them in pre-season?" is the question the effective-dated shape
 *      exists to answer, and it is answered here rather than nowhere. */
function TargetRangeForm({
  orgId,
  athleteId,
  userId,
  timezone,
  live,
  history,
  onDone,
}: {
  orgId: string;
  athleteId: string;
  userId: string;
  timezone: string;
  live: BodyMassTargetRangeWithSetter | null;
  history: BodyMassTargetRangeWithSetter[];
  onDone: () => void;
}) {
  const [lowKg, setLowKg] = useState('');
  const [highKg, setHighKg] = useState('');
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        setTargetRange(createClient(), orgId, userId, timezone, {
          athleteId,
          lowKg: Number(lowKg),
          highKg: Number(highKg),
          rationale: rationale.trim() === '' ? null : rationale.trim(),
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

  const retract = useMutation({
    mutationFn: () => withWriteTimeout(retractTargetRange(createClient(), orgId, live?.id ?? '')),
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
      <p className="pp-target-private" role="note">
        Staff only. The athlete never sees this range, on any screen, and it is never
        ranked on a leaderboard.
      </p>

      {live ? (
        <p className="cap" style={{ margin: 0 }}>
          Currently {live.target_low_kg.toFixed(1)}–{live.target_high_kg.toFixed(1)} kg, set by{' '}
          {live.set_by_name ?? 'a member of staff'} on {formatDate(live.effective_from, timezone)}.
          Saving a new range keeps this one as history rather than overwriting it.
        </p>
      ) : null}

      <div className="pp-weight-form-row">
        <label className="label" htmlFor="tr-low">
          Low bound (kg)
        </label>
        <input
          id="tr-low"
          className="field"
          type="number"
          step="0.1"
          min="30"
          max="250"
          inputMode="decimal"
          value={lowKg}
          onChange={(event) => setLowKg(event.target.value)}
          required
        />
      </div>
      <div className="pp-weight-form-row">
        <label className="label" htmlFor="tr-high">
          High bound (kg)
        </label>
        <input
          id="tr-high"
          className="field"
          type="number"
          step="0.1"
          min="30"
          max="250"
          inputMode="decimal"
          value={highKg}
          onChange={(event) => setHighKg(event.target.value)}
          required
        />
      </div>
      <div className="pp-weight-form-row">
        <label className="label" htmlFor="tr-why">
          Why (optional)
        </label>
        <input
          id="tr-why"
          className="field"
          type="text"
          maxLength={500}
          placeholder="e.g. holding scrum mass through the block"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
        />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="pp-target-actions">
        <button type="submit" className="btn-primary" disabled={submit.isPending}>
          {submit.isPending ? 'Saving…' : live ? 'Save new range' : 'Save target range'}
        </button>
        {live ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={retract.isPending}
            title="Removes the range entirely. Use this only if it was set in error — to change a target, save a new range instead."
            onClick={() => {
              setError(null);
              retract.mutate();
            }}
          >
            {retract.isPending ? 'Retracting…' : 'Retract'}
          </button>
        ) : null}
      </div>

      {history.length > 0 ? (
        <div className="pp-target-history">
          <p className="label" style={{ margin: '4px 0 2px' }}>
            Previous ranges
          </p>
          {history.map((r) => (
            <p key={r.id} className="tiny" style={{ margin: 0 }}>
              <span className="num">
                {r.target_low_kg.toFixed(1)}–{r.target_high_kg.toFixed(1)} kg
              </span>{' '}
              · {formatDate(r.effective_from, timezone)} to{' '}
              {r.effective_to ? formatDate(r.effective_to, timezone) : 'now'} ·{' '}
              {r.set_by_name ?? 'staff'}
              {r.rationale ? ` · ${r.rationale}` : ''}
            </p>
          ))}
        </div>
      ) : null}
    </form>
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
      <button type="submit" className="btn-primary" disabled={submit.isPending} style={{ marginTop: 'var(--sp-4)' }}>
        {submit.isPending ? 'Saving…' : 'Save weigh-in'}
      </button>
    </form>
  );
}

/** The edit list opens on a fortnight. Named rather than inline so the copy
 *  below and the filter cannot drift apart. */
const RECENT_DAYS = 14;

function EditList({
  orgId,
  timezone,
  entries,
  onDone,
}: {
  orgId: string;
  timezone: string;
  entries: BodyCompositionEntry[];
  onDone: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  /* Two weeks by DATE MEASURED, not the newest N rows. Ashcombe weighs in
     fortnightly (see squad/[athleteId]/gym's own note), so "the last 14 entries"
     would be six months of history for them and three weeks for a club that
     weighs daily — the same control meaning something different per club. A date
     range means the same thing everywhere. */
  const cutoff = addDays(todayIso(timezone), -RECENT_DAYS);
  const recent = entries.filter((e) => e.measured_on >= cutoff);
  const hiddenCount = entries.length - recent.length;
  const shown = showAll ? entries : recent;

  return (
    <div className="pp-weight-edit-list">
      {shown.map((entry) => (
        <EditRow key={entry.id} orgId={orgId} timezone={timezone} entry={entry} onDone={onDone} />
      ))}

      {shown.length === 0 ? (
        <p className="tiny" style={{ color: 'var(--faint)' }}>
          Nothing in the last {RECENT_DAYS} days.
        </p>
      ) : null}

      {/* Only when there is something behind it. A "View all" that reveals
          nothing is a control that teaches people not to trust controls. */}
      {!showAll && hiddenCount > 0 ? (
        <button type="button" className="btn-ghost" onClick={() => setShowAll(true)}>
          View all ({hiddenCount} older)
        </button>
      ) : null}
      {showAll && hiddenCount > 0 ? (
        <button type="button" className="btn-ghost" onClick={() => setShowAll(false)}>
          Show last {RECENT_DAYS} days only
        </button>
      ) : null}
    </div>
  );
}

function EditRow({
  orgId,
  timezone,
  entry,
  onDone,
}: {
  orgId: string;
  timezone: string;
  entry: BodyCompositionEntry;
  onDone: () => void;
}) {
  const [measuredOn, setMeasuredOn] = useState(entry.measured_on);
  const [bodyMassKg, setBodyMassKg] = useState(String(entry.body_mass_kg ?? ''));
  const [bodyFatPct, setBodyFatPct] = useState(entry.body_fat_pct !== null ? String(entry.body_fat_pct) : '');
  const [method, setMethod] = useState(entry.method ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  /* Was this row LOGGED today, in the club's own timezone? Migration 0084 gates
     the delete on exactly this, so the control appears only where the write will
     land. Computed from created_at, not measured_on: the window is about when
     the row was entered, so a backdated weigh-in is removable on the day it is
     typed and permanent after — and yesterday's entry has no delete at all, no
     matter what date it describes.

     The timezone matters: at 00:30 BST a UTC comparison still says yesterday,
     and the button would vanish half an hour early. */
  const loggedToday = dateInTz(new Date(entry.created_at), timezone) === todayIso(timezone);

  const remove = useMutation({
    mutationFn: () => withWriteTimeout(deleteWeighIn(createClient(), orgId, entry.id)),
    onSuccess: (result) => {
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      onDone();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

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
      <span className="num tiny" style={{ minWidth: 78 }}>
        {formatDate(entry.measured_on, timezone)}
      </span>
      <input
        className="field"
        type="date"
        value={measuredOn}
        onChange={(event) => {
          setMeasuredOn(event.target.value);
          setSaved(false);
        }}
        aria-label={`Date for the ${formatDate(entry.measured_on, timezone)} entry`}
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
        aria-label={`Body mass in kg for the ${formatDate(entry.measured_on, timezone)} entry`}
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
        aria-label={`Body fat percent for the ${formatDate(entry.measured_on, timezone)} entry`}
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
        aria-label={`Method for the ${formatDate(entry.measured_on, timezone)} entry`}
      />
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          setError(null);
          save.mutate();
        }}
        disabled={save.isPending || remove.isPending}
      >
        {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
      {/* Only on a row logged today. Nothing older renders this at all — not a
          disabled button, which invites a click and explains nothing. */}
      {loggedToday ? (
        confirming ? (
          <>
            <button
              type="button"
              className="btn-ghost"
              style={{ color: 'var(--bad-text)' }}
              onClick={() => {
                setError(null);
                remove.mutate();
              }}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            style={{ color: 'var(--bad-text)' }}
            onClick={() => setConfirming(true)}
            disabled={save.isPending}
            aria-label={`Delete the ${formatDate(entry.measured_on, timezone)} entry`}
          >
            Delete
          </button>
        )
      ) : null}
      {error ? (
        <span className="form-error" role="alert" style={{ gridColumn: '1 / -1' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
