import { acwrInsufficiencyNote, acwrSquadHeadline } from '@/lib/acwr';
import { csvResponse, toCsv } from '@/lib/csv';
import { fetchSquadWeeklyReport } from '@/lib/queries/squadWeeklyReport';
import { recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatNumber, todayIso } from '@/lib/format';
import { reportDefinition } from '@/lib/reportCatalogue';
import { requireReport } from '@/lib/session';
import { squadWeek } from '@/lib/squadWeek';
import type { AppRole } from '@/lib/types/database';
import { exportAuditMetadata, exportCaption, exportFileName, type ExportDescriptor } from '@/lib/exportDescriptor';
import { formatDateTime } from '@/lib/format';

/** CSV only, see lib/csv.ts's header. Four small tables, one per section
 *  that's naturally a row-per-athlete grid — load, gym, testing and
 *  availability — each with its own `#` heading line, same technique
 *  reports/athlete/[athleteId]/export/route.ts already uses. The headline
 *  tiles and the attention list aren't tabular data and stay on the page. */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone, fullName } = await requireReport('squad');
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the export resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // caption below names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  // Same ?week= the on-screen report's pager sets (an old ?to= still
  // resolves to its week), so an exported file matches the week the coach
  // was looking at (audit B4) — Monday to Sunday, club local time.
  const isDate = (v: string | null): v is string => v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const realToday = todayIso(timezone);
  const weekParam = url.searchParams.get('week');
  const toParam = url.searchParams.get('to');
  const week = squadWeek({ anchor: isDate(weekParam) ? weekParam : isDate(toParam) ? toParam : realToday, today: realToday });

  const [groups, report] = await Promise.all([fetchGroups(db, orgId), fetchSquadWeeklyReport(db, orgId, groupIds, timezone, { from: week.from, to: week.to })]);

  const loadCsv = toCsv(
    report.load.map((r) => ({
      name: `${r.last_name}, ${r.first_name}`,
      acute: r.acute === null ? '' : formatNumber(r.acute, 0),
      chronic: r.chronic === null ? '' : formatNumber(r.chronic, 0),
      acwr: r.acwr === null ? '' : formatNumber(r.acwr, 2),
      suppressed: r.suppressed ? 'yes' : '',
    })),
    [
      ['name', 'Athlete'],
      ['acute', 'Acute (7 day)'],
      ['chronic', 'Chronic (28 day, weekly)'],
      ['acwr', 'ACWR'],
      ['suppressed', 'Suppressed'],
    ],
  );

  const gymCsv = toCsv(
    report.gymByAthlete.map((g) => ({ name: g.name, logged: g.sessionsLogged, completed: g.sessionsCompleted })),
    [
      ['name', 'Athlete'],
      ['logged', 'Sessions logged'],
      ['completed', 'Sessions completed'],
    ],
  );

  const testsCsv = toCsv(
    report.testsThisWeek.map((t) => ({ name: t.name, test: t.test_name, value: formatNumber(t.value, 1), unit: t.unit, date: t.test_date })),
    [
      ['name', 'Athlete'],
      ['test', 'Test'],
      ['value', 'Value'],
      ['unit', 'Unit'],
      ['date', 'Date'],
    ],
  );

  const availabilityCsv = toCsv(
    report.availability.map((a) => ({
      name: a.name,
      status: a.status,
      restrictions: a.restrictions.join('; '),
      body_area: a.body_area ?? '',
      expected_return: a.expected_return ?? '',
    })),
    [
      ['name', 'Athlete'],
      ['status', 'Status'],
      ['restrictions', 'Restrictions'],
      ['body_area', 'Body area'],
      ['expected_return', 'Expected return'],
    ],
  );

  /* PATTERN-S7 C3 / S8 C8: one descriptor for the dialog, the header and
     the audit row. Four sections, so the row count is their sum and the
     noun says so. */
  const sectionRows = report.load.length + report.gymByAthlete.length + report.testsThisWeek.length + report.availability.length;
  const descriptor: ExportDescriptor = {
    fileName: exportFileName('squad-weekly', report.from, report.to),
    report: 'Squad weekly report',
    window: `Week ${report.from} to ${report.to}`,
    scope: `${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athlete${report.athleteCount === 1 ? '' : 's'})`,
    rows: sectionRows,
    rowNoun: 'athlete per section (load, gym sessions, testing, availability)',
    filters: [],
    medical: false,
  };

  const caption =
    exportCaption(descriptor, reportDefinition('squad'), { exportedBy: fullName, at: formatDateTime(new Date().toISOString(), timezone) }) +
    `# Compliance ${report.tiles.compliancePct === null ? 'n/a' : `${report.tiles.compliancePct}%`}, ` +
    `available ${report.tiles.availablePct === null ? 'n/a' : `${report.tiles.availablePct}%`}, ` +
    `${report.tiles.openFlagCount} open flags. ` +
    `ACWR: ${acwrSquadHeadline(report.tiles.acwr.outsideBand, report.tiles.acwr.computable, report.tiles.acwr.suppressed)} ` +
    `(${acwrInsufficiencyNote()})\r\n\r\n` +
    `# Load\r\n`;

  const csv = caption + loadCsv + `\r\n# Gym sessions\r\n` + gymCsv + `\r\n# Testing\r\n` + testsCsv + `\r\n# Availability\r\n` + availabilityCsv;

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'squad_weekly',
    { from: report.from, to: report.to, group_ids: groupIds, ...exportAuditMetadata(descriptor) },
    'export',
  );

  return csvResponse(csv, descriptor.fileName);
}
