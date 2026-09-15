'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { lastSent, pendingGymSetLogs, pendingNutritionCheckins, pendingTraining, pendingWellness, type LastSent } from '@/lib/outbox';
import { queueHeader, queueRows, waitingEmptyLine, type QueueRow } from '@/lib/outboxQueue';
import { flushOutbox } from '@/lib/outboxFlush';
import { createClient } from '@/lib/supabase/client';

type Props = { orgId: string; athleteId: string; userId: string; timezone: string };

/** PATTERN-S6 C1 (2026-09-13): the queue, read from this phone's storage.
 *  Re-read when the phone comes back online and when another tab changes the
 *  queue. The row is the athlete app's own list row (.hist-row): what, its
 *  denominator, the time saved.
 *
 *  "Send now" — decision batch 14 September 2026, #2: on this screen only,
 *  never per item, and the S6 wording stays everywhere else. "A person with
 *  one bar of signal is better served by a button than by a screen telling
 *  them to relax." It runs exactly what Today runs on load and on `online`
 *  (lib/outboxFlush.ts) over the whole queue; the outcome is said in the
 *  status region under the button — sent and still waiting, or "Still no
 *  signal" — and the list re-reads itself. A flagged conflict is not
 *  "waiting" and is not retried here either. */
export function WaitingQueue({ orgId, athleteId, userId, timezone }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [last, setLast] = useState<LastSent | null>(null);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const refresh = () => {
    const now = new Date().toISOString();
    setRows(queueRows({ wellness: pendingWellness(), training: pendingTraining(), nutrition: pendingNutritionCheckins(), gym: pendingGymSetLogs() }, timezone, now));
    setLast(lastSent());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('storage', refresh);
    };
    // refresh reads storage and the timezone; both are stable for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone]);

  async function sendNow() {
    if (sending) return;
    setSending(true);
    setOutcome(null);
    const before = rows?.reduce((n, r) => n + r.writes, 0) ?? 0;
    try {
      const { sent } = await flushOutbox(createClient(), { orgId, athleteId, userId });
      refresh();
      const left = before - sent;
      if (sent === 0) setOutcome('Still no signal. Everything is still saved here.');
      else if (left <= 0) setOutcome(`Sent ${sent === 1 ? 'one entry' : `${sent} entries`}. Nothing is waiting.`);
      else setOutcome(`Sent ${sent === 1 ? 'one entry' : `${sent} entries`} · ${left === 1 ? 'one' : left} still waiting.`);
      if (sent > 0) router.refresh();
    } finally {
      setSending(false);
    }
  }

  /* Before the first read there is nothing to say; the read is synchronous
     on mount so this is one frame, never a spinner. */
  if (rows === null) return null;

  if (rows.length === 0) {
    return (
      <>
        {outcome ? (
          <p className="tiny" role="status" style={{ marginBottom: 'var(--sp-10)' }}>
            {outcome}
          </p>
        ) : null}
        <div className="empty">
          <h2>Nothing is waiting.</h2>
          <p>{waitingEmptyLine(last, timezone, new Date().toISOString()).replace(/^Nothing is waiting\. /, '')}</p>
        </div>
      </>
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
      <div style={{ padding: '0 var(--pad-card-x, 18px) var(--sp-14)' }}>
        <p className="tiny" style={{ margin: '0 0 var(--sp-10)' }}>
          Oldest first. Each sends by itself when you have signal. If you have a bar now, you can try them all at once.
        </p>
        <button type="button" className="btn-primary" onClick={() => void sendNow()} disabled={sending} data-send-now>
          {sending ? 'Sending…' : 'Send now'}
        </button>
        <p className="tiny" role="status" style={{ margin: 'var(--sp-8) 0 0', minHeight: '1.2em' }}>
          {outcome ?? ''}
        </p>
      </div>
    </section>
  );
}
