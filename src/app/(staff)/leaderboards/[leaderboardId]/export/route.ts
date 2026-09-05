import { notFound } from 'next/navigation';
import { csvResponse, toCsv } from '@/lib/csv';
import {
  fetchBoard,
  fetchBoardRanking,
  fetchMetricCatalogue,
  fetchAthleteNames,
  metricDecimals,
  populationLabel,
} from '@/lib/queries/leaderboards';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatNumber } from '@/lib/format';
import { premiumOnlyResponse, requireStaff } from '@/lib/session';
import { isUuid } from '@/lib/uuid';
import { isPremium } from '@/lib/tier';
import { actingRole } from '@/lib/access';

/** The "download" half of the coach's request for a download and a print button on a
 *  board. CSV, via lib/csv.ts — the same export every report on this app already
 *  ships, and the same reasoning that file's own header gives for CSV being the whole
 *  of it.
 *
 *  Three things this route copies from the board page it exports rather than deciding
 *  for itself, because a download that disagrees with the screen it came from is worse
 *  than no download:
 *
 *   - The role gate. requireStaff() is not enough on its own: the board page refuses
 *     an admin-only visitor by hand (a ranking is named-athlete data, and admin does
 *     not read athlete performance data — 01-roles-and-permissions.md §1). Repeated
 *     here, because a route is a separate front door and RLS on `leaderboards` alone
 *     would let an admin through to the config, even though compute_leaderboard would
 *     then hand them an empty ranking.
 *   - The group filter, via resolveGroupFilter — the sticky cookie, exactly as the
 *     reports' own exports resolve it (audit S4), so what downloads is what is on
 *     screen. And filtered the same way: the ranking is computed once, unfiltered, and
 *     rows are dropped afterwards, so a forward ranked 7th squad-wide exports as 7th
 *     and never as 2nd. The caption says so in words.
 *   - The decimals. metricDecimals(), not a literal, so a distance exports as metres
 *     and a max speed keeps its two places.
 *
 *  Every exclusion the board makes — opted out, medically suppressed, an unconsented
 *  minor, below the qualifying record count — is made inside compute_leaderboard, so
 *  this file cannot leak one by forgetting it: there is no path here that reads an
 *  athlete the screen would not have shown. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leaderboardId: string }> },
) {
  const { leaderboardId } = await params;
  const { db, orgId, claims, tier } = await requireStaff();
  /* Shape-check the route param before it reaches a query. Authenticated
     first, so this never becomes a probe; then 404 rather than 500, because a
     malformed id is a URL that does not name anything, not a server fault. */
  if (!isUuid(leaderboardId)) notFound();


  /* No role narrowing here. docs/access-matrix.md §3.4 gives Leaderboard a V to
     every staff role, and §3.5's rule is that "a download carries the same
     permission as the screen it belongs to, without exception". This route used
     to refuse anyone who was not a coach or a medic, which was narrower than the
     screen above it: under the five-role model that refused the sport scientist,
     the S&C and the nutritionist a board all three may read. requireStaff() is
     the whole gate. */

  const url = new URL(request.url);
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);

  const board = await fetchBoard(db, orgId, leaderboardId);
  if (!board) notFound();

  /* A board whose metric is GPS is a GPS export, whatever route serves it.
     leaderboards/new/page.tsx already refuses to CREATE one on Basic and says
     in its own header that the prohibition is not server-enforced — so a board
     made while the club was Premium, or inserted directly, kept ranking and
     kept exporting after a downgrade. `gps.` is the same discriminator that
     page filters on. */
  if (board.metric_key.startsWith('gps.') && !isPremium(tier)) {
    return premiumOnlyResponse('Ranking GPS metrics');
  }

  const [fullRanking, catalogue, groups, selectedNamesById] = await Promise.all([
    fetchBoardRanking(db, leaderboardId),
    fetchMetricCatalogue(db),
    fetchGroups(db, orgId),
    board.population_type === 'selected'
      ? fetchAthleteNames(db, orgId, board.athlete_ids ?? [])
      : Promise.resolve(new Map<string, string>()),
  ]);

  const filterAthleteIds =
    groupIds.length > 0 ? await fetchGroupAthleteIds(db, orgId, groupIds) : null;
  const ranking = filterAthleteIds
    ? fullRanking.filter((row) => filterAthleteIds.includes(row.athlete_id))
    : fullRanking;

  const metric = catalogue.find((m) => m.key === board.metric_key);
  const decimals = metricDecimals(metric);
  const selectedNames =
    board.population_type === 'selected'
      ? (board.athlete_ids ?? [])
          .map((id) => selectedNamesById.get(id))
          .filter((n): n is string => !!n)
      : null;

  const windowLabel =
    board.window_type === 'days'
      ? `last ${board.window_days} days`
      : board.window_type === 'season'
        ? 'this season'
        : 'all time';

  const rows = ranking.map((row) => ({
    position: `${row.is_tied ? '=' : ''}${row.position}`,
    first_name: row.first_name,
    last_name: row.last_name,
    value: formatNumber(row.value, decimals),
    record_count: row.record_count,
  }));

  const csv = toCsv(rows, [
    ['position', 'Position'],
    ['first_name', 'First name'],
    ['last_name', 'Last name'],
    // The unit belongs in the header, not repeated on every cell — a spreadsheet
    // column of "9868 m" is text and will not sum; a column of 9868 is a number.
    ['value', `${metric?.label ?? board.metric_key}${metric?.unit ? ` (${metric.unit.trim()})` : ''}`],
    ['record_count', 'Records'],
  ]);

  const caption =
    `# ${board.name} — ${metric?.label ?? board.metric_key}, ${board.aggregation}, ${windowLabel}.\r\n` +
    `# Population: ${populationLabel(board, selectedNames)}. Scope shown: ${groupScopeLabel(groups, groupIds)}` +
    (groupIds.length > 0
      ? ` (${ranking.length} of ${fullRanking.length} ranked athletes; positions are squad-wide).`
      : ` (${ranking.length} ranked).`) +
    `\r\n# Athletes who opted out or did not qualify are not listed, and are not distinguished from each other.\r\n\r\n`;

  const actorRole = actingRole(claims.roles);
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'leaderboard',
    { leaderboard_id: board.id, metric_key: board.metric_key, group_ids: groupIds, format: 'csv' },
    'export',
  );

  // The board's own name in the filename, not a fixed 'leaderboard.csv': a coach
  // downloading three boards in a row must be able to tell them apart in Downloads.
  const slug = board.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';
  return csvResponse(caption + csv, `${slug}-leaderboard.csv`);
}
