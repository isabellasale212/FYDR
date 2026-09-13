import Link from 'next/link';
import { ReportHeader } from '@/components/ReportHeader/ReportHeader';
import { ReportFigure } from '@/components/ReportFigure/ReportFigure';
import { TableShell } from '@/components/TableShell/TableShell';
import { ExportDialog } from '@/components/ExportDialog/ExportDialog';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchGroups } from '@/lib/queries/groups';
import { recordReportView } from '@/lib/queries/reports';
import { fetchTrainingLoadReport } from '@/lib/queries/trainingLoadReport';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, formatNumber, todayIso } from '@/lib/format';
import { narrowWindowNote, periodNav } from '@/lib/periodNav';
import { periodCaveat, periodParamsFrom, periodSticky } from '@/lib/reportPeriod.server';
import { belowSquadFloor, squadFloorNote } from '@/lib/smallSample';
import { reportDefinition, TRAINING_LOAD_OFF_STATE } from '@/lib/reportCatalogue';
import { reportRoleNote } from '@/lib/reportRoleNote';
import { trainingLoadFigure } from '@/lib/reportFigureCards';
import { exportFileName } from '@/lib/exportDescriptor';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { resolveTrainingLoadPeriod, trainingLoadAnchor, trainingLoadQuery } from './period';

export const metadata = { title: 'Training load report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The seventh report (the catalogue addendum, 13 September 2026), every club:
 *  session load — RPE × minutes — summed over the period, per athlete, over
 *  the sessions each was expected at. docs/screens/65-training-load-report.md.
 *
 *  The RPE club setting (0118): when the club does not collect session RPE
 *  the destination STAYS and carries the addendum's off state, naming the
 *  setting and who can change it (docs/decisions/absence-rule.md). Nothing is
 *  queried and nothing is exported for an off club — there is no load to
 *  report and a file of nothing would say otherwise.
 *
 *  A load has no percentage of its own, so the emphasised figure is the
 *  sessions rated of expected — the denominator every sum below rests on —
 *  with the squad's summed load beside it; the table then ranks the load. */
export default async function TrainingLoadReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone, collectsRpe } = await requireReport('trainingLoad');
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const groups = await fetchGroups(db, orgId);
  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;

  if (!collectsRpe) {
    await recordReportView(db, orgId, claims.userId, actorRole, 'trainingLoad', { group_ids: groupIds, off: 'collects_rpe' });
    return (
      <>
        <ReportHeader
          groups={groups}
          groupIds={groupIds}
          eyebrow="Reports · Training load"
          title="Training load"
          definition={reportDefinition('trainingLoad') ?? undefined}
          sub={
            <p className="eyebrow rhead-sub">
              {groupScopeLabel(groups, groupIds)} · {orgName}
            </p>
          }
        />
        <EmptyState title="Session RPE is off for this club" body={TRAINING_LOAD_OFF_STATE} action={{ href: '/settings/club#rpe', label: 'Open Settings › Club' }} />
      </>
    );
  }

  const realToday = todayIso(timezone);
  const anchor = await trainingLoadAnchor(db, orgId, groupIds, params.to, realToday);
  const today = anchor.to;
  const period = await resolveTrainingLoadPeriod(db, orgId, today, periodParamsFrom(params));
  const fromDate = period.range.from;
  const caveat = periodCaveat(period);

  const report = await fetchTrainingLoadReport(db, orgId, groupIds, fromDate, today);
  const withRating = report.rows.filter((r) => r.total_load !== null);
  const floored = belowSquadFloor(withRating.length);
  const squadMean = withRating.length > 0 && !floored ? withRating.reduce((s, r) => s + (r.total_load ?? 0), 0) / withRating.length : null;
  const query = trainingLoadQuery(period.key, today, groupIds);
  const nav = periodNav({ key: period.key, from: fromDate, to: today, days: period.range.days, realToday });
  const narrowNote = narrowWindowNote(period.range.days);

  await recordReportView(db, orgId, claims.userId, actorRole, 'trainingLoad', { from: fromDate, to: today, period: period.key, group_ids: groupIds });

  const figure = trainingLoadFigure({ expected: report.expected, rated: report.rated, totalLoad: report.totalLoad, athleteCount: report.athleteCount, rangeLabel: period.range.label, floored });

  return (
    <>
      <ReportHeader
        groups={groups}
        groupIds={groupIds}
        eyebrow="Reports · Training load"
        title="Training load"
        definition={reportDefinition('trainingLoad') ?? undefined}
        roleNote={reportRoleNote('trainingLoad', claims.roles)}
        sub={
          <div className="rhead-sub">
            <p className="eyebrow" style={{ marginBottom: 'var(--sp-10)' }}>
              {groupScopeLabel(groups, groupIds)} · {orgName} · {period.range.label} · {formatDate(fromDate, timezone)} to {formatDate(today, timezone)} ·{' '}
              {report.athleteCount} athlete{report.athleteCount === 1 ? '' : 's'}
            </p>
            {caveat ? (
              <p className="sub" style={{ margin: '0 0 10px' }}>
                {caveat}
              </p>
            ) : null}
            {anchor.usingLatestData ? (
              <p className="sub" style={{ margin: '0 0 10px' }}>
                Showing the most recent window with data, ending <b>{formatDate(today, timezone)}</b> — real today is {formatDate(realToday, timezone)}.{' '}
                <Link href={`/reports/training-load?${trainingLoadQuery(period.key, realToday, groupIds)}`} className="linklike">
                  Jump to today instead
                </Link>
              </p>
            ) : null}
          </div>
        }
        actions={
          <>
            <ExportDialog
              href={`/reports/training-load/export?${query}`}
              descriptor={{
                fileName: exportFileName('training-load', fromDate, today),
                report: 'Training load report',
                window: `${period.range.label}: ${fromDate} to ${today}`,
                scope: `${groupScopeLabel(groups, groupIds)} (${report.athleteCount} athlete${report.athleteCount === 1 ? '' : 's'})`,
                rows: report.rows.length,
                rowNoun: 'athlete',
                filters: [],
                medical: false,
              }}
            />
            <a href={`/reports/training-load/pdf?${query}`} className="rhead-btn">
              Export PDF
            </a>
          </>
        }
        period={
          <div className="rhead-period-stack">
            <div className="rhead-period-row">
              <PeriodSelector value={period.key} allowed={period.allowed} reasons={period.reasons} season={period.season} sticky={periodSticky(period)} />
              {nav.previous || nav.next ? (
                <nav className="rhead-period-nav" aria-label="Walk the window">
                  {nav.previous ? (
                    <Link href={`/reports/training-load?${trainingLoadQuery(period.key, nav.previous.to, groupIds)}`} className="rhead-btn">
                      ‹ {nav.previous.label}
                    </Link>
                  ) : null}
                  {nav.next ? (
                    <Link href={`/reports/training-load?${trainingLoadQuery(period.key, nav.next.to, groupIds)}`} className="rhead-btn">
                      {nav.next.label} ›
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </div>
            {narrowNote ? <p className="rhead-period-note">{narrowNote}</p> : null}
          </div>
        }
      />

      <ReportFigure {...figure} />

      {report.athleteCount === 0 ? (
        <EmptyState title={`Nobody in ${groupScopeLabel(groups, groupIds)}.`} body="The group filter resolves to no athletes, so there is no load to sum. Widen it and the table returns." />
      ) : report.expected === 0 ? (
        <EmptyState
          title="No session expected a rating in this period."
          body={`None of the ${report.athleteCount} athlete${report.athleteCount === 1 ? '' : 's'} in ${groupScopeLabel(groups, groupIds)} was expected at a session between ${formatDate(fromDate, timezone)} and ${formatDate(today, timezone)}. Nothing is missing — a session enters here the day it is published on the schedule with a rating expected.`}
        />
      ) : (
        <TableShell
          title="Load by athlete"
          titleId="load-title"
          sort="Highest load first — the athlete carrying the most is at the top; athletes with no rating are last"
          count={`${withRating.length} of ${report.athleteCount} athletes with a rating`}
        >
          {/* The squad mean is drawn only above the floor (PATTERN-S7 C8);
              below it the note says so and the rows stand on their own. */}
          {squadMean !== null ? (
            <p className="tiny" style={{ margin: '0 0 var(--sp-10)' }}>
              Squad mean {formatNumber(squadMean, 0)} AU per athlete over the period, across the {withRating.length} with a rating.
            </p>
          ) : floored && withRating.length > 0 ? (
            <p className="tiny" style={{ margin: '0 0 var(--sp-10)' }}>
              {squadFloorNote('The squad mean', withRating.length)}
            </p>
          ) : null}
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-cards">
              <caption className="visually-hidden">Session load by athlete, highest first</caption>
              <thead>
                <tr>
                  <th scope="col">Athlete</th>
                  <th scope="col" className="r">Rated of expected</th>
                  <th scope="col" className="r">Total load (AU)</th>
                  <th scope="col" className="r">Per rated session</th>
                  <th scope="col" className="r">Heaviest session</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.athlete_id}>
                    <td className="nm" data-label="Athlete">
                      <Link href={`/squad/${r.athlete_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {r.first_name} {r.last_name}
                      </Link>
                    </td>
                    <td className="r num" data-label="Rated of expected">
                      {r.expected === 0 ? 'Not expected' : `${r.rated} of ${r.expected}`}
                    </td>
                    {/* "not counted as zero": nothing rated is words, never 0. */}
                    <td className="r num" data-label="Total load (AU)">
                      {r.total_load === null ? <span className="sub">{r.expected === 0 ? 'Not expected' : 'No ratings'}</span> : formatNumber(r.total_load, 0)}
                    </td>
                    <td className="r num" data-label="Per rated session">
                      {r.mean_load === null ? <span className="sub">—</span> : formatNumber(r.mean_load, 0)}
                    </td>
                    <td className="r num" data-label="Heaviest session">
                      {r.peak_load === null ? <span className="sub">—</span> : formatNumber(r.peak_load, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny" style={{ marginTop: 'var(--sp-12)' }}>
            Load is in arbitrary units (AU): the CR-10 rating, 0 rest to 10 maximal, multiplied by the session&rsquo;s minutes (MET-007). A
            rating of 0 is a real value and counts as a load of 0; a session with no rating is left out of every sum. Ratings corrected by a
            coach are counted as corrected.
          </p>
        </TableShell>
      )}
    </>
  );
}
