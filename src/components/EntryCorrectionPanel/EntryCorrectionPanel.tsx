'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { reviseWellnessEntry } from '@/lib/queries/wellness';
import { reviseTrainingEntry } from '@/lib/queries/training';
import {
  recordRevisionChainView,
  type TrainingWithSession,
  type WellnessRevisionRow,
  type WithRevisions,
} from '@/lib/queries/entryRevisions';
import { WellnessCorrection, TrainingCorrection } from '@/lib/validation/entryCorrection';
import { SCALE_COPY, WELLNESS_SCALES, type WellnessScale } from '@/lib/validation/wellness';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { BLANK, formatDate, formatDateTime, formatNumber } from '@/lib/format';

/**
 * Coach-facing entry correction, and the "this was corrected" marker that
 * adr-005-immutable-entries.md O-28 specified and nothing implemented.
 *
 * The club's ask, verbatim: "the athlete shouldnt be able to edit an entry only the
 * coach should be able to do it on the system - show me exactly how they can do this
 * and is this a feature in the system for each player profile." This component is the
 * "yes, here" — it lives on the player profile, one card, per athlete.
 *
 * What it is NOT
 *   Not an edit. There is no UPDATE grant on `wellness_entries` or `training_entries`
 *   for any role, including the coach using this panel (300_coach_entry_correction_test
 *   re-proves that after 0058). Saving here calls `revise_*`, which closes the original
 *   with `superseded_by` and inserts a new row carrying `revision_of`. The original
 *   value stays readable forever, which is the whole of ADR-005 and is why the copy
 *   below says "correct", never "edit".
 *
 * Two things worth knowing about the shape
 *   1. Every field starts prefilled with the CURRENT value and is compared against it
 *      on save; only genuinely changed fields go into the payload. The RPCs coalesce
 *      each field against the original, so an untouched field is expressed as absence
 *      rather than as a restatement. This matters beyond tidiness: it means a coach
 *      fixing a duration cannot accidentally overwrite a sleep score with a rounded
 *      version of itself, which is exactly the class of bug the athlete's old correction
 *      mode hit. It is also why this file must NOT copy that mode's fix — see the note
 *      above the two forms below on why the input's step matches the column instead.
 *   2. Expanding the history writes one audit row per entry per mount, never per click
 *      — see `seenRef` below. O-28's third clause. It is the *read* half of the audit;
 *      the write half lives in migration 0058's RPCs, which log `entry_revision.created`
 *      with the prior values whenever a correction below is saved.
 */

const WINDOW_LABEL = 'last 28 days';

type Props = {
  athleteId: string;
  athleteFirstName: string;
  timezone: string;
  /** coach or medical. Migration 0058's guard is the real gate; this only decides
   *  whether a control that RLS would refuse is offered at all. CLAUDE.md §2 rule 2. */
  canCorrect: boolean;
  wellness: WithRevisions<WellnessRevisionRow>[];
  training: TrainingWithSession[];
};

export function EntryCorrectionPanel({
  athleteId,
  athleteFirstName,
  timezone,
  canCorrect,
  wellness,
  training,
}: Props) {
  const router = useRouter();
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<string | null>(null);

  /* One audit row per entry per mount. A coach toggling a disclosure open, shut and
   * open again is one look, not three, and audit_log is evidence rather than a click
   * stream (04-data-model.md §13, and the 16 KB metadata ceiling there says the same
   * thing about volume). Deliberately a ref, not state: recording a look must never
   * cause a render. */
  const seenRef = useRef<Set<string>>(new Set());

  function toggleHistory(key: string, domain: 'wellness' | 'training', entryId: string) {
    const nowOpen = openHistory !== key;
    setOpenHistory(nowOpen ? key : null);
    if (nowOpen && !seenRef.current.has(key)) {
      seenRef.current.add(key);
      void recordRevisionChainView(createClient(), athleteId, domain, entryId);
    }
  }

  const correctedWellness = wellness.filter((w) => w.priorRevisions.length > 0 || w.current.revision_of !== null).length;
  const correctedTraining = training.filter((t) => t.priorRevisions.length > 0 || t.current.revision_of !== null).length;

  return (
    <section className="card pp-card" aria-labelledby="pp-corrections-title">
      <h2 className="card-title" id="pp-corrections-title">
        Entries and corrections
      </h2>
      <p className="import-sub" style={{ margin: '4px 0 0' }}>
        The {WINDOW_LABEL} of {athleteFirstName}&rsquo;s wellness check-ins and session
        ratings. {canCorrect
          ? 'Correcting one keeps the original and records a new, dated revision against your name — entries are never overwritten.'
          : 'Correcting an entry belongs to the sport scientist, the coach and the medic.'}
      </p>
      <p className="cap" style={{ margin: '6px 0 0' }}>
        {correctedWellness + correctedTraining === 0
          ? 'Nothing in this window has been corrected.'
          : `${correctedWellness + correctedTraining} of these entries carry a correction. Expand one to see what it said before.`}
      </p>

      <h3 className="card-title" style={{ fontSize: 'var(--fs-14)', marginTop: 'var(--sp-18)' }}>
        Wellness check-ins
      </h3>
      {wellness.length === 0 ? (
        <p className="cap" style={{ marginTop: 'var(--sp-6)' }}>
          No wellness entries in the {WINDOW_LABEL}.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <caption className="visually-hidden">
              Wellness entries in the {WINDOW_LABEL}, most recent first, with their correction history
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="r">
                  Sleep
                </th>
                <th scope="col" className="r">
                  Quality
                </th>
                <th scope="col" className="r">
                  Fatigue
                </th>
                <th scope="col" className="r">
                  Soreness
                </th>
                <th scope="col" className="r">
                  Stress
                </th>
                <th scope="col" className="r">
                  Mood
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {wellness.map((row) => {
                const key = `w-${row.current.id}`;
                const corrected = row.current.revision_of !== null;
                return (
                  <WellnessRow
                    key={key}
                    rowKey={key}
                    row={row}
                    corrected={corrected}
                    timezone={timezone}
                    canCorrect={canCorrect}
                    historyOpen={openHistory === key}
                    formOpen={openForm === key}
                    onToggleHistory={() => toggleHistory(key, 'wellness', row.current.id)}
                    onToggleForm={() => setOpenForm((f) => (f === key ? null : key))}
                    onSaved={() => {
                      setOpenForm(null);
                      router.refresh();
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="card-title" style={{ fontSize: 'var(--fs-14)', marginTop: 'var(--sp-22)' }}>
        Session ratings (RPE)
      </h3>
      {training.length === 0 ? (
        <p className="cap" style={{ marginTop: 'var(--sp-6)' }}>
          No session ratings in the {WINDOW_LABEL}.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <caption className="visually-hidden">
              Session ratings in the {WINDOW_LABEL}, most recent first, with their correction history
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Session</th>
                <th scope="col" className="r">
                  RPE
                </th>
                <th scope="col" className="r">
                  Minutes
                </th>
                <th scope="col" className="r">
                  Load
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {training.map((row) => {
                const key = `t-${row.current.id}`;
                return (
                  <TrainingRow
                    key={key}
                    rowKey={key}
                    row={row}
                    corrected={row.current.revision_of !== null}
                    timezone={timezone}
                    canCorrect={canCorrect}
                    historyOpen={openHistory === key}
                    formOpen={openForm === key}
                    onToggleHistory={() => toggleHistory(key, 'training', row.current.id)}
                    onToggleForm={() => setOpenForm((f) => (f === key ? null : key))}
                    onSaved={() => {
                      setOpenForm(null);
                      router.refresh();
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* The asymmetry, stated on the screen rather than only in a migration comment.
        * A coach who can correct sleep and RPE here will reasonably ask why the gym and
        * nutrition numbers on the same athlete have no Correct button, and the honest
        * answer is that the database has no staff write path to those two tables at all
        * (0012 §11, 0045). Saying so is better than a button that always fails. */}
      <p className="cap" style={{ marginTop: 'var(--sp-18)' }}>
        Gym set logs and the weekly nutrition check-in are not correctable here. Neither
        table has a staff write path, so those two stay the athlete&rsquo;s own to fix
        from their app.
      </p>
    </section>
  );
}

/** The shared "Corrected" marker. O-28's "current value plus an edited marker": the
 *  coach's default view is the number, and the fact that it is not the first number is
 *  a pill rather than a second column of history they did not ask for. */
function CorrectedPill({ by, at, timezone }: { by: string | null; at: string | null; timezone: string }) {
  return (
    /* .pill-neutral, not .pill-warn. A correction is a normal, wanted event — the
     * feature the club asked for — and colouring it amber would read as "something is
     * wrong with this athlete's data", which is exactly the connotation that would
     * discourage anyone from making one. */
    <span
      className="pill pill-neutral"
      style={{ marginInlineStart: 6 }}
      title={
        at
          ? `Corrected ${formatDateTime(at, timezone)}${by ? ` by ${by}` : ''}`
          : 'This entry has been corrected'
      }
    >
      Corrected
    </span>
  );
}

function HistoryCell<T extends { id: string; submitted_at: string | null }>({
  colSpan,
  row,
  timezone,
  render,
}: {
  colSpan: number;
  row: { priorRevisions: T[]; correctedBy: string | null; correctedAt: string | null };
  timezone: string;
  render: (rev: T) => string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ background: 'var(--surf2)' }}>
        <p className="cap" style={{ margin: '0 0 6px' }}>
          {row.correctedAt
            ? `Current value recorded ${formatDateTime(row.correctedAt, timezone)}${
                row.correctedBy ? ` by ${row.correctedBy}` : ' by a staff member'
              }.`
            : 'Correction history.'}
        </p>
        {row.priorRevisions.length === 0 ? (
          /* Reachable and not a bug: `revision_of` points outside the fetched window
           * (an old entry corrected recently). Saying so beats an empty box that reads
           * as a loading failure. */
          <p className="cap" style={{ margin: 0 }}>
            The version this replaced is older than the {WINDOW_LABEL} shown here.
          </p>
        ) : (
          <ol className="cap" style={{ margin: 0, paddingInlineStart: 18 }}>
            {row.priorRevisions.map((rev) => (
              <li key={rev.id} className="num">
                {render(rev)}
                {rev.submitted_at ? ` · recorded ${formatDateTime(rev.submitted_at, timezone)}` : ''}
              </li>
            ))}
          </ol>
        )}
      </td>
    </tr>
  );
}

type RowShellProps = {
  rowKey: string;
  timezone: string;
  canCorrect: boolean;
  corrected: boolean;
  historyOpen: boolean;
  formOpen: boolean;
  onToggleHistory: () => void;
  onToggleForm: () => void;
  onSaved: () => void;
};

function ActionsCell({
  corrected,
  canCorrect,
  historyOpen,
  formOpen,
  onToggleHistory,
  onToggleForm,
  label,
}: Pick<RowShellProps, 'corrected' | 'canCorrect' | 'historyOpen' | 'formOpen' | 'onToggleHistory' | 'onToggleForm'> & {
  label: string;
}) {
  return (
    <td className="sub" style={{ whiteSpace: 'nowrap' }}>
      {corrected ? (
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '4px 10px', marginInlineEnd: 6 }}
          onClick={onToggleHistory}
          aria-expanded={historyOpen}
        >
          {historyOpen ? 'Hide history' : 'History'}
        </button>
      ) : null}
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: '4px 10px' }}
        disabled={!canCorrect}
        aria-disabled={!canCorrect}
        aria-expanded={formOpen}
        title={canCorrect ? undefined : 'Correcting an entry belongs to the sport scientist, the coach and the medic.'}
        onClick={onToggleForm}
      >
        {formOpen ? 'Cancel' : `Correct ${label}`}
      </button>
    </td>
  );
}

function WellnessRow({
  rowKey,
  row,
  corrected,
  timezone,
  canCorrect,
  historyOpen,
  formOpen,
  onToggleHistory,
  onToggleForm,
  onSaved,
}: RowShellProps & { row: WithRevisions<WellnessRevisionRow> }) {
  const e = row.current;
  return (
    <>
      <tr>
        <td className="num sub">
          {formatDate(e.entry_date, timezone)}
          {corrected ? <CorrectedPill by={row.correctedBy} at={row.correctedAt} timezone={timezone} /> : null}
        </td>
        <td className="r num">{e.sleep_hours !== null ? `${formatNumber(e.sleep_hours, 1)} h` : BLANK}</td>
        <td className="r num">{e.sleep_quality ?? BLANK}</td>
        <td className="r num">{e.fatigue ?? BLANK}</td>
        <td className="r num">{e.soreness ?? BLANK}</td>
        <td className="r num">{e.stress ?? BLANK}</td>
        <td className="r num">{e.mood ?? BLANK}</td>
        <ActionsCell
          corrected={corrected}
          canCorrect={canCorrect}
          historyOpen={historyOpen}
          formOpen={formOpen}
          onToggleHistory={onToggleHistory}
          onToggleForm={onToggleForm}
          label="check-in"
        />
      </tr>
      {historyOpen ? (
        <HistoryCell
          colSpan={8}
          row={row}
          timezone={timezone}
          render={(r) =>
            `sleep ${r.sleep_hours ?? '–'} h · quality ${r.sleep_quality ?? '–'} · fatigue ${
              r.fatigue ?? '–'
            } · soreness ${r.soreness ?? '–'} · stress ${r.stress ?? '–'} · mood ${r.mood ?? '–'}`
          }
        />
      ) : null}
      {formOpen ? (
        <tr>
          <td colSpan={8}>
            <WellnessCorrectionForm key={rowKey} entry={e} timezone={timezone} onSaved={onSaved} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function TrainingRow({
  rowKey,
  row,
  corrected,
  timezone,
  canCorrect,
  historyOpen,
  formOpen,
  onToggleHistory,
  onToggleForm,
  onSaved,
}: RowShellProps & { row: TrainingWithSession }) {
  const e = row.current;
  return (
    <>
      <tr>
        <td className="num sub">
          {formatDate(e.entry_date, timezone)}
          {corrected ? <CorrectedPill by={row.correctedBy} at={row.correctedAt} timezone={timezone} /> : null}
        </td>
        <td className="nm">{row.sessionTitle ?? 'Session no longer on the schedule'}</td>
        <td className="r num">{formatNumber(e.rpe, 1)}</td>
        <td className="r num">{e.duration_min ?? BLANK}</td>
        <td className="r num">{formatNumber(e.session_load, 0)}</td>
        <ActionsCell
          corrected={corrected}
          canCorrect={canCorrect}
          historyOpen={historyOpen}
          formOpen={formOpen}
          onToggleHistory={onToggleHistory}
          onToggleForm={onToggleForm}
          label="rating"
        />
      </tr>
      {historyOpen ? (
        <HistoryCell
          colSpan={6}
          row={row}
          timezone={timezone}
          render={(r) => `RPE ${r.rpe ?? '–'} · ${r.duration_min ?? '–'} min · load ${r.session_load ?? '–'}`}
        />
      ) : null}
      {formOpen ? (
        <tr>
          <td colSpan={6}>
            <TrainingCorrectionForm key={rowKey} entry={e} timezone={timezone} onSaved={onSaved} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ forms */

/* Both forms below are `noValidate`, matching CheckInForm and RpeForm, and that is
 * load-bearing rather than stylistic — it is the backstop for the bug CheckInForm's
 * deleted rounding comment recorded ("e.g. 7.9 … Caught live").
 *
 * The failure it prevents: `wellness_entries.sleep_hours` is `numeric(3,1)` and the
 * seed rounds to one decimal (supabase/seed.sql), so roughly four rows in five carry
 * a value like 7.3 or 7.9. Prefilled into an input whose `step` is coarser than the
 * column, that value fails the browser's own `stepMismatch` check, and a validating
 * form refuses to submit AT ALL — React's `onSubmit` never fires, and the coach cannot
 * correct fatigue or soreness on that row either, because one untouched field they
 * never looked at is holding the whole form shut. A native bubble on a value the coach
 * did not type is not a useful error, and blocking five other fields with it is worse.
 *
 * `noValidate` alone would only stop the block, so the step is fixed too: the sleep
 * input steps in 0.1 and `WellnessCorrection` allows 0.1, which is exactly the column's
 * precision. The input, the schema and the column now agree, so a real stored value is
 * always expressible and the prefill is never a value the form rejects.
 *
 * What is deliberately NOT done here is CheckInForm's old fix — rounding the prefill to
 * the input's step. That guard was right for a form the athlete filled in from scratch;
 * it is wrong here. Every field on these forms is diffed against the original by
 * `changedNumber` below, so a prefill rounded from 7.9 to 8.0 would read as a change
 * the coach never made and would write a fabricated sleep value into an immutable
 * revision. Widening the step is the same rescue without the fabrication.
 *
 * RPE keeps `step="0.5"`: `TrainingCorrection` documents that bound, and real rpe rows
 * land on half steps (seed.sql:525). `noValidate` covers it regardless. */

/** Text state, not numeric state, throughout both forms. A number input bound to a
 *  number cannot represent "the coach has cleared the box and is mid-type", and
 *  coercing an empty string to 0 would send a real, wrong value (a sleep score of 0,
 *  an RPE of 0) into an immutable revision. Empty means untouched-or-cleared and is
 *  dropped from the payload; the RPC's coalesce then keeps the original. */
function changedNumber(next: string, original: number | null): number | undefined {
  if (next.trim() === '') return undefined;
  const value = Number(next);
  if (!Number.isFinite(value)) return undefined;
  if (original !== null && value === original) return undefined;
  return value;
}

function WellnessCorrectionForm({
  entry,
  timezone,
  onSaved,
}: {
  entry: WellnessRevisionRow;
  timezone: string;
  onSaved: () => void;
}) {
  const [sleepHours, setSleepHours] = useState(entry.sleep_hours !== null ? String(entry.sleep_hours) : '');
  const [scales, setScales] = useState<Record<WellnessScale, string>>({
    sleep_quality: entry.sleep_quality !== null ? String(entry.sleep_quality) : '',
    fatigue: entry.fatigue !== null ? String(entry.fatigue) : '',
    soreness: entry.soreness !== null ? String(entry.soreness) : '',
    stress: entry.stress !== null ? String(entry.stress) : '',
    mood: entry.mood !== null ? String(entry.mood) : '',
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const candidate = {
        sleep_hours: changedNumber(sleepHours, entry.sleep_hours),
        sleep_quality: changedNumber(scales.sleep_quality, entry.sleep_quality),
        fatigue: changedNumber(scales.fatigue, entry.fatigue),
        soreness: changedNumber(scales.soreness, entry.soreness),
        stress: changedNumber(scales.stress, entry.stress),
        mood: changedNumber(scales.mood, entry.mood),
      };
      const parsed = WellnessCorrection.safeParse(candidate);
      if (!parsed.success) {
        /* The refine's message ("Nothing was changed.") is the common case and is
         * already written for a person; a bounds failure is not, so it is replaced
         * rather than shown raw. */
        throw new Error(
          parsed.error.issues.some((i) => i.message === 'Nothing was changed.')
            ? 'Nothing was changed.'
            : 'Sleep is 0–14 hours to one decimal place; every other score is a whole number from 1 to 5.',
        );
      }
      return withWriteTimeout(reviseWellnessEntry(createClient(), entry.id, parsed.data));
    },
    onSuccess: (result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        save.mutate();
      }}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-12)', alignItems: 'flex-end', padding: '10px 0' }}
    >
      <p className="cap" style={{ flexBasis: '100%', margin: 0 }}>
        Correcting {formatDate(entry.entry_date, timezone)}. Change only what is wrong —
        anything you leave alone is carried through untouched. Every scale runs 1 to 5
        where <b>5 is the best</b>, soreness included.
      </p>
      <label style={{ minWidth: 110 }}>
        <span className="label">Sleep (h)</span>
        {/* step 0.1, not 0.5: sleep_hours is numeric(3,1) and real rows carry one
          * decimal. See this file's note above the forms on why the step matches the
          * column rather than the athlete stepper. */}
        <input
          className="field"
          type="number"
          step="0.1"
          min="0"
          max="14"
          inputMode="decimal"
          value={sleepHours}
          onChange={(event) => setSleepHours(event.target.value)}
        />
      </label>
      {WELLNESS_SCALES.map((scale) => (
        <label key={scale} style={{ minWidth: 110 }}>
          <span className="label">{SCALE_COPY[scale].label}</span>
          <select
            className="field"
            value={scales[scale]}
            onChange={(event) => setScales((s) => ({ ...s, [scale]: event.target.value }))}
          >
            <option value="">Leave as is</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n} — {SCALE_COPY[scale].words[n - 1]}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit" className="btn-primary" disabled={save.isPending}>
        {save.isPending ? 'Saving correction…' : 'Save correction'}
      </button>
      {error ? (
        <p className="form-error" role="alert" style={{ flexBasis: '100%', margin: 0 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

function TrainingCorrectionForm({
  entry,
  timezone,
  onSaved,
}: {
  entry: TrainingWithSession['current'];
  timezone: string;
  onSaved: () => void;
}) {
  const [rpe, setRpe] = useState(entry.rpe !== null ? String(entry.rpe) : '');
  const [duration, setDuration] = useState(entry.duration_min !== null ? String(entry.duration_min) : '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const candidate = {
        rpe: changedNumber(rpe, entry.rpe),
        duration_min: changedNumber(duration, entry.duration_min),
      };
      const parsed = TrainingCorrection.safeParse(candidate);
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues.some((i) => i.message === 'Nothing was changed.')
            ? 'Nothing was changed.'
            : 'RPE is 1–10 in half-point steps; minutes is a whole number from 1 to 600.',
        );
      }
      return withWriteTimeout(reviseTrainingEntry(createClient(), entry.id, parsed.data));
    },
    onSuccess: (result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        save.mutate();
      }}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-12)', alignItems: 'flex-end', padding: '10px 0' }}
    >
      <p className="cap" style={{ flexBasis: '100%', margin: 0 }}>
        Correcting the rating for {formatDate(entry.entry_date, timezone)}. Session load
        is recalculated from whatever you save here; you never set it directly.
      </p>
      <label style={{ minWidth: 110 }}>
        <span className="label">RPE (1–10)</span>
        <input
          className="field"
          type="number"
          step="0.5"
          min="1"
          max="10"
          inputMode="decimal"
          value={rpe}
          onChange={(event) => setRpe(event.target.value)}
        />
      </label>
      <label style={{ minWidth: 110 }}>
        <span className="label">Minutes</span>
        <input
          className="field"
          type="number"
          step="1"
          min="1"
          max="600"
          inputMode="numeric"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
      </label>
      <button type="submit" className="btn-primary" disabled={save.isPending}>
        {save.isPending ? 'Saving correction…' : 'Save correction'}
      </button>
      {error ? (
        <p className="form-error" role="alert" style={{ flexBasis: '100%', margin: 0 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
