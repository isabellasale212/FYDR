import { renderToBuffer } from '@react-pdf/renderer';
import { fetchComplianceReport, recordReportView } from '@/lib/queries/reports';
import { parseGroupParam } from '@/lib/groupFilter';
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
  const groupIds = parseGroupParam(url.searchParams.get('groups') ?? undefined);
  const days = PERIODS.includes(Number(url.searchParams.get('days')) as (typeof PERIODS)[number]) ? Number(url.searchParams.get('days')) : 7;

  const today = todayIso(timezone);
  const fromDate = addDays(today, -(days - 1));

  const report = await fetchComplianceReport(db, orgId, groupIds, fromDate, today);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(today)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Compliance · ${orgName}`}
        title="Compliance report"
        meta={`${formatDate(fromDate)} to ${formatDate(today)} · ${report.athleteCount} athletes`}
      />

      <PdfTileRow>
        {report.summary.map((s) => (
          <PdfTile key={s.domain} label={enumLabel(s.domain)} value={s.pct === null ? '—' : `${s.pct}%`} />
        ))}
      </PdfTileRow>

      <PdfSectionTitle title="By athlete" caption="Worst first isn't applied here — see the on-screen report for sorted order; this table follows the roster." />
      <PdfTable
        emptyText="No athletes in this filter."
        rows={report.byAthlete.map((a) => {
          let expected = 0;
          let submitted = 0;
          for (const v of Object.values(a.perDomain)) {
            expected += v.expected;
            submitted += v.submitted;
          }
          const pct = expected > 0 ? Math.round((100 * submitted) / expected) : null;
          return { ...a, pct };
        })}
        columns={[
          { key: 'name', label: 'Athlete', width: '40%', render: (r) => `${r.first_name} ${r.last_name}` },
          { key: 'last', label: 'Last submission', width: '30%', render: (r) => (r.lastSubmission ? formatDate(r.lastSubmission) : 'No submissions') },
          { key: 'pct', label: 'Compliance', width: '30%', align: 'right', render: (r) => (r.pct === null ? '—' : `${r.pct}%`) },
        ]}
      />

      <PdfSectionTitle title="By day and domain" caption="Squad-wide totals per day and domain, not the full athlete-by-day grid." />
      <PdfTable
        emptyText="No expectations in this period."
        rows={report.byDay}
        columns={[
          { key: 'date', label: 'Date', width: '30%', render: (r) => formatDate(r.date) },
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
