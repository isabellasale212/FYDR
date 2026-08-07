import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchStaffBoards, fetchMetricCatalogue } from '@/lib/queries/leaderboards';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Leaderboard · Fydr' };

/** screens/leaderboards.md, screen 26, simplified — see
 *  lib/queries/leaderboards.ts and the migration file for the exact cuts. Route per
 *  20-route-map.md line 122. */
export default async function LeaderboardsPage() {
  const { db, orgId, orgName } = await requireStaff();
  const [boards, catalogue] = await Promise.all([
    fetchStaffBoards(db, orgId),
    fetchMetricCatalogue(db),
  ]);
  const labelByKey = new Map(catalogue.map((m) => [m.key, m]));

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Leaderboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/leaderboards/new" className="btn-primary">
            + New leaderboard
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          title="No leaderboards yet"
          body="Any eligible metric can be ranked. Wellness and body composition never can — see the builder for why."
        />
      ) : (
        <div className="stack">
          {boards.map((board) => {
            const metric = labelByKey.get(board.metric_key);
            return (
              <Link key={board.id} href={`/leaderboards/${board.id}`} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p className="nm" style={{ marginBottom: 2 }}>
                      {board.name}
                    </p>
                    <p className="tiny">
                      {metric?.label ?? board.metric_key}
                      {metric?.unit ? metric.unit : ''} · {board.population_type} ·{' '}
                      {board.window_type === 'days'
                        ? `last ${board.window_days} days`
                        : board.window_type === 'season'
                          ? 'this season'
                          : 'all time'}
                    </p>
                  </div>
                  <span
                    className={`pill ${board.visibility === 'published' ? 'pill-good' : 'pill-neutral'}`}
                  >
                    {board.visibility === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="cap">
        Wellness and body composition can never be ranked here, by design &mdash; see any
        ineligible metric in the builder for the reason. Boards render only once at least
        three athletes qualify.
      </p>
    </>
  );
}
