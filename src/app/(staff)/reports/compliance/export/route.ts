import { csvResponse, toCsv } from '@/lib/csv';
import { fetchComplianceReport, recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, todayIso } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** CSV only — see lib/csv.ts's header for why PDF and XLSX are cut. Runs
 *  server-side and writes its own audit_log row on every download, per
 *  screens/reports.md: "If added, it must run server-side as a report_runs
 *  job and write an export.run audit event" — this pass has no report_runs
 *  table (see lib/queries/reports.ts's header), so the audit row is the
 *  whole of what tracks the export, the same simplification recordReportView
 *  already made for an ordinary report open. */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone } = await requireReportAccess();
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the export must resolve the
  // sticky filter cookie exactly as the on-screen report does (audit S4),
  // and the caption below states the resolved scope by name.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const days = [7, 14, 28].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7;

  const today = todayIso(timezone);
  const fromDate = addDays(today, -(days - 1));

  const [groups, report] = await Promise.all([fetchGroups(db, orgId), fetchComplianceReport(db, orgId, groupIds, fromDate, today)]);
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  const rows = report.byAthlete.flatMap((a) =>
    Object.entries(a.perDomain).map(([domain, v]) => ({
      first_name: a.first_name,
      last_name: a.last_name,
      domain,
      expected: v.expected,
      submitted: v.submitted,
      pct: v.expected > 0 ? Math.round((100 * v.submitted) / v.expected) : '',
      last_submission: a.lastSubmission ?? '',
    })),
  );

  const csv = toCsv(rows, [
    ['first_name', 'First name'],
    ['last_name', 'Last name'],
    ['domain', 'Domain'],
    ['expected', 'Expected'],
    ['submitted', 'Submitted'],
    ['pct', 'Percent'],
    ['last_submission', 'Last submission'],
  ]);

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'compliance',
    {
      from: fromDate,
      to: today,
      group_ids: groupIds,
      group_names: groupIds.map((id) => groupNameById.get(id) ?? id),
      format: 'csv',
    },
    'export',
  );

  const caption =
    `# Compliance report, ${fromDate} to ${today}. ` +
    `Scope: ${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athletes).\r\n`;

  return csvResponse(caption + csv, `compliance-${fromDate}-to-${today}.csv`);
}
