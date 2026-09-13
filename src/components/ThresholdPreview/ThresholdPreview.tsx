'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { previewThreshold, previewThresholdRule, type ThresholdPreviewInput, type ThresholdPreviewRow } from '@/lib/queries/thresholds';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { previewSummary } from '@/lib/thresholdWords';

/* PATTERN-S8 C6 (2026-09-13): the 28-day preview, on demand. A button that
 * asks migration 0113 which athletes this rule would have flagged over the
 * trailing 28 local days — the engine's own evaluator, cooldown aside — and
 * reads the answer back with its denominator. Writes nothing; the copy says
 * so. On demand rather than on load because each preview walks every
 * athlete × 28 days × the rule's consecutive days through the same per-day
 * function the nightly sweep uses. */
type Props =
  | { kind: 'saved'; thresholdId: string; label?: string }
  | { kind: 'draft'; input: ThresholdPreviewInput | null; label?: string; blockedReason?: string | null };

export function ThresholdPreview(props: Props) {
  const [rows, setRows] = useState<ThresholdPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = props.label ?? 'Preview the last 28 days';

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const db = createClient();
      const result = await withWriteTimeout(props.kind === 'saved' ? previewThreshold(db, props.thresholdId, 28) : previewThresholdRule(db, props.input!, 28));
      setRows(result);
    } catch (err) {
      setError(toUserMessage(err, 'staff'));
    } finally {
      setBusy(false);
    }
  }

  const summary = rows ? previewSummary(rows) : null;
  const notReady = props.kind === 'draft' && (props.input === null || !!props.blockedReason);

  return (
    <div className="thr-preview">
      <div className="chiprow">
        <button type="button" className="btn-ghost" disabled={busy || notReady} onClick={run} aria-describedby={notReady && props.kind === 'draft' && props.blockedReason ? 'thr-preview-why' : undefined}>
          {busy ? 'Reading 28 days…' : rows ? 'Preview again' : label}
        </button>
        {notReady && props.kind === 'draft' && props.blockedReason ? (
          <span className="tiny" id="thr-preview-why">
            {props.blockedReason}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-8)' }}>
          {error}
        </p>
      ) : null}
      {summary ? (
        <div className="card thr-preview-card" role="region" aria-live="polite" aria-label="Preview of the last 28 days">
          <p className="nm">
            {summary.inScope === 0 ? 'Nobody in scope' : `${summary.count} · last ${summary.windowDays} days`}
          </p>
          <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
            {summary.sentence}
          </p>
          {summary.names.length > 0 ? (
            <ul className="thr-preview-names">
              {summary.names.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
            {summary.caveat}
          </p>
        </div>
      ) : rows && !summary ? (
        <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
          Previewing thresholds belongs to the coach and the sport scientist.
        </p>
      ) : null}
    </div>
  );
}
