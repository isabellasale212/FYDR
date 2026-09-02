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

  /* "add a button to add additional attempts if required" — the coach's own
   * words. Extra attempts are per-athlete and per-day, not per-grid: on a
   * real testing day it is one athlete who fluffs a rep and goes again, and
   * widening the whole squad's grid to match would put empty boxes under
   * fourteen other names.
   *
   * Nothing is written to the database when this is pressed, and that is
   * correct rather than a shortcut: test_results.value is NOT NULL (0024),
   * so an "empty attempt 4" is not a row that can exist. The button reveals
   * the next slot; the existing per-cell autosave writes the real row via
   * logAttempt() with the next attempt_number as soon as a value is entered.
   * No trigger work is needed either — mark_best_attempt (0024, rewritten in
   * 0025) recomputes the best across every non-deleted attempt in the
   * (athlete, test, date, side) group, so attempt 4 competes for best on
   * insert exactly as attempts 1-3 did, and attempt_number carries no upper
   * bound or check constraint. */
  /* Stores a TARGET total attempt count per athlete, not a count of extra
   * clicks. That distinction is what keeps this idempotent against the
   * router.refresh() every save triggers: with an increment, saving a value
   * into the new attempt 4 would come back as savedMax=4 PLUS the +1 still
   * held in state and open a stray empty attempt 5 the coach never asked
   * for, again on every subsequent save. As a target it simply loses to
   * savedMax once the row exists. */
  const [requestedAttempts, setRequestedAttempts] = useState<Record<string, number>>({});

  function attemptSlotsFor(a: AthleteForLogging): Array<{ attempt: number; side: 'left' | 'right' | null }> {
    // max(defaultAttempts, highest attempt already saved, coach's request) —
    // not defaultAttempts alone. Including savedMax also fixes a real
    // pre-existing bug: an extra attempt logged today became INVISIBLE on the
    // next page load, because the grid only ever drew default_attempts boxes
    // while the row sat in the table unrendered (and, being unrendered,
    // uneditable and undeletable from this screen). Lowering a test's
    // default_attempts after a session had already been logged did the same.
    const savedMax = a.attempts.reduce((m, x) => Math.max(m, x.attempt_number), 0);
    const count = Math.max(defaultAttempts, savedMax, requestedAttempts[a.athlete_id] ?? 0);

    if (sideMode === 'bilateral') {
      return Array.from({ length: count }, (_, i) => ({ attempt: i + 1, side: null }));
    }
    const slots: Array<{ attempt: number; side: 'left' | 'right' | null }> = [];
    for (let i = 1; i <= count; i += 1) {
      // A per-side test gets both sides of the new attempt. An athlete who
      // needs a re-run of their left grip still has a right-hand box for that
      // attempt number; leaving it blank writes no row.
      for (const side of SIDES) slots.push({ attempt: i, side });
    }
    return slots;
  }
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
        {athletes.map((a, index) => {
          const slots = attemptSlotsFor(a);
          const nextAttemptNumber = slots.length === 0 ? 1 : Math.max(...slots.map((s) => s.attempt)) + 1;
          return (
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
                        className="field num"
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
                          className="tiny num"
                          role="status"
                          style={{ textAlign: 'center', color: STATUS_GLYPH[cellStatus].color, fontSize: 9.5 }}
                        >
                          {STATUS_GLYPH[cellStatus].text}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {/* Sits at the end of this athlete's own row of boxes, where
                  * a coach's eye already is after filling the last one.
                  *
                  * Wrapped in the same label/control column each input cell
                  * uses, with the label hidden rather than omitted, so the
                  * button lines up with the input boxes instead of with
                  * whichever cells happen to be showing a "saved ✓" line
                  * underneath. alignSelf on a bare button could not do this:
                  * the row's height changes as save states appear.
                  *
                  * The accessible name says whose attempt it adds — the
                  * visible "+ Attempt" label repeats once per athlete and
                  * would otherwise be fifteen identically-named buttons. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="tiny" aria-hidden="true" style={{ visibility: 'hidden' }}>
                    +
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                    aria-label={`Add attempt ${nextAttemptNumber} for ${a.first_name} ${a.last_name}`}
                    onClick={() => setRequestedAttempts((r) => ({ ...r, [a.athlete_id]: nextAttemptNumber }))}
                  >
                    + Attempt
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {/* The coach asked whether inputs autosave "or should there be a button
        * to save and upload a testing session, you decide." Decision: keep
        * per-cell autosave, add no session-level save button. A save button
        * here would be strictly worse than what already exists — it would
        * reintroduce exactly the failure this grid was rebuilt to kill (a
        * hall full of typed values lost to a closed laptop or a dead phone,
        * the original audit finding in this file's header), it would give
        * two competing answers to "is this saved?" next to per-cell state
        * that is already truthful, and there is no upload step for it to
        * gate: logAttempt() writes straight to test_results with no draft or
        * session-staging table behind it, so "upload" would be a button that
        * saved already-saved rows. The honest fix for the underlying worry —
        * "did that land?" — is visible per-cell state plus the leave-page
        * warning, and both are already here. */}
      <p className="tiny">
        Values save on their own when you press Enter or move to the next box &mdash; there is
        no save button, and each box shows its own saved state. Use <strong>+ Attempt</strong> on
        an athlete&rsquo;s row if they need an extra go beyond the {defaultAttempts} this test
        expects. Best attempt per athlete, per side, is marked automatically (green outline)
        &mdash; highest or lowest depending on the test&rsquo;s own direction, and it is
        recalculated when an extra attempt is added. Tap a name for history, personal bests,
        and to mark a different attempt best by hand.
      </p>
    </div>
  );
}
