import Link from 'next/link';
import { LeaveLeaderboardButton } from '@/components/LeaveLeaderboardButton/LeaveLeaderboardButton';
import {
  fetchBoard,
  fetchBoardRanking,
  fetchMetricCatalogue,
  metricDecimals,
  populationLabel,
} from '@/lib/queries/leaderboards';
import { formatNumber } from '@/lib/format';
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
        <div className="sheet-head">
          <Link href="/my-data/boards" className="sheet-x" aria-label="Back to leaderboards">
            <span aria-hidden="true">←</span>
          </Link>
          <h1 className="t">Leaderboard</h1>
          <span style={{ width: 44 }} />
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
  // metricDecimals, not the old inline `unit === '' ? 0 : 1`: a GPS distance board
  // would otherwise read "6260.0 m" and a max-speed board "9.3 m/s", which rounds away
  // the gap the board exists to show. See its own comment in lib/queries/leaderboards.ts.
  const decimals = metricDecimals(metric);
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

      <p className="tiny" style={{ marginBottom: 'var(--sp-10)' }}>
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
          <table className="tbl lb-table">
            <caption className="visually-hidden">{board.name} ranking</caption>
            <thead>
              <tr>
                {/* "#" and "Value" said nothing. The position column is named,
                    and the value column names the metric it actually holds —
                    the board's own title does not always say it. */}
                <th scope="col">Pos</th>
                <th scope="col">Athlete</th>
                <th scope="col" className="r">
                  {metric?.label ?? 'Value'}
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
                    <td className="num sub">
                      {/* Top three carry a little weight so the head of the
                          board reads as the head of the board. Deliberately
                          restrained — no medals, no colour: this is a squad
                          of teammates, not a podium. */}
                      <span className="lb-pos" data-top={row.position <= 3 ? 'true' : undefined}>
                        {row.is_tied ? '=' : ''}
                        {row.position}
                      </span>
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
                    <td className="r num">
                      {formatNumber(row.value, decimals)}
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
                  <td className="num sub">
                    {own.is_tied ? '=' : ''}
                    {own.position}
                  </td>
                  <td className="nm">
                    <span className="pill pill-accent" style={{ marginInlineEnd: 8 }}>
                      YOU
                    </span>
                    {own.first_name} {own.last_name}
                  </td>
                  <td className="r num">
                    {formatNumber(own.value, decimals)}
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
