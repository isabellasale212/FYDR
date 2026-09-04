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

// Built per call, from the org's real timezone (organisations.timezone),
// not a hardcoded one — these used to construct once at module load with
// a literal 'Europe/London', so a non-UK org's week header, fixture day
// label and matchday line all rendered in UK local time regardless of the
// org's own configured zone. Uncached, matching format.ts's own
// formatDate/formatTime etc., which construct fresh per call rather than
// memoise by timezone.
function rangeFmt(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: timezone });
}
function rangeMonthFmt(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: timezone });
}
function weekdayLongFmt(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: timezone });
}
function dayMonthFmt(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: timezone });
}

function weekRangeLabel(weekStart: string, weekEnd: string, timezone: string): string {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${weekEnd}T12:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return sameMonth
    ? `${rangeFmt(timezone).format(start)} – ${rangeMonthFmt(timezone).format(end)}`
    : `${rangeMonthFmt(timezone).format(start)} – ${rangeMonthFmt(timezone).format(end)}`;
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
    ? (() => {
        // The fixture's real local calendar day/date, not the UTC one —
        // kickoff_at is a stored UTC instant, and a kickoff between
        // 23:00-00:00 UTC (00:00-01:00 local in BST) is the NEXT local
        // day. getUTCDate() read the UTC day-of-month directly; both
        // fields now go through the org's real timezone, like every
        // other formatter here.
        const kickoff = new Date(weekFixtures[0]!.kickoff_at);
        return `MD ${weekdayLongFmt(timezone).format(kickoff).toUpperCase()} ${rangeFmt(timezone).format(kickoff)} · ${weekFixtures[0]!.home_away === 'away' ? 'AT' : 'V'} ${weekFixtures[0]!.opponent.toUpperCase()}`;
      })()
    : null;
  const eyebrow = [
    `WEEK OF ${weekdayLongFmt(timezone).format(new Date(`${weekStart}T12:00:00Z`)).toUpperCase()} ${dayMonthFmt(timezone).format(
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
      <ScheduleWorkspace
        orgId={orgId}
        userId={claims.userId}
        timezone={timezone}
        weekStart={weekStart}
        days={days}
        today={today}
        weekRangeLabel={weekRangeLabel(weekStart, weekEnd, timezone)}
        eyebrow={eyebrow}
        prevHref={dateQuery(prevWeek)}
        nextHref={dateQuery(nextWeek)}
        timetableHref={timetableHref}
        initialSessions={sessions}
        groups={groups.map((g) => ({ id: g.id, name: g.name, group_type: g.group_type, memberCount: g.member_count }))}
        groupIds={groupIds}
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
