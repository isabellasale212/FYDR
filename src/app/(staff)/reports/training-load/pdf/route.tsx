import { renderToBuffer } from '@react-pdf/renderer';
import { fetchTrainingLoadReport } from '@/lib/queries/trainingLoadReport';
import { recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, formatNumber, todayIso } from '@/lib/format';
import { resolveTrainingLoadPeriod, trainingLoadAnchor } from '../period';
import { periodParamsFromUrl } from '@/lib/reportPeriod.server';
import { PdfFigure, PdfHeader, PdfReport, PdfSectionTitle, PdfTable, pdfResponse } from '@/lib/pdf';
import { reportDefinition, TRAINING_LOAD_OFF_STATE } from '@/lib/reportCatalogue';
import { belowSquadFloor } from '@/lib/smallSample';
import { trainingLoadFigure } from '@/lib/reportFigureCards';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** The Training load report as a PDF — the same figure, the same ranked
 *  table, the definition under the title. For a club with session RPE off the
 *  page is the header and the off state: the destination stays, on paper too
 *  (docs/decisions/absence-rule.md). */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone, collectsRpe } = await requireReport('trainingLoad');
  const url = new URL(request.url);
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const groups = await fetchGroups(db, orgId);
  const scopeLabel = groupScopeLabel(groups, groupIds);
  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  const footer = `${orgName} · Fydr · generated ${formatDate(todayIso(timezone), timezone)} · not for redistribution without the club's own policy`;

  if (!collectsRpe) {
    const buffer = await renderToBuffer(
      <PdfReport footer={footer}>
        <PdfHeader eyebrow={`Training load · ${orgName}`} title="Training load report" definition={reportDefinition('trainingLoad') ?? undefined} meta={`Scope: ${scopeLabel}`} />
        <PdfSectionTitle title="Session RPE is off for this club" caption={TRAINING_LOAD_OFF_STATE} />
      </PdfReport>,
    );
    await recordReportView(db, orgId, claims.userId, actorRole, 'trainingLoad', { group_ids: groupIds, off: 'collects_rpe', format: 'pdf' }, 'export');
    return pdfResponse(buffer, 'training-load.pdf');
  }

  const realToday = todayIso(timezone);
  const anchor = await trainingLoadAnchor(db, orgId, groupIds, url.searchParams.get('to') ?? undefined, realToday);
  const period = await resolveTrainingLoadPeriod(db, orgId, anchor.to, periodParamsFromUrl(url));
  const fromDate = period.range.from;
  const today = anchor.to;
  const report = await fetchTrainingLoadReport(db, orgId, groupIds, fromDate, today);
  const withRating = report.rows.filter((r) => r.total_load !== null);

  const buffer = await renderToBuffer(
    <PdfReport footer={footer}>
      <PdfHeader
        eyebrow={`Training load · ${orgName}`}
        title="Training load report"
        definition={reportDefinition('trainingLoad') ?? undefined}
        meta={`${period.range.label} · ${formatDate(fromDate, timezone)} to ${formatDate(today, timezone)} · Scope: ${scopeLabel} (${report.athleteCount} athlete${report.athleteCount === 1 ? '' : 's'})`}
      />
      <PdfFigure
        {...trainingLoadFigure({ expected: report.expected, rated: report.rated, totalLoad: report.totalLoad, athleteCount: report.athleteCount, rangeLabel: period.range.label, floored: belowSquadFloor(withRating.length) })}
      />
      <PdfSectionTitle
        title="Load by athlete"
        caption={`Highest load first; athletes with no rating last. Load is in arbitrary units: the CR-10 rating (0 rest to 10 maximal) multiplied by the session's minutes. A session with no rating is not counted as zero. ${withRating.length} of ${report.athleteCount} athletes with a rating.`}
      />
      <PdfTable
        emptyText={report.athleteCount === 0 ? `No athletes in the current scope (${scopeLabel}).` : 'No session expected a rating in this period.'}
        rows={report.rows}
        columns={[
          { key: 'name', label: 'Athlete', width: '34%', render: (r) => `${r.first_name} ${r.last_name}` },
          { key: 'rated', label: 'Rated of expected', width: '18%', align: 'right', render: (r) => (r.expected === 0 ? 'Not expected' : `${r.rated} of ${r.expected}`) },
          { key: 'total', label: 'Total load (AU)', width: '16%', align: 'right', render: (r) => (r.total_load === null ? (r.expected === 0 ? 'Not expected' : 'No ratings') : formatNumber(r.total_load, 0)) },
          { key: 'mean', label: 'Per rated session', width: '16%', align: 'right', render: (r) => (r.mean_load === null ? '—' : formatNumber(r.mean_load, 0)) },
          { key: 'peak', label: 'Heaviest session', width: '16%', align: 'right', render: (r) => (r.peak_load === null ? '—' : formatNumber(r.peak_load, 0)) },
        ]}
      />
    </PdfReport>,
  );

  await recordReportView(db, orgId, claims.userId, actorRole, 'trainingLoad', { from: fromDate, to: today, period: period.key, group_ids: groupIds, format: 'pdf' }, 'export');
  return pdfResponse(buffer, `training-load-${fromDate}-to-${today}.pdf`);
}
