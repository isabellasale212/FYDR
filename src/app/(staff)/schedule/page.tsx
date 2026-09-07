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
import { addDays, dateInTz, decimalHourInTz, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

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
  /* G-33 narrowed scheduling to the sport scientist and the coach, and 0070/0073
     enforce it on sessions, fixtures, week_templates and session_participants
     alike. This screen had no check at all, so a medic, a nutritionist or an S&C
     was shown the Edit toggle and every create control on it. */
  const canEdit = hasAnyRole(claims.roles, SESSION_EDIT);
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

  /* EVERY fixture in the week, not just the earliest.
   *
   * This read weekFixtures[0]. Ashcombe's week already held a Tuesday fixture,
   * so a second one created for the Saturday was written, fetched, sorted
   * second and then never shown anywhere — reported as "creating a fixture does
   * nothing, nothing appears afterward". The row was always there; the screen
   * only ever named one of them, and fixtures do not render on the grid at all.
   *
   * The kickoff is formatted in the org's timezone rather than UTC: kickoff_at
   * is a stored instant, and one between 23:00-00:00 UTC is the NEXT local day.
   * That fix is preserved here per fixture. */
  const matchDayLabel =
    weekFixtures.length === 0
      ? null
      : weekFixtures
          .map((f) => {
            const kickoff = new Date(f.kickoff_at);
            return `MD ${weekdayLongFmt(timezone).format(kickoff).toUpperCase()} ${rangeFmt(timezone).format(kickoff)} · ${f.home_away === 'away' ? 'AT' : 'V'} ${f.opponent.toUpperCase()}`;
          })
          .join(' · ');
  /* The same fixtures again, resolved into the grid's coordinates. Done here,
     beside the eyebrow that formats the same rows, so both readings of
     kickoff_at happen in one place and in the org's timezone: dateInTz for the
     day column, decimalHourInTz for the height. A grid that did this itself
     would be a second chance to get the timezone wrong differently. */
  const gridFixtures = weekFixtures.map((f) => {
    const kickoff = new Date(f.kickoff_at);
    return {
      id: f.id,
      dow: dateInTz(kickoff, timezone),
      start: decimalHourInTz(kickoff, timezone),
      opponent: f.opponent,
      homeAway: f.home_away,
    };
  });

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
        fixtures={gridFixtures}
        orgId={orgId}
        userId={claims.userId}
        canEdit={canEdit}
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
