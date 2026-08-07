import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchTestByTest, fetchTestLongitudinal, fetchTestingByAthlete } from '@/lib/queries/testingReport';
import { recordReportView } from '@/lib/queries/reports';
import { parseGroupParam } from '@/lib/groupFilter';
import { BLANK, formatDate, formatNumber } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Testing report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/reports.md, report 5 of 5 — see lib/queries/testingReport.ts's
 *  header for the full scope reasoning. The last of the five report types
 *  to get built, closing this build's Reports library out completely. */
export default async function TestingReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims } = await requireReportAccess();
  const params = await searchParams;
  const groupIds = parseGroupParam(params.groups);

  const [groups, byAthlete] = await Promise.all([fetchGroups(db, orgId), fetchTestingByAthlete(db, orgId, groupIds)]);

  const requestedTestId = typeof params.test === 'string' ? params.test : undefined;
  const selectedTestId = byAthlete.definitions.find((d) => d.id === requestedTestId)?.id ?? byAthlete.definitions[0]?.id ?? null;

  const [byTest, longitudinal] = selectedTestId
    ? await Promise.all([fetchTestByTest(db, orgId, groupIds, selectedTestId), fetchTestLongitudinal(db, orgId, groupIds, selectedTestId)])
    : [null, []];

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'testing', {
    group_ids: groupIds,
    test_definition_id: selectedTestId,
  });

  const groupQuery = groupIds.length ? `&groups=${groupIds.join(',')}` : '';

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> · Testing
          </p>
          <h1>Testing report</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={`/reports/testing/export?${selectedTestId ? `test=${selectedTestId}${groupQuery}` : groupQuery.replace('&', '')}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/testing/pdf?${selectedTestId ? `test=${selectedTestId}${groupQuery}` : groupQuery.replace('&', '')}`} className="btn-ghost">
            Export PDF
          </a>
          <ThemeToggle />
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        Squad · {orgName} · {byAthlete.rows.length} athletes · {byAthlete.definitions.length} tests
      </p>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {byAthlete.definitions.length === 0 ? (
        <div className="empty">
          <h2>No test defined yet</h2>
          <p>Define a test in Testing before a report has anything to show.</p>
        </div>
      ) : (
        <ReportPager
          pages={[
            {
              label: 'By athlete',
              content: (
                <section className="card flush" aria-labelledby="by-athlete-title">
                  <h2 className="card-title" id="by-athlete-title" style={{ padding: '16px 16px 0' }}>
                    Personal best per test
                  </h2>
                  <p className="import-sub" style={{ padding: '0 16px' }}>
                    Every athlete, every test, current personal best. A blank cell means no result recorded.
                  </p>
                  {byAthlete.rows.length === 0 ? (
                    <p className="tiny" style={{ padding: 16 }}>
                      No athlete in this filter.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tbl" style={{ margin: '0 16px 16px', minWidth: 480 }}>
                        <thead>
                          <tr>
                            <th scope="col">Athlete</th>
                            {byAthlete.definitions.map((d) => (
                              <th key={d.id} scope="col" className="r">
                                {d.name}
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
                                  <td key={d.id} className="r mono">
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
                  <div className="chiprow">
                    {byAthlete.definitions.map((d) => (
                      <Link
                        key={d.id}
                        href={`/reports/testing?test=${d.id}${groupQuery}`}
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
                          <p className="mono" style={{ fontSize: 20, fontWeight: 800 }}>
                            {byTest.median === null ? BLANK : formatNumber(byTest.median, byTest.definition.decimal_places)} {byTest.definition.unit}
                          </p>
                        </div>
                        <div className="card">
                          <p className="tiny">Q1</p>
                          <p className="mono" style={{ fontSize: 20, fontWeight: 800 }}>
                            {byTest.q1 === null ? BLANK : formatNumber(byTest.q1, byTest.definition.decimal_places)}
                          </p>
                        </div>
                        <div className="card">
                          <p className="tiny">Q3</p>
                          <p className="mono" style={{ fontSize: 20, fontWeight: 800 }}>
                            {byTest.q3 === null ? BLANK : formatNumber(byTest.q3, byTest.definition.decimal_places)}
                          </p>
                        </div>
                      </div>

                      <section className="card flush" aria-labelledby="ranking-title">
                        <h2 className="card-title" id="ranking-title" style={{ padding: '16px 16px 0' }}>
                          {byTest.definition.name} &mdash; ranked
                        </h2>
                        {byTest.rows.length === 0 ? (
                          <p className="tiny" style={{ padding: 16 }}>
                            No result recorded for this test in this filter.
                          </p>
                        ) : (
                          byTest.rows.map((r, i) => (
                            <div key={`${r.athlete_id}-${r.side ?? ''}`}>
                              {i > 0 ? <div className="hair" /> : null}
                              <div className="load-row" style={{ gridTemplateColumns: '28px 1fr auto auto', padding: '9px 16px' }}>
                                <span className="tiny mono">{r.rank}</span>
                                <Link href={`/squad/${r.athlete_id}`} className="nm">
                                  {r.name}
                                </Link>
                                <span className="tiny">{r.side ?? ''}</span>
                                <span className="mono nm">
                                  {formatNumber(r.value, byTest.definition.decimal_places)} {byTest.definition.unit}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </section>

                      <section className="card flush" aria-labelledby="longitudinal-title">
                        <h2 className="card-title" id="longitudinal-title" style={{ padding: '16px 16px 0' }}>
                          Squad median over time
                        </h2>
                        {longitudinal.length === 0 ? (
                          <p className="tiny" style={{ padding: 16 }}>
                            No history for this test yet.
                          </p>
                        ) : (
                          longitudinal.map((p, i) => (
                            <div key={p.date}>
                              {i > 0 ? <div className="hair" /> : null}
                              <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto', padding: '9px 16px' }}>
                                <span className="sub mono">{formatDate(p.date)}</span>
                                <span className="tiny">n={p.n}</span>
                                <span className="mono nm">
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
