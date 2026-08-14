import { notFound } from 'next/navigation';
import { renderToBuffer } from '@react-pdf/renderer';
import { acwrSuppressedLabel } from '@/lib/acwr';
import { fetchAthleteReport } from '@/lib/queries/athleteReport';
import { recordReportView } from '@/lib/queries/reports';
import { enumLabel, formatDate, formatNumber } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

const PERIODS = [28, 90] as const;

/** lib/pdf.tsx has the "this was actually buildable" story. Fourth report
 *  to get a PDF. No wellness chart — same "no charts" cut every PDF export
 *  in this build makes; the readiness band is screen-only rendering with no
 *  PDF equivalent worth inventing. */
export async function GET(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const url = new URL(request.url);
  const days = PERIODS.includes(Number(url.searchParams.get('days')) as (typeof PERIODS)[number]) ? Number(url.searchParams.get('days')) : 28;

  const report = await fetchAthleteReport(db, orgId, athleteId, timezone, days);
  if (!report) notFound();

  const { athlete, compliancePct, openFlags, currentProgrammes } = report.summary;
  const loadDaysWithValue = report.load.byDay.filter((d) => d.load !== null);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(report.to, timezone)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Athlete report · ${orgName}`}
        title={`${athlete.first_name} ${athlete.last_name}`}
        meta={`${athlete.position ?? ''} · ${formatDate(report.from, timezone)} to ${formatDate(report.to, timezone)}`}
      />

      <PdfTileRow>
        <PdfTile label="Compliance, this period" value={compliancePct === null ? '—' : `${compliancePct}%`} />
        <PdfTile label="Open flags" value={String(openFlags.length)} tone={openFlags.length > 0 ? 'warn' : undefined} />
        <PdfTile label="ACWR" value={report.load.acwr === null ? (report.load.suppressed ? acwrSuppressedLabel(report.load.daysWithData) : '—') : formatNumber(report.load.acwr, 2)} />
        <PdfTile label="Programme" value={currentProgrammes.length === 0 ? '—' : currentProgrammes.map((p) => p.name).join(', ')} />
      </PdfTileRow>

      <PdfSectionTitle title="Open flags" />
      <PdfTable
        emptyText="No open flag for this athlete."
        rows={openFlags}
        columns={[
          { key: 'domain', label: 'Domain', width: '20%', render: (r) => enumLabel(r.domain) },
          { key: 'what', label: 'What', width: '50%', render: (r) => `${r.what} ${r.observed} vs ${r.expected}`.trim() },
          { key: 'severity', label: 'Severity', width: '15%', render: (r) => r.severity },
          { key: 'since', label: 'Since', width: '15%', render: (r) => formatDate(r.flag_date, timezone) },
        ]}
      />

      <PdfSectionTitle title="Session load by day" caption="Days with a recorded load only." />
      <PdfTable
        emptyText="No session load recorded in this period."
        rows={loadDaysWithValue}
        columns={[
          { key: 'date', label: 'Date', width: '50%', render: (r) => formatDate(r.date, timezone) },
          { key: 'load', label: 'Load', width: '50%', align: 'right', render: (r) => formatNumber(r.load, 0) },
        ]}
      />

      <PdfSectionTitle
        title="GPS, this period"
        caption={report.load.gps.sessionsWithData === 0 ? 'No GPS data for this athlete in this period.' : ''}
      />
      {report.load.gps.sessionsWithData > 0 ? (
        <PdfTileRow>
          <PdfTile label="Sessions with data" value={String(report.load.gps.sessionsWithData)} />
          <PdfTile label="Total distance" value={`${formatNumber(report.load.gps.totalDistanceM, 0)} m`} />
          <PdfTile label="High speed distance" value={`${formatNumber(report.load.gps.highSpeedDistanceM, 0)} m`} />
        </PdfTileRow>
      ) : null}

      <PdfSectionTitle title="Testing" caption="Latest and personal best per test." />
      <PdfTable
        emptyText="No test result recorded for this athlete."
        rows={report.gymAndTesting.tests}
        columns={[
          { key: 'name', label: 'Test', width: '30%', render: (r) => `${r.name} (${r.unit})` },
          { key: 'pb', label: 'PB', width: '20%', align: 'right', render: (r) => (r.pbValue === null ? '—' : formatNumber(r.pbValue, r.decimal_places)) },
          { key: 'pbDate', label: 'PB date', width: '15%', render: (r) => (r.pbDate ? formatDate(r.pbDate, timezone) : '') },
          {
            key: 'latest',
            label: 'Latest',
            width: '20%',
            align: 'right',
            render: (r) => (r.latestValue === null ? '—' : formatNumber(r.latestValue, r.decimal_places)),
          },
          { key: 'latestDate', label: 'Latest date', width: '15%', render: (r) => (r.latestDate ? formatDate(r.latestDate, timezone) : '') },
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
    'athlete',
    { athlete_id: athleteId, from: report.from, to: report.to, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `athlete-report-${athlete.last_name.toLowerCase()}-${report.from}-to-${report.to}.pdf`);
}
