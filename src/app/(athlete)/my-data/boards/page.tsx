import Link from 'next/link';
import { AthleteBoardTable } from '@/components/AthleteBoardTable/AthleteBoardTable';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { LeaderboardVisibilityGate } from '@/components/HideLeaderboardsToggle/LeaderboardVisibilityGate';
import { LeaveLeaderboardButton } from '@/components/LeaveLeaderboardButton/LeaveLeaderboardButton';
import { ReportSelectNav } from '@/components/ReportSelectNav/ReportSelectNav';
import { fetchBoardRanking, fetchMyBoards, fetchMetricCatalogue } from '@/lib/queries/leaderboards';
import { requireAthlete } from '@/lib/session';
import { gpsMetricBlocked } from '@/lib/tier';
import { isUuid } from '@/lib/uuid';

export const metadata = { title: 'Leaderboards · Fydr' };

/** ONE BOARD, AND A DROPDOWN TO SWITCH — Isabella, 16 September 2026 (the
 *  overnight queue, 1.3: "a simple board, with a dropdown to switch between
 *  leaderboards"). Until then this was "Boards I am on", a list of cards each
 *  opening its own page. Now the page IS the board: the dropdown names every
 *  board the athlete is on, `?board=` holds the choice, and the chosen board
 *  is drawn in place with the same table the detail route draws
 *  (AthleteBoardTable). With no choice the first board is shown — the one the
 *  athlete is doing best on, screens/leaderboards.md's own ordering ("the
 *  ordering least likely to open the app on a discouraging number").
 *
 *  A board this athlete does not appear on — excluded, opted out,
 *  unqualified, or simply not on it — is not in the dropdown at all, per
 *  fetchMyBoards; and a GPS board on a Basic club is filtered the same way
 *  (Q-29), as this list always did. Route per 20-route-map.md line 74. */
export default async function MyBoardsPage({ searchParams }: { searchParams: Promise<{ board?: string | string[] }> }) {
  const { db, orgId, athleteId, claims, tier } = await requireAthlete();
  const { board: requested } = await searchParams;
  const [mine, catalogue] = await Promise.all([fetchMyBoards(db, orgId, athleteId), fetchMetricCatalogue(db)]);
  const boards = mine.filter(({ board }) => !gpsMetricBlocked(board.metric_key, tier));
  const chosenId = typeof requested === 'string' && isUuid(requested) ? requested : null;
  const chosen = boards.find(({ board }) => board.id === chosenId) ?? boards[0] ?? null;
  const ranking = chosen ? await fetchBoardRanking(db, chosen.board.id) : [];
  const labelByKey = new Map(catalogue.map((m) => [m.key, m]));

  return (
    <>
      <div className="hd">
        <h1 className="d">Leaderboards</h1>
      </div>

      <LeaderboardVisibilityGate>
        {boards.length === 0 ? (
          <EmptyState title="No leaderboards yet" body="Boards your club publishes and includes you on appear here." />
        ) : chosen ? (
          <div className="stack">
            {/* The dropdown: every board this athlete is on, its metric beside
                its name so three boards of one name still tell apart. Any
                other query param is kept, none exists here today. */}
            <ReportSelectNav
              label="Board"
              paramKey="board"
              value={chosen.board.id}
              options={boards.map(({ board }) => {
                const metric = labelByKey.get(board.metric_key)?.label;
                return { value: board.id, label: metric && metric !== board.name ? `${board.name} · ${metric}` : board.name };
              })}
              ariaLabel="Which leaderboard to show"
            />
            <div>
              <h2 className="card-title" style={{ marginBottom: 'var(--sp-4)' }}>
                {chosen.board.name}
              </h2>
              <AthleteBoardTable
                board={chosen.board}
                ranking={ranking}
                metric={labelByKey.get(chosen.board.metric_key)}
                athleteId={athleteId}
                own={chosen.own}
              />
            </div>
            <LeaveLeaderboardButton orgId={orgId} athleteId={athleteId} userId={claims.userId} boardId={chosen.board.id} boardName={chosen.board.name} />
          </div>
        ) : null}

        <p className="cap">
          <Link href="/me/leaderboards">Manage who sees you on a leaderboard</Link>
        </p>
      </LeaderboardVisibilityGate>
    </>
  );
}
