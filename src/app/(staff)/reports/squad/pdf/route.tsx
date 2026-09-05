import { renderToBuffer } from '@react-pdf/renderer';
import { ACWR_BAND_TEXT, acwrInsufficiencyNote, acwrSquadHeadline, acwrSuppressedLabel } from '@/lib/acwr';
import { fetchSquadWeeklyReport } from '@/lib/queries/squadWeeklyReport';
import { recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, formatNumber } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** lib/pdf.tsx has the full "this was actually buildable" story. Squad
 *  weekly first because its own name is the exact document a coach wants a
 *  PDF of — "the week in one document" — for a Monday meeting, per its own
 *  page's caption. Same numbers as the on-screen report and the CSV export;
 *  a printed page is a rendering, not a third calculation. Real JSX built
 *  only from @react-pdf/renderer's own primitives (View, Text, and the
 *  small wrappers in lib/pdf.tsx) — its custom reconciler has no host
 *  config for a plain HTML tag, so this file never reaches for one. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the PDF resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // header meta names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  // Same ?to= the on-screen report's week nav sets, so an exported file
  // matches whatever week the coach was actually looking at (audit B4).
  const toParam = url.searchParams.get('to');
  const endDate = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : undefined;

  const [groups, report] = await Promise.all([fetchGroups(db, orgId), fetchSquadWeeklyReport(db, orgId, groupIds, timezone, endDate)]);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(report.to, timezone)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Squad weekly · ${orgName}`}
        title="Squad weekly report"
        meta={`${formatDate(report.from, timezone)} to ${formatDate(report.to, timezone)} · Scope: ${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athletes)`}
      />

      <PdfTileRow>
        <PdfTile label="Compliance, this week" value={report.tiles.compliancePct === null ? '—' : `${report.tiles.compliancePct}%`} />
        <PdfTile label="Available today" value={report.tiles.availablePct === null ? '—' : `${report.tiles.availablePct}%`} />
        <PdfTile label="Open flags" value={String(report.tiles.openFlagCount)} tone={report.tiles.openFlagCount > 0 ? 'warn' : undefined} />
        <PdfTile
          label={`ACWR outside ${ACWR_BAND_TEXT} (${acwrSquadHeadline(report.tiles.acwr.outsideBand, report.tiles.acwr.computable, report.tiles.acwr.suppressed)})`}
          value={report.tiles.acwr.computable === 0 ? '—' : String(report.tiles.acwr.outsideBand)}
          tone={report.tiles.acwr.outsideBand > 0 ? 'bad' : undefined}
        />
      </PdfTileRow>

      <PdfSectionTitle title="Needing attention" caption="Each against the athlete's own baseline, ranked by severity." />
      <PdfTable
        emptyText="Nothing is asking for attention."
        rows={report.attention}
        columns={[
          { key: 'name', label: 'Athlete', width: '30%', render: (r) => r.name },
          { key: 'what', label: 'What', width: '45%', render: (r) => `${r.what} ${r.value} vs ${r.baseline}`.trim() },
          { key: 'severity', label: 'Severity', width: '15%', render: (r) => r.severity },
          { key: 'duration', label: 'Since', width: '10%', render: (r) => r.duration },
        ]}
      />

      <PdfSectionTitle
        title="Load, weekly per athlete"
        caption={`ACWR distribution, worst first. ${ACWR_BAND_TEXT} is the descriptive band used everywhere the ratio appears; the flag rule itself is set on the Thresholds screen. ${acwrInsufficiencyNote()}`}
      />
      <PdfTable
        emptyText="No athlete in this filter."
        rows={report.load}
        columns={[
          { key: 'name', label: 'Athlete', width: '40%', render: (r) => `${r.first_name} ${r.last_name}` },
          { key: 'acute', label: 'Acute', width: '20%', align: 'right', render: (r) => (r.acute === null ? '—' : formatNumber(r.acute, 0)) },
          { key: 'chronic', label: 'Chronic', width: '20%', align: 'right', render: (r) => (r.chronic === null ? '—' : formatNumber(r.chronic, 0)) },
          {
            key: 'acwr',
            label: 'ACWR',
            width: '20%',
            align: 'right',
            render: (r) => (r.acwr === null ? (r.suppressed ? acwrSuppressedLabel(r.days_with_data) : '—') : formatNumber(r.acwr, 2)),
          },
        ]}
      />

      <PdfSectionTitle title="Availability" />
      <PdfTable
        emptyText="Everyone in this filter is fully available."
        rows={report.availability}
        columns={[
          { key: 'name', label: 'Athlete', width: '35%', render: (r) => r.name },
          { key: 'status', label: 'Status', width: '20%', render: (r) => r.status },
          { key: 'body_area', label: 'Body area', width: '25%', render: (r) => r.body_area ?? '' },
          { key: 'return', label: 'Expected return', width: '20%', render: (r) => r.expected_return ?? '' },
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
    'squad_weekly',
    { from: report.from, to: report.to, group_ids: groupIds, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `squad-weekly-${report.from}-to-${report.to}.pdf`);
}
