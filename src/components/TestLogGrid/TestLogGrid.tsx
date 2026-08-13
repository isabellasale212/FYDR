'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logAttempt, type AthleteForLogging } from '@/lib/queries/testing';
import type { SideMode } from '@/lib/types/database';

type Props = {
  orgId: string;
  userId: string;
  testDefinitionId: string;
  testDate: string;
  defaultAttempts: number;
  sideMode: SideMode;
  decimalPlaces: number;
  unit: string;
  athletes: readonly AthleteForLogging[];
};

const SIDES = ['left', 'right'] as const;

type CellStatus = 'dirty' | 'saving' | 'saved' | 'error';

/** The hall-session logging grid. The one rule that matters here, learned
 *  from a real audit finding (a coach's value typed then Tabbed away saved
 *  nothing, silently): every path out of a cell — Enter, Tab, click away —
 *  funnels through the same commit function, every cell shows its own
 *  saved/saving/failed state, and leaving the page with anything uncommitted
 *  gets a browser warning. A 15-athlete session's data must never depend on
 *  which key the coach happened to press. */
export function TestLogGrid({ orgId, userId, testDefinitionId, testDate, defaultAttempts, sideMode, decimalPlaces, unit, athletes }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, CellStatus>>({});
  const statusRef = useRef(status);
  statusRef.current = status;

  // Anything typed but not yet confirmed saved blocks navigation with the
  // browser's own leave-page warning.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const pending = Object.values(statusRef.current).some(
        (s) => s === 'dirty' || s === 'saving' || s === 'error',
      );
      if (pending) event.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  async function commitCell(
    key: string,
    athleteId: string,
    slot: { attempt: number; side: 'left' | 'right' | null },
    rawValue: string,
    existingValue: number | null,
  ) {
    const num = Number(rawValue);
    if (rawValue.trim() === '' || Number.isNaN(num)) return;
    if (existingValue !== null && existingValue === num) {
      setStatus((s) => ({ ...s, [key]: 'saved' }));
      return;
    }

    setStatus((s) => ({ ...s, [key]: 'saving' }));
    const result = await logAttempt(createClient(), orgId, userId, {
      athleteId,
      testDefinitionId,
      testDate,
      attemptNumber: slot.attempt,
      value: num,
      side: slot.side,
    });

    if (result.error) {
      setStatus((s) => ({ ...s, [key]: 'error' }));
      setError(`Could not save that result — ${result.error}. The value is still in the box; press Enter to retry.`);
      return;
    }
    setStatus((s) => ({ ...s, [key]: 'saved' }));
    setError(null);
    router.refresh();
  }

  function attemptSlots(): Array<{ attempt: number; side: 'left' | 'right' | null }> {
    if (sideMode === 'bilateral') {
      return Array.from({ length: defaultAttempts }, (_, i) => ({ attempt: i + 1, side: null }));
    }
    const slots: Array<{ attempt: number; side: 'left' | 'right' | null }> = [];
    for (let i = 1; i <= defaultAttempts; i += 1) {
      for (const side of SIDES) slots.push({ attempt: i, side });
    }
    return slots;
  }

  const slots = attemptSlots();
  const STATUS_GLYPH: Record<CellStatus, { text: string; color: string }> = {
    dirty: { text: 'unsaved', color: 'var(--warn-text)' },
    saving: { text: 'saving…', color: 'var(--faint)' },
    saved: { text: 'saved ✓', color: 'var(--good-text)' },
    error: { text: 'failed — retry', color: 'var(--bad-text)' },
  };

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="card flush">
        {athletes.map((a, index) => (
          <div key={a.athlete_id}>
            {index > 0 ? <div className="hair" /> : null}
            <div style={{ padding: '10px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <Link href={`/testing/${testDefinitionId}/${a.athlete_id}`} className="nm">
                  {a.first_name} {a.last_name}
                </Link>
                {a.pbValue !== null ? (
                  <span className="pill pill-good" title="Personal best">
                    PB {a.pbValue.toFixed(decimalPlaces)}
                    {unit}
                  </span>
                ) : (
                  <span className="tiny" style={{ color: 'var(--faint)' }}>
                    no PB yet
                  </span>
                )}
              </div>
              <p className="tiny" style={{ color: 'var(--muted)', marginBottom: 4 }}>
                Attempts{unit ? ` (${unit})` : ''}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {slots.map((slot) => {
                  const key = `${a.athlete_id}:${slot.attempt}:${slot.side ?? 'b'}`;
                  const existing = a.attempts.find((x) => x.attempt_number === slot.attempt && (x.side ?? null) === slot.side);
                  const draft = drafts[key] ?? (existing ? String(existing.value) : '');
                  const cellStatus = status[key];
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="tiny" style={{ textAlign: 'center' }}>
                        {slot.side ? `${slot.side.charAt(0).toUpperCase()}${slot.attempt}` : slot.attempt}
                      </span>
                      <input
                        className="field mono"
                        style={{
                          width: 64,
                          padding: '6px 4px',
                          textAlign: 'center',
                          borderColor:
                            cellStatus === 'error'
                              ? 'var(--bad)'
                              : cellStatus === 'dirty'
                                ? 'var(--warn)'
                                : existing?.is_best
                                  ? 'var(--good)'
                                  : undefined,
                        }}
                        inputMode="decimal"
                        aria-label={`${a.first_name} ${a.last_name}, attempt ${slot.attempt}${slot.side ? `, ${slot.side}` : ''}${unit ? `, in ${unit}` : ''}`}
                        value={draft}
                        onChange={(e) => {
                          setDrafts((d) => ({ ...d, [key]: e.target.value }));
                          setStatus((s) => ({ ...s, [key]: 'dirty' }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void commitCell(key, a.athlete_id, slot, draft, existing?.value ?? null);
                          }
                        }}
                        onBlur={() => {
                          if (status[key] === 'dirty' || status[key] === 'error') {
                            void commitCell(key, a.athlete_id, slot, draft, existing?.value ?? null);
                          }
                        }}
                      />
                      {cellStatus ? (
                        <span
                          className="tiny mono"
                          role="status"
                          style={{ textAlign: 'center', color: STATUS_GLYPH[cellStatus].color, fontSize: 9.5 }}
                        >
                          {STATUS_GLYPH[cellStatus].text}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="tiny">
        Values save when you press Enter or move to the next box, and each box shows its own
        saved state. Best attempt per athlete, per side, is marked automatically (green
        outline) &mdash; highest or lowest depending on the test&rsquo;s own direction. Tap a
        name for history and to mark a different attempt best by hand.
      </p>
    </div>
  );
}
