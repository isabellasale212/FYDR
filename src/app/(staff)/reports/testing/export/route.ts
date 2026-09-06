import { csvResponse, toCsv } from '@/lib/csv';
import { fetchTestByTest, fetchTestingByAthlete } from '@/lib/queries/testingReport';
import { recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatNumber } from '@/lib/format';
import { resolveTestingPeriod, testingWindow } from '../period';
import { periodParamsFromUrl } from '@/lib/reportPeriod.server';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** CSV only, see lib/csv.ts's header. Exports the "By athlete" grid always
 *  (every athlete, every test, best in the reporting period) plus the selected
 *  test's ranked distribution — the two genuinely tabular shapes this report
 *  has. "The selected test" means the same thing here as on the page and in the
 *  PDF, `?test=` or the first definition; see the resolution below.
 *
 *  This handler had NO window at all, because neither did the report. It reads
 *  `?period=` through ../period.ts, the same module the page and the PDF
 *  import, so a coach who exports "this season" gets a season — and a file that
 *  states which window it covers in its own caption. */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone } = await requireReport('testing');
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the export resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // caption below names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const requestedTestId = url.searchParams.get('test');

  const period = await resolveTestingPeriod(db, orgId, timezone, periodParamsFromUrl(url));
  const reportWindow = testingWindow(period);

  const [groups, byAthlete] = await Promise.all([fetchGroups(db, orgId), fetchTestingByAthlete(db, orgId, groupIds, reportWindow)]);

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

  /* THE SAME SELECTION THE PAGE AND THE PDF MAKE, and it has to be spelled the
   * same way rather than "whatever `?test=` said".
   *
   * Both of those fall back to `definitions[0]` when `?test=` is absent (the
   * page at page.tsx's `selectedDefinition`, the PDF at pdf/route.tsx:37) —
   * because that is what the screen SHOWS on a first open, with the "By test"
   * tab already populated. This handler tested the raw param instead, so an
   * export taken from a first open — or from any link that did not carry
   * `?test=` — silently dropped the ranked section the coach was looking at,
   * and the CSV had no way to say a section was missing. It also never checked
   * the param against the real definitions, so a stale test id produced an
   * empty section rather than the report's own default.
   *
   * Three surfaces, one rule, stated at each of them; the shared thing here is
   * `definitions`, which only exists after the fetch above. */
  const selectedTestId =
    byAthlete.definitions.find((d) => d.id === requestedTestId)?.id ?? byAthlete.definitions[0]?.id ?? null;

  let testSection = '';
  if (selectedTestId) {
    const byTest = await fetchTestByTest(db, orgId, groupIds, selectedTestId, reportWindow);
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

  // The window is stated on the file, not just applied to it. A CSV that says
  // "personal bests" over a season-bounded read is a file someone will paste
  // into a spreadsheet next year and read as all-time.
  const caption =
    `# Testing report, ${period.range.label.toLowerCase()}: ${reportWindow.from} to ${reportWindow.to}. ` +
    `Scope: ${groupScopeLabel(groups, groupIds)} ` +
    `(${byAthlete.rows.length} athletes), ${byAthlete.definitions.length} tests.\r\n\r\n# By athlete — best in period\r\n`;

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'testing',
    // The RESOLVED test, not the raw param — the audit row records what was
    // actually disclosed, and the page and the PDF both log it that way.
    { group_ids: groupIds, test_definition_id: selectedTestId, period: period.key, from: reportWindow.from, to: reportWindow.to, format: 'csv' },
    'export',
  );

  return csvResponse(caption + athleteCsv + testSection, `testing-report-${reportWindow.from}-to-${reportWindow.to}.csv`);
}
