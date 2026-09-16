import Link from 'next/link';
import { DashboardTabs } from '@/components/DashboardTabs/DashboardTabs';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PublishWeekButton } from '@/components/PublishWeekButton/PublishWeekButton';
import { TeamAllocationBoard } from '@/components/TeamAllocationBoard/TeamAllocationBoard';
import { fetchTeams, fetchWeekBoard } from '@/lib/queries/teamAllocation';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { mondayOf } from '@/lib/queries/schedule';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Match · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** THE MATCH TAB (Isabella, 16 September 2026, the overnight queue, 3.4):
 *  "team selection moves off [Manage groups] onto the dashboard, in a Match
 *  tab, viewable and editable by the coach only, for selecting on match
 *  days." The board is the one at /injuries/team-allocation — the same
 *  teams table (migration 0003), the same team_allocations with their
 *  draft/published states, the same TeamAllocationBoard — so there is still
 *  exactly one place a team is defined and one answer to "who is in the 1st
 *  XV this week"; that route still answers for old links.
 *
 *  THE COACH'S. The tab is drawn on the dashboard for the coach only, and
 *  the allocate and publish controls here are the coach's alone: the sport
 *  scientist, whom SESSION_EDIT admits at the RPC, reads. HIDDEN, not
 *  withheld — the database enforcement follows after Friday
 *  (docs/after-friday.md); a non-coach who opens the address reads the
 *  board as the medic always has. */
export default async function DashboardMatchPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  // A hide, not a gate (Isabella, 16 Sept 2026, 3.4): the coach alone is
  // SHOWN the tab and the controls; SESSION_EDIT is the write's set and is
  // unchanged, the enforcement following after Friday.
  // access-exempt: no set in access.ts is "the coach alone", and inventing one would claim a rule
  const isCoach = claims.roles.includes('coach');

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const today = todayIso(timezone);
  const requestedDate = typeof params.week === 'string' ? params.week : today;
  const weekStart = mondayOf(requestedDate);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);
  const weekHref = (week: string) => (groupIds.length > 0 ? `/dashboard/match?week=${week}&groups=${groupIds.join(',')}` : `/dashboard/match?week=${week}`);

  const [teams, board, groups] = await Promise.all([fetchTeams(db, orgId), fetchWeekBoard(db, orgId, weekStart), fetchGroups(db, orgId)]);
  const draftCount = board.allocations.filter((a) => a.status === 'draft').length;
  const poolFilterIds = groupIds.length > 0 ? await fetchGroupAthleteIds(db, orgId, groupIds) : null;
  const filteredBoard = poolFilterIds ? { ...board, unallocated: board.unallocated.filter((a) => poolFilterIds.includes(a.athlete_id)) } : board;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            {groupScopeLabel(groups, groupIds)} · {orgName}
          </p>
          <h1>Match</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          <GroupFilter groups={groups} selected={groupIds} />
          {isCoach ? <PublishWeekButton canManage={isCoach} orgId={orgId} userId={claims.userId} weekStart={weekStart} draftCount={draftCount} /> : null}
        </div>
      </div>

      <DashboardTabs current="match" show={isCoach} groupIds={groupIds} />

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

      {!isCoach ? (
        <div className="note" style={{ marginTop: 'var(--sp-14)' }}>
          <div className="note-glyph" aria-hidden="true">
            i
          </div>
          <p className="note-text">
            <b>Read only.</b> Selecting a team is the coach&rsquo;s decision. Availability is changed from an athlete&rsquo;s own record.
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: 'var(--sp-14)' }}>
        <TeamAllocationBoard orgId={orgId} userId={claims.userId} weekStart={weekStart} teams={teams} board={filteredBoard} canAllocate={isCoach} timezone={timezone} />
      </div>

      {/* 2.3 (16 Sept 2026): a definition card — the desktop's. */}
      <p className="cap" data-desktop-only="">
        Availability, body area and side, restrictions, and expected return &mdash; the same limited injury view every other screen shows
        a coach. No diagnosis, no clinical notes, not even for medical, on this screen. Teams are standing squads (1st XV, 2nd XV, Colts),
        never a group: an athlete is in many groups and plays for one team on a weekend.
      </p>
    </>
  );
}
