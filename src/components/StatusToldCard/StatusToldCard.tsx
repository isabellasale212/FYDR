import Link from 'next/link';
import { availabilityStatus } from '@/lib/status';
import { formatDateTime } from '@/lib/format';
import type { AvailabilityStatus } from '@/lib/types/database';

/** PATTERN-S3 C1: the athlete is told once. When a staff member sets the
 *  athlete's status, an emphasised card above To do carries the status word,
 *  who set it, when, and one action; it stays on every visit until the
 *  status screen has been opened once (availability.athlete_seen_at, 0122),
 *  then never returns for that row. No timer. A return to available after
 *  an injury is a change too — the cleared state — and is told the same way. */
export function StatusToldCard({ status, setBy, setAt, timezone }: { status: AvailabilityStatus; setBy: { name: string; role: string | null } | null; setAt: string; timezone: string }) {
  const word = availabilityStatus(status).label;
  return (
    <section className="card" aria-labelledby="told-title" data-emphasis data-status-told={status}>
      <p className="eyebrow">Your status changed</p>
      <h2 className="card-title" id="told-title">
        {word}
      </h2>
      <p className="import-sub num">
        Set by {setBy ? `${setBy.name}${setBy.role ? `, ${setBy.role}` : ''}` : 'the club'} · {formatDateTime(setAt, timezone)}
      </p>
      <Link href="/me/status" className="btn-primary btn-commit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
        See what it means
      </Link>
    </section>
  );
}
