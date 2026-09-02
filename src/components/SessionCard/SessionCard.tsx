import Link from 'next/link';
import type { SessionWithHeadcount } from '@/lib/queries/schedule';
import { BLANK, enumLabel, formatTime, mdLabel } from '@/lib/format';

type Props = {
  session: SessionWithHeadcount;
  // IANA zone used to display session.starts_at in the organisation's local time.
  timezone: string;
  // The session's md_offset re-anchored to its own real calendar week (see
  // anchorMdOffsetsToWeek, format.ts) — computed by the page via
  // fetchWeekMdLabels and passed down, rather than read raw off `session`,
  // so this card can't show a different MD-n than the Schedule grid for the
  // same session (audit blocker B2).
  anchoredMdOffset: number | null;
};

/** One row of today's timetable. The location is on every row because half the
 *  squad group chat is somebody asking which pitch. Links through to
 *  session-detail.md's screen, `/schedule/:sessionId`, from both places this
 *  card renders (the Schedule week view and the staff dashboard). */
export function SessionCard({ session, timezone, anchoredMdOffset }: Props) {
  const md = mdLabel(anchoredMdOffset);
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
      <div className="num">{formatTime(session.starts_at, timezone)}</div>
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
              <span className="num">{md}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="load-val num sub">
        {session.duration_min !== null ? `${session.duration_min} min` : BLANK}
      </div>
      <div className="load-val num">
        {session.expected !== null ? (
          `${session.expected} named`
        ) : (
          <span className="tiny">{BLANK}</span>
        )}
      </div>
    </Link>
  );
}
