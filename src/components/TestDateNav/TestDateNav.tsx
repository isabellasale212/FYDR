'use client';

import { useRouter } from 'next/navigation';
import type { TestSessionDate } from '@/lib/queries/testing';
import { addDays, formatDate } from '@/lib/format';

type Props = {
  testDefinitionId: string;
  testDate: string;
  timezone: string;
  groupIds: readonly string[];
  dates: readonly TestSessionDate[];
};

/** Audit finding 36: this grid's only date control was "‹ Previous day /
 *  Next day ›", one calendar day per click — reaching a session from a few
 *  months back took roughly 25 clicks, and there was no way to see which
 *  days actually had a session at all. Three controls now cover the three
 *  real needs: the arrows still nudge a day at a time (useful once you're
 *  near the right week), a native date picker jumps straight to any day
 *  including one with no results yet (to start a new session), and the
 *  dropdown lists only the dates this test actually has results on — the
 *  direct one-click jump to an old session that was missing entirely. */
export function TestDateNav({ testDefinitionId, testDate, timezone, groupIds, dates }: Props) {
  const router = useRouter();

  function hrefFor(date: string): string {
    return groupIds.length > 0
      ? `/testing/${testDefinitionId}?date=${date}&groups=${groupIds.join(',')}`
      : `/testing/${testDefinitionId}?date=${date}`;
  }

  function go(date: string) {
    if (date) router.push(hrefFor(date));
  }

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-10)', flexWrap: 'wrap', marginBottom: 'var(--sp-14)' }}>
      <button type="button" className="btn-ghost" onClick={() => go(addDays(testDate, -1))}>
        ‹ Previous day
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="nm num">{formatDate(testDate, timezone)}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
          <span className="tiny" style={{ color: 'var(--muted)' }}>
            Jump to date
          </span>
          <input
            type="date"
            className="field"
            style={{ padding: '4px 8px' }}
            value={testDate}
            onChange={(e) => go(e.target.value)}
            aria-label="Jump to a specific date"
          />
        </label>
        {dates.length > 0 ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
            <span className="tiny" style={{ color: 'var(--muted)' }}>
              Past sessions
            </span>
            <select
              className="field"
              style={{ padding: '4px 8px' }}
              value={dates.some((d) => d.date === testDate) ? testDate : ''}
              onChange={(e) => go(e.target.value)}
              aria-label="Jump to a past testing session for this test"
            >
              <option value="" disabled>
                {dates.length} logged {dates.length === 1 ? 'session' : 'sessions'}…
              </option>
              {dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {formatDate(d.date, timezone)} · {d.resultCount} {d.resultCount === 1 ? 'result' : 'results'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <button type="button" className="btn-ghost" onClick={() => go(addDays(testDate, 1))}>
        Next day ›
      </button>
    </div>
  );
}
