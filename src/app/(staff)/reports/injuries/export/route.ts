import { csvResponse, toCsv } from '@/lib/csv';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import { fetchInjuryAvailabilityReport, recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { periodParamsFromUrl, resolveInjuryPeriod } from '../period';

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
  const { db, orgId, claims, timezone } = await requireReport('injuries');
  const isMedical = hasAnyRole(claims.roles, CLINICAL_ONLY);
  const url = new URL(request.url);
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);

  /* This line used to be `[28, 90, 180, 365].includes(...)` — the array
   * INLINED as a literal rather than named, which is why a grep for `PERIODS`
   * found seven of the nine copies of the legacy `?days=` allow-list and
   * missed this one. It now resolves through the same module the page and the
   * PDF use, so the CSV covers the window the coach was looking at rather
   * than silently falling back to 28 days the moment it meets `?period=season`.
   * resolveInjuryPeriod also reads the sticky cookie, exactly as the page
   * does — a bare export URL is scoped the way the screen is. */
  const period = await resolveInjuryPeriod(db, orgId, timezone, periodParamsFromUrl(url));
  const fromDate = period.from;
  const today = period.to;

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

  const actorRole = (isMedical ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'injury_availability',
    {
      from: fromDate,
      to: today,
      period: period.key,
      group_ids: groupIds,
      medical: isMedical,
      format: 'csv',
    },
    'export',
  );

  /* The caption names the period KEY as well as its dates. "28 days" and
   * "this season" can resolve to the same span for a club four weeks into a
   * season, and a CSV that lands in someone's inbox has no control to read
   * the answer off. `Current` is stated as unwindowed for the same reason the
   * page and the PDF state it: these rows are availability as of today, not a
   * historical snapshot of the period. */
  const caption =
    `# Injury & availability report, ${period.label} (${fromDate} to ${today}). ` +
    `Scope: ${groupScopeLabel(groups, groupIds)} (${report.summary.athleteCount} athletes). ` +
    `Rows are availability as of ${today}, not a snapshot of the period.\r\n`;

  return csvResponse(caption + csv, `injury-availability-${fromDate}-to-${today}.csv`);
}
