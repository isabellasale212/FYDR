import { renderToBuffer } from '@react-pdf/renderer';
import { fetchInjuryAvailabilityReport, recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { enumLabel, formatDate } from '@/lib/format';
import { PdfHeader, PdfMedicalBanner, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { periodCaveat, periodParamsFromUrl, resolveInjuryPeriod } from '../period';

/** lib/pdf.tsx has the "this was actually buildable" story. Third report
 *  to get a PDF. The coach and medical versions are two different reads,
 *  not one PDF with a field hidden — same discipline the page and the CSV
 *  export already hold: isMedical gates which fields
 *  fetchInjuryAvailabilityReport even reads, before this file ever sees
 *  them. screens/reports.md's own rule for the medical version: a banner on
 *  every page, in the header and footer, and the filename states it — all
 *  three are here, not just the on-screen note the page itself carries. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const isMedical = claims.roles.includes('medical');
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: a PDF handed to someone else is
  // the exact artefact the audit's S4 finding warned about — it must resolve
  // the sticky filter cookie exactly as the on-screen report does, and its
  // header meta names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);

  /* Resolved through the same module as the page and the CSV. A PDF that
   * meets `?period=season` and quietly falls back to its own 28-day default
   * is the worst version of this failure — it is a document, handed to
   * someone else, with a wrong window and nothing on it that says so. */
  const period = await resolveInjuryPeriod(db, orgId, timezone, periodParamsFromUrl(url));
  const fromDate = period.from;
  const today = period.to;
  const caveat = periodCaveat(period);

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchInjuryAvailabilityReport(db, orgId, groupIds, fromDate, today, isMedical),
  ]);
  const scopeLabel = groupScopeLabel(groups, groupIds);

  const footer = isMedical
    ? `MEDICAL IN CONFIDENCE · ${orgName} · Fydr · generated ${formatDate(today, timezone)}`
    : `${orgName} · Fydr · generated ${formatDate(today, timezone)} · not for redistribution without the club's own policy`;

  const buffer = await renderToBuffer(
    <PdfReport footer={footer}>
      {isMedical ? <PdfMedicalBanner /> : null}
      <PdfHeader
        eyebrow={isMedical ? `MEDICAL IN CONFIDENCE · Injury & availability · ${orgName}` : `Injury & availability · ${orgName}`}
        title="Injury & availability report"
        meta={`${period.label} · ${formatDate(fromDate, timezone)} to ${formatDate(today, timezone)} · Scope: ${scopeLabel} (${report.summary.athleteCount} athletes)${caveat ? ` · ${caveat}` : ''}`}
      />

      <PdfTileRow>
        <PdfTile label="New injuries" value={String(report.summary.newInjuries)} />
        <PdfTile label="Athlete-days lost" value={String(report.summary.daysLost)} />
        <PdfTile label="Availability" value={report.summary.availabilityPct === null ? '—' : `${report.summary.availabilityPct}%`} />
      </PdfTileRow>

      {isMedical && report.clinical ? (
        <>
          <PdfSectionTitle title="New injuries by body area" />
          <PdfTable
            emptyText="None in this period."
            rows={report.clinical.byBodyAreaOfNewInjuries}
            columns={[
              { key: 'area', label: 'Body area', width: '70%', render: (r) => enumLabel(r.bodyArea) },
              { key: 'count', label: 'Count', width: '30%', align: 'right', render: (r) => String(r.count) },
            ]}
          />
        </>
      ) : null}

      <PdfSectionTitle title="Current" caption="Availability status right now, not a historical snapshot for this period." />
      <PdfTable
        emptyText={
          // Never make the categorical claim over a filtered subset — the
          // audit's worst S4 case (analysis finding 27).
          groupIds.length > 0
            ? `No unavailable or modified athletes in the current scope (${scopeLabel}).`
            : 'Everyone is available.'
        }
        rows={report.current}
        columns={[
          { key: 'name', label: 'Athlete', width: '30%', render: (r) => r.name },
          { key: 'status', label: 'Status', width: '20%', render: (r) => enumLabel(r.status) },
          {
            key: 'detail',
            label: 'Detail',
            width: '30%',
            render: (r) => (r.body_area ? enumLabel(r.body_area) : r.restrictions.map(enumLabel).join(', ') || 'Restricted'),
          },
          { key: 'return', label: 'Expected return', width: '20%', render: (r) => (r.expected_return ? formatDate(r.expected_return, timezone) : '') },
        ]}
      />

      <PdfSectionTitle title="Burden" caption="Athlete-days lost by week." />
      <PdfTable
        emptyText="No days lost in this period."
        rows={report.burden}
        columns={[
          { key: 'week', label: 'Week of', width: '60%', render: (r) => formatDate(r.weekStart, timezone) },
          { key: 'days', label: 'Days lost', width: '40%', align: 'right', render: (r) => String(r.daysLost) },
        ]}
      />
    </PdfReport>,
  );

  const actorRole = (isMedical ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'injury_availability',
    { from: fromDate, to: today, period: period.key, group_ids: groupIds, medical: isMedical, format: 'pdf' },
    'export',
  );

  const filename = isMedical
    ? `injury-availability-medical-in-confidence-${fromDate}-to-${today}.pdf`
    : `injury-availability-${fromDate}-to-${today}.pdf`;

  return pdfResponse(buffer, filename);
}
