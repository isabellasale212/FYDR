import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { LeaderboardStaffActions } from '@/components/LeaderboardStaffActions/LeaderboardStaffActions';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import {
  fetchBoard,
  fetchBoardRanking,
  fetchMetricCatalogue,
} from '@/lib/queries/leaderboards';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { formatNumber } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Leaderboard · Fydr' };

/** screens/leaderboards.md's staff board view, simplified: no movement column (no
 *  snapshots table), no "Not ranked" names list (needs a second query resolving the
 *  full population against the ranking; the count omission is a real cut, tracked
 *  here rather than silently dropped). Route per 20-route-map.md line 123.
 *
 *  CLAUDE.md §3: this screen displays every ranked athlete at once, so it needs the
 *  group filter — screens/leaderboards.md §"Staff filtering" (line 831) is explicit
 *  about the shape that filter takes here, and it's not the obvious one. The filter
 *  narrows what's *shown*, never what's *ranked*: fetchBoardRanking() is called once,
 *  unfiltered, and the result is filtered client-side-of-the-request after the fact.
 *  Filtering at the RPC level would silently re-rank within the filtered set, so a
 *  forward ranked 7th squad-wide would show as 2nd when viewed through the Forwards
 *  filter — two coaches would then quote different positions for the same athlete on
 *  the same board, exactly the confusion the doc calls out by name. */
export default async function LeaderboardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leaderboardId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { leaderboardId } = await params;
  const { db, orgId, claims } = await requireStaff();

  // docs/20-route-map.md §2.3: board detail's roles are `coach, medical`
  // only — unlike the wall one level up, there's no admin row_note here at
  // all, aggregate or otherwise. Checked before fetchBoard() runs, so an
  // admin-only visitor gets the same denial regardless of whether the
  // board id resolves, matching /flags and /squad/[athleteId].
  const hasAccess = claims.roles.includes('coach') || claims.roles.includes('medical');
  if (!hasAccess) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">
              <Link href="/leaderboards/manage">Leaderboard</Link> · Board
            </p>
            <h1>Board detail</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="empty">
          <h2>Not part of this role</h2>
          <p>
            A board&apos;s ranking is named-athlete data. Admin manages the club and does
            not read athlete performance data &mdash; see 01-roles-and-permissions.md §1.
            The board list at <Link href="/leaderboards/manage">Manage leaderboards</Link>{' '}
            shows configuration only, with no ranking.
          </p>
        </div>
      </>
    );
  }

  const sp = await searchParams;
  const groupIds = await resolveGroupFilter(sp.groups);

  const board = await fetchBoard(db, orgId, leaderboardId);
  if (!board) notFound();

  const [fullRanking, catalogue, groups] = await Promise.all([
    fetchBoardRanking(db, leaderboardId),
    fetchMetricCatalogue(db),
    fetchGroups(db, orgId),
  ]);

  const filterAthleteIds = groupIds.length > 0 ? await fetchGroupAthleteIds(db, orgId, groupIds) : null;
  const ranking = filterAthleteIds ? fullRanking.filter((row) => filterAthleteIds.includes(row.athlete_id)) : fullRanking;
  const isFiltered = groupIds.length > 0;
  const scopeLabel = groupScopeLabel(groups, groupIds);

  const metric = catalogue.find((m) => m.key === board.metric_key);
  const isMedical = claims.roles.includes('medical');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/leaderboards/manage">Leaderboard</Link> · {board.name}
          </p>
          <h1>{board.name}</h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className={`pill ${board.visibility === 'published' ? 'pill-good' : 'pill-neutral'}`}>
            {board.visibility === 'published' ? 'Published' : 'Draft'}
          </span>
          <span className="pill pill-neutral">{board.population_type}</span>
          <span className="pill pill-neutral">
            {board.window_type === 'days'
              ? `Last ${board.window_days} days`
              : board.window_type === 'season'
                ? 'This season'
                : 'All time'}
          </span>
        </div>
        <p style={{ marginTop: 10 }}>
          Ranking {metric?.label ?? board.metric_key}, {board.aggregation}.
        </p>
      </div>

      <div style={{ margin: '14px 0' }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <LeaderboardStaffActions
          orgId={orgId}
          userId={claims.userId}
          boardId={board.id}
          visibility={board.visibility}
          isMedical={isMedical}
          ranking={fullRanking}
        />
      </div>

      <section aria-labelledby="ranking-title">
        <p className="sect" id="ranking-title" style={{ marginBottom: 8 }}>
          Ranking
        </p>
        {fullRanking.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              Not enough results to rank. This board needs at least{' '}
              {metric?.min_population ?? 3} athletes with a qualifying result.
            </p>
          </div>
        ) : ranking.length === 0 ? (
          <EmptyState
            title="No ranked athletes in this filter"
            body={`No athletes in the current scope (${scopeLabel}) appear on this board. Clear the filter to see everyone.`}
          />
        ) : (
          <div className="card flush">
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <caption className="visually-hidden">{board.name} ranking</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Athlete</th>
                    <th scope="col" className="r">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row) => (
                    <tr key={row.athlete_id}>
                      <td className="mono sub">
                        {row.is_tied ? '=' : ''}
                        {row.position}
                      </td>
                      <td className="nm">
                        {row.first_name} {row.last_name}
                      </td>
                      <td className="r mono">
                        {formatNumber(row.value, metric?.unit === '' ? 0 : 1)}
                        {metric?.unit ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="cap">
          {isFiltered
            ? `Showing ${ranking.length} of ${fullRanking.length} ranked athletes. Positions are squad-wide.`
            : `${ranking.length} athlete${ranking.length === 1 ? '' : 's'} ranked`}
          {' · '}
          {board.window_type === 'days'
            ? `last ${board.window_days} days`
            : board.window_type === 'season'
              ? 'this season'
              : 'all time'}
          . Athletes who opted out or did not qualify are not shown, and are not
          distinguished from each other here.
        </p>
        <p className="cap">
          Athletes under 18 are never shown on a published board unless they choose to
          opt in themselves &mdash; if one is missing here, that may be why, not a fault
          with the board.
        </p>
      </section>
    </>
  );
}
