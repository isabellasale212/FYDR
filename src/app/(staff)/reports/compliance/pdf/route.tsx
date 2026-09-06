import { renderToBuffer } from '@react-pdf/renderer';
import { complianceAthletePct, fetchComplianceReport, recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { enumLabel, formatDate, todayIso } from '@/lib/format';
import { complianceAnchor, resolveCompliancePeriod } from '../period';
import { periodParamsFromUrl } from '@/lib/reportPeriod.server';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** lib/pdf.tsx has the "this was actually buildable" story. Second report
 *  to get a PDF, after Squad weekly proved the pattern — same numbers as
 *  the on-screen report and the CSV export.
 *
 *  "Same numbers" is now enforced rather than asserted: the local
 *  `PERIODS = [7, 14, 28]` this file used to carry was the third of three
 *  copies of the same allow-list, and the first one to fall out of step would
 *  have handed a coach a PDF covering a different window than the screen they
 *  clicked it from, with the header meta stating the wrong window confidently.
 *  All three surfaces now resolve through resolveReportPeriod. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireReport('compliance');
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the PDF resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // header meta names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const realToday = todayIso(timezone);
  // Same ?to= day anchor the on-screen report uses (default: the most recent
  // day with data, not real today — audit analysis finding 14), so an exported
  // file matches the window the coach was actually looking at. `?to=` and
  // `?period=` stay orthogonal here exactly as they do on the page.
  const anchor = await complianceAnchor(db, orgId, groupIds, url.searchParams.get('to') ?? undefined, realToday);
  const today = anchor.to;
  const period = await resolveCompliancePeriod(db, orgId, today, periodParamsFromUrl(url));
  const fromDate = period.range.from;

  const [groups, report] = await Promise.all([fetchGroups(db, orgId), fetchComplianceReport(db, orgId, groupIds, fromDate, today)]);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(today, timezone)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Compliance · ${orgName}`}
        title="Compliance report"
        meta={`${period.range.label} · ${formatDate(fromDate, timezone)} to ${formatDate(today, timezone)} · Scope: ${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athletes)`}
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

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'compliance',
    { from: fromDate, to: today, period: period.key, group_ids: groupIds, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `compliance-${fromDate}-to-${today}.pdf`);
}
