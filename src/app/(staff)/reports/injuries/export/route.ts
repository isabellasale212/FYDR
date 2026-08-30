import { csvResponse, toCsv } from '@/lib/csv';
import { fetchInjuryAvailabilityReport, recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, todayIso } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** CSV only, see lib/csv.ts's header. The coach export and the medical
 *  export are two different queries, not one CSV with a column hidden after
 *  the fact — isMedical gates which fields fetchInjuryAvailabilityReport
 *  even reads, the same boundary the report page itself holds.
 *
 *  Scoped through resolveGroupFilter (URL param, then the sticky filter
 *  cookie), not parseGroupParam on the URL alone: the audit's S4 finding
 *  (analysis findings 27/49) was a group filter that silently re-scoped
 *  every screen while this export answered a bare URL with differently-
 *  scoped rows and no hint either way. The export now resolves the scope
 *  exactly as the page does, and the `# Scope:` caption line states it. */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone } = await requireReportAccess();
  const isMedical = claims.roles.includes('medical');
  const url = new URL(request.url);
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const days = [28, 90, 180, 365].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 28;

  const today = todayIso(timezone);
  const fromDate = addDays(today, -(days - 1));

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchInjuryAvailabilityReport(db, orgId, groupIds, fromDate, today, isMedical),
  ]);

  const rows = report.current.map((r) => ({
    name: r.name,
    position: r.position ?? '',
    squad_number: r.squad_number ?? '',
    status: r.status,
    restrictions: r.restrictions.join('; '),
    body_area: r.body_area ?? '',
    side: r.side ?? '',
    expected_return: r.expected_return ?? '',
  }));

  const csv = toCsv(rows, [
    ['name', 'Name'],
    ['position', 'Position'],
    ['squad_number', 'Squad number'],
    ['status', 'Status'],
    ['restrictions', 'Restrictions'],
    ['body_area', 'Body area'],
    ['side', 'Side'],
    ['expected_return', 'Expected return'],
  ]);

  const actorRole = (isMedical ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'injury_availability',
    {
      from: fromDate,
      to: today,
      group_ids: groupIds,
      medical: isMedical,
      format: 'csv',
    },
    'export',
  );

  const caption =
    `# Injury & availability report, ${fromDate} to ${today}. ` +
    `Scope: ${groupScopeLabel(groups, groupIds)} (${report.summary.athleteCount} athletes).\r\n`;

  return csvResponse(caption + csv, `injury-availability-${fromDate}-to-${today}.csv`);
}
