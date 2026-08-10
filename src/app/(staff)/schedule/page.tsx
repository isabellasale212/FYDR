import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchWeekSessions, mondayOf } from '@/lib/queries/schedule';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, enumLabel, formatDate, formatLongDate, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Schedule · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/schedule.md, screen 15, simplified — see the query file header
 *  for the exact cuts. A Monday-to-Sunday week list, which the doc itself
 *  says is the right shape at phone width and which reads just as clearly
 *  on web at this scope. */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, timezone } = await requireStaff();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const today = todayIso(timezone);
  const requestedDate = typeof params.date === 'string' ? params.date : today;
  const weekStart = mondayOf(requestedDate);
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const [groups, sessions] = await Promise.all([
    fetchGroups(db, orgId),
    fetchWeekSessions(db, orgId, weekStart, groupIds),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = byDay.get(s.entry_date) ?? [];
    list.push(s);
    byDay.set(s.entry_date, list);
  }

  const groupQuery = groupIds.length > 0 ? `&groups=${groupIds.join(',')}` : '';

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Schedule</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href={`/schedule/new?date=${requestedDate}`} className="btn-primary">
            + New session
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* One sidebar entry now covers both the plan (this page, the next
       * three weeks) and the pitch-side day (Timetable's read-and-capture
       * attendance view) — screens/schedule.md and screens/timetable.md
       * still draw the real distinction the sidebar comment used to
       * (schedule.md: "not an analysis screen"; timetable.md: "does not
       * create or edit sessions"), so this is a navigation merge, not a
       * page merge: two routes, two write surfaces, one way in. */}
      <div className="chiprow" style={{ marginBottom: 14 }}>
        <span className="squad-chip" aria-current="page">
          Week plan
        </span>
        <Link href="/timetable" className="squad-chip">
          Today
        </Link>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href={`/schedule?date=${prevWeek}${groupQuery}`} className="btn-ghost" aria-label="Previous week">
          ‹ Previous
        </Link>
        <span className="nm mono">
          {formatDate(weekStart)} to {formatDate(weekEnd)}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href={`/schedule/planner/apply?week=${weekStart}`} className="btn-ghost">
            Apply template
          </Link>
          <Link href={`/schedule?date=${nextWeek}${groupQuery}`} className="btn-ghost" aria-label="Next week">
            Next ›
          </Link>
        </div>
      </div>
      <p className="cap" style={{ marginTop: 8 }}>
        <Link href="/schedule/planner">MD-n planner →</Link> — define a week&apos;s shape once, apply it here.
      </p>

      {sessions.length === 0 ? (
        <EmptyState
          title="Nothing scheduled this week"
          body="No session sits in this week for this filter."
        />
      ) : null}

      <div className="stack">
        {days.map((day) => {
          const dayName = new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            timeZone: 'Europe/London',
          }).format(new Date(`${day}T12:00:00Z`));
          const daySessions = byDay.get(day) ?? [];
          const isToday = day === today;

          return (
            <section className="card flush" key={day} aria-labelledby={`day-${day}`}>
              <h2
                className="sect"
                id={`day-${day}`}
                style={{ padding: '14px 16px 8px' }}
              >
                {dayName.toUpperCase()} · {formatDate(day)}
                {isToday ? <span className="pill pill-accent">Today</span> : null}
              </h2>
              {daySessions.length === 0 ? (
                <p className="cap" style={{ padding: '0 16px 16px' }}>
                  Nothing scheduled.
                </p>
              ) : (
                daySessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))
              )}
            </section>
          );
        })}
      </div>

      <p className="cap">
        {formatLongDate(weekStart)} &ndash; {formatLongDate(weekEnd)}. Session types:{' '}
        {enumLabel('training')}, {enumLabel('gym')}, {enumLabel('match')}, {enumLabel('testing')},{' '}
        {enumLabel('recovery')}, {enumLabel('meeting')}, {enumLabel('rehab')}.
      </p>
    </>
  );
}
