import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { TimetableSessionCard } from '@/components/TimetableSessionCard/TimetableSessionCard';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchWeekMdLabels, mondayOf } from '@/lib/queries/schedule';
import { fetchTimetableDay } from '@/lib/queries/timetable';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Timetable · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/timetable.md, screen 11 — see lib/queries/timetable.ts's header
 *  for the full account of what this pass builds against the doc's own
 *  mobile-first, "provisional, awaiting client design photographs" layout,
 *  and why. Coach and medical only, matching the doc's own role table
 *  exactly (admin: no access by default) — session_attendance's RLS grants
 *  insert/update to those two roles alone, so this page's redirect and the
 *  database's actual refusal agree. */
export default async function TimetablePage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
  if (!isCoach && !isMedical) redirect('/dashboard');
  const actorRole: 'coach' | 'medical' = isMedical ? 'medical' : 'coach';

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const today = todayIso(timezone);
  const date = typeof params.date === 'string' ? params.date : today;
  const dayHref = (d: string) =>
    groupIds.length > 0 ? `/timetable?date=${d}&groups=${groupIds.join(',')}` : `/timetable?date=${d}`;

  const [groups, sessions, weekMd] = await Promise.all([
    fetchGroups(db, orgId),
    fetchTimetableDay(db, orgId, date, groupIds),
    fetchWeekMdLabels(db, orgId, mondayOf(date)),
  ]);
  // Every session on this page shares `date` (fetchTimetableDay is bounded
  // to one calendar day), so one anchored lookup applies to all of them —
  // the same primitive the Schedule grid uses, so a session doesn't show a
  // different MD-n here than one tab-click away on /schedule.
  const anchoredMdOffset = weekMd.get(date) ?? null;

  const now = Date.now();

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">{groupScopeLabel(groups, groupIds)} · {orgName}</p>
          <h1>Timetable</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ThemeToggle />
        </div>
      </div>

      {/* Mirrors the toggle on /schedule — one sidebar entry, two real
       * routes (this page's write surface, attendance capture, has no
       * equivalent on the week-plan page). */}
      <div className="chiprow" style={{ margin: '10px 0 14px' }}>
        <Link href="/schedule" className="squad-chip">
          Week plan
        </Link>
        <span className="squad-chip" aria-current="page">
          Today
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Link href={dayHref(addDays(date, -1))} className="btn-ghost" aria-label="Previous day">
          ‹ Previous
        </Link>
        <span className="nm mono">
          {formatDate(date)} · {sessions.length} session{sessions.length === 1 ? '' : 's'}
        </span>
        <Link href={dayHref(addDays(date, 1))} className="btn-ghost" aria-label="Next day">
          Next ›
        </Link>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions today"
          body="Nothing is scheduled for this date. Open the schedule to plan one."
        />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {sessions.map((session) => {
            const startMs = Date.parse(session.starts_at);
            const endMs = startMs + (session.duration_min ?? 60) * 60_000;
            const isLive = now >= startMs && now <= endMs;
            return (
              <TimetableSessionCard
                key={session.id}
                orgId={orgId}
                userId={claims.userId}
                actorRole={actorRole}
                session={session}
                anchoredMdOffset={anchoredMdOffset}
                defaultExpanded={isLive}
              />
            );
          })}
        </div>
      )}

      <p className="cap">
        Every restricted athlete&rsquo;s restrictions are shown on their own row. Check them
        before marking anyone as full participation.
      </p>
    </>
  );
}
