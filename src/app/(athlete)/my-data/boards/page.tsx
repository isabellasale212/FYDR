import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { LeaderboardVisibilityGate } from '@/components/HideLeaderboardsToggle/LeaderboardVisibilityGate';
import {
  fetchMyBoards,
  fetchMetricCatalogue,
  metricDecimals,
  populationLabel,
} from '@/lib/queries/leaderboards';
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

      <LeaderboardVisibilityGate>
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
                    {/* The metric leads this line now. When every published board ranked
                        session load there was nothing to tell apart, and a board's own
                        name was enough; a club running distance, sprint distance and max
                        speed boards side by side is exactly the athlete-side request
                        ("tailor to different metrics rather than the total session load"),
                        and a list of three names with no metric on any of them does not
                        answer it. */}
                    {metric ? `${metric.label} · ` : ''}
                    {/* No selectedNames arg: an athlete-scoped `db` can't resolve other
                        athletes' names for a 'selected' board (RLS — see
                        fetchAthleteNames' own comment in leaderboards.ts), so this falls
                        back to populationLabel's count-only branch for that case. */}
                    {populationLabel(board)} ·{' '}
                    {board.window_type === 'days'
                      ? `last ${board.window_days} days`
                      : board.window_type === 'season'
                        ? 'this season'
                        : 'all time'}
                  </p>
                  <p style={{ margin: 0 }}>
                    You are <b>{own.position}{own.is_tied ? ' (tied)' : ''}</b> ·{' '}
                    {/* Was a hardcoded 1 decimal — the one place on either surface that
                        really did assume session load, printing it as "1240.0" and, once
                        GPS metrics landed, a distance as "6260.0 m". metricDecimals reads
                        the metric's own unit instead. */}
                    <span className="num">{formatNumber(own.value, metricDecimals(metric))}</span>
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
      </LeaderboardVisibilityGate>
    </>
  );
}
