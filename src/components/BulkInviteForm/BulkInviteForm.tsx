'use client';

import { useMemo, useState } from 'react';
import {
  isRowSendable,
  matchBulkInviteRows,
  parseBulkInviteText,
  type BulkInvitePreviewRow,
  type BulkInviteResult,
  type BulkInviteSendRow,
} from '@/lib/queries/bulkInvite';
import type { UnlinkedAthlete } from '@/lib/queries/userManagement';

type Props = {
  unlinkedAthletes: UnlinkedAthlete[];
};

const PLACEHOLDER = 'ellis@mail.example, Ellis, Marsh, 4, 2008-03-14\nryan@mail.example, Ryan, Doherty, 2, 2006-11-02\ntom@mail.example, Tom, Reeve, 12, 2004-07-30';

/** The two-step flow the spec insists on — preview, then send — exists
 *  because auto-linking an account to the wrong athlete record is a
 *  data-protection incident, not a convenience bug (this file's own query
 *  layer, lib/queries/bulkInvite.ts, carries the full reasoning). Nothing
 *  is written to the database until "Send" is clicked, and a row matching
 *  more than one same-named athlete cannot be sent until a person, not
 *  this code, has picked which one. */
export function BulkInviteForm({ unlinkedAthletes }: Props) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<BulkInvitePreviewRow[] | null>(null);
  const [tooMany, setTooMany] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkInviteResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const sendableCount = useMemo(() => preview?.filter(isRowSendable).length ?? 0, [preview]);

  function onParse() {
    const { rows, tooMany: exceeded } = parseBulkInviteText(text);
    setTooMany(exceeded);
    setPreview(matchBulkInviteRows(rows, unlinkedAthletes));
    setResults(null);
  }

  function onPickCandidate(line: number, athleteId: string) {
    setPreview((rows) => rows?.map((r) => (r.line === line ? { ...r, chosenAthleteId: athleteId || null } : r)) ?? null);
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setSendError('That file is too large — 1MB maximum.');
      return;
    }
    const content = await file.text();
    setText(content);
    const { rows, tooMany: exceeded } = parseBulkInviteText(content);
    setTooMany(exceeded);
    setPreview(matchBulkInviteRows(rows, unlinkedAthletes));
    setResults(null);
  }

  async function onSend() {
    if (!preview) return;
    const sendRows: BulkInviteSendRow[] = preview.filter(isRowSendable).map((r) => ({
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      squadNumber: r.squadNumber,
      dateOfBirth: r.dateOfBirth,
      athleteId: r.matchStatus === 'matched' || r.matchStatus === 'needs_choice' ? r.chosenAthleteId : null,
    }));
    if (sendRows.length === 0) return;

    setBusy(true);
    setSendError(null);
    const resp = await fetch('/settings/users/bulk-invite/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: sendRows }),
    });
    setBusy(false);

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      setSendError(body.error ?? 'Could not send invites.');
      return;
    }
    const body = await resp.json();
    setResults(body.results);
  }

  const statusLabel: Record<BulkInvitePreviewRow['matchStatus'], string> = {
    error: 'Error',
    new: 'New athlete record',
    matched: 'Links to existing record',
    needs_choice: 'Needs a choice',
  };

  return (
    <div className="stack">
      <div className="card">
        <h2 className="card-title">Paste or upload</h2>
        <div className="form-row">
          <label className="label" htmlFor="bulk-invite-text">
            Columns: email, first name, last name, squad number, date of birth (YYYY-MM-DD)
          </label>
          <textarea
            id="bulk-invite-text"
            className="field"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            style={{ fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>
        <div className="chiprow" style={{ marginTop: 10 }}>
          <label className="btn-ghost" style={{ cursor: 'pointer' }}>
            Upload a CSV instead
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} style={{ display: 'none' }} />
          </label>
          <button type="button" className="btn-primary" onClick={onParse} disabled={text.trim().length === 0}>
            Preview
          </button>
        </div>
        {tooMany ? <p className="form-error">Only the first {preview?.length ?? 0} rows are shown — invite up to 100 people at a time.</p> : null}
        {sendError ? (
          <p className="form-error" role="alert">
            {sendError}
          </p>
        ) : null}
      </div>

      {preview && preview.length > 0 && !results ? (
        <div className="card">
          <h2 className="card-title">Preview — {preview.length} rows</h2>
          <p className="import-sub" style={{ marginBottom: 10 }}>
            {preview.filter((r) => r.matchStatus === 'new').length} new athlete record
            {preview.filter((r) => r.matchStatus === 'new').length === 1 ? '' : 's'} will be created ·{' '}
            {preview.filter((r) => r.matchStatus === 'matched').length} will link to an existing record ·{' '}
            {preview.filter((r) => r.matchStatus === 'error' || r.matchStatus === 'needs_choice').length} need attention
          </p>
          <table className="tbl">
            <caption className="visually-hidden">Bulk invite preview</caption>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">Email</th>
                <th scope="col">Name</th>
                <th scope="col">Squad no.</th>
                <th scope="col">Date of birth</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.line}>
                  <td className="num sub">{row.line}</td>
                  <td className="sub">{row.email || '—'}</td>
                  <td className="nm">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="num sub">{row.squadNumber ?? '—'}</td>
                  <td className="num sub">{row.dateOfBirth ?? '—'}</td>
                  <td>
                    {row.matchStatus === 'error' ? (
                      <span className="g-bad">{row.error}</span>
                    ) : row.matchStatus === 'needs_choice' ? (
                      <select className="field" style={{ minHeight: 32, padding: '4px 8px' }} value={row.chosenAthleteId ?? ''} onChange={(e) => onPickCandidate(row.line, e.target.value)}>
                        <option value="">Choose which record…</option>
                        {row.candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.first_name} {c.last_name} {c.squad_number !== null ? `· no.${c.squad_number}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="sub">{statusLabel[row.matchStatus]}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={onSend} disabled={busy || sendableCount === 0}>
            {busy ? 'Sending…' : `Send ${sendableCount} invite${sendableCount === 1 ? '' : 's'}`}
          </button>
        </div>
      ) : null}

      {results ? (
        <div className="card">
          <h2 className="card-title">
            {results.filter((r) => r.ok).length} sent, {results.filter((r) => !r.ok).length} failed
          </h2>
          <p className="import-sub" style={{ marginBottom: 10 }}>
            Each invite link is shown once, here only &mdash; copy them now. There is no invite email; send each link to
            its athlete directly. A link works once, confirms their email address, and lets them choose their own
            password, which nobody here ever sees.
          </p>
          <table className="tbl">
            <caption className="visually-hidden">Bulk invite results</caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Result</th>
                <th scope="col">Invite link</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.email}>
                  <td className="sub">{r.email}</td>
                  <td>{r.ok ? <span className="g-good">Sent</span> : <span className="g-bad">{r.error}</span>}</td>
                  <td className="nm" style={{ wordBreak: 'break-all' }}>{r.inviteUrl ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
