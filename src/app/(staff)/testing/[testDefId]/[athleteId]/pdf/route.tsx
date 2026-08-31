import { Fragment } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { computeTestBestsBySide, fetchHistory, fetchTestDefinitions } from '@/lib/queries/testing';
import { fetchCurrentSeason } from '@/lib/queries/schedule';
import { recordReportView } from '@/lib/queries/reports';
import { formatDate, formatNumber, todayIso } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireStaff } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** One athlete's testing report as a PDF, using the same lib/pdf.tsx
 *  primitives as the other five report PDFs — no new dependency, and the
 *  same "not for redistribution" footer they all carry.
 *
 *  requireStaff, not requireReportAccess, for the reason the sibling CSV
 *  route's header gives: this must gate exactly as the page it renders.
 *
 *  The three bests are PdfTiles rather than table rows because that is what
 *  PdfTileRow exists for, and it matches how the squad testing PDF presents
 *  its median/Q1/Q3 trio. */
/* `_request` is unread — see the sibling export route's note: both ids come
 * from the path and no group filter is resolved here, so there is no query
 * string to read. The parameter stays because params arrive positionally. */
export async function GET(_request: Request, { params }: { params: Promise<{ testDefId: string; athleteId: string }> }) {
  const { testDefId, athleteId } = await params;
  const { db, orgId, orgName, claims, timezone } = await requireStaff();

  const [definitions, history, athleteRes, season] = await Promise.all([
    fetchTestDefinitions(db, orgId),
    fetchHistory(db, orgId, athleteId, testDefId),
    db.from('athletes').select('first_name, last_name').eq('org_id', orgId).eq('id', athleteId).maybeSingle(),
    fetchCurrentSeason(db, orgId),
  ]);

  const definition = definitions.find((d) => d.id === testDefId);
  if (!definition || !athleteRes.data) return new Response('Not found', { status: 404 });

  const athleteName = `${athleteRes.data.first_name} ${athleteRes.data.last_name}`;
  // Per side — see computeTestBestsBySide. A per_side test prints one labelled
  // tile row per side; a bilateral test prints the single unlabelled row it
  // always did.
  const bestsBySide = computeTestBestsBySide(history, definition, season);
  const dp = definition.decimal_places;
  const withUnit = (v: number | null) => (v === null ? '—' : `${formatNumber(v, dp)} ${definition.unit}`.trim());

  // Positive is already improvement-signed by computeTestBests — the tone
  // must not re-apply higher_is_better here or a faster sprint would print red.
  const trendTone = (pct: number | null) => (pct === null ? undefined : pct > 0 ? ('good' as const) : pct < 0 ? ('bad' as const) : undefined);

  const buffer = await renderToBuffer(
    <PdfReport
      footer={`${orgName} · Fydr · generated ${formatDate(todayIso(timezone), timezone)} · not for redistribution without the club's own policy`}
    >
      <PdfHeader
        eyebrow={`Testing · ${orgName}`}
        title={`${athleteName} — ${definition.name}`}
        meta={`${definition.unit ? `${definition.unit} · ` : ''}${definition.higher_is_better ? 'Higher is better' : 'Lower is better'} · ${history.length} attempts recorded`}
      />

      {bestsBySide.map(({ side, label, bests }) => (
        <Fragment key={side ?? 'none'}>
          <PdfSectionTitle
            title={label ? `Bests · ${label}` : 'Bests'}
            caption={
              (bests.trendPct === null
                ? 'Season trend needs a current season, a result inside it, and a result before it.'
                : `Season trend is this season's best against their best from before ${season?.name ?? 'the season'}; positive is an improvement.`) +
              // Separate from the trend, not derived from it: a first season has
              // no trend and can still be a lifetime best, and equalling an old
              // mark reads 0.0% and is not a PB.
              (bests.seasonIsNewAllTimeBest ? ' New lifetime best set this season.' : '')
            }
          />
          <PdfTileRow>
            <PdfTile label={season ? `Season's best · ${season.name}` : "Season's best"} value={withUnit(bests.seasonValue)} />
            <PdfTile label="All-time best" value={withUnit(bests.allTimeValue)} />
            <PdfTile
              label="Season trend"
              value={bests.trendPct === null ? '—' : `${bests.trendPct > 0 ? '+' : ''}${bests.trendPct.toFixed(1)}%`}
              tone={trendTone(bests.trendPct)}
            />
          </PdfTileRow>
        </Fragment>
      ))}

      <PdfSectionTitle title="History" caption="Every attempt, most recent first. ★ marks the best of that session." />
      <PdfTable
        emptyText="No results logged yet."
        rows={history}
        columns={[
          { key: 'date', label: 'Date', width: '24%', render: (r) => formatDate(r.test_date, timezone) },
          { key: 'attempt', label: 'Attempt', width: '16%', render: (r) => String(r.attempt_number) },
          { key: 'side', label: 'Side', width: '14%', render: (r) => r.side ?? '' },
          { key: 'value', label: 'Value', width: '26%', align: 'right', render: (r) => `${formatNumber(r.value, dp)} ${definition.unit}`.trim() },
          { key: 'best', label: 'Best', width: '20%', render: (r) => (r.is_best ? (r.is_best_manual ? '★ manual' : '★') : '') },
        ]}
      />
    </PdfReport>,
  );

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'testing-athlete',
    { athlete_id: athleteId, test_definition_id: testDefId, format: 'pdf' },
    'export',
  );

  const slug = athleteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return pdfResponse(buffer, `${slug}-${definition.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}
