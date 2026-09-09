'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  PROBLEM_REPORT_CATEGORY_LABEL,
  acknowledgeProblemReport,
  addProblemReportNote,
  closeProblemReport,
  type OpenProblemReport,
  type ProblemReportNote,
} from '@/lib/queries/problemReports';
import { formatDateTime } from '@/lib/format';

/** The note body limit is migration 0055's own check constraint
 *  (`char_length(body) <= 1000`), which mirrors 0040's limit on the report it
 *  annotates. Stopping the field here means the medic finds out while typing
 *  rather than on a 23514 from the database. */
const NOTE_MAX = 1000;

function ReportRow({
  report,
  notes,
  orgId,
  userId,
  timezone,
}: {
  report: OpenProblemReport;
  notes: ProblemReportNote[];
  orgId: string;
  userId: string;
  timezone: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Collapsed by default, the same shape FlagCard gives its own note
  // affordance: the common case is a plain Acknowledge with nothing to say,
  // and the note is an additive second step rather than a required one.
  const [addingNote, setAddingNote] = useState(false);
  const [note, setNote] = useState('');

  const acknowledgeMutation = useMutation({
    mutationFn: () => acknowledgeProblemReport(createClient(), report.id, userId),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeProblemReport(createClient(), report.id, userId),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) =>
      addProblemReportNote(createClient(), { reportId: report.id, body }, { orgId, userId }),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setAddingNote(false);
      setNote('');
      router.refresh();
    },
  });

  const pending =
    acknowledgeMutation.isPending || closeMutation.isPending || noteMutation.isPending;

  function saveNote() {
    const body = note.trim();
    if (!body) {
      setError('Write something before saving the note.');
      return;
    }
    setError(null);
    noteMutation.mutate(body);
  }

  return (
    <div className="load-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 'var(--sp-8)', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="nm">
            {report.first_name} {report.last_name}
          </span>
          <span className={`pill ${report.status === 'open' ? 'pill-warn' : 'pill-good'}`}>
            {report.status === 'open' ? 'Not yet seen' : 'Acknowledged'}
          </span>
        </div>
        <div className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
          {formatDateTime(report.created_at, timezone)}
          {report.category ? ` · ${PROBLEM_REPORT_CATEGORY_LABEL[report.category] ?? report.category}` : ''}
        </div>
        <p style={{ fontSize: 'var(--fs-14)', marginTop: 'var(--sp-6)' }}>{report.body}</p>

        {/* The triage trail, oldest first — migration 0055's problem_report_notes.
         *
         * IMPORTANT, and the opposite of FlagCard's superficially similar
         * "+ Add note": that note goes into flags.staff_note and is shown to
         * the athlete on their own FlagNotice once the flag is acknowledged, by
         * design (it is staff-only until then, and the card says so). These notes
         * are MEDICAL ONLY and are never shown to the athlete — not on the
         * athlete's own report, which they can otherwise read in full. That is
         * why they live in their own table with a single medical-only select
         * policy rather than as a column on problem_reports, where the
         * athlete's row-select would have exposed them. Do not "unify" the two
         * affordances, and do not surface anything below on an athlete
         * surface. */}
        {notes.length > 0 ? (
          <ul className="report-notes">
            {notes.map((n) => (
              <li key={n.id} className="report-note">
                <p className="report-note-body">{n.body}</p>
                <p className="report-note-attribution">
                  {n.author_name ?? 'Medical staff'} · {formatDateTime(n.created_at, timezone)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {addingNote ? (
          <div className="report-note-form">
            <label className="label" htmlFor={`note-${report.id}`}>
              Note on this report
            </label>
            <textarea
              id={`note-${report.id}`}
              className="field"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="e.g. Called them Wednesday. Tightness on the bike only, full ROM. Reviewing Thursday."
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby={`note-privacy-${report.id}`}
            />
            <p className="tiny" id={`note-privacy-${report.id}`} style={{ marginTop: 'var(--sp-4)' }}>
              Medical staff only. {report.first_name} cannot see this, and neither can coaching
              staff. Notes cannot be edited once saved — add another to correct one.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-8)', marginTop: 'var(--sp-8)' }}>
              <button type="button" className="btn-primary" onClick={saveNote} disabled={pending}>
                {noteMutation.isPending ? 'Saving…' : 'Save note'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={noteMutation.isPending}
                onClick={() => {
                  setAddingNote(false);
                  setNote('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-6)' }}>
            {error}
          </p>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        {report.status === 'open' ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={() => acknowledgeMutation.mutate()}
          >
            {acknowledgeMutation.isPending ? 'Saving…' : 'Acknowledge'}
          </button>
        ) : null}
        {addingNote ? null : (
          <button
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={() => {
              setAddingNote(true);
              setError(null);
            }}
            aria-label={`Add a medical note on ${report.first_name} ${report.last_name}'s report`}
          >
            + Note
          </button>
        )}
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => closeMutation.mutate()}>
          {closeMutation.isPending ? 'Saving…' : 'Close'}
        </button>
      </div>
    </div>
  );
}

/** Medical-only, per migration 0040's own RLS: this component is never
 *  rendered for a coach at all (see (staff)/injuries/page.tsx's own
 *  `isMedical` gate), and even if it somehow were, fetchOpenProblemReports
 *  would hand a coach an empty array — the access control is the RLS
 *  policy, this is just where the UI hides the empty section. Acknowledge
 *  then Close, or Close directly for a duplicate/mis-tap; migration 0040's
 *  trigger is what actually enforces both the transition and the
 *  acting-user stamp, this only performs the update it expects.
 *
 *  The notes (migration 0055) are the same story one table over: medical-only
 *  by policy, never shown to the athlete the report is about, and appended
 *  rather than edited. See ReportRow's own comment for why they are not
 *  FlagCard's athlete-facing note despite looking like it. */
export function ProblemReportsTriage({
  reports,
  notes,
  orgId,
  userId,
  timezone,
}: {
  reports: OpenProblemReport[];
  notes: ProblemReportNote[];
  orgId: string;
  userId: string;
  timezone: string;
}) {
  if (reports.length === 0) {
    return <p className="cap">No open reports. Anything an athlete sends will show up here.</p>;
  }

  return (
    <div className="card flush">
      {reports.map((r, index) => (
        <div key={r.id}>
          {index > 0 ? <div className="hair" /> : null}
          <ReportRow
            report={r}
            notes={notes.filter((n) => n.report_id === r.id)}
            orgId={orgId}
            userId={userId}
            timezone={timezone}
          />
        </div>
      ))}
    </div>
  );
}
