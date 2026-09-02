'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RetentionPreview, RetentionRunResult } from '@/lib/retention/compute';

/** The dry-run gate the spec insists on, enforced in the UI too, not just
 *  the server: Run stays disabled until a Preview has actually completed
 *  in this session, so an admin always sees the real counts before doing
 *  anything real with them. */
export function RetentionPanel() {
  const router = useRouter();
  const [preview, setPreview] = useState<RetentionPreview | null>(null);
  const [result, setResult] = useState<RetentionRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPreview() {
    setBusy(true);
    setError(null);
    setResult(null);
    const resp = await fetch('/settings/retention/preview', { method: 'POST' });
    setBusy(false);
    if (!resp.ok) {
      setError('Could not compute a preview.');
      return;
    }
    const body = await resp.json();
    setPreview(body.preview);
  }

  async function onRun() {
    if (!preview) return;
    const automatedTotal = preview.categories.filter((c) => c.automated).reduce((n, c) => n + c.count, 0);
    if (automatedTotal === 0) {
      setError('Nothing eligible to run — the preview above already shows zero for every automated category.');
      return;
    }
    setBusy(true);
    setError(null);
    const resp = await fetch('/settings/retention/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    setBusy(false);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      setError(body.error ?? 'The run failed.');
      return;
    }
    const body = await resp.json();
    setResult(body.result);
    setPreview(null);
    router.refresh();
  }

  return (
    <section className="card" aria-labelledby="run-title">
      <h2 className="card-title" id="run-title">
        Preview and run
      </h2>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {!preview && !result ? (
        <button type="button" className="btn-primary" onClick={onPreview} disabled={busy}>
          {busy ? 'Computing…' : 'Preview'}
        </button>
      ) : null}

      {preview ? (
        <>
          <table className="tbl">
            <caption className="visually-hidden">Retention preview counts</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="r">
                  Rows affected
                </th>
                <th scope="col">Cutoff</th>
              </tr>
            </thead>
            <tbody>
              {preview.categories.map((c) => (
                <tr key={c.category}>
                  <td className="nm">{c.category}</td>
                  <td className="r num">{c.count}</td>
                  <td className="sub">{c.cutoffDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="chiprow" style={{ marginTop: 12 }}>
            <button type="button" className="btn-ghost" onClick={onPreview} disabled={busy}>
              {busy ? 'Computing…' : 'Refresh preview'}
            </button>
            <button type="button" className="btn-primary" onClick={onRun} disabled={busy}>
              {busy ? 'Running…' : 'Run now'}
            </button>
          </div>
          <p className="cap" style={{ marginTop: 8 }}>
            Only the automated categories above will actually change anything. Everything else is shown for
            visibility only.
          </p>
        </>
      ) : null}

      {result ? (
        <div className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            {result.importBatchesDeleted} import file{result.importBatchesDeleted === 1 ? '' : 's'} deleted,{' '}
            {result.injuriesRedacted} closed injury record{result.injuriesRedacted === 1 ? '' : 's'} redacted.
          </span>
        </div>
      ) : null}
    </section>
  );
}
