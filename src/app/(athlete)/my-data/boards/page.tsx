import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchMyBoards, fetchMetricCatalogue } from '@/lib/queries/leaderboards';
import { formatNumber } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Leaderboards · Fydr' };

/** "Boards I am on" — screens/leaderboards.md's athlete list. Ordered by the athlete's
 *  own position ascending, per the spec's own stated reasoning: "the board they are
 *  doing best on is first... the ordering least likely to open the app on a
 *  discouraging number." A board this athlete does not appear on — excluded, opted
 *  out, unqualified, or simply not on it — never appears here at all, per
 *  fetchMyBoards; there is no partial or greyed row for one. Route per
 *  20-route-map.md line 74. */
export default async function MyBoardsPage() {
  const { db, orgId, athleteId } = await requireAthlete();
  const [mine, catalogue] = await Promise.all([
    fetchMyBoards(db, orgId, athleteId),
    fetchMetricCatalogue(db),
  ]);
  const labelByKey = new Map(catalogue.map((m) => [m.key, m]));

  return (
    <>
      <div className="hd">
        <h1 className="d">Leaderboards</h1>
      </div>

      <p className="tiny">Opted in · leave any board from Me.</p>

      {mine.length === 0 ? (
        <EmptyState
          title="No leaderboards yet"
          body="Boards your club publishes and includes you on appear here."
        />
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {mine.map(({ board, own }) => {
            const metric = labelByKey.get(board.metric_key);
            return (
              <Link key={board.id} href={`/my-data/boards/${board.id}`} className="card">
                <p className="nm" style={{ marginBottom: 2 }}>
                  {board.name}
                </p>
                <p className="tiny" style={{ marginBottom: 8 }}>
                  {board.population_type} ·{' '}
                  {board.window_type === 'days'
                    ? `last ${board.window_days} days`
                    : board.window_type === 'season'
                      ? 'this season'
                      : 'all time'}
                </p>
                <p style={{ margin: 0 }}>
                  You are <b>{own.position}{own.is_tied ? ' (tied)' : ''}</b> ·{' '}
                  <span className="mono">{formatNumber(own.value, 1)}</span>
                  {metric?.unit ?? ''}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <p className="cap">
        <Link href="/me/leaderboards">Manage who sees you on a leaderboard</Link>
      </p>
    </>
  );
}
