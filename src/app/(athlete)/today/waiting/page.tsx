import Link from 'next/link';
import { WaitingQueue } from '@/components/WaitingQueue/WaitingQueue';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Waiting to send · Fydr' };

/** PATTERN-S6 C1 (2026-09-13): the "Waiting to send" queue — what this phone
 *  is holding until it has signal. Reached only from the count on Today
 *  ("See what is waiting"); the queues live in the browser, so the page is a
 *  shell and the client component reads them. Oldest first; no Send now, no
 *  per-item retry: the send is not the athlete's job. Spec:
 *  docs/athlete/screens/19-waiting-to-send.md. */
export default async function WaitingToSendPage() {
  const { timezone } = await requireAthlete();
  return (
    <>
      <div className="hd">
        <h1 className="d">Waiting to send</h1>
      </div>
      <p className="tiny">
        <Link href="/today">← Today</Link>
      </p>
      <WaitingQueue timezone={timezone} />
    </>
  );
}
