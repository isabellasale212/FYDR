'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { markBestManual, type HistoryRow } from '@/lib/queries/testing';
import { humanizeDbError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { BodySide } from '@/lib/types/database';
import { formatDate } from '@/lib/format';

type Props = {
  orgId: string;
  testDefinitionId: string;
  athleteId: string;
  rows: readonly HistoryRow[];
  unit: string;
  decimalPlaces: number;
};

export function TestHistoryList({ orgId, testDefinitionId, athleteId, rows, unit, decimalPlaces }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [conditions, setConditions] = useState('');

  const mutation = useMutation({
    mutationFn: (input: { resultId: string; testDate: string; side: BodySide | null }) =>
      withWriteTimeout(
        markBestManual(createClient(), orgId, {
          resultId: input.resultId,
          athleteId,
          testDefinitionId,
          testDate: input.testDate,
          side: input.side,
          conditions,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      setMarkingId(null);
      setConditions('');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const byDate = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const list = byDate.get(r.test_date) ?? [];
    list.push(r);
    byDate.set(r.test_date, list);
  }

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {[...byDate.entries()].map(([date, dayRows]) => (
        <div key={date} className="card">
          <p className="label">{formatDate(date)}</p>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            {dayRows.map((r) => (
              <div key={r.id}>
                <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                  <span className="tiny">
                    {r.side ? `${r.side} ` : ''}Attempt {r.attempt_number}
                  </span>
                  <span className="mono">
                    {r.value.toFixed(decimalPlaces)}
                    {unit}
                  </span>
                  {r.is_best ? (
                    <span className={`pill ${r.is_best_manual ? 'pill-warn' : 'pill-good'}`}>
                      {r.is_best_manual ? 'Best (manual)' : 'Best'}
                    </span>
                  ) : (
                    <button type="button" className="btn-ghost" onClick={() => setMarkingId(r.id)}>
                      Mark best
                    </button>
                  )}
                </div>
                {r.conditions ? <p className="tiny">{r.conditions}</p> : null}
                {markingId === r.id ? (
                  <div className="card" style={{ marginTop: 8, borderColor: 'var(--warn)' }}>
                    <p className="tiny">Why is this the best attempt, not the highest/lowest value?</p>
                    <input
                      className="field"
                      style={{ marginTop: 6 }}
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder="Other attempt wind-assisted, technique fault, etc."
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!conditions.trim() || mutation.isPending}
                        onClick={() => mutation.mutate({ resultId: r.id, testDate: r.test_date, side: r.side })}
                      >
                        {mutation.isPending ? 'Saving…' : 'Mark as best'}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setMarkingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
