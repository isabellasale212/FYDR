'use client';

import { Fragment, useEffect, useState } from 'react';
import { lastSent, pendingGymSetLogs, pendingNutritionCheckins, pendingTraining, pendingWellness, type LastSent } from '@/lib/outbox';
import { queueHeader, queueRows, waitingEmptyLine, type QueueRow } from '@/lib/outboxQueue';

/** PATTERN-S6 C1 (2026-09-13): the queue, read from this phone's storage.
 *  Re-read when the phone comes back online (OutboxFlusher on Today is what
 *  sends; this screen only reports) and when another tab changes the queue.
 *  Nothing here animates and nothing here retries. The row is the athlete
 *  app's own list row (.hist-row): what, its denominator, the time saved. */
export function WaitingQueue({ timezone }: { timezone: string }) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [last, setLast] = useState<LastSent | null>(null);

  useEffect(() => {
    const refresh = () => {
      const now = new Date().toISOString();
      setRows(queueRows({ wellness: pendingWellness(), training: pendingTraining(), nutrition: pendingNutritionCheckins(), gym: pendingGymSetLogs() }, timezone, now));
      setLast(lastSent());
    };
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [timezone]);

  /* Before the first read there is nothing to say; the read is synchronous
     on mount so this is one frame, never a spinner. */
  if (rows === null) return null;

  if (rows.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing is waiting.</h2>
        <p>{waitingEmptyLine(last, timezone, new Date().toISOString()).replace(/^Nothing is waiting\. /, '')}</p>
      </div>
    );
  }

  return (
    <section className="card flush" aria-labelledby="waiting-title">
      <div className="hist-head">
        <h2 className="card-title" id="waiting-title" style={{ margin: 0 }}>
          Saved on this phone
        </h2>
        <span className="hist-n num">{queueHeader(rows)}</span>
      </div>
      {rows.map((r, i) => (
        <Fragment key={r.key}>
          {i > 0 ? <div className="hair" /> : null}
          <div className="hist-row">
            <div style={{ minWidth: 0 }}>
              <p className="hist-date">{r.what}</p>
              <p className="hist-detail">{r.denominator}</p>
            </div>
            <p className="hist-value num">{r.savedLabel}</p>
          </div>
        </Fragment>
      ))}
      <p className="tiny" style={{ padding: '0 var(--pad-card-x, 18px) var(--sp-12)' }}>
        Oldest first. Each sends by itself when you have signal — there is nothing to press.
      </p>
    </section>
  );
}
