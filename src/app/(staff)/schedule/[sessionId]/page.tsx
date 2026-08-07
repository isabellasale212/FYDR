import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SessionEditForm } from '@/components/SessionEditForm/SessionEditForm';
import { SessionActions } from '@/components/SessionActions/SessionActions';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSessionDetail } from '@/lib/queries/schedule';
import { enumLabel, formatLongDate, formatTime, mdLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Session · Fydr' };

/** screens/session-detail.md, screen 16, simplified — see the query file
 *  header in `lib/queries/schedule.ts` for the exact cuts. Route per
 *  `20-route-map.md` line 112, `/schedule/:sessionId`, which wins over the
 *  screen doc's own `/schedule/session/{id}` header per CLAUDE.md's
 *  route-map-wins-on-naming rule. */
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { db, orgId, timezone } = await requireStaff();

  const session = await fetchSessionDetail(db, orgId, sessionId);
  if (!session) notFound();

  const groups = await fetchGroups(db, orgId);
  const md = mdLabel(session.md_offset);
  const cancelled = session.status === 'cancelled';

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule">Schedule</Link> · {enumLabel(session.session_type)}
          </p>
          <h1>{session.title}</h1>
        </div>
        <ThemeToggle />
      </div>

      {cancelled ? (
        <div className="note" style={{ marginBottom: 14 }}>
          <div className="note-glyph">!</div>
          <p className="note-text">
            <b>This session was cancelled.</b> Attendance and any entries already
            submitted are kept, not erased. Reinstate it below to bring it back
            onto the schedule.
          </p>
        </div>
      ) : null}

      <div className="card" style={{ opacity: cancelled ? 0.7 : 1 }}>
        <p className="label">When and where</p>
        <p style={{ marginTop: 6 }}>
          {formatLongDate(session.starts_at.slice(0, 10))} &middot; {formatTime(session.starts_at)}
          {session.duration_min !== null ? ` for ${session.duration_min} min` : ''}
        </p>
        <p className="tiny" style={{ marginTop: 4 }}>
          {session.location ?? 'Location not set'}
          {md ? ` · ${md}` : ''}
        </p>
        {session.groupIds.length > 0 ? (
          <div className="chiprow" style={{ marginTop: 10 }}>
            {groups
              .filter((g) => session.groupIds.includes(g.id))
              .map((g) => (
                <span key={g.id} className="chip-static">
                  {g.name}
                </span>
              ))}
          </div>
        ) : (
          <p className="tiny" style={{ marginTop: 10 }}>
            No group named. This session is for the whole squad.
          </p>
        )}
        {session.fixture_id ? (
          <p style={{ marginTop: 10 }}>
            <Link href={`/schedule/fixtures/${session.fixture_id}`}>
              View the fixture this session is anchored to →
            </Link>
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <SessionActions orgId={orgId} session={session} />
      </div>

      {!cancelled ? (
        <div style={{ marginTop: 14 }}>
          <p className="sect" style={{ marginBottom: 8 }}>
            Edit this session
          </p>
          <SessionEditForm
            orgId={orgId}
            session={session}
            groups={groups}
            timezone={timezone}
          />
        </div>
      ) : null}
    </>
  );
}
