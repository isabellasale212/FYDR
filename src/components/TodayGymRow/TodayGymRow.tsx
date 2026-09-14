'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OUTBOX_CHANGED_EVENT } from '@/lib/outbox';
import { queuedGymSets } from '@/lib/gymOutboxFlush';

/* PATTERN-S6 C2 (batch B8): Today's row for a gym session under way —
 * "Lower A · 6 of 12 sets · 2 waiting to send". The name and the two counts
 * come from the server (lib/queries/programmes.ts fetchMyOpenGymSessionToday);
 * "waiting to send" is this phone's outbox, which the server cannot see, so it
 * is read in an effect after mount — the server render and the first client
 * render agree (no count), then the real one lands — and kept current on the
 * outbox's own change event, the way the logger's progress row does it. A
 * Client Component for that one reason; everything else is the plain row. */
type Props = {
  programmeSessionId: string;
  sessionLogId: string;
  name: string;
  logged: number;
  total: number;
};

export function TodayGymRow({ programmeSessionId, sessionLogId, name, logged, total }: Props) {
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    const read = () => setWaiting(queuedGymSets(sessionLogId));
    read();
    window.addEventListener(OUTBOX_CHANGED_EVENT, read);
    window.addEventListener('online', read);
    return () => {
      window.removeEventListener(OUTBOX_CHANGED_EVENT, read);
      window.removeEventListener('online', read);
    };
  }, [sessionLogId]);

  return (
    <Link href={`/gym/${programmeSessionId}`} className="card td-row" data-today-gym-row>
      <span style={{ minWidth: 0 }}>
        <span className="td-name" style={{ fontSize: 'var(--t-body-lg)' }}>{name}</span>
        <span className="td-sub num">
          {logged} of {total} sets
          {waiting > 0 ? ` · ${waiting} waiting to send` : ''}
        </span>
      </span>
      <span className="chev td-chev" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
