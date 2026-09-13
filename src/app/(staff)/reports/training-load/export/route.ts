import { csvResponse, toCsv } from '@/lib/csv';
import { fetchTrainingLoadReport } from '@/lib/queries/trainingLoadReport';
import { recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDateTime, formatNumber, todayIso } from '@/lib/format';
import { resolveTrainingLoadPeriod, trainingLoadAnchor } from '../period';
import { periodParamsFromUrl } from '@/lib/reportPeriod.server';
import { reportDefinition, TRAINING_LOAD_OFF_STATE } from '@/lib/reportCatalogue';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { exportAuditMetadata, exportCaption, exportFileName, type ExportDescriptor } from '@/lib/exportDescriptor';

/** The Training load report as CSV: one row per athlete in scope, the same
 *  numbers the page ranks, the definition sentence as the file's first line.
 *  "No ratings" is written as words in the load columns, never 0 — the file
 *  keeps the screen's rule that a session with no rating is not counted as
 *  zero. For a club with session RPE off the file is its caption and the off
 *  state, no rows: there is no load to report, and the file says so rather
 *  than being empty. */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone, fullName, collectsRpe } = await requireReport('trainingLoad');
  const url = new URL(request.url);
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;

  if (!collectsRpe) {
    await recordReportView(db, orgId, claims.userId, actorRole, 'trainingLoad', { group_ids: groupIds, off: 'collects_rpe', format: 'csv' }, 'export');
    return csvResponse(`# ${reportDefinition('trainingLoad')}\r\n# ${TRAINING_LOAD_OFF_STATE}\r\n`, 'training-load.csv');
  }

  const realToday = todayIso(timezone);
  const anchor = await trainingLoadAnchor(db, orgId, groupIds, url.searchParams.get('to') ?? undefined, realToday);
  const period = await resolveTrainingLoadPeriod(db, orgId, anchor.to, periodParamsFromUrl(url));
  const fromDate = period.range.from;
  const today = anchor.to;

  const [groups, report] = await Promise.all([fetchGroups(db, orgId), fetchTrainingLoadReport(db, orgId, groupIds, fromDate, today)]);

  const rows = report.rows.map((r) => ({
    name: `${r.first_name} ${r.last_name}`,
    expected: String(r.expected),
    rated: String(r.rated),
    total_load: r.total_load === null ? (r.expected === 0 ? 'Not expected' : 'No ratings') : formatNumber(r.total_load, 0),
    mean_load: r.mean_load === null ? '' : formatNumber(r.mean_load, 0),
    peak_load: r.peak_load === null ? '' : formatNumber(r.peak_load, 0),
  }));
  const csv = toCsv(rows, [
    ['name', 'Athlete'],
    ['expected', 'Sessions expected'],
    ['rated', 'Sessions rated'],
    ['total_load', 'Total load (AU)'],
    ['mean_load', 'Per rated session (AU)'],
    ['peak_load', 'Heaviest session (AU)'],
  ]);

  const descriptor: ExportDescriptor = {
    fileName: exportFileName('training-load', fromDate, today),
    report: 'Training load report',
    window: `${period.range.label}: ${fromDate} to ${today}`,
    scope: `${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athlete${report.athleteCount === 1 ? '' : 's'})`,
    rows: report.rows.length,
    rowNoun: 'athlete',
    filters: [],
    medical: false,
  };

  const caption =
    exportCaption(descriptor, reportDefinition('trainingLoad'), { exportedBy: fullName, at: formatDateTime(new Date().toISOString(), timezone) }) +
    `# Load is in arbitrary units: the CR-10 rating (0 rest to 10 maximal) multiplied by the session's minutes. ${report.rated} of ${report.expected} expected sessions rated; the rest are not counted as zero.\r\n`;

  await recordReportView(db, orgId, claims.userId, actorRole, 'trainingLoad', { from: fromDate, to: today, period: period.key, group_ids: groupIds, ...exportAuditMetadata(descriptor) }, 'export');

  return csvResponse(caption + csv, descriptor.fileName);
}
