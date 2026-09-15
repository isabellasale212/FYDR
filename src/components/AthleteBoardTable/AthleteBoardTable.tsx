import { type Leaderboard, type MetricDefinition, type RankedRow, metricDecimals, populationLabel } from '@/lib/queries/leaderboards';
import { formatNumber } from '@/lib/format';

/* One board, as the athlete reads it — screens/leaderboards.md's athlete
 * board view: top-N plus the athlete's own row if they fall outside it.
 * Lifted out of /my-data/boards/[leaderboardId] on 16 September 2026
 * (Isabella's overnight queue, 1.3: "a simple board, with a dropdown to
 * switch between leaderboards") so the boards page can draw the chosen
 * board in place and the detail route can keep drawing the same table. The
 * caller has already settled that the board is published, on the plan and
 * that the athlete is on it. */
type Props = {
  board: Leaderboard;
  ranking: readonly RankedRow[];
  metric: MetricDefinition | undefined;
  athleteId: string;
  own: RankedRow;
};

export function AthleteBoardTable({ board, ranking, metric, athleteId, own }: Props) {
  // metricDecimals, not the old inline `unit === '' ? 0 : 1`: a GPS distance board
  // would otherwise read "6260.0 m" and a max-speed board "9.3 m/s", which rounds away
  // the gap the board exists to show. See its own comment in lib/queries/leaderboards.ts.
  const decimals = metricDecimals(metric);
  const topN = board.athlete_view === 'full' ? ranking.length : board.top_n;
  const top = ranking.slice(0, topN);
  const ownInTop = top.some((r) => r.athlete_id === athleteId);
  const self = { borderInlineStart: '3px solid var(--accent)', background: 'var(--surf2)' } as const;

  return (
    <>
      <p className="tiny" style={{ marginBottom: 'var(--sp-10)' }}>
        {/* No selectedNames arg — an athlete-scoped db cannot resolve other
            athletes' names for a 'selected' board (RLS; fetchAthleteNames'
            own comment in leaderboards.ts). */}
        {populationLabel(board)} ·{' '}
        {board.window_type === 'days' ? `last ${board.window_days} days` : board.window_type === 'season' ? 'this season' : 'all time'}
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
                  <tr key={row.athlete_id} aria-current={isSelf ? 'true' : undefined} style={isSelf ? self : undefined}>
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
                          <span className="pill pill-accent" style={{ marginInlineEnd: 'var(--s-4)' }}>
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
                <tr aria-current="true" style={self}>
                  <td className="num sub">
                    {own.is_tied ? '=' : ''}
                    {own.position}
                  </td>
                  <td className="nm">
                    <span className="pill pill-accent" style={{ marginInlineEnd: 'var(--s-4)' }}>
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
        {ranking.length} athlete{ranking.length === 1 ? '' : 's'} ranked. Athletes who are not shown either opted out or have no
        qualifying result &mdash; which one is never shown here.
      </p>
    </>
  );
}
