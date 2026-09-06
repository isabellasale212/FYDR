import Link from 'next/link';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchTestByTest, fetchTestLongitudinal, fetchTestingByAthlete } from '@/lib/queries/testingReport';
import { recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { BLANK, formatDate, formatNumber } from '@/lib/format';
import { resolveTestingPeriod, testingQuery, testingWindow } from './period';
import { periodCaveat, periodParamsFrom, periodSticky } from '@/lib/reportPeriod.server';
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

  const [byTest, longitudinal] = selectedTestId
    ? await Promise.all([
        fetchTestByTest(db, orgId, groupIds, selectedTestId, reportWindow),
        fetchTestLongitudinal(db, orgId, groupIds, selectedTestId, reportWindow),
      ])
    : [null, []];

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
        <p className="sub" style={{ margin: '0 0 10px' }}>
          {caveat}
        </p>
      ) : null}

      {byAthlete.definitions.length === 0 ? (
        <div className="empty">
          <h2>No test defined yet</h2>
          <p>
            <Link href="/testing">Define a test</Link> before a report has anything to
            show.
          </p>
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
                <a href={`/reports/testing/export?${query}`} className="rhead-btn">
                  Export CSV
                </a>
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
                    <p className="tiny" style={{ padding: 16 }}>
                      {groupIds.length > 0
                        ? `No athletes in the current scope (${groupScopeLabel(groups, groupIds)}) — clear the filter to see the whole squad.`
                        : 'No athletes in this squad yet.'}
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tbl" style={{ margin: '0 16px 16px', minWidth: 480 }}>
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
                                    {cell?.value === null || cell?.value === undefined ? BLANK : formatNumber(cell.value, d.decimal_places)}
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
                      <div className="grid3">
                        <div className="card">
                          <p className="tiny">Median</p>
                          <p className="num" style={{ fontSize: 20, fontWeight: 800 }}>
                            {byTest.median === null ? BLANK : formatNumber(byTest.median, byTest.definition.decimal_places)} {byTest.definition.unit}
                          </p>
                        </div>
                        <div className="card">
                          <p className="tiny">Q1</p>
                          <p className="num" style={{ fontSize: 20, fontWeight: 800 }}>
                            {byTest.q1 === null ? BLANK : formatNumber(byTest.q1, byTest.definition.decimal_places)}
                          </p>
                        </div>
                        <div className="card">
                          <p className="tiny">Q3</p>
                          <p className="num" style={{ fontSize: 20, fontWeight: 800 }}>
                            {byTest.q3 === null ? BLANK : formatNumber(byTest.q3, byTest.definition.decimal_places)}
                          </p>
                        </div>
                      </div>

                      <section className="card flush" aria-labelledby="ranking-title">
                        <h2 className="card-title" id="ranking-title" style={{ padding: '16px 16px 0' }}>
                          {byTest.definition.name} &mdash; ranked
                        </h2>
                        {byTest.rows.length === 0 ? (
                          /* "…yet" was true when the read was all-time. It is
                           * not true of a bounded one: an empty ranking now
                           * means nothing was recorded IN THIS PERIOD, and a
                           * coach told "no result recorded for this test yet"
                           * about a test the squad ran last season would go
                           * looking for a data-entry problem that isn't
                           * there. The empty state names the window and the
                           * widest one available. */
                          <p className="tiny" style={{ padding: 16 }}>
                            {groupIds.length > 0
                              ? `No result recorded for this test in ${period.range.label.toLowerCase()} for the current scope (${groupScopeLabel(groups, groupIds)}) — clear the filter, or widen the period to "All on record".`
                              : `No result recorded for this test in ${period.range.label.toLowerCase()} — widen the period to "All on record" to check the club's whole history.`}
                          </p>
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
                      </section>

                      <section className="card flush" aria-labelledby="longitudinal-title">
                        <h2 className="card-title" id="longitudinal-title" style={{ padding: '16px 16px 0' }}>
                          Squad median over time &mdash; {period.range.label.toLowerCase()}
                        </h2>
                        {longitudinal.length === 0 ? (
                          <p className="tiny" style={{ padding: 16 }}>
                            No test dates in {period.range.label.toLowerCase()} — widen the period to see further back.
                          </p>
                        ) : (
                          longitudinal.map((p, i) => (
                            <div key={p.date}>
                              {i > 0 ? <div className="hair" /> : null}
                              <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto', padding: '9px 16px' }}>
                                <span className="sub num">{formatDate(p.date, timezone)}</span>
                                <span className="tiny">n={p.n}</span>
                                <span className="num nm">
                                  {p.median === null ? BLANK : formatNumber(p.median, byTest.definition.decimal_places)} {byTest.definition.unit}
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
