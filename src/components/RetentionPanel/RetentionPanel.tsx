'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RetentionPreview, RetentionRunResult } from '@/lib/retention/compute';
import { retentionConsequence } from '@/lib/retentionWords';
import { Dialog } from '@/components/Dialog/Dialog';

/** The dry-run gate the spec insists on, enforced in the UI too, not just
 *  the server: Run stays disabled until a Preview has actually completed
 *  in this session, so an admin always sees the real counts before doing
 *  anything real with them.
 *
 *  PATTERN-S8 C9 (2026-09-13): the consequence sits in the same card as the
 *  button — what the run will delete and redact, the athletes those records
 *  belong to and which of them are still on the squad, by name, and what
 *  stays — and Run opens B11's dialog (a purge is irreversible), which
 *  says it again with the one button, "Run retention". Nothing is written
 *  before that button. The preview itself is logged as its own action with
 *  the counts and retains no rows (decision batch A6). */
export function RetentionPanel() {
  const router = useRouter();
  const [preview, setPreview] = useState<RetentionPreview | null>(null);
  const [result, setResult] = useState<RetentionRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
    setBusy(true);
    setError(null);
    const resp = await fetch('/settings/retention/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    setBusy(false);
    setConfirming(false);
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

  const consequence = preview ? retentionConsequence(preview) : null;

  return (
    <section className={`card${consequence?.runnable ? ' ret-armed' : ''}`} aria-labelledby="run-title">
      <h2 className="card-title" id="run-title">
        Preview and run
      </h2>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {!preview && !result ? (
        <>
          <p className="tiny" style={{ marginBottom: 'var(--sp-10)' }}>
            Preview reads the counts and writes nothing but its own audit row. Run is offered only after a preview, and
            says exactly what it will do before it does it.
          </p>
          <button type="button" className="btn-primary" onClick={onPreview} disabled={busy}>
            {busy ? 'Computing…' : 'Preview'}
          </button>
        </>
      ) : null}

      {preview && consequence ? (
        <>
          <table className="tbl tbl-cards">
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
                  <td className="nm" data-label="Category">{c.category}</td>
                  <td className="r num" data-label="Rows affected">{c.count}</td>
                  <td className="sub" data-label="Cutoff">{c.cutoffDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* The consequence, in the same card as the button. */}
          <div className="ret-consequence" role="region" aria-live="polite" aria-label="What running retention now will do">
            <p className="nm">{consequence.lead}</p>
            {consequence.people ? (
              <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
                {consequence.people}
              </p>
            ) : null}
            {consequence.visibility ? (
              <p className="cap" style={{ marginTop: 'var(--sp-6)' }}>
                {consequence.visibility}
              </p>
            ) : null}
          </div>

          <div className="chiprow" style={{ marginTop: 'var(--sp-12)' }}>
            <button type="button" className="btn-ghost" onClick={onPreview} disabled={busy}>
              {busy ? 'Computing…' : 'Refresh preview'}
            </button>
            {consequence.runnable ? (
              <button type="button" className="btn-primary" onClick={() => setConfirming(true)} disabled={busy} aria-haspopup="dialog">
                Run now
              </button>
            ) : (
              <span className="tiny">Nothing to run.</span>
            )}
          </div>

          <Dialog
            open={confirming}
            onClose={() => setConfirming(false)}
            title="Run retention now?"
            tone="bad"
            actions={
              <>
                <button type="button" className="btn-primary" onClick={onRun} disabled={busy}>
                  {busy ? 'Running…' : 'Run retention'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
              </>
            }
          >
            <ul className="dlg-lines">
              <li>{consequence.lead}</li>
              {consequence.people ? <li>{consequence.people}</li> : null}
              <li>The run is written to the audit log with your name and the counts.</li>
            </ul>
          </Dialog>
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
