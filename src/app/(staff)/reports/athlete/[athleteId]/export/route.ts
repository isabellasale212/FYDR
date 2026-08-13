import { notFound } from 'next/navigation';
import { acwrSuppressedLabel } from '@/lib/acwr';
import { csvResponse, toCsv } from '@/lib/csv';
import { fetchAthleteReport } from '@/lib/queries/athleteReport';
import { recordReportView } from '@/lib/queries/reports';
import { formatNumber } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

const PERIODS = [28, 90] as const;

/** CSV only, see lib/csv.ts's header. One row per day in the period —
 *  readiness and session load, the two daily series this report has — with
 *  the period's headline figures (compliance, ACWR, open flags, current
 *  programme) as a caption line, the same technique
 *  reports/training/export/route.ts already uses for context that doesn't
 *  fit a day-by-day grid. Test results, being one row per test rather than
 *  per day, are a second table appended below the daily grid. */
export async function GET(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const { db, orgId, claims, timezone } = await requireReportAccess();
  const url = new URL(request.url);
  const days = PERIODS.includes(Number(url.searchParams.get('days')) as (typeof PERIODS)[number])
    ? Number(url.searchParams.get('days'))
    : 28;

  const report = await fetchAthleteReport(db, orgId, athleteId, timezone, days);
  if (!report) notFound();

  const readinessByDate = new Map(report.wellness.map((p) => [p.date, p.value]));

  const dayRows = report.load.byDay.map((d) => ({
    date: d.date,
    readiness: readinessByDate.get(d.date) ?? '',
    session_load: d.load ?? '',
  }));

  const dailyCsv = toCsv(dayRows, [
    ['date', 'Date'],
    ['readiness', 'Readiness'],
    ['session_load', 'Session load'],
  ]);

  const testRows = report.gymAndTesting.tests.map((t) => ({
    test: t.name,
    unit: t.unit,
    pb: t.pbValue === null ? '' : formatNumber(t.pbValue, t.decimal_places),
    pb_date: t.pbDate ?? '',
    latest: t.latestValue === null ? '' : formatNumber(t.latestValue, t.decimal_places),
    latest_date: t.latestDate ?? '',
  }));

  const testCsv = toCsv(testRows, [
    ['test', 'Test'],
    ['unit', 'Unit'],
    ['pb', 'PB'],
    ['pb_date', 'PB date'],
    ['latest', 'Latest'],
    ['latest_date', 'Latest date'],
  ]);

  const { athlete, compliancePct, openFlags, currentProgrammes } = report.summary;
  const caption =
    `# Athlete report, ${athlete.first_name} ${athlete.last_name}, ${report.from} to ${report.to}. ` +
    `Compliance ${compliancePct === null ? 'n/a' : `${compliancePct}%`}, ` +
    `ACWR ${report.load.acwr === null ? acwrSuppressedLabel(report.load.daysWithData) : formatNumber(report.load.acwr, 2)}, ` +
    `${openFlags.length} open flag${openFlags.length === 1 ? '' : 's'}, ` +
    `programme(s): ${currentProgrammes.length > 0 ? currentProgrammes.map((p) => p.name).join('; ') : 'none'}.\r\n\r\n` +
    `# Daily readiness and session load\r\n`;

  const testHeader = `\r\n# Testing — latest and personal best\r\n`;

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'athlete',
    { athlete_id: athleteId, from: report.from, to: report.to, format: 'csv' },
    'export',
  );

  return csvResponse(caption + dailyCsv + testHeader + testCsv, `athlete-report-${athlete.last_name.toLowerCase()}-${report.from}-to-${report.to}.csv`);
}
