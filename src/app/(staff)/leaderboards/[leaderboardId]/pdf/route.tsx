import { notFound } from 'next/navigation';
import { renderToBuffer } from '@react-pdf/renderer';
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
import { formatDate, formatNumber, todayIso } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { premiumOnlyResponse, requireStaff } from '@/lib/session';
import { isUuid } from '@/lib/uuid';
import { isPremium } from '@/lib/tier';
import type { AppRole } from '@/lib/types/database';

/** The "print" half of the coach's request. A real PDF through lib/pdf.tsx and
 *  @react-pdf/renderer — the same pipeline all five reports use — rather than a print
 *  stylesheet over the live page.
 *
 *  Why a PDF and not window.print(): a printed board is a thing that gets pinned to a
 *  wall and photographed, so it needs to carry its own context (which metric, which
 *  aggregation, which window, which population, whose club, generated when) and the
 *  same "not for redistribution" footer every other export here carries. window.print()
 *  renders whatever happens to be on screen — sidebar, filter chips, action buttons and
 *  all — and the components/PrintButton component that does exactly that already exists
 *  for the two boards (availability, dashboard) where printing the live screen IS the
 *  workflow. This is not that: a leaderboard leaving the building is a named-athlete
 *  disclosure, and it should look like one.
 *
 *  Served as an attachment, exactly like every other pdfResponse in this app — the
 *  browser saves it, the coach opens it and prints from their own viewer. Serving it
 *  inline so the print dialog is one step closer was considered and not done: it would
 *  mean a second, divergent copy of pdfResponse, and the Content-Disposition of a
 *  named-athlete export is not a good place for this route to be the odd one out.
 *
 *  Same three borrowings from the board page as the CSV route beside this one — the
 *  hand-written admin refusal, the sticky group filter, metricDecimals — for the same
 *  reasons; see that file's header. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leaderboardId: string }> },
) {
  const { leaderboardId } = await params;
  const { db, orgId, orgName, claims, timezone, tier } = await requireStaff();
  /* Shape-check the route param before it reaches a query. Authenticated
     first, so this never becomes a probe; then 404 rather than 500, because a
     malformed id is a URL that does not name anything, not a server fault. */
  if (!isUuid(leaderboardId)) notFound();


  if (!claims.roles.includes('coach') && !claims.roles.includes('medical')) {
    return new Response('A board ranking is named-athlete data and is not part of this role.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

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
  const unit = metric?.unit ?? '';
  const selectedNames =
    board.population_type === 'selected'
      ? (board.athlete_ids ?? [])
          .map((id) => selectedNamesById.get(id))
          .filter((n): n is string => !!n)
      : null;

  const windowLabel =
    board.window_type === 'days'
      ? `Last ${board.window_days} days`
      : board.window_type === 'season'
        ? 'This season'
        : 'All time';

  const scopeLabel = groupScopeLabel(groups, groupIds);
  const leader = ranking[0] ?? null;

  const buffer = await renderToBuffer(
    <PdfReport
      footer={`${orgName} · Fydr · generated ${formatDate(todayIso(timezone), timezone)} · not for redistribution without the club's own policy`}
    >
      <PdfHeader
        eyebrow={`Leaderboard · ${orgName}`}
        title={board.name}
        meta={`${metric?.label ?? board.metric_key} · ${board.aggregation} · ${windowLabel.toLowerCase()} · ${populationLabel(board, selectedNames)}${groupIds.length > 0 ? ` · shown: ${scopeLabel}` : ''}`}
      />

      <PdfTileRow>
        <PdfTile label="Ranked" value={String(ranking.length)} />
        <PdfTile
          label="Leader"
          value={leader ? `${leader.first_name} ${leader.last_name}` : '—'}
        />
        <PdfTile
          label={metric?.label ?? 'Top value'}
          value={leader ? `${formatNumber(leader.value, decimals)}${unit}` : '—'}
        />
      </PdfTileRow>

      <PdfSectionTitle
        title="Ranking"
        caption={
          groupIds.length > 0
            ? `${ranking.length} of ${fullRanking.length} ranked athletes, narrowed to ${scopeLabel}. Positions are squad-wide, not positions within this filter.`
            : 'Athletes who opted out or did not qualify are not listed, and are not distinguished from each other.'
        }
      />
      <PdfTable
        emptyText={
          fullRanking.length === 0
            ? `Not enough results to rank. This board needs at least ${metric?.min_population ?? 3} athletes with a qualifying result.`
            : `No athletes in the current scope (${scopeLabel}) appear on this board.`
        }
        rows={ranking}
        columns={[
          {
            key: 'position',
            label: '#',
            width: '10%',
            render: (r) => `${r.is_tied ? '=' : ''}${r.position}`,
          },
          { key: 'name', label: 'Athlete', width: '55%', render: (r) => `${r.first_name} ${r.last_name}` },
          {
            key: 'records',
            label: 'Records',
            width: '15%',
            align: 'right',
            render: (r) => String(r.record_count),
          },
          {
            key: 'value',
            label: metric?.label ?? 'Value',
            width: '20%',
            align: 'right',
            render: (r) => `${formatNumber(r.value, decimals)}${unit}`,
          },
        ]}
      />
    </PdfReport>,
  );

  const actorRole = (claims.roles.includes('medical') ? 'medical' : 'coach') as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'leaderboard',
    { leaderboard_id: board.id, metric_key: board.metric_key, group_ids: groupIds, format: 'pdf' },
    'export',
  );

  const slug = board.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';
  return pdfResponse(buffer, `${slug}-leaderboard.pdf`);
}
