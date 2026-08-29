import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import {
  fetchStaffBoards,
  fetchMetricCatalogue,
  fetchAthleteNames,
  populationLabel,
} from '@/lib/queries/leaderboards';
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
 *  line pending its own update.
 *
 *  Deliberately ungated for admin, the other half of the leaderboards split
 *  (see /leaderboards' own header for the wall's side of it):
 *  20-route-map.md lists this route's roles as `coach, medical, admin
 *  (aggregate)`, and every row this page renders is board *configuration* —
 *  name, metric, population type, window, publish state, participant
 *  count — never a named result. fetchStaffBoards() selects no athlete
 *  columns at all. That's what "aggregate" means for this screen in
 *  practice, so unlike the wall (LeaderboardWall, a named ranking with no
 *  aggregate-only rendering built) there's nothing here to deny. Board
 *  *detail* (/leaderboards/:leaderboardId, a real named ranking) and
 *  *creation* (/leaderboards/new) are each gated on their own page instead
 *  — new leaderboard already redirects a non-coach/medical visitor back
 *  here, and this list is exactly where they land. */
export default async function ManageLeaderboardsPage() {
  const { db, orgId } = await requireStaff();
  const [boards, catalogue] = await Promise.all([
    fetchStaffBoards(db, orgId),
    fetchMetricCatalogue(db),
  ]);
  const labelByKey = new Map(catalogue.map((m) => [m.key, m]));

  // One batched name lookup for every 'selected' board on the page, not one query
  // per row — fetchAthleteNames takes a flat id list, so every board's athlete_ids
  // are unioned first (Set dedupes an athlete selected on more than one board).
  // Staff-only, same reasoning as the board detail page: see fetchAthleteNames'
  // own comment in leaderboards.ts.
  const selectedIds = new Set(
    boards.filter((b) => b.population_type === 'selected').flatMap((b) => b.athlete_ids ?? []),
  );
  const selectedNamesById =
    selectedIds.size > 0 ? await fetchAthleteNames(db, orgId, [...selectedIds]) : new Map<string, string>();

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/leaderboards">Testing wall</Link> · Manage
          </p>
          <h1>Manage leaderboards</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/leaderboards/new" className="btn-primary">
            + New leaderboard
          </Link>
        </div>
      </div>

      <p className="cap" style={{ marginTop: -6, marginBottom: 14 }}>
        The published, consent-gated boards real athletes can see and leave. For
        internal-only results, go back to the <Link href="/leaderboards">testing wall</Link>.
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
            const selectedNames =
              board.population_type === 'selected'
                ? (board.athlete_ids ?? [])
                    .map((id) => selectedNamesById.get(id))
                    .filter((n): n is string => !!n)
                : null;
            return (
              <Link key={board.id} href={`/leaderboards/${board.id}`} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p className="nm" style={{ marginBottom: 2 }}>
                      {board.name}
                    </p>
                    <p className="tiny">
                      {metric?.label ?? board.metric_key}
                      {metric?.unit ? metric.unit : ''} · {populationLabel(board, selectedNames)} ·{' '}
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
        three athletes qualify. Athletes under 18 appear only if they choose to opt in
        themselves &mdash; nobody at the club can turn that on for them.
      </p>
    </>
  );
}
