import { notFound } from 'next/navigation';
import { renderToBuffer } from '@react-pdf/renderer';
import { acwrSuppressedLabel } from '@/lib/acwr';
import { fetchAthleteReport } from '@/lib/queries/athleteReport';
import { recordReportView } from '@/lib/queries/reports';
import { enumLabel, formatDate, formatNumber } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReport } from '@/lib/session';
import { isUuid } from '@/lib/uuid';
import { isPremium } from '@/lib/tier';
import type { AppRole } from '@/lib/types/database';
import { ACWR_WINDOW_CAPTION, periodCaveat, periodParamsFromUrl, resolveAthletePeriod } from '../period';

/** lib/pdf.tsx has the "this was actually buildable" story. Fourth report
 *  to get a PDF. No wellness chart — same "no charts" cut every PDF export
 *  in this build makes; the readiness band is screen-only rendering with no
 *  PDF equivalent worth inventing. */
export async function GET(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const { db, orgId, orgName, claims, timezone, tier } = await requireReport('athlete');
  /* Shape-check the route param before it reaches a query. Authenticated
     first, so this never becomes a probe; then 404 rather than 500, because a
     malformed id is a URL that does not name anything, not a server fault. */
  if (!isUuid(athleteId)) notFound();

  const url = new URL(request.url);

  /* Same module as the page and the CSV. A PDF is the worst place for a
   * silently substituted window: it is a document, handed to someone else,
   * with no control on it to check the figure against. */
  const period = await resolveAthletePeriod(db, orgId, athleteId, timezone, periodParamsFromUrl(url));
  const caveat = periodCaveat(period);

  const report = await fetchAthleteReport(db, orgId, athleteId, timezone, { from: period.from, to: period.to });
  if (!report) notFound();

  const { athlete, compliancePct, openFlags, currentProgrammes } = report.summary;
  const loadDaysWithValue = report.load.byDay.filter((d) => d.load !== null);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(report.to, timezone)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Athlete report · ${orgName}`}
        title={`${athlete.first_name} ${athlete.last_name}`}
        meta={`${athlete.position ?? ''} · ${period.label} · ${formatDate(report.from, timezone)} to ${formatDate(report.to, timezone)}${caveat ? ` · ${caveat}` : ''}`}
      />

      {/* The ACWR tile sits in a row headed by a period label, so its own
          fixed window is stated in the tile label AND spelled out underneath.
          On screen the coach can at least see the control; on a printed page
          handed to a director of rugby there is nothing else to read it
          against, and "ACWR" under "This season" invites exactly the wrong
          conclusion. The ratio is defined as trailing 7:28 (lib/acwr.ts) and
          no period selection changes it. */}
      <PdfTileRow>
        <PdfTile label="Compliance, this period" value={compliancePct === null ? '—' : `${compliancePct}%`} />
        <PdfTile label="Open flags" value={String(openFlags.length)} tone={openFlags.length > 0 ? 'warn' : undefined} />
        <PdfTile label="ACWR · trailing 7:28" value={report.load.acwr === null ? (report.load.suppressed ? acwrSuppressedLabel(report.load.daysWithData) : '—') : formatNumber(report.load.acwr, 2)} />
        <PdfTile label="Programme" value={currentProgrammes.length === 0 ? '—' : currentProgrammes.map((p) => p.name).join(', ')} />
      </PdfTileRow>

      <PdfSectionTitle title="How to read these figures" caption={ACWR_WINDOW_CAPTION} />

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

      {/* Same withholding as the screen this prints: GPS is Premium, the
          rest of the athlete report is not. A PDF is the version that leaves
          the building, so it must not carry a section the screen refuses. */}
      {isPremium(tier) ? (
        <>
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
        </>
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

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'athlete',
    { athlete_id: athleteId, from: report.from, to: report.to, period: period.key, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `athlete-report-${athlete.last_name.toLowerCase()}-${report.from}-to-${report.to}.pdf`);
}
