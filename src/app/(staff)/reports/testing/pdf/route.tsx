import { renderToBuffer } from '@react-pdf/renderer';
import { fetchTestByTest, fetchTestingByAthlete } from '@/lib/queries/testingReport';
import { recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, formatNumber, todayIso } from '@/lib/format';
import { resolveTestingPeriod, testingWindow } from '../period';
import { periodParamsFromUrl } from '@/lib/reportPeriod.server';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** lib/pdf.tsx has the "this was actually buildable" story. Fifth and last
 *  report to get a PDF — every report this build ships now has one. The
 *  "By athlete" grid can run wide with many tests; PdfTable's percentage
 *  widths shrink to fit rather than overflow the page, same trade-off the
 *  on-screen table's own horizontal scroll makes differently. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireReport('testing');
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the PDF resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // header meta names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);

  // Same period resolution as the page and the CSV. A PDF is the artefact most
  // likely to outlive the session that made it, so the window it covers is
  // resolved from the same place and then printed on it (header meta and the
  // page footer), never left implicit.
  const period = await resolveTestingPeriod(db, orgId, timezone, periodParamsFromUrl(url));
  const reportWindow = testingWindow(period);

  const [groups, byAthlete] = await Promise.all([fetchGroups(db, orgId), fetchTestingByAthlete(db, orgId, groupIds, reportWindow)]);
  const scopeLabel = groupScopeLabel(groups, groupIds);
  const requestedTestId = url.searchParams.get('test');
  const selectedTestId = byAthlete.definitions.find((d) => d.id === requestedTestId)?.id ?? byAthlete.definitions[0]?.id ?? null;
  const byTest = selectedTestId ? await fetchTestByTest(db, orgId, groupIds, selectedTestId, reportWindow) : null;

  const athleteColWidth = `${Math.max(20, 100 - byAthlete.definitions.length * 15)}%`;
  const testColWidth = byAthlete.definitions.length > 0 ? `${Math.min(15, 80 / byAthlete.definitions.length)}%` : '15%';

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(todayIso(timezone), timezone)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Testing · ${orgName}`}
        title="Testing report"
        meta={`${period.range.label} · ${formatDate(reportWindow.from, timezone)} to ${formatDate(reportWindow.to, timezone)} · Scope: ${scopeLabel} (${byAthlete.rows.length} athletes) · ${byAthlete.definitions.length} tests`}
      />

      <PdfSectionTitle
        title="By athlete"
        caption={`Every athlete, every test, best result between ${formatDate(reportWindow.from, timezone)} and ${formatDate(reportWindow.to, timezone)}.`}
      />
      <PdfTable
        emptyText={groupIds.length > 0 ? `No athletes in the current scope (${scopeLabel}).` : 'No athletes in this squad yet.'}
        rows={byAthlete.rows}
        columns={[
          { key: 'name', label: 'Athlete', width: athleteColWidth, render: (r) => r.name },
          ...byAthlete.definitions.map((d) => ({
            key: d.id,
            label: d.name,
            width: testColWidth,
            align: 'right' as const,
            render: (r: (typeof byAthlete.rows)[number]) => {
              const cell = r.cells.get(d.id);
              return cell?.value === null || cell?.value === undefined ? '—' : formatNumber(cell.value, d.decimal_places);
            },
          })),
        ]}
      />

      {byTest ? (
        <>
          <PdfSectionTitle title={`${byTest.definition.name} — ranked`} caption={`Best attempt per athlete in ${period.range.label.toLowerCase()}.`} />
          <PdfTileRow>
            <PdfTile label="Median" value={byTest.median === null ? '—' : `${formatNumber(byTest.median, byTest.definition.decimal_places)} ${byTest.definition.unit}`} />
            <PdfTile label="Q1" value={byTest.q1 === null ? '—' : formatNumber(byTest.q1, byTest.definition.decimal_places)} />
            <PdfTile label="Q3" value={byTest.q3 === null ? '—' : formatNumber(byTest.q3, byTest.definition.decimal_places)} />
          </PdfTileRow>
          <PdfTable
            emptyText={`No result recorded for this test in ${period.range.label.toLowerCase()}, in this filter.`}
            rows={byTest.rows}
            columns={[
              { key: 'rank', label: 'Rank', width: '10%', render: (r) => String(r.rank) },
              { key: 'name', label: 'Athlete', width: '50%', render: (r) => r.name },
              { key: 'side', label: 'Side', width: '15%', render: (r) => r.side ?? '' },
              { key: 'value', label: 'Value', width: '25%', align: 'right', render: (r) => `${formatNumber(r.value, byTest.definition.decimal_places)} ${byTest.definition.unit}` },
            ]}
          />
        </>
      ) : null}
    </PdfReport>,
  );

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'testing',
    { group_ids: groupIds, test_definition_id: selectedTestId, period: period.key, from: reportWindow.from, to: reportWindow.to, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `testing-report-${reportWindow.from}-to-${reportWindow.to}.pdf`);
}
