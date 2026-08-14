import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Pill } from '@/components/Pill/Pill';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import { acwrInsufficiencyNote, acwrSuppressedLabel } from '@/lib/acwr';
import { fetchAthleteReport } from '@/lib/queries/athleteReport';
import { recordReportView } from '@/lib/queries/reports';
import { BLANK, ageFrom, enumLabel, formatDate, formatNumber, formatTime } from '@/lib/format';
import { availabilityStatus, SEVERITY_STATUS } from '@/lib/status';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Athlete report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PERIODS = [28, 90] as const;

/** screens/reports.md, report 1 of 5 — see lib/queries/athleteReport.ts's
 *  header for the full scope reasoning: built now that GPS records and
 *  testing, the two gaps reports.ts's own header named as the reason this
 *  report was cut, both exist. */
export default async function AthleteReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: SearchParams;
}) {
  const { athleteId } = await params;
  const { db, orgId, claims, timezone } = await requireReportAccess();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days) as (typeof PERIODS)[number]) ? Number(sp.days) : 28;

  const report = await fetchAthleteReport(db, orgId, athleteId, timezone, days);
  if (!report) notFound();

  const { athlete, compliancePct, openFlags, currentProgrammes } = report.summary;
  const status = availabilityStatus(athlete.availability?.status ?? null);
  const restrictions = athlete.availability?.restrictions ?? [];
  const age = ageFrom(athlete.date_of_birth);
  const openInjury = athlete.open_injuries[0];

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'athlete', {
    athlete_id: athleteId,
    from: report.from,
    to: report.to,
  });

  const loadDaysWithValue = report.load.byDay.filter((d) => d.load !== null);
  // fetchAthleteRecentSessions sorts most-recent-first (screens/schedule.md's
  // own "recent sessions" convention), so index 0 is the latest, not the last.
  const mostRecentSession = report.sessions.length > 0 ? report.sessions[0] : undefined;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> ·{' '}
            <Link href="/reports/athlete">Athlete report</Link>
          </p>
          <h1>
            {athlete.first_name} {athlete.last_name}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={`/reports/athlete/${athleteId}/export?days=${days}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/athlete/${athleteId}/pdf?days=${days}`} className="btn-ghost">
            Export PDF
          </a>
          <ThemeToggle />
        </div>
      </div>

      <div className="pbar">
        <div className="l1">
          <span className="nmx">
            {athlete.first_name} {athlete.last_name}
          </span>
          <span className="sub">
            {athlete.position ?? BLANK}
            {age !== null ? ` · ${age}` : ''}
            {athlete.team_name ? ` · ${athlete.team_name}` : ''}
          </span>
          <Pill status={status} />
          {restrictions.length > 0 ? <span className="sub">{restrictions.map(enumLabel).join(' · ')}</span> : null}
        </div>
        <div className="l2">
          <span>
            Squad no. <b className="mono">{athlete.squad_number ?? BLANK}</b>
          </span>
          <span className="dot">·</span>
          <span>
            Groups <b>{athlete.group_names.length > 0 ? athlete.group_names.join(', ') : BLANK}</b>
          </span>
          {openInjury ? (
            <>
              <span className="dot">·</span>
              <span>
                {enumLabel(openInjury.body_area)}
                {openInjury.side ? ` (${enumLabel(openInjury.side)})` : ''}, back{' '}
                <b className="mono">{openInjury.expected_return ? formatDate(openInjury.expected_return, timezone) : 'not set'}</b>
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="eyebrow">
          {formatDate(report.from, timezone)} to {formatDate(report.to, timezone)}
        </span>
        <div className="chiprow">
          {PERIODS.map((d) => (
            <Link key={d} href={`/reports/athlete/${athleteId}?days=${d}`} className="squad-chip" aria-pressed={days === d}>
              {d} days
            </Link>
          ))}
        </div>
      </div>

      <ReportPager
        pages={[
          {
            label: 'Summary',
            content: (
              <div className="stack">
                <div className="grid3">
                  <div className="card">
                    <p className="tiny">Compliance, this period</p>
                    <p className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                      {compliancePct === null ? '—' : `${compliancePct}%`}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Open flags</p>
                    <p className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                      {openFlags.length}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Current programme{currentProgrammes.length === 1 ? '' : 's'}</p>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>
                      {currentProgrammes.length === 0 ? BLANK : currentProgrammes.map((p) => p.name).join(', ')}
                    </p>
                  </div>
                </div>

                <section className="card" aria-labelledby="flags-title">
                  <h2 className="card-title" id="flags-title">
                    Open flags
                  </h2>
                  {openFlags.length === 0 ? (
                    <p className="cap">No open flag for this athlete.</p>
                  ) : (
                    openFlags.map((f) => (
                      <div className="kv" key={f.id}>
                        <span className="sub">
                          {enumLabel(f.domain)} · {f.what}
                          {f.observed ? ` (${f.observed}${f.expected ? ` vs ${f.expected}` : ''})` : ''}
                        </span>
                        <Pill status={SEVERITY_STATUS[f.severity]} />
                      </div>
                    ))
                  )}
                </section>
              </div>
            ),
          },
          {
            label: 'Wellness',
            content: (
              <section className="card" aria-labelledby="wellness-title">
                <h2 className="card-title" id="wellness-title">
                  Wellness
                </h2>
                <p className="import-sub">
                  Composite readiness against {athlete.first_name}&apos;s own 14 day rolling mean and &plusmn;1SD band.
                </p>
                {report.wellness.every((p) => p.value === null) ? (
                  <EmptyState headingLevel={3} title="No wellness entries in this period" body="Nothing submitted in this window." />
                ) : (
                  <WellnessChart series={report.wellness} min={0} max={100} ticks={[0, 25, 50, 75, 100]} title={`Readiness for ${athlete.first_name} ${athlete.last_name}`} timezone={timezone} />
                )}
              </section>
            ),
          },
          {
            label: 'Load',
            content: (
              <div className="stack">
                <div className="grid3">
                  <div className="card">
                    <p className="tiny">Acute (7 day)</p>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.load.acute === null ? '—' : formatNumber(report.load.acute, 0)}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Chronic (28 day, weekly)</p>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.load.chronic === null ? '—' : formatNumber(report.load.chronic, 0)}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">ACWR</p>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.load.acwr === null ? '—' : formatNumber(report.load.acwr, 2)}
                    </p>
                  </div>
                </div>
                {report.load.suppressed ? (
                  <p className="cap">
                    {acwrSuppressedLabel(report.load.daysWithData)} — {acwrInsufficiencyNote(report.load.daysWithData)}
                  </p>
                ) : null}

                <section className="card" aria-labelledby="gps-title">
                  <h2 className="card-title" id="gps-title">
                    GPS, this period
                  </h2>
                  {report.load.gps.sessionsWithData === 0 ? (
                    <p className="cap">No GPS data for this athlete in this period.</p>
                  ) : (
                    <div className="grid3">
                      <div>
                        <p className="tiny">Sessions with data</p>
                        <p className="mono nm">{report.load.gps.sessionsWithData}</p>
                      </div>
                      <div>
                        <p className="tiny">Total distance</p>
                        <p className="mono nm">{formatNumber(report.load.gps.totalDistanceM, 0)} m</p>
                      </div>
                      <div>
                        <p className="tiny">High speed distance</p>
                        <p className="mono nm">{formatNumber(report.load.gps.highSpeedDistanceM, 0)} m</p>
                      </div>
                    </div>
                  )}
                </section>

                <section className="card flush" aria-labelledby="load-days-title">
                  <h2 className="card-title" id="load-days-title" style={{ padding: '16px 16px 0' }}>
                    Session load by day
                  </h2>
                  {loadDaysWithValue.length === 0 ? (
                    <p className="tiny" style={{ padding: 16 }}>
                      No session load recorded in this period.
                    </p>
                  ) : (
                    loadDaysWithValue.map((d, i) => (
                      <div key={d.date}>
                        {i > 0 ? <div className="hair" /> : null}
                        <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                          <span className="sub mono">{formatDate(d.date, timezone)}</span>
                          <span className="load-val mono">{formatNumber(d.load, 0)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </div>
            ),
          },
          {
            label: 'Gym and testing',
            content: (
              <div className="stack">
                <div className="grid3">
                  <div className="card">
                    <p className="tiny">Gym sessions logged</p>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.gymAndTesting.sessionsLogged}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Completed</p>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.gymAndTesting.sessionsCompleted}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Programme{currentProgrammes.length === 1 ? '' : 's'}</p>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>
                      {currentProgrammes.length === 0 ? BLANK : currentProgrammes.map((p) => `${p.name} (${enumLabel(p.type)})`).join(', ')}
                    </p>
                  </div>
                </div>

                <section className="card flush" aria-labelledby="tests-title">
                  <h2 className="card-title" id="tests-title" style={{ padding: '16px 16px 0' }}>
                    Testing
                  </h2>
                  {report.gymAndTesting.tests.length === 0 ? (
                    <p className="tiny" style={{ padding: 16 }}>
                      No test result recorded for this athlete.
                    </p>
                  ) : (
                    <table className="tbl" style={{ margin: '0 16px', width: 'calc(100% - 32px)' }}>
                      <thead>
                        <tr>
                          <th scope="col">Test</th>
                          <th scope="col" className="r">
                            PB
                          </th>
                          <th scope="col">PB date</th>
                          <th scope="col" className="r">
                            Latest
                          </th>
                          <th scope="col">Latest date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.gymAndTesting.tests.map((t) => (
                          <tr key={t.test_definition_id}>
                            <td className="nm">
                              {t.name} <span className="tiny">({t.unit})</span>
                            </td>
                            <td className="r mono">{t.pbValue === null ? BLANK : formatNumber(t.pbValue, t.decimal_places)}</td>
                            <td className="sub mono">{t.pbDate ? formatDate(t.pbDate, timezone) : BLANK}</td>
                            <td className="r mono">{t.latestValue === null ? BLANK : formatNumber(t.latestValue, t.decimal_places)}</td>
                            <td className="sub mono">{t.latestDate ? formatDate(t.latestDate, timezone) : BLANK}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="cap" style={{ padding: 16 }}>
                    Squad percentiles aren&apos;t shown on this one-athlete report &mdash; see the
                    Testing report for squad-wide comparisons.
                  </p>
                </section>
              </div>
            ),
          },
        ]}
      />

      <p className="cap" style={{ marginTop: 14 }}>
        {report.sessions.length} session{report.sessions.length === 1 ? '' : 's'} scheduled for {athlete.first_name} in this
        period
        {mostRecentSession ? `, most recent ${formatDate(mostRecentSession.starts_at, timezone)} ${formatTime(mostRecentSession.starts_at, timezone)}` : ''}
        .
      </p>
    </>
  );
}
