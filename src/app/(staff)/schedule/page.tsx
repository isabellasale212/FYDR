import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { ScheduleWorkspace } from '@/components/ScheduleGrid/ScheduleWorkspace';
import { fetchGroupsWithCounts } from '@/lib/queries/groups';
import {
  fetchGroupMembership,
  fetchNormalWeek,
  fetchWeekFixtures,
  fetchWeekSessionsDetailed,
  mondayOf,
} from '@/lib/queries/schedule';
import { fetchTemplates } from '@/lib/queries/weekTemplates';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, decimalHourInTz, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Schedule · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/London' });
const RANGE_MONTH_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
const WEEKDAY_LONG_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Europe/London' });
const DAY_MONTH_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/London' });

function weekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${weekEnd}T12:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return sameMonth
    ? `${RANGE_FMT.format(start)} – ${RANGE_MONTH_FMT.format(end)}`
    : `${RANGE_MONTH_FMT.format(start)} – ${RANGE_MONTH_FMT.format(end)}`;
}

/** SCHEDULE-SPEC.md, the grid rebuild of the week-plan half of what
 *  2708234 consolidated under one "Schedule" sidebar row — Timetable (real
 *  attendance capture, docs/02-information-architecture.md §4.1) stays a
 *  separate route and file, untouched. See ScheduleWorkspace.tsx's own
 *  header for the editing model, and scheduleGeometry.ts's for the block
 *  placement algorithm and the real athlete-ID clash detection that
 *  replaces the spec's literal 'Staff'/'Academy' name exception. */
export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireStaff();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const today = todayIso(timezone);
  const requestedDate = typeof params.date === 'string' ? params.date : today;
  const weekStart = mondayOf(requestedDate);
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const groups = await fetchGroupsWithCounts(db, orgId);

  const [sessions, groupMembership, templates, typical, weekFixtures] = await Promise.all([
    fetchWeekSessionsDetailed(db, orgId, weekStart, groupIds, groups, timezone),
    fetchGroupMembership(db, orgId),
    fetchTemplates(db, orgId, timezone),
    fetchNormalWeek(db, orgId, groups, weekStart, groupIds, timezone),
    fetchWeekFixtures(db, orgId, weekStart, timezone),
  ]);

  const groupQuery = groupIds.length > 0 ? `&groups=${groupIds.join(',')}` : '';
  const dateQuery = (d: string) => `/schedule?date=${d}${groupQuery}`;
  const timetableHref = groupIds.length > 0 ? `/timetable?groups=${groupIds.join(',')}` : '/timetable';

  const matchDayLabel = weekFixtures[0]
    ? `MD ${WEEKDAY_LONG_FMT.format(new Date(weekFixtures[0].kickoff_at)).toUpperCase()} ${new Date(
        weekFixtures[0].kickoff_at,
      ).getUTCDate()} · ${weekFixtures[0].home_away === 'away' ? 'AT' : 'V'} ${weekFixtures[0].opponent.toUpperCase()}`
    : null;
  const eyebrow = [
    `WEEK OF ${WEEKDAY_LONG_FMT.format(new Date(`${weekStart}T12:00:00Z`)).toUpperCase()} ${DAY_MONTH_FMT.format(
      new Date(`${weekStart}T12:00:00Z`),
    ).toUpperCase()}`,
    matchDayLabel,
    // The active scope by name — audit S4: the filter re-scopes this whole
    // week view, so the header has to say so.
    groupScopeLabel(groups, groupIds).toUpperCase(),
  ]
    .filter(Boolean)
    .join(' · ');

  const nowDecimalHourToday = days.includes(today) ? decimalHourInTz(new Date(), timezone) : null;

  return (
    <>
      <div className="sg-filterbar">
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <ScheduleWorkspace
        orgId={orgId}
        userId={claims.userId}
        timezone={timezone}
        weekStart={weekStart}
        days={days}
        today={today}
        weekRangeLabel={weekRangeLabel(weekStart, weekEnd)}
        eyebrow={eyebrow}
        prevHref={dateQuery(prevWeek)}
        nextHref={dateQuery(nextWeek)}
        timetableHref={timetableHref}
        initialSessions={sessions}
        groups={groups.map((g) => ({ id: g.id, name: g.name, group_type: g.group_type, memberCount: g.member_count }))}
        groupMembership={groupMembership}
        templates={templates.filter((t) => !t.archived).map((t) => ({ id: t.id, name: t.name }))}
        applyTemplateHrefBase={`/schedule/planner/apply?week=${weekStart}`}
        saveTemplateHref="/schedule/planner/new"
        typical={typical}
        nowDecimalHourToday={nowDecimalHourToday}
      />
    </>
  );
}
