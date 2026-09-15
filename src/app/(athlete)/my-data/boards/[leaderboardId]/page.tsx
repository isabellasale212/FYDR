import Link from 'next/link';
import { LeaveLeaderboardButton } from '@/components/LeaveLeaderboardButton/LeaveLeaderboardButton';
import { AthleteBoardTable } from '@/components/AthleteBoardTable/AthleteBoardTable';
import { fetchBoard, fetchBoardRanking, fetchMetricCatalogue } from '@/lib/queries/leaderboards';
import { requireAthlete } from '@/lib/session';
import { gpsMetricBlocked } from '@/lib/tier';

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
  const { db, orgId, athleteId, claims, tier } = await requireAthlete();

  const [board, ranking, catalogue] = await Promise.all([
    fetchBoard(db, orgId, leaderboardId),
    fetchBoardRanking(db, leaderboardId),
    fetchMetricCatalogue(db),
  ]);

  const own = ranking.find((r) => r.athlete_id === athleteId);

  /* SPLIT FROM THE !own CHECK BY 0094, and the order matters now. Once the tier
     gate moved inside compute_leaderboard, a gated GPS board returns NO ranking
     rows at all — so `own` is undefined for every athlete, and a single combined
     guard would answer "this leaderboard is not available" and never reach the
     plan message below. The board's existence is settled here; whether the
     athlete is on it is settled after the plan is. */
  if (!board || board.visibility !== 'published') {
    return (
      <>
        <div className="hd">
          <h1 className="d">Leaderboard</h1>
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

  /* THE PLAN GATE, Q-29. A GPS board on a Basic club is not shown, and this is
     the athlete half of a rule the staff detail page has always had — its own
     comment names the two cases: a board "created while the club was Premium,
     or inserted directly". Until 8 September 2026 the athlete screens had no
     such check, so those were exactly the cases where a Basic club's players
     kept seeing a Premium metric.

     AFTER the board/visibility/own check above, not before it, and deliberately:
     an athlete who is not on this board should read "not available" rather than
     a message about their club's plan, which would tell them a board exists that
     they were never on. The plan is only their business once the board is.

     Worded as the plan, not as a fault. The board is real and the club owns it;
     it is the metric that stopped being included. Same stance as the staff
     PlanGate, in the athlete shell's own markup rather than the staff one's.

     KEPT AFTER 0094 moved the rule into compute_leaderboard, on purpose. The
     function now refuses the ranking outright, which closes the direct-call
     bypass this check never could — but a function that returns no rows cannot
     tell anybody why. This is the only layer that can, so it stays. */
  if (gpsMetricBlocked(board.metric_key, tier)) {
    return (
      <>
        <div className="hd">
          <h1 className="d">Leaderboard</h1>
        </div>
        <div className="empty">
          <h2>Not on your club&rsquo;s plan</h2>
          <p>
            This board ranks GPS data, which is part of the Premium plan. It is still here
            and nothing has been deleted &mdash; it is not shown while your club is on Basic.
          </p>
          <p>
            <Link href="/my-data/boards">Back to leaderboards</Link>
          </p>
        </div>
      </>
    );
  }

  /* AFTER the plan gate, deliberately. An athlete who is simply not on a board
     they could otherwise see should read "not available" rather than anything
     about their club's plan — but a board their club cannot show at all is the
     plan's business, and saying so is the whole point of keeping a page-level
     check once 0094 made the function refuse silently. */
  if (!own) {
    return (
      <>
        <div className="hd">
          <h1 className="d">Leaderboard</h1>
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

  return (
    <>
      <div className="hd">
        <h1 className="d">{board.name}</h1>
      </div>

      {/* The table is AthleteBoardTable since 16 Sept 2026 (1.3), shared with
          the boards page, which draws the chosen board in place. */}
      <AthleteBoardTable board={board} ranking={ranking} metric={metric} athleteId={athleteId} own={own} />

      <div style={{ marginTop: 'var(--sp-14)' }}>
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
