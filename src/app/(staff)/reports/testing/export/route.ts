import { csvResponse, toCsv } from '@/lib/csv';
import { fetchTestByTest, fetchTestingByAthlete } from '@/lib/queries/testingReport';
import { recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatNumber } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** CSV only, see lib/csv.ts's header. Exports the "By athlete" grid always
 *  (every athlete, every test, personal best) plus the selected test's
 *  ranked distribution when one is chosen — the two genuinely tabular
 *  shapes this report has. */
export async function GET(request: Request) {
  const { db, orgId, claims } = await requireReportAccess();
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the export resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // caption below names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const testId = url.searchParams.get('test');

  const [groups, byAthlete] = await Promise.all([fetchGroups(db, orgId), fetchTestingByAthlete(db, orgId, groupIds)]);

  const athleteRows = byAthlete.rows.map((row) => {
    const record: Record<string, string> = { name: row.name };
    for (const d of byAthlete.definitions) {
      const cell = row.cells.get(d.id);
      record[d.id] = cell?.value === null || cell?.value === undefined ? '' : formatNumber(cell.value, d.decimal_places);
    }
    return record;
  });

  const athleteCsv = toCsv(athleteRows, [
    ['name', 'Athlete'],
    ...byAthlete.definitions.map((d) => [d.id, `${d.name} (${d.unit})`] as [string, string]),
  ]);

  let testSection = '';
  if (testId) {
    const byTest = await fetchTestByTest(db, orgId, groupIds, testId);
    if (byTest) {
      const testRows = byTest.rows.map((r) => ({
        rank: r.rank,
        name: r.name,
        side: r.side ?? '',
        value: formatNumber(r.value, byTest.definition.decimal_places),
        date: r.date,
      }));
      const testCsv = toCsv(testRows, [
        ['rank', 'Rank'],
        ['name', 'Athlete'],
        ['side', 'Side'],
        ['value', `Value (${byTest.definition.unit})`],
        ['date', 'Date'],
      ]);
      testSection = `\r\n# ${byTest.definition.name} — ranked (median ${byTest.median === null ? 'n/a' : formatNumber(byTest.median, byTest.definition.decimal_places)})\r\n${testCsv}`;
    }
  }

  const caption =
    `# Testing report. Scope: ${groupScopeLabel(groups, groupIds)} ` +
    `(${byAthlete.rows.length} athletes), ${byAthlete.definitions.length} tests.\r\n\r\n# By athlete — personal bests\r\n`;

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'testing', { group_ids: groupIds, test_definition_id: testId, format: 'csv' }, 'export');

  return csvResponse(caption + athleteCsv + testSection, 'testing-report.csv');
}
