import { renderToBuffer } from '@react-pdf/renderer';
import { complianceAthletePct, fetchComplianceReport, fetchLatestComplianceExpectationDate, recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, enumLabel, formatDate, todayIso } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

const PERIODS = [7, 14, 28] as const;

/** lib/pdf.tsx has the "this was actually buildable" story. Second report
 *  to get a PDF, after Squad weekly proved the pattern — same numbers as
 *  the on-screen report and the CSV export. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the PDF resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // header meta names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const days = PERIODS.includes(Number(url.searchParams.get('days')) as (typeof PERIODS)[number]) ? Number(url.searchParams.get('days')) : 7;
  // Same ?to= the on-screen report's window picker sets (default: the most
  // recent day with data, not real today — audit analysis finding 14), so
  // an exported file matches whatever window the coach was actually
  // looking at.
  const toParam = url.searchParams.get('to');
  const realToday = todayIso(timezone);
  const today =
    toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)
      ? toParam > realToday
        ? realToday
        : toParam
      : (await fetchLatestComplianceExpectationDate(db, orgId, groupIds)) ?? realToday;
  const fromDate = addDays(today, -(days - 1));

  const [groups, report] = await Promise.all([fetchGroups(db, orgId), fetchComplianceReport(db, orgId, groupIds, fromDate, today)]);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(today, timezone)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Compliance · ${orgName}`}
        title="Compliance report"
        meta={`${formatDate(fromDate, timezone)} to ${formatDate(today, timezone)} · Scope: ${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athletes)`}
      />

      <PdfTileRow>
        {report.summary.map((s) => (
          <PdfTile key={s.domain} label={enumLabel(s.domain)} value={s.pct === null ? '—' : `${s.pct}%`} />
        ))}
      </PdfTileRow>

      <PdfSectionTitle
        title="By athlete"
        caption="Worst first — athletes who still have something to chase come before anyone fully waived out of this window."
      />
      <PdfTable
        emptyText="No athletes in this filter."
        rows={report.byAthlete.map((a) => ({ ...a, pct: complianceAthletePct(a) }))}
        columns={[
          { key: 'name', label: 'Athlete', width: '35%', render: (r) => `${r.first_name} ${r.last_name}` },
          { key: 'last', label: 'Last submission', width: '30%', render: (r) => (r.lastSubmission ? formatDate(r.lastSubmission, timezone) : 'No submissions') },
          {
            key: 'pct',
            label: 'Compliance',
            width: '35%',
            align: 'right',
            render: (r) => (r.pct === null ? (r.waivedCount > 0 ? `Waived (${r.waivedCount})` : '—') : `${r.pct}%`),
          },
        ]}
      />

      <PdfSectionTitle title="By day and domain" caption="Squad-wide totals per day and domain, not the full athlete-by-day grid." />
      <PdfTable
        emptyText="No expectations in this period."
        rows={report.byDay}
        columns={[
          { key: 'date', label: 'Date', width: '30%', render: (r) => formatDate(r.date, timezone) },
          { key: 'domain', label: 'Domain', width: '30%', render: (r) => enumLabel(r.domain) },
          {
            key: 'val',
            label: 'Submitted / expected',
            width: '40%',
            align: 'right',
            render: (r) => `${r.submitted}/${r.expected}${r.waived > 0 ? ` (+${r.waived} waived)` : ''}`,
          },
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
    'compliance',
    { from: fromDate, to: today, group_ids: groupIds, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `compliance-${fromDate}-to-${today}.pdf`);
}
