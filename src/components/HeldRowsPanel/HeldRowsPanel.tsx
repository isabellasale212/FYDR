'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HeldRowRecord, ImportRosterAthlete } from '@/lib/queries/gpsImport';
import type { HeldResolveResult } from '@/app/(staff)/settings/imports/held/route';
import { heldRowLine, heldSummary, matchedLine } from '@/lib/importHeld';

/* PATTERN-S8 C11 (2026-09-13): what the import could not match, named on
 * screen. Each held row shows the vendor's spelling, the date and the
 * distance it carries, an athlete picker and Match — which writes the GPS
 * row and remembers the spelling — or Discard. The status line after a
 * match says both things: the record written and the spelling remembered,
 * so the next file with the same name needs no question. */
type Props = { rows: HeldRowRecord[]; roster: ImportRosterAthlete[] };

export function HeldRowsPanel({ rows, roster }: Props) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function resolve(row: HeldRowRecord, action: 'match' | 'discard') {
    const athleteId = choice[row.id] ?? '';
    if (action === 'match' && !athleteId) {
      setError(`Pick the athlete "${row.player_name}" belongs to.`);
      return;
    }
    setBusy(row.id);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch('/settings/imports/held', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ heldId: row.id, action, athleteId }) });
      const data: HeldResolveResult = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Could not resolve that row.');
        return;
      }
      const athlete = roster.find((a) => a.id === athleteId);
      setStatus(action === 'match' ? matchedLine({ playerName: row.player_name, athleteName: athlete ? `${athlete.first_name} ${athlete.last_name}` : 'the athlete', aliasRemembered: data.aliasRemembered }) : `Row ${row.row_number} ("${row.player_name}") discarded. Nothing was written.`);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0 && !status) return null;

  return (
    <section className="card held-card" aria-labelledby="held-title">
      <h2 className="card-title" id="held-title">
        {heldSummary(rows.length)}
      </h2>
      {rows.length > 0 ? (
        <p className="tiny" style={{ marginBottom: 'var(--sp-10)' }}>
          These rows were valid but their names matched nobody on the roster, or more than one athlete. Nothing was guessed. Match each to
          its athlete and the file&apos;s spelling is remembered, so the next file needs no question; discard a row that is not one of your
          athletes.
        </p>
      ) : null}
      {status ? (
        <p className="banner" role="status" style={{ marginBottom: 'var(--sp-10)' }}>
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>{status}</span>
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert" style={{ marginBottom: 'var(--sp-10)' }}>
          {error}
        </p>
      ) : null}
      <ul className="held-list">
        {rows.map((row) => (
          <li key={row.id} className="held-row">
            <div className="held-who">
              <span className="nm">&ldquo;{row.player_name}&rdquo;</span>
              <span className="tiny held-line">{heldRowLine(row)}</span>
            </div>
            <div className="held-actions">
              <label className="visually-hidden" htmlFor={`held-${row.id}`}>
                Athlete for {row.player_name}
              </label>
              <select id={`held-${row.id}`} className="field held-pick" value={choice[row.id] ?? ''} onChange={(e) => setChoice((c) => ({ ...c, [row.id]: e.target.value }))}>
                <option value="">Pick the athlete</option>
                {roster.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.last_name}, {a.first_name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-primary" disabled={busy === row.id} onClick={() => resolve(row, 'match')}>
                {busy === row.id ? 'Matching…' : 'Match'}
              </button>
              <button type="button" className="btn-ghost" disabled={busy === row.id} onClick={() => resolve(row, 'discard')}>
                Discard
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
