import Link from 'next/link';
import type { SessionWithHeadcount } from '@/lib/queries/schedule';
import { BLANK, enumLabel, formatTime, mdLabel } from '@/lib/format';

type Props = { session: SessionWithHeadcount };

/** One row of today's timetable. The location is on every row because half the
 *  squad group chat is somebody asking which pitch. Links through to
 *  session-detail.md's screen, `/schedule/:sessionId`, from both places this
 *  card renders (the Schedule week view and the staff dashboard). */
export function SessionCard({ session }: Props) {
  const md = mdLabel(session.md_offset);
  const cancelled = session.status === 'cancelled';

  return (
    <Link
      href={`/schedule/${session.id}`}
      className="load-row"
      style={{
        gridTemplateColumns: '56px minmax(0,1fr) 78px 88px',
        textDecoration: 'none',
        color: 'inherit',
        opacity: cancelled ? 0.55 : 1,
      }}
    >
      <div className="mono">{formatTime(session.starts_at)}</div>
      <div>
        <span className="nm" style={{ textDecoration: cancelled ? 'line-through' : 'none' }}>
          {session.title}
        </span>{' '}
        <span className="tiny">{enumLabel(session.session_type)}</span>
        {cancelled ? <span className="tiny"> · Cancelled</span> : null}
        <div className="tiny">
          {session.location ?? 'Location not set'}
          {md ? (
            <>
              {' · '}
              <span className="mono">{md}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="load-val mono sub">
        {session.duration_min !== null ? `${session.duration_min} min` : BLANK}
      </div>
      <div className="load-val mono">
        {session.expected !== null ? (
          `${session.expected} named`
        ) : (
          <span className="tiny">{BLANK}</span>
        )}
      </div>
    </Link>
  );
}
