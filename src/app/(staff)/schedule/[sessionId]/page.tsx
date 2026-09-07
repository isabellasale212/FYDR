import { notFound } from 'next/navigation';
import { fetchEstablishedTitles } from '@/lib/queries/sessionTitles';
import Link from 'next/link';
import { SessionEditForm } from '@/components/SessionEditForm/SessionEditForm';
import { SessionActions } from '@/components/SessionActions/SessionActions';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSessionDetail, fetchWeekMdLabels, mondayOf } from '@/lib/queries/schedule';
import { dateInTz, enumLabel, formatLongDate, formatTime, mdLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

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
  const { db, orgId, timezone, claims } = await requireStaff();

  const session = await fetchSessionDetail(db, orgId, sessionId);
  if (!session) notFound();

  // Local calendar date, not the UTC one — same bug class as schedule.ts's
  // own dayBounds()/rangeBounds() (see its header), one level down.
  const sessionDate = dateInTz(new Date(session.starts_at), timezone);
  // MD-n re-anchored to this session's own real calendar week (its stored
  // md_offset can count toward a fixture in a later week — see
  // anchorMdOffsetsToWeek, format.ts). fetchWeekMdLabels is the same
  // primitive the week-level views (ScheduleWorkspace, dashboard, /today's
  // week strip) already use, so this permalink page agrees with them for
  // the identical session instead of showing the raw stored offset.
  const [groups, weekMd] = await Promise.all([
    fetchGroups(db, orgId),
    fetchWeekMdLabels(db, orgId, mondayOf(sessionDate), timezone),
  ]);
  const md = mdLabel(weekMd.get(sessionDate) ?? null);
  const cancelled = session.status === 'cancelled';

  /* The club's own established session names, for the title field's
     datalist. Read here rather than in the client component so it is one
     server-side query on a page that is already fetching groups. */
  const titleSuggestions = await fetchEstablishedTitles(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule">Schedule</Link> · {enumLabel(session.session_type)}
          </p>
          <h1>{session.title}</h1>
        </div>
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
          {/* formatLongDate resolves the real local date from the full
              instant itself via Intl + timeZone — no need to pre-slice
              starts_at down to its UTC date first. */}
          {formatLongDate(session.starts_at, timezone)} &middot; {formatTime(session.starts_at, timezone)}
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
        <SessionActions
          canManage={hasAnyRole(claims.roles, SESSION_EDIT)} orgId={orgId} session={session} />
      </div>

      {!cancelled ? (
        <div style={{ marginTop: 14 }}>
          <p className="sect" style={{ marginBottom: 8 }}>
            Edit this session
          </p>
          <SessionEditForm
        titleSuggestions={titleSuggestions}
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
