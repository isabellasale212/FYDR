'use client';

import { useId, useState } from 'react';
import type { ExportDomain, ExportDomainKey } from '@/lib/exportDomains';

type Props = {
  domains: readonly ExportDomain[];
  groupIds: readonly string[];
  groupLabel: string;
  athleteCount: number;
  defaultFrom: string;
  defaultTo: string;
  today: string;
};

type GenerateResponse = {
  ok: boolean;
  error: string | null;
  files: { filename: string; content: string }[];
  athleteCount: number;
  groupLabel: string;
};

function addDaysLocal(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const QUICK_RANGES: readonly { label: string; days: number }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

/** screens/exports.md job 1's "New export" panel — see generate/route.ts's
 *  own header for the full scope reasoning (synchronous, real, CSV-only,
 *  job 3 deferred). This component only ever builds a request and triggers
 *  real browser downloads from a real response; it holds no query logic and
 *  no role check of its own — those live server-side, where they actually
 *  count (CLAUDE.md §2 rule 2).
 *
 *  Multiple files, not a zip (no new dependency, matching lib/csv.ts's own
 *  CSV-only header): the response is JSON with one {filename, content} pair
 *  per selected domain, and this component turns each into a Blob and
 *  clicks a synthetic download link for it, staggered slightly so a browser
 *  doesn't collapse a burst of simultaneous downloads into one silently
 *  dropped file. Chrome (and others) may still show a one-time "this site is
 *  downloading multiple files" prompt for more than one or two files — a
 *  real, known trade-off of this approach versus a zip, and the honest one
 *  given no new dependency is in scope for this pass. */
export function ExportBuilderForm({ domains, groupIds, groupLabel, athleteCount, defaultFrom, defaultTo, today }: Props) {
  const legendId = useId();
  const warningId = useId();
  const [selected, setSelected] = useState<Set<ExportDomainKey>>(() => new Set(domains.map((d) => d.key)));
  const [fromVal, setFromVal] = useState(defaultFrom);
  const [toVal, setToVal] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function toggle(key: ExportDomainKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyQuickRange(days: number) {
    setFromVal(addDaysLocal(today, -(days - 1)));
    setToVal(today);
  }

  async function onGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (selected.size === 0) {
      setError('Choose what to include.');
      return;
    }
    if (!fromVal || !toVal) {
      setError('Choose a valid date range.');
      return;
    }
    if (fromVal > toVal) {
      setError('The end date must be after the start date.');
      return;
    }

    setBusy(true);
    const resp = await fetch('/settings/exports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: [...selected], groupIds, from: fromVal, to: toVal }),
    });
    const body: GenerateResponse | null = await resp.json().catch(() => null);
    setBusy(false);

    if (!resp.ok || !body?.ok) {
      setError(body?.error ?? 'Could not generate the export.');
      return;
    }

    for (const file of body.files) {
      const blob = new Blob([file.content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Deliberate stagger between downloads — see this file's header.
      await new Promise((resolve) => setTimeout(resolve, 250));
      URL.revokeObjectURL(url);
    }

    setSuccessMsg(
      `${body.files.length} file${body.files.length === 1 ? '' : 's'} downloaded — ${body.athleteCount} athlete${body.athleteCount === 1 ? '' : 's'}, ${body.groupLabel}, ${fromVal} to ${toVal}.`,
    );
  }

  return (
    <form onSubmit={onGenerate} className="card" aria-labelledby={legendId}>
      <h2 className="card-title" id={legendId}>
        New export
      </h2>
      <p className="sub" style={{ margin: '2px 0 14px' }}>
        {groupLabel} · {athleteCount} athlete{athleteCount === 1 ? '' : 's'} in scope
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {successMsg ? (
        <div className="banner" role="status" style={{ marginBottom: 14 }}>
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>{successMsg}</span>
        </div>
      ) : null}

      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
        <legend className="label" style={{ fontSize: 13, marginBottom: 8 }}>
          What to include
        </legend>
        <div style={{ display: 'grid', gap: 4 }}>
          {domains.map((d) => (
            <label
              key={d.key}
              className="todo"
              style={{ gridTemplateColumns: '22px minmax(0, 1fr)', borderTop: '1px solid var(--hair)', cursor: 'pointer' }}
            >
              <input type="checkbox" checked={selected.has(d.key)} onChange={() => toggle(d.key)} />
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{d.label}</span>
                <span className="tiny">{d.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
        <legend className="label" style={{ fontSize: 13, marginBottom: 8 }}>
          When
        </legend>
        <div className="chiprow" style={{ marginBottom: 10 }}>
          {QUICK_RANGES.map((r) => (
            <button key={r.days} type="button" className="squad-chip" onClick={() => applyQuickRange(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 0 }}>
          <div>
            <label className="label" htmlFor="export-from">
              From
            </label>
            <input id="export-from" type="date" className="field" value={fromVal} max={toVal || undefined} onChange={(e) => setFromVal(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="export-to">
              To
            </label>
            <input id="export-to" type="date" className="field" value={toVal} min={fromVal || undefined} max={today} onChange={(e) => setToVal(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="banner" id={warningId} style={{ marginBottom: 14 }}>
        <span className="g g-warn" aria-hidden="true">
          ⚠
        </span>
        <span>
          This export contains personal data about {athleteCount} athlete{athleteCount === 1 ? '' : 's'}. It will be
          recorded in the audit log against your name.
        </span>
      </div>

      <button type="submit" className="btn-primary" disabled={busy} aria-describedby={warningId}>
        {busy ? 'Generating…' : 'Generate'}
      </button>
      <p className="cap" style={{ marginTop: 10 }}>
        Format: CSV, one file per domain selected above — see lib/csv.ts&rsquo;s own header for why this build&rsquo;s
        exports are CSV only. Generated immediately, not queued: nothing is saved on the server, and there is no
        export history to come back to (a real, stated cut — see docs/screens/exports.md).
      </p>
    </form>
  );
}
