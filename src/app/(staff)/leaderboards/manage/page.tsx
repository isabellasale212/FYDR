import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchStaffBoards, fetchMetricCatalogue } from '@/lib/queries/leaderboards';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Manage leaderboards · Fydr' };

/** screens/leaderboards.md, screen 26, simplified — see
 *  lib/queries/leaderboards.ts and the migration file for the exact cuts.
 *
 *  Moved from the bare /leaderboards route (LEADERBOARD-SPEC.md, the testing wall,
 *  now lives there instead — a different feature, see that page's own header) to
 *  /leaderboards/manage. This is still the real, load-bearing config/CRUD/consent
 *  system: publish/unpublish, medical suppression, and the boards real opted-in
 *  athletes see at /me/leaderboards and /my-data/boards all still run through here
 *  unchanged. Route was 20-route-map.md line 122; that map is now stale on this one
 *  line pending its own update. */
export default async function ManageLeaderboardsPage() {
  const { db, orgId } = await requireStaff();
  const [boards, catalogue] = await Promise.all([
    fetchStaffBoards(db, orgId),
    fetchMetricCatalogue(db),
  ]);
  const labelByKey = new Map(catalogue.map((m) => [m.key, m]));

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/leaderboards">Leaderboard</Link> · Manage
          </p>
          <h1>Manage leaderboards</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/leaderboards/new" className="btn-primary">
            + New leaderboard
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <p className="cap" style={{ marginTop: -6, marginBottom: 14 }}>
        The published, consent-gated boards real athletes can see and leave. For the
        internal testing wall, go back to <Link href="/leaderboards">Leaderboard</Link>.
      </p>

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
