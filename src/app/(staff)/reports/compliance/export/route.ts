import { csvResponse, toCsv } from '@/lib/csv';
import { fetchComplianceReport, fetchLatestComplianceExpectationDate, recordReportView } from '@/lib/queries/reports';
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
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  // One row per athlete, not per domain·athlete — waivedCount is a
  // whole-window total across every domain, so a per-domain row would
  // either duplicate or misattribute it. Per-domain expected/submitted
  // stay as separate columns instead of separate rows.
  const rows = report.byAthlete.map((a) => {
    let expected = 0;
    let submitted = 0;
    for (const v of Object.values(a.perDomain)) {
      expected += v.expected;
      submitted += v.submitted;
    }
    return {
      first_name: a.first_name,
      last_name: a.last_name,
      wellness_expected: a.perDomain.wellness?.expected ?? 0,
      wellness_submitted: a.perDomain.wellness?.submitted ?? 0,
      training_rpe_expected: a.perDomain.training_rpe?.expected ?? 0,
      training_rpe_submitted: a.perDomain.training_rpe?.submitted ?? 0,
      gym_expected: a.perDomain.gym?.expected ?? 0,
      gym_submitted: a.perDomain.gym?.submitted ?? 0,
      pct: expected > 0 ? Math.round((100 * submitted) / expected) : '',
      // "Waived, nothing to chase" reads distinctly from an empty pct —
      // a fully waived athlete otherwise sorted and exported identically
      // to a genuinely compliant one (audit analysis finding 19).
      waived: a.waivedCount > 0 ? a.waivedCount : '',
      last_submission: a.lastSubmission ?? '',
    };
  });

  const csv = toCsv(rows, [
    ['first_name', 'First name'],
    ['last_name', 'Last name'],
    ['wellness_expected', 'Wellness expected'],
    ['wellness_submitted', 'Wellness submitted'],
    ['training_rpe_expected', 'Training RPE expected'],
    ['training_rpe_submitted', 'Training RPE submitted'],
    ['gym_expected', 'Gym expected'],
    ['gym_submitted', 'Gym submitted'],
    ['pct', 'Percent'],
    ['waived', 'Waived (excluded above)'],
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
    `Scope: ${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athletes). ` +
    `Waived expectations are excluded from Expected/Submitted above and reported in their own column.\r\n`;

  return csvResponse(caption + csv, `compliance-${fromDate}-to-${today}.csv`);
}
