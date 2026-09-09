import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PublishWeekButton } from '@/components/PublishWeekButton/PublishWeekButton';
import { TeamAllocationBoard } from '@/components/TeamAllocationBoard/TeamAllocationBoard';
import { fetchTeams, fetchWeekBoard } from '@/lib/queries/teamAllocation';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { mondayOf } from '@/lib/queries/schedule';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireInjuryAccess } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Team allocation · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/team-allocation.md, screen 14, cut down hard — see
 *  lib/queries/teamAllocation.ts's header for exactly what and why. Route per
 *  20-route-map.md line 100, nested under /injuries because availability drives
 *  the allocation, the same reasoning the spec itself gives for putting this
 *  screen off the injury dashboard rather than its own top-level page. Admin has
 *  no access at all, per the role table — this page redirects them, same
 *  treatment as every other role boundary in this build.
 *
 *  CLAUDE.md §3's group filter, added per screens/team-allocation.md's own line
 *  93: "mandatory, and it applies to the unallocated pool only. Team lanes and
 *  their members always render in full." So only board.unallocated is filtered
 *  here — board.allocations (the team lanes) is passed through untouched,
 *  exactly as the doc specifies, not a general-purpose squad filter. */
export default async function TeamAllocationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims, timezone } = await requireInjuryAccess();
  /* Was `isCoach`, while the PublishWeekButton it wraps resolves canManage from
     SESSION_EDIT. Outer gate and inner gate disagreeing meant the sport
     scientist never saw a control they were entitled to use. One set, read
     once. */
  const canManageWeek = hasAnyRole(claims.roles, SESSION_EDIT);

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const today = todayIso(timezone);
  const requestedDate = typeof params.week === 'string' ? params.week : today;
  const weekStart = mondayOf(requestedDate);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);
  // Same lesson as testing/[testDefId]/page.tsx's dayHref: week navigation has to
  // carry the group filter forward, or clicking "Next" silently clears it.
  const weekHref = (week: string) =>
    groupIds.length > 0 ? `/injuries/team-allocation?week=${week}&groups=${groupIds.join(',')}` : `/injuries/team-allocation?week=${week}`;

  const [teams, board, groups] = await Promise.all([
    fetchTeams(db, orgId),
    fetchWeekBoard(db, orgId, weekStart),
    fetchGroups(db, orgId),
  ]);
  const draftCount = board.allocations.filter((a) => a.status === 'draft').length;

  const poolFilterIds = groupIds.length > 0 ? await fetchGroupAthleteIds(db, orgId, groupIds) : null;
  const filteredBoard = poolFilterIds
    ? { ...board, unallocated: board.unallocated.filter((a) => poolFilterIds.includes(a.athlete_id)) }
    : board;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/injuries">Injuries</Link> · Team allocation
          </p>
          <h1>Team allocation</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          {canManageWeek ? <PublishWeekButton
          canManage={hasAnyRole(claims.roles, SESSION_EDIT)} orgId={orgId} userId={claims.userId} weekStart={weekStart} draftCount={draftCount} /> : null}
        </div>
      </div>

      <p className="eyebrow">{groupScopeLabel(groups, groupIds)} · {orgName}</p>

      <div style={{ margin: '10px 0' }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href={weekHref(prevWeek)} className="btn-ghost" aria-label="Previous week">
          ‹ Previous
        </Link>
        <span className="nm num">
          {formatDate(weekStart, timezone)} to {formatDate(weekEnd, timezone)}
        </span>
        <Link href={weekHref(nextWeek)} className="btn-ghost" aria-label="Next week">
          Next ›
        </Link>
      </div>

      {!canManageWeek ? (
        <div className="note" style={{ marginTop: 'var(--sp-14)' }}>
          <div className="note-glyph" aria-hidden="true">i</div>
          <p className="note-text">
            <b>Read only.</b> Medical sees the whole board and every availability status,
            and can change an athlete&rsquo;s availability from their own record, but
            cannot allocate or publish &mdash; that is a coach decision.
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: 'var(--sp-14)' }}>
        <TeamAllocationBoard
          orgId={orgId}
          userId={claims.userId}
          weekStart={weekStart}
          teams={teams}
          board={filteredBoard}
          canAllocate={hasAnyRole(claims.roles, SESSION_EDIT)}
          timezone={timezone}
        />
      </div>

      {/* THIS CAPTION HAS NOW BEEN WRONG IN BOTH DIRECTIONS, which is why the guard
          checks it against the query AND the board rather than against a remembered
          sentence.
          First it read "Availability, restrictions and body area only — the same
          boundary as every other screen", while the screen showed neither of the
          latter two: it named fields that were never fetched. Nothing leaked, but it
          told a coach they were looking at something they were not.
          Then it read "Availability only", which was true of the code — and made this
          the ONLY coach-facing screen without the limited injury view. Isabella decided
          on 2026-09-09 to show the same four fields as the other five screens
          (29-team-allocation.md), so the caption names them. */}
      <p className="cap">
        Availability, body area and side, restrictions, and expected return &mdash; the
        same limited injury view every other screen shows a coach. No diagnosis, no
        clinical notes, not even for medical, on this screen.
      </p>
    </>
  );
}
