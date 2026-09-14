import Link from 'next/link';
import { belowSquadFloor } from '@/lib/smallSample';
import { NOT_SHOWN, NO_RESULT } from '@/lib/reportFigures';
import { testCoverageFigure } from '@/lib/reportFigureCards';
import { ReportFigure } from '@/components/ReportFigure/ReportFigure';
import { TableShell } from '@/components/TableShell/TableShell';
import { ExportDialog } from '@/components/ExportDialog/ExportDialog';
import { exportFileName } from '@/lib/exportDescriptor';

import { filterEmptyCopy, staffEmptyCopy } from '@/lib/staffEmpty';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchTestByTest, fetchTestLongitudinal, fetchTestingByAthlete, fetchLatestTestResultDate } from '@/lib/queries/testingReport';
import { recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, formatNumber } from '@/lib/format';
import { resolveTestingPeriod, testingQuery, testingWindow } from './period';
import { periodCaveat, periodParamsFrom, periodSticky } from '@/lib/reportPeriod.server';
import { reportDefinition } from '@/lib/reportCatalogue';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Testing report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/reports.md, report 5 of 5 — see lib/queries/testingReport.ts's
 *  header for the full scope reasoning. The last of the five report types
 *  to get built, closing this build's Reports library out completely.
 *
 *  THIS SCREEN WAS COMPLETELY UNBOUNDED until this pass: no `days`, no `from`,
 *  no `todayIso` anywhere in the file, and all three of its queries took no
 *  dates at all. The longitudinal series in particular plotted every result the
 *  club had ever recorded, so a squad three seasons deep got a "squad median
 *  over time" dominated by athletes who have left — and, past PostgREST's
 *  silent 1000-row ceiling, a series arbitrarily truncated with no error. It
 *  now has a period, defaulting to the season. */
export default async function TestingReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone } = await requireReport('testing');
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  /* `day` and `week` are offered DISABLED with their reason rather than hidden;
   * ./period.ts carries both reasons and the argument for them. The same module
   * is imported by this report's CSV and PDF handlers, so all three cover the
   * same window. */
  const period = await resolveTestingPeriod(db, orgId, timezone, periodParamsFrom(params));
  // `reportWindow`, not `window` — this file renders in a browser and shadowing
  // the DOM global inside a component is a trap for whoever edits it next.
  const reportWindow = testingWindow(period);
  const caveat = periodCaveat(period);

  const [groups, byAthlete] = await Promise.all([fetchGroups(db, orgId), fetchTestingByAthlete(db, orgId, groupIds, reportWindow)]);

  const requestedTestId = typeof params.test === 'string' ? params.test : undefined;
  const selectedDefinition = byAthlete.definitions.find((d) => d.id === requestedTestId) ?? byAthlete.definitions[0] ?? null;
  const selectedTestId = selectedDefinition?.id ?? null;

  const [byTest, longitudinal, latestResultOnRecord] = selectedTestId
    ? await Promise.all([
        fetchTestByTest(db, orgId, groupIds, selectedTestId, reportWindow),
        fetchTestLongitudinal(db, orgId, groupIds, selectedTestId, reportWindow),
        /* PATTERN-S6 C8: the most recent result on record for this test, any
           period, so an empty window names it rather than "never". It sits in
           the Promise.all deliberately, so it runs on populated loads too and
           re-resolves the group scope this page already holds — one indexed
           read in parallel with the two the tab needs anyway, which is cheaper
           than a second round trip on the empty path. Not an empty-only read. */
        fetchLatestTestResultDate(db, orgId, groupIds, selectedTestId),
      ])
    : [null, [], null];
  const scopeWords = groupIds.length === 0 ? 'the squad' : groupScopeLabel(groups, groupIds);
  /* byAthlete carries one row per athlete in scope whether or not they have a
     result, so no rows under a filter means the filter matches no athletes. */
  const scopeIsEmpty = groupIds.length > 0 && byAthlete.rows.length === 0;
  const athletesFilterEmpty = filterEmptyCopy({ what: 'athlete', inScope: 0, scopeLabel: scopeWords, why: 'is on the roster' });
  /* fetchLatestTestResultDate returns null for an empty scope as well as for a
     test never run, so the by-test tab tells the two apart here: an empty
     scope gets the filter sentence (the same grammar as the Athletes tab's),
     never "no result on record", which would send a coach looking for a
     data-entry problem the club does not have. */
  const byTestEmpty = !selectedDefinition
    ? null
    : scopeIsEmpty
      ? filterEmptyCopy({ what: 'test result', inScope: 0, scopeLabel: scopeWords, why: 'is on the roster' })
      : staffEmptyCopy({
          domain: 'testing',
          firstName: scopeWords,
          periodKey: period.key,
          rangeLabel: period.range.label,
          latest: latestResultOnRecord,
          latestLabel: latestResultOnRecord ? formatDate(latestResultOnRecord, timezone) : null,
          seasonStart: period.season?.starts_on ?? null,
          today: reportWindow.to,
        });
  /* Where the by-test empty's one action goes: an empty scope drops the filter
     (and clears the shared cookie — see EmptyState's clearsGroupFilter) and
     keeps the period and the test; an empty window widens the period and keeps
     the test and the filter. */
  const byTestEmptyHref = !byTestEmpty?.action
    ? null
    : scopeIsEmpty
      ? `/reports/testing?period=${period.key}${selectedTestId ? `&test=${selectedTestId}` : ''}`
      : `/reports/testing?period=${byTestEmpty.action.period}${selectedTestId ? `&test=${selectedTestId}` : ''}${groupIds.length > 0 ? `&groups=${groupIds.join(',')}` : ''}`;

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'testing', {
    group_ids: groupIds,
    test_definition_id: selectedTestId,
    // A report open is a data disclosure, so the audit row records what was
    // disclosed: the named window and the dates it resolved to, not just the
    // test. This report previously disclosed the club's entire testing history
    // on every open and the audit row could not say so.
    period: period.key,
    from: reportWindow.from,
    to: reportWindow.to,
  });

  // The RESOLVED key, never the raw URL value — a coerced period must not
  // travel to the export, or the download covers a window the screen did not
  // show. Built by the colocated module rather than hand-concatenated, which is
  // how the `groupQuery.replace('&', '')` dance these hrefs used to need got
  // there in the first place.
  const query = testingQuery(period.key, groupIds, selectedTestId);

  return (
    <>

      {caveat ? (
        <p className="sub" style={{ margin: '0 0 var(--s-5)' }}>
          {caveat}
        </p>
      ) : null}

      {byAthlete.definitions.length === 0 ? (
        /* PATTERN-S6 C8: nothing on record for the club, and where the data
           enters — the one action here is the definition, not a window. */
        <div className="empty">
          <h2>No test defined for the club yet.</h2>
          <p>
            Nothing is missing — no test has been defined, so there is nothing to record against. A test appears
            here once one is defined and a result entered.
          </p>
          <Link href="/testing" className="btn-ghost empty-action">
            Define a test
          </Link>
        </div>
      ) : (
        /* The period scopes every tab, so it rides the tab row rather than a
           row of its own above it. */
        <ReportPager
          header={{
            groups,
            groupIds,
            eyebrow: 'Reports · Testing',
            title: 'Testing report',
            /* PATTERN-S7 C1: the catalogue's sentence, above the numbers. */
            definition: reportDefinition('testing') ?? undefined,
            sub: (
              <>
                <p className="eyebrow rhead-sub">
                  {groupScopeLabel(groups, groupIds)} · {orgName} · {period.range.label} ·{' '}
                  {formatDate(reportWindow.from, timezone)} to {formatDate(reportWindow.to, timezone)} ·{' '}
                  {byAthlete.rows.length} athletes · {byAthlete.definitions.length} tests
                </p>
                {/* Both land on /testing, but one is "record a number today"
                    and the other is "change what the club measures" — the
                    first is the primary action, the second is a way out. */}
                <Link href="/testing" className="tst-manage">
                  Manage tests &rarr;
                </Link>
              </>
            ),
            actions: (
              <>
                <Link href="/testing" className="rhead-btn-primary" aria-label="Log a result for any test">
                  + Log a result
                </Link>
                <PrintButton className="rhead-btn" />
                {/* PATTERN-S7 C3: named and described before it is written. */}
                <ExportDialog
                  href={`/reports/testing/export?${query}`}
                  descriptor={{
                    fileName: exportFileName('testing-report', reportWindow.from, reportWindow.to),
                    report: 'Testing report',
                    window: `${period.range.label}: ${reportWindow.from} to ${reportWindow.to}`,
                    scope: `${groupScopeLabel(groups, groupIds)} (${byAthlete.rows.length} athlete${byAthlete.rows.length === 1 ? '' : 's'}), ${byAthlete.definitions.length} test${byAthlete.definitions.length === 1 ? '' : 's'}`,
                    rows: byAthlete.rows.length + (byTest?.rows.length ?? 0),
                    rowNoun: 'athlete (best in period), then one per ranked result',
                    filters: byTest ? [`Ranked test: ${byTest.definition.name}`] : [],
                    medical: false,
                  }}
                />
                <a href={`/reports/testing/pdf?${query}`} className="rhead-btn">
                  Export PDF
                </a>
              </>
            ),
          }}
          right={
              /* NOT sticky when this is the report's own default (`season`,
                 or `year` for a club with no season row) rather than something
                 the coach picked, and not sticky when their pick was clamped
                 either — periodSticky() carries both halves and the reasoning.
                 Writing a screen-specific default into the account-wide
                 `fydr-period` cookie would re-scope every other screen to a
                 window nobody chose. */
              <PeriodSelector
                value={period.key}
                allowed={period.allowed}
                reasons={period.reasons}
                season={period.season}
                sticky={periodSticky(period)}
              />
          }
          pages={[
            {
              label: 'By athlete',
              content: (
                <section className="card flush tst-pb" aria-labelledby="by-athlete-title">
                  {/* Titled "Personal bests" per the review, WITH the window
                    * still named beside it. The grid used to say "current
                    * personal best" over an all-time read; now that the report
                    * has a window, the best shown is the best IN that window,
                    * and a bare "personal bests" over a season-bounded number
                    * would put back the quietly wrong claim the bounding was
                    * added to fix. At `?period=all` the scope reads "all on
                    * record", which is the old behaviour said out loud.
                    *
                    * The description under it is gone: it said the same thing
                    * at paragraph length, and the empty-cell rule it explained
                    * is the ordinary meaning of a blank cell. */}
                  <h2 className="card-title tst-pb-head" id="by-athlete-title">
                    <span className="tst-pb-dot" aria-hidden="true" />
                    Personal bests
                  </h2>
                  {byAthlete.rows.length === 0 ? (
                    <div style={{ padding: 'var(--sp-16)' }}>
                      {groupIds.length > 0 ? (
                        <EmptyState
                          headingLevel={3}
                          title={athletesFilterEmpty.title}
                          body={athletesFilterEmpty.body}
                          action={{ href: `/reports/testing?period=${period.key}${selectedTestId ? `&test=${selectedTestId}` : ''}`, label: athletesFilterEmpty.action!.label, clearsGroupFilter: true }}
                        />
                      ) : (
                        <EmptyState headingLevel={3} title="No athletes in this squad yet." body="Nothing is missing — the roster is empty. Athletes appear here once they are added to the squad." />
                      )}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tbl" style={{ margin: '0 var(--s-8) var(--s-8)', minWidth: 480 }}>
                        <thead>
                          <tr>
                            <th scope="col">Athlete</th>
                            {byAthlete.definitions.map((d) => (
                              <th key={d.id} scope="col" className="r">
                                {d.name}{' '}
                                <Link
                                  href={`/testing/${d.id}`}
                                  className="tiny"
                                  aria-label={`Log a ${d.name} result`}
                                  title="Log a result"
                                >
                                  +
                                </Link>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {byAthlete.rows.map((row) => (
                            <tr key={row.athlete_id}>
                              <td>
                                <Link href={`/squad/${row.athlete_id}`} className="nm">
                                  {row.name}
                                </Link>
                              </td>
                              {byAthlete.definitions.map((d) => {
                                const cell = row.cells.get(d.id);
                                return (
                                  <td key={d.id} className="r num">
                                    {cell?.value === null || cell?.value === undefined ? NO_RESULT : formatNumber(cell.value, d.decimal_places)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ),
            },
            {
              label: 'By test',
              content: (
                <div className="stack">
                  {/* The period is carried explicitly here. This chip row
                    * hand-builds its href from a fixed list of keys, so every
                    * param it does not name is dropped — the exact bug
                    * PeriodSelector exists to make impossible, and without it
                    * the coach loses their window every time they switch
                    * test. */}
                  <div className="chiprow">
                    {byAthlete.definitions.map((d) => (
                      <Link
                        key={d.id}
                        href={`/reports/testing?${testingQuery(period.key, groupIds, d.id)}`}
                        className="squad-chip"
                        aria-pressed={d.id === selectedTestId}
                      >
                        {d.name}
                      </Link>
                    ))}
                  </div>

                  {byTest ? (
                    <>
                      {/* PATTERN-S7 C1: the one emphasised figure — athletes
                          with a result of those in scope, for this test in
                          the window; the count before the percentage; C2's
                          ranked-coverage sentence (who is not ranked, and the
                          C8 squad floor when it applies) as the exclusions. */}
                      <ReportFigure
                        {...testCoverageFigure({
                          withResult: byTest.rows.length,
                          inScope: byAthlete.rows.length,
                          testName: byTest.definition.name,
                          rangeLabel: period.range.label,
                          floored: byTest.rows.length > 0 && belowSquadFloor(byTest.rows.length),
                        })}
                      />
                      <div className="grid3">
                        <div className="card">
                          <p className="tiny">Median</p>
                          <p className="num" style={{ fontSize: 'var(--fs-20)', fontWeight: 'var(--w-black)' }}>
                            {byTest.median === null ? (byTest.rows.length === 0 ? 'No results' : NOT_SHOWN) : `${formatNumber(byTest.median, byTest.definition.decimal_places)} ${byTest.definition.unit}`}
                          </p>
                        </div>
                        <div className="card">
                          <p className="tiny">Q1</p>
                          <p className="num" style={{ fontSize: 'var(--fs-20)', fontWeight: 'var(--w-black)' }}>
                            {byTest.q1 === null ? (byTest.rows.length === 0 ? 'No results' : NOT_SHOWN) : formatNumber(byTest.q1, byTest.definition.decimal_places)}
                          </p>
                        </div>
                        <div className="card">
                          <p className="tiny">Q3</p>
                          <p className="num" style={{ fontSize: 'var(--fs-20)', fontWeight: 'var(--w-black)' }}>
                            {byTest.q3 === null ? (byTest.rows.length === 0 ? 'No results' : NOT_SHOWN) : formatNumber(byTest.q3, byTest.definition.decimal_places)}
                          </p>
                        </div>
                      </div>

                      {/* PATTERN-S7 C1: the table shell — best first in the
                          test's own direction, said in the header, with the
                          count over those in scope. */}
                      <TableShell
                        title={`${byTest.definition.name} — ranked`}
                        titleId="ranking-title"
                        sort={`${byTest.definition.higher_is_better ? 'Highest' : 'Lowest'} first — the best result in this test's own direction`}
                        count={`${byTest.rows.length} of ${byAthlete.rows.length} athletes`}
                        className="flush"
                      >
                        {byTest.rows.length === 0 ? (
                          /* "…yet" was true when the read was all-time. It is
                           * not true of a bounded one: an empty ranking now
                           * means nothing was recorded IN THIS PERIOD, and a
                           * coach told "no result recorded for this test yet"
                           * about a test the squad ran last season would go
                           * looking for a data-entry problem that isn't
                           * there. The empty state names the window and the
                           * widest one available. */
                          /* PATTERN-S6 C8 (2026-09-13): the grammar — the most
                             recent result on record for this test and its
                             date, and one action that widens the period to
                             the smallest one holding it; nothing on record
                             says so ("Nothing is missing"). */
                          <div style={{ padding: 'var(--sp-16)' }}>
                            {/* The `!` is sound: this branch renders only under
                                selectedDefinition, and byTestEmpty is null only
                                when it is — selectedTestId derives from
                                selectedDefinition. */}
                            <EmptyState
                              headingLevel={3}
                              title={byTestEmpty!.title}
                              body={byTestEmpty!.body}
                              action={byTestEmptyHref ? { href: byTestEmptyHref, label: byTestEmpty!.action!.label, clearsGroupFilter: scopeIsEmpty } : null}
                            />
                          </div>
                        ) : (
                          byTest.rows.map((r, i) => (
                            <div key={`${r.athlete_id}-${r.side ?? ''}`}>
                              {i > 0 ? <div className="hair" /> : null}
                              <div className="load-row tst-rank-row">
                                <span className="tst-rank-n num">{r.rank}</span>
                                <Link href={`/squad/${r.athlete_id}`} className="nm">
                                  {r.name}
                                </Link>
                                <span className="tiny">{r.side ?? ''}</span>
                                <span className="num nm">
                                  {formatNumber(r.value, byTest.definition.decimal_places)} {byTest.definition.unit}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </TableShell>

                      <section className="card flush" aria-labelledby="longitudinal-title">
                        <h2 className="card-title" id="longitudinal-title" style={{ padding: 'var(--s-8) var(--s-8) 0' }}>
                          Squad median over time &mdash; {period.range.label.toLowerCase()}
                        </h2>
                        {longitudinal.length === 0 ? (
                          <p className="tiny" style={{ padding: 'var(--sp-16)' }}>
                            No test dates in {period.range.label.toLowerCase()} — widen the period to see further back.
                          </p>
                        ) : (
                          longitudinal.map((p, i) => (
                            <div key={p.date}>
                              {i > 0 ? <div className="hair" /> : null}
                              <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto', padding: 'var(--s-5) var(--s-8)' }}>
                                <span className="sub num">{formatDate(p.date, timezone)}</span>
                                <span className="tiny">n = {p.n}{p.median === null ? ' · fewer than five' : ''}</span>
                                <span className="num nm">
                                  {p.median === null ? NOT_SHOWN : `${formatNumber(p.median, byTest.definition.decimal_places)} ${byTest.definition.unit}`}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </section>
                    </>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
