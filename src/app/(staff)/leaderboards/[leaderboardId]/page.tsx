import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LeaderboardStaffActions } from '@/components/LeaderboardStaffActions/LeaderboardStaffActions';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import {
  fetchBoard,
  fetchBoardRanking,
  fetchMetricCatalogue,
} from '@/lib/queries/leaderboards';
import { formatNumber } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Leaderboard · Fydr' };

/** screens/leaderboards.md's staff board view, simplified: no movement column (no
 *  snapshots table), no "Not ranked" names list (needs a second query resolving the
 *  full population against the ranking; the count omission is a real cut, tracked
 *  here rather than silently dropped). Route per 20-route-map.md line 123. */
export default async function LeaderboardDetailPage({
  params,
}: {
  params: Promise<{ leaderboardId: string }>;
}) {
  const { leaderboardId } = await params;
  const { db, orgId, claims } = await requireStaff();

  const board = await fetchBoard(db, orgId, leaderboardId);
  if (!board) notFound();

  const [ranking, catalogue] = await Promise.all([
    fetchBoardRanking(db, leaderboardId),
    fetchMetricCatalogue(db),
  ]);
  const metric = catalogue.find((m) => m.key === board.metric_key);
  const isMedical = claims.roles.includes('medical');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/leaderboards">Leaderboard</Link> · {board.name}
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

      <div style={{ marginTop: 14 }}>
        <LeaderboardStaffActions
          orgId={orgId}
          userId={claims.userId}
          boardId={board.id}
          visibility={board.visibility}
          isMedical={isMedical}
          ranking={ranking}
        />
      </div>

      <section style={{ marginTop: 14 }} aria-labelledby="ranking-title">
        <p className="sect" id="ranking-title" style={{ marginBottom: 8 }}>
          Ranking
        </p>
        {ranking.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              Not enough results to rank. This board needs at least{' '}
              {metric?.min_population ?? 3} athletes with a qualifying result.
            </p>
          </div>
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
          {ranking.length} athlete{ranking.length === 1 ? '' : 's'} ranked ·{' '}
          {board.window_type === 'days'
            ? `last ${board.window_days} days`
            : board.window_type === 'season'
              ? 'this season'
              : 'all time'}
          . Athletes who opted out or did not qualify are not shown, and are not
          distinguished from each other here.
        </p>
      </section>
    </>
  );
}
