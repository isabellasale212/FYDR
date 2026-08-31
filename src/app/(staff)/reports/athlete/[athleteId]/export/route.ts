import { notFound } from 'next/navigation';
import { acwrSuppressedLabel } from '@/lib/acwr';
import { csvResponse, toCsv } from '@/lib/csv';
import { fetchAthleteReport } from '@/lib/queries/athleteReport';
import { recordReportView } from '@/lib/queries/reports';
import { formatNumber } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { ACWR_WINDOW_CAPTION, periodCaveat, periodParamsFromUrl, resolveAthletePeriod } from '../period';

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

  /* Resolved through the same module as the page and the PDF. Before this,
   * this handler's own `PERIODS = [28, 90]` copy meant a page writing
   * `?period=season` produced a CSV silently covering 28 days — the export is
   * wrong and says nothing, which is the failure the period model exists to
   * stop. It also reads the sticky cookie, exactly as the page does, so a
   * bare export URL is scoped the way the screen was. */
  const period = await resolveAthletePeriod(db, orgId, athleteId, timezone, periodParamsFromUrl(url));

  const report = await fetchAthleteReport(db, orgId, athleteId, timezone, { from: period.from, to: period.to });
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
  /* The ACWR figure in this caption sits beside a period label, so the caption
   * must say that the two are not the same window — a CSV has no tile label to
   * carry it and lands in an inbox with no control to check it against. Same
   * sentence the page prints under the load tiles, from the same constant. */
  const caveat = periodCaveat(period);
  const caption =
    `# Athlete report, ${athlete.first_name} ${athlete.last_name}, ${period.label} (${report.from} to ${report.to}). ` +
    `Compliance ${compliancePct === null ? 'n/a' : `${compliancePct}%`}, ` +
    `ACWR ${report.load.acwr === null ? acwrSuppressedLabel(report.load.daysWithData) : formatNumber(report.load.acwr, 2)}, ` +
    `${openFlags.length} open flag${openFlags.length === 1 ? '' : 's'}, ` +
    `programme(s): ${currentProgrammes.length > 0 ? currentProgrammes.map((p) => p.name).join('; ') : 'none'}.\r\n` +
    `# ${ACWR_WINDOW_CAPTION}\r\n` +
    (caveat ? `# ${caveat}\r\n` : '') +
    `\r\n# Daily readiness and session load\r\n`;

  const testHeader = `\r\n# Testing — latest and personal best\r\n`;

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'athlete',
    { athlete_id: athleteId, from: report.from, to: report.to, period: period.key, format: 'csv' },
    'export',
  );

  return csvResponse(caption + dailyCsv + testHeader + testCsv, `athlete-report-${athlete.last_name.toLowerCase()}-${report.from}-to-${report.to}.csv`);
}
