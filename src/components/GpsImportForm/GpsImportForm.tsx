'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UploadResult } from '@/app/(staff)/settings/imports/upload/route';

/** screens/imports.md, cut down hard — see lib/queries/gpsImport.ts's header
 *  for the full list of what this build does not attempt. This component is
 *  the whole UI for what remains: pick a file, upload it, see what landed
 *  and what didn't. No drag-and-drop staging, no per-row review-before-commit
 *  — a row is either accepted (and already committed by the time this
 *  component sees the response) or rejected with a reason. */
export function GpsImportForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch('/settings/imports/upload', { method: 'POST', body });
      const data: UploadResult = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Import failed.');
        if (data.rejected.length > 0) setResult(data);
      } else {
        setResult(data);
        if (inputRef.current) inputRef.current.value = '';
        setFileName(null);
        router.refresh();
      }
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <h2 className="card-title">Import GPS data</h2>
      <p className="import-sub">
        A .csv file with the exact header row from the template below. One row per athlete per session. See{' '}
        <a href="/settings/imports/template" style={{ color: 'var(--accent-text)', textDecoration: 'underline' }}>
          the template
        </a>{' '}
        for the columns and an example row.
      </p>

      <div className="form-row">
        <label className="label" htmlFor="gps-file">
          File
        </label>
        <input
          id="gps-file"
          ref={inputRef}
          className="field"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
        {fileName ? (
          <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
            {fileName}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="banner" role="alert" style={{ marginBottom: 'var(--sp-12)' }}>
          <span className="g g-bad" aria-hidden="true">
            ✕
          </span>
          <span>{error}</span>
        </p>
      ) : null}

      {result?.ok ? (
        <p className="banner" role="status" style={{ marginBottom: 'var(--sp-12)' }}>
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            {result.filename}: {result.acceptedCount} record{result.acceptedCount === 1 ? '' : 's'} imported
            {result.rejectedCount > 0 ? `, ${result.rejectedCount} row${result.rejectedCount === 1 ? '' : 's'} rejected` : ''}.
          </span>
        </p>
      ) : null}

      {result && result.rejected.length > 0 ? (
        <div style={{ marginBottom: 'var(--sp-12)', overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Row</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.rejected.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? 'Importing…' : 'Import'}
      </button>
    </form>
  );
}
