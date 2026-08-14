import Link from 'next/link';
import { LeaveLeaderboardButton } from '@/components/LeaveLeaderboardButton/LeaveLeaderboardButton';
import {
  fetchBoard,
  fetchBoardRanking,
  fetchMetricCatalogue,
  populationLabel,
} from '@/lib/queries/leaderboards';
import { formatNumber } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Board · Fydr' };

/** screens/leaderboards.md's athlete board view: top-N plus the athlete's own row if
 *  they fall outside it. compute_leaderboard already refuses to return this board at
 *  all unless the athlete qualifies for it (see migration 0016's own comment on the
 *  function) — noPermission for an unqualified or unpublished board is therefore just
 *  "nothing came back", handled below the same uninformative way the spec asks for. */
export default async function MyBoardDetailPage({
  params,
}: {
  params: Promise<{ leaderboardId: string }>;
}) {
  const { leaderboardId } = await params;
  const { db, orgId, athleteId, claims } = await requireAthlete();

  const [board, ranking, catalogue] = await Promise.all([
    fetchBoard(db, orgId, leaderboardId),
    fetchBoardRanking(db, leaderboardId),
    fetchMetricCatalogue(db),
  ]);

  const own = ranking.find((r) => r.athlete_id === athleteId);
  if (!board || board.visibility !== 'published' || !own) {
    return (
      <>
        <div className="sheet-head">
          <Link href="/my-data/boards" className="sheet-x" aria-label="Back to leaderboards">
            <span aria-hidden="true">←</span>
          </Link>
          <h1 className="t">Leaderboard</h1>
          <span style={{ width: 44 }} />
        </div>
        <div className="empty">
          <h2>This leaderboard is not available</h2>
          <p>
            <Link href="/my-data/boards">Back to leaderboards</Link>
          </p>
        </div>
      </>
    );
  }

  const metric = catalogue.find((m) => m.key === board.metric_key);
  const topN = board.athlete_view === 'full' ? ranking.length : board.top_n;
  const top = ranking.slice(0, topN);
  const ownInTop = top.some((r) => r.athlete_id === athleteId);

  return (
    <>
      <div className="sheet-head">
        <Link href="/my-data/boards" className="sheet-x" aria-label="Back to leaderboards">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="t">{board.name}</h1>
        <span style={{ width: 44 }} />
      </div>

      <p className="tiny" style={{ marginBottom: 10 }}>
        {/* No selectedNames arg here either — same RLS reasoning as the boards list
            page; see fetchAthleteNames' own comment in leaderboards.ts. */}
        {populationLabel(board)} ·{' '}
        {board.window_type === 'days'
          ? `last ${board.window_days} days`
          : board.window_type === 'season'
            ? 'this season'
            : 'all time'}
      </p>

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
              {top.map((row) => {
                const isSelf = row.athlete_id === athleteId;
                return (
                  <tr
                    key={row.athlete_id}
                    aria-current={isSelf ? 'true' : undefined}
                    style={
                      isSelf
                        ? { borderInlineStart: '3px solid var(--accent)', background: 'var(--surf2)' }
                        : undefined
                    }
                  >
                    <td className="mono sub">
                      {row.is_tied ? '=' : ''}
                      {row.position}
                    </td>
                    <td className="nm">
                      {isSelf ? (
                        <>
                          <span className="pill pill-accent" style={{ marginInlineEnd: 8 }}>
                            YOU
                          </span>
                          {row.first_name} {row.last_name}
                        </>
                      ) : (
                        `${row.first_name} ${row.last_name}`
                      )}
                    </td>
                    <td className="r mono">
                      {formatNumber(row.value, metric?.unit === '' ? 0 : 1)}
                      {metric?.unit ?? ''}
                    </td>
                  </tr>
                );
              })}
              {!ownInTop ? (
                <tr
                  aria-current="true"
                  style={{ borderInlineStart: '3px solid var(--accent)', background: 'var(--surf2)' }}
                >
                  <td className="mono sub">
                    {own.is_tied ? '=' : ''}
                    {own.position}
                  </td>
                  <td className="nm">
                    <span className="pill pill-accent" style={{ marginInlineEnd: 8 }}>
                      YOU
                    </span>
                    {own.first_name} {own.last_name}
                  </td>
                  <td className="r mono">
                    {formatNumber(own.value, metric?.unit === '' ? 0 : 1)}
                    {metric?.unit ?? ''}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="cap">
        {ranking.length} athlete{ranking.length === 1 ? '' : 's'} ranked. Athletes who
        are not shown either opted out or have no qualifying result &mdash; which one is
        never shown here.
      </p>

      <div style={{ marginTop: 14 }}>
        <LeaveLeaderboardButton
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          boardId={board.id}
          boardName={board.name}
        />
      </div>
    </>
  );
}
