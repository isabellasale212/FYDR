import Link from 'next/link';
import { fetchMyLatestRecord } from '@/lib/queries/myLatestRecord';
import { staffEmptyCopy } from '@/lib/staffEmpty';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { Pill } from '@/components/Pill/Pill';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import { acwrInsufficiencyNote, acwrSuppressedLabel } from '@/lib/acwr';
import { fetchAthleteReport } from '@/lib/queries/athleteReport';
import { recordReportView } from '@/lib/queries/reports';
import { ageFrom, bodyAreaPhrase, enumLabel, formatDate, formatNumber } from '@/lib/format';
import { NO_RESULT } from '@/lib/reportFigures';
import { availabilityStatus, SEVERITY_STATUS } from '@/lib/status';
import { athleteDefinition } from '@/lib/reportCatalogue';
import { reportRoleNote } from '@/lib/reportRoleNote';
import { athleteComplianceFigure } from '@/lib/reportFigureCards';
import { ReportFigure } from '@/components/ReportFigure/ReportFigure';
import { TableShell } from '@/components/TableShell/TableShell';
import { ExportDialog } from '@/components/ExportDialog/ExportDialog';

import { requireReport } from '@/lib/session';
import { rpeOffLine } from '@/lib/rpeSetting';
import { isUuid } from '@/lib/uuid';
import { GPS_REGION_BODY, GPS_REGION_NOTE } from '@/lib/premiumWords';
import { PlanGateCard } from '@/components/PlanGate/PlanGate';
import { isPremium } from '@/lib/tier';
import type { AppRole } from '@/lib/types/database';
import {
  ACWR_WINDOW_CAPTION,
  ATHLETE_PERIOD_REASONS,
  ATHLETE_PERIODS,
  exportQuery,
  periodCaveat,
  periodParamsFrom,
  resolveAthletePeriod,
} from './period';

export const metadata = { title: 'Athlete report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* The `?days=[28, 90]` chip row that used to live here is gone. Two separate
 * things were wrong with it and only one of them was the narrow vocabulary:
 *
 *  - IT DROPPED THE GROUP FILTER. Every chip's href was
 *    `/reports/athlete/${athleteId}?days=${d}` — hand-built from a fixed list
 *    of keys, so `?groups=` (and anything added later) vanished on every
 *    period change. A coach filtered to Forwards, changed the period, and
 *    silently lost the filter: CLAUDE.md §3, broken by an href. PeriodSelector
 *    wraps ReportSelectNav, which rebuilds from the live useSearchParams(),
 *    so the whole class of bug is gone rather than this one instance of it.
 *  - IT OFFERED TWO WINDOWS. Now week / month / season / year / all, with
 *    `day` disabled-and-explained rather than hidden.
 *
 * The period does NOT reach the ACWR tiles on the Load tab — see ./period.ts's
 * header, and ACWR_WINDOW_CAPTION printed under them below. */

/** screens/reports.md, report 1 of 5 — see lib/queries/athleteReport.ts's
 *  header for the full scope reasoning: built now that GPS records and
 *  testing, the two gaps reports.ts's own header named as the reason this
 *  report was cut, both exist. */

/* Vs PB, direction-corrected. A sprint is faster when the number is smaller,
 * so `gap` is signed against the test's OWN direction — printing a slower time
 * as a gain is the whole reason MyTestSummary now carries higher_is_better.
 * "At PB" is a real third state, not a zero: it says the latest result IS their
 * best, which is different from being a hair off it. */
function vsPb(t: {
  pbValue: number | null;
  latestValue: number | null;
  higher_is_better: boolean;
  decimal_places: number;
}): { label: string; tone: 'at' | 'off' | 'heavy'; heavy: boolean } | null {
  if (t.pbValue === null || t.latestValue === null) return null;
  const gap = t.higher_is_better ? t.latestValue - t.pbValue : t.pbValue - t.latestValue;
  const atPb = Math.abs(gap) < Math.pow(10, -t.decimal_places) / 2;
  if (atPb) return { label: 'at PB', tone: 'at', heavy: false };
  const pctOff = t.pbValue !== 0 ? Math.abs(gap / t.pbValue) * 100 : 0;
  const heavy = pctOff >= 10;
  const sign = gap > 0 ? '+' : '−';
  return {
    label: `${sign}${formatNumber(Math.abs(gap), t.decimal_places)} · ${sign}${Math.round(pctOff)}%`,
    tone: heavy ? 'heavy' : 'off',
    heavy,
  };
}

export default async function AthleteReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: SearchParams;
}) {
  const { athleteId } = await params;
  const { db, orgId, claims, timezone, tier, collectsRpe } = await requireReport('athlete');
  /* Shape-check the route param before it reaches a query. Authenticated
     first, so this never becomes a probe; then 404 rather than 500, because a
     malformed id is a URL that does not name anything, not a server fault. */
  if (!isUuid(athleteId)) notFound();

  const sp = await searchParams;
  const period = await resolveAthletePeriod(db, orgId, athleteId, timezone, periodParamsFrom(sp));
  const caveat = periodCaveat(period);

  const report = await fetchAthleteReport(db, orgId, athleteId, timezone, { from: period.from, to: period.to });
  if (!report) notFound();

  const { athlete, openFlags, currentProgrammes } = report.summary;
  /* PATTERN-S6 C8: the wellness card's empty state names the most recent
     check-in on record, any period — the same read the athlete's own My data
     makes for its empty period (12 C6). */
  const [latestWellnessOnRecord, latestGpsOnRecord] = await Promise.all([
    fetchMyLatestRecord(db, athleteId, 'wellness'),
    fetchMyLatestRecord(db, athleteId, 'gps'),
  ]);
  const gpsEmpty = staffEmptyCopy({
    domain: 'gps',
    firstName: athlete.first_name,
    periodKey: period.key,
    rangeLabel: period.label,
    latest: latestGpsOnRecord,
    latestLabel: latestGpsOnRecord ? formatDate(latestGpsOnRecord, timezone) : null,
    seasonStart: period.season?.starts_on ?? null,
    today: report.to,
  });
  /* The tests summary is all-time, so an empty one is "nothing on record":
     the grammar's second state, no action. */
  const testsEmpty = staffEmptyCopy({
    domain: 'testing',
    firstName: athlete.first_name,
    periodKey: 'all',
    rangeLabel: 'All on record',
    latest: null,
    latestLabel: null,
    seasonStart: null,
    today: report.to,
  });
  const wellnessEmpty = staffEmptyCopy({
    domain: 'wellness',
    firstName: athlete.first_name,
    periodKey: period.key,
    rangeLabel: period.label,
    latest: latestWellnessOnRecord,
    latestLabel: latestWellnessOnRecord ? formatDate(latestWellnessOnRecord, timezone) : null,
    seasonStart: period.season?.starts_on ?? null,
    today: report.to,
  });
  const status = availabilityStatus(athlete.availability?.status ?? null);
  const restrictions = athlete.availability?.restrictions ?? [];
  const age = ageFrom(athlete.date_of_birth, timezone);
  const openInjury = athlete.open_injuries[0];

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'athlete', {
    athlete_id: athleteId,
    from: report.from,
    to: report.to,
    period: period.key,
  });

  /* Narrowed, not just filtered: the predicate tells TypeScript the load is a
     number so the bar arithmetic below does not have to re-check it. */
  const loadDaysWithValue = report.load.byDay.filter(
    (d): d is typeof d & { load: number } => d.load !== null,
  );
  const peakLoad = loadDaysWithValue.reduce((m, d) => Math.max(m, d.load), 0);

  /* The latest wellness reading actually on file, and how many of the window's
     days carry one. A composite score with no date beside it invites reading a
     three-week-old number as today's. */
  const wellnessWithValue = report.wellness.filter(
    (p): p is typeof p & { value: number } => p.value !== null,
  );
  const latestWellness = wellnessWithValue.length > 0 ? wellnessWithValue[wellnessWithValue.length - 1]! : null;
  const wellnessSubmitted = wellnessWithValue.length;

  /* "N tests well below PB" — the same 10% threshold vsPb() uses for its own
     row wash, counted once here so the badge and the washes cannot disagree. */
  const wellBelowPb = report.gymAndTesting.tests.filter((t) => vsPb(t)?.heavy).length;

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
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          {/* PATTERN-S7 C3: named and described before it is written. */}
          <ExportDialog
            href={`/reports/athlete/${athleteId}/export?${exportQuery(period.key)}`}
            className="btn-ghost"
            descriptor={{
              fileName: `athlete-report-${athlete.last_name.toLowerCase()}-${report.from}-to-${report.to}.csv`,
              report: `Athlete report, ${athlete.first_name} ${athlete.last_name}`,
              window: `${period.label} (${report.from} to ${report.to})`,
              scope: `One athlete, ${athlete.first_name} ${athlete.last_name}`,
              rows: report.load.byDay.length + report.gymAndTesting.tests.length,
              rowNoun: 'day (readiness and session load), then one per test',
              filters: [],
              medical: false,
            }}
          />
          <a href={`/reports/athlete/${athleteId}/pdf?${exportQuery(period.key)}`} className="btn-ghost">
            Export PDF
          </a>
        </div>
      </div>

      {/* The design's identity card. It leads with the POSITION, not the name
          again — the name is already the page title, and what a coach needs
          next to it is what this athlete plays and whether they are available.
          Squad number, age, team and groups keep their line underneath. */}
      <div className="card ath-id">
        <span className="ath-avatar" aria-hidden="true">
          {`${athlete.first_name[0] ?? ''}${athlete.last_name[0] ?? ''}`.toUpperCase()}
        </span>
        <span className="ath-id-main">
          <span className="ath-id-line">
            <span className="ath-position">{athlete.position ?? 'Position not set'}</span>
            <Pill status={status} />
            {restrictions.length > 0 ? (
              <span className="tiny" style={{ color: 'var(--muted)' }}>{restrictions.map(enumLabel).join(' · ')}</span>
            ) : null}
          </span>
          <span className="ath-meta">
            {[
              age !== null ? String(age) : null,
              athlete.team_name,
              athlete.squad_number !== null ? `squad no. ${athlete.squad_number}` : null,
              athlete.group_names.length > 0 ? athlete.group_names.join(', ') : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'No squad detail on file'}
          </span>
          {openInjury ? (
            <span className="tiny" style={{ color: 'var(--muted)' }}>
              {bodyAreaPhrase(openInjury)}
              {openInjury.side ? ` (${enumLabel(openInjury.side)})` : ''}, back{' '}
              {openInjury.expected_return ? formatDate(openInjury.expected_return, timezone) : 'not set'}
            </span>
          ) : null}
        </span>
        {/* The cross-domain compliance figure stood at the end of this row
            (carried over from the summary tiles the card replaced) until
            PATTERN-S7 C1, 2026-09-13: it is now the report's one emphasised
            figure card, leading the Summary page below, with its
            denominator, sample and exclusions in full. */}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-16)', alignItems: 'center', marginBottom: 'var(--sp-14)', flexWrap: 'wrap' }}>
        <span className="eyebrow">
          {period.label} · {formatDate(report.from, timezone)} to {formatDate(report.to, timezone)}
        </span>
      </div>

      {caveat ? (
        <p className="cap" style={{ marginBottom: 'var(--sp-12)' }}>
          {caveat}
        </p>
      ) : null}

      {/* PATTERN-S7 C1: the catalogue's sentence, above the numbers — the
          same card the shared header draws (.rhead-definition), composed
          here because this report's header is its own (one athlete, a
          breadcrumb, no group chips). The same words head both exports. */}
      <div className="card rhead-definition" style={{ marginBottom: 'var(--sp-14)' }}>
        <p>{athleteDefinition({ athlete: `${athlete.first_name} ${athlete.last_name}`, start: formatDate(report.from, timezone), end: formatDate(report.to, timezone) })}</p>
      </div>
      {/* PATTERN-S7 C10: the role note — what this reader sees of the injury
          detail, composed here because this report's header is its own. */}
      {reportRoleNote('athlete', claims.roles) ? (
        <p className="tiny rhead-rolenote" style={{ margin: 'calc(-1 * var(--sp-6)) 0 var(--sp-14)' }}>
          {reportRoleNote('athlete', claims.roles)}
        </p>
      ) : null}

      {/* The period scopes every tab, so it rides the tab row rather than a
          row of its own above it. */}
      <ReportPager
        right={
            /* `value` is the CLAMPED key, not the raw URL value — a select
               whose value matches no option silently shows the first one
               instead. `allowed` leaves `day` visible-but-disabled with its
               reason; `season` is absent entirely when the club has no season
               row. */
            <PeriodSelector
              value={period.key}
              allowed={ATHLETE_PERIODS}
              reasons={ATHLETE_PERIOD_REASONS}
              season={period.season}
              ariaLabel="Reporting period"
            />
        }
        pages={[
          {
            label: 'Summary',
            content: (
              <div className="stack">
                {/* PATTERN-S7 C1: the one emphasised figure — met of expected
                    across every domain expected of this athlete, the count
                    before the percentage, their waived days as the exclusions. */}
                <ReportFigure
                  {...athleteComplianceFigure({
                    met: report.summary.compliance.met,
                    expected: report.summary.compliance.expected,
                    waived: report.summary.compliance.waived,
                    firstName: athlete.first_name,
                    rangeLabel: period.label,
                  })}
                />
                <div className="ath-summary-grid">
                  <section className="card" aria-labelledby="sum-wellness">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-12)' }}>
                      <h2 className="ath-card-title" id="sum-wellness">
                        Wellness
                      </h2>
                      <span className="ath-latest">
                        {latestWellness === null ? 'Nothing submitted' : latestWellness.value}
                      </span>
                      <span className="tiny" style={{ color: 'var(--faint)' }}>
                        {latestWellness === null
                          ? 'nothing submitted'
                          : `latest, ${formatDate(latestWellness.date, timezone)}`}
                      </span>
                    </div>
                    {report.wellness.every((p) => p.value === null) ? (
                      /* PATTERN-S6 C8 (2026-09-13): the one empty-state grammar
                         — the window, the most recent check-in on record and
                         its date, what would fill it, one action that widens
                         the period. Never "never" when the truth is "not in
                         this period". */
                      <EmptyState
                        headingLevel={3}
                        title={wellnessEmpty.title}
                        body={wellnessEmpty.body}
                        action={
                          wellnessEmpty.action
                            ? { href: `/reports/athlete/${athleteId}?period=${wellnessEmpty.action.period}`, label: wellnessEmpty.action.label }
                            : null
                        }
                      />
                    ) : (
                      <>
                        {/* Bars, and three gridlines rather than five. A
                            readiness score is one self-reported answer per
                            day, not a continuous quantity sampled daily, so
                            the slope between two points was never a rate to
                            read — and a day nobody submitted now leaves an
                            obvious gap in a row of columns. 0/50/100 is the
                            whole scale plus its midpoint; 25 and 75 were
                            gridlines nobody reads a readiness score against. */}
                        <WellnessChart
                          series={report.wellness}
                          bars
                          min={0}
                          max={100}
                          ticks={[0, 50, 100]}
                          title={`Readiness for ${athlete.first_name} ${athlete.last_name}`}
                          timezone={timezone}
                        />
                        <p className="tiny" style={{ color: 'var(--muted)', marginTop: 'var(--sp-10)' }}>
                          {wellnessSubmitted} of {report.wellness.length} days submitted
                        </p>
                      </>
                    )}
                  </section>

                  <section className="card" aria-labelledby="sum-load">
                    <h2 className="ath-card-title" id="sum-load" style={{ marginBottom: 'var(--sp-12)' }}>
                      Load
                    </h2>
                    {/* THE THREE TILES DO NOT MOVE WITH THE PERIOD CONTROL —
                        acute is trailing 7 days and chronic trailing 28 by
                        definition (lib/acwr.ts). When the baseline is still
                        building they show a dash and say so: an estimate from
                        too few days is worse than no estimate. */}
                    {/* Migration 0118: the club setting (the absence rule). */}
                    {!collectsRpe ? (
                      <div className="ath-note" data-rpe-off>
                        <span className="ath-note-title">Session RPE is off for this club</span>
                        <span className="ath-note-body">{rpeOffLine('session load')}</span>
                      </div>
                    ) : null}
                    {report.load.suppressed ? (
                      <div className="ath-note">
                        <span className="ath-note-title">{acwrSuppressedLabel(report.load.daysWithData)}</span>
                        <span className="ath-note-body">{acwrInsufficiencyNote(report.load.daysWithData)}</span>
                      </div>
                    ) : null}
                    <div className="ath-load-tiles">
                      {[
                        { label: 'Acute', value: report.load.acute, dp: 0, sub: 'trailing 7 days' },
                        { label: 'Chronic', value: report.load.chronic, dp: 0, sub: 'trailing 28 days' },
                        { label: 'ACWR', value: report.load.acwr, dp: 2, sub: 'trailing 7:28' },
                      ].map((tile) => (
                        <div key={tile.label} className="ath-tile">
                          <span className="ath-tile-label">{tile.label}</span>
                          <span className="ath-tile-value" data-empty={tile.value === null}>
                            {tile.value === null ? 'Building baseline' : formatNumber(tile.value, tile.dp)}
                          </span>
                          <span className="ath-tile-sub">{tile.sub}</span>
                        </div>
                      ))}
                    </div>
                    {/* D-20's second half (decision batch, 14 September 2026):
                        a premium REGION inside a base page shows a card, never
                        vanishes — and never reads "0 m" for a plan that returns
                        no rows (0119), which is a zero standing in for an
                        absence. The card names the plan; the plan page says the
                        rest. */}
                    {isPremium(tier) ? (
                      <div className="ath-stats" style={{ marginTop: 'var(--sp-12)' }}>
                        <div>
                          <div className="ath-stat-label">GPS sessions</div>
                          <div className="ath-stat-value">{report.load.gps.sessionsWithData}</div>
                        </div>
                        <div>
                          <div className="ath-stat-label">Total distance</div>
                          <div className="ath-stat-value">
                            {formatNumber(report.load.gps.totalDistanceM, 0)} m
                          </div>
                        </div>
                        <div>
                          <div className="ath-stat-label">High speed</div>
                          <div className="ath-stat-value">
                            {formatNumber(report.load.gps.highSpeedDistanceM, 0)} m
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="tiny" style={{ marginTop: 'var(--sp-12)' }} data-gps-plan-note>
                        {GPS_REGION_NOTE}
                      </p>
                    )}
                    <div style={{ marginTop: 'var(--sp-12)', paddingTop: 'var(--sp-10)', borderTop: '1px solid var(--hair)' }}>
                      <p style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--w-bold)', margin: '0 0 var(--s-4)' }}>
                        Session load by day
                        {loadDaysWithValue.length > 0 ? (
                          <span className="tiny" style={{ fontWeight: 'var(--w-regular)', color: 'var(--faint)' }}>
                            {' '}
                            · {loadDaysWithValue.length} day{loadDaysWithValue.length === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </p>
                      {loadDaysWithValue.length === 0 ? (
                        <p className="tiny" style={{ color: 'var(--muted)' }}>
                          No session load recorded in this period.
                        </p>
                      ) : (
                        <div className="ath-loaddays">
                          {loadDaysWithValue.map((d) => (
                            <div key={d.date} className="ath-loadday">
                              <span className="ath-loadday-day">{formatDate(d.date, timezone)}</span>
                              <span className="cmpl-track">
                                <span
                                  className="cmpl-fill"
                                  data-tone="accent"
                                  style={{ width: `${peakLoad > 0 ? Math.round((100 * d.load) / peakLoad) : 0}%` }}
                                />
                              </span>
                              <span className="ath-loadday-val">{formatNumber(d.load, 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <section className="card cmpl-table" aria-labelledby="sum-gym">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-14)', flexWrap: 'wrap' }}>
                    <h2 className="ath-card-title" id="sum-gym">
                      Gym and testing
                    </h2>
                    <span className="tiny" style={{ color: 'var(--muted)' }}>
                      {report.gymAndTesting.sessionsCompleted} of {report.gymAndTesting.sessionsLogged} gym
                      sessions completed
                      {currentProgrammes.length > 0 ? ` · ${currentProgrammes.map((p) => p.name).join(', ')}` : ''}
                    </span>
                    {wellBelowPb > 0 ? (
                      <span className="pill pill-bad" style={{ marginLeft: 'auto' }}>
                        {wellBelowPb} test{wellBelowPb === 1 ? '' : 's'} well below PB
                      </span>
                    ) : null}
                  </div>
                  {report.gymAndTesting.tests.length === 0 ? (
                    <EmptyState headingLevel={3} title={testsEmpty.title} body={testsEmpty.body} />
                  ) : (
                    <>
                      <div className="ath-tests-head">
                        <span>Test</span>
                        <span style={{ textAlign: 'right' }}>PB</span>
                        <span style={{ textAlign: 'right' }}>PB date</span>
                        <span style={{ textAlign: 'right' }}>Latest</span>
                        <span style={{ textAlign: 'right' }}>Latest date</span>
                        <span style={{ textAlign: 'right' }}>Vs PB</span>
                      </div>
                      {report.gymAndTesting.tests.map((t) => {
                        const delta = vsPb(t);
                        return (
                          <div key={t.test_definition_id} className="ath-test-row" data-heavy={delta?.heavy ?? false}>
                            <span>
                              <span style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--w-semi)' }}>{t.name}</span>{' '}
                              <span className="tiny" style={{ color: 'var(--faint)' }}>
                                ({t.unit})
                              </span>
                            </span>
                            <span className="ath-test-num">
                              {t.pbValue === null ? NO_RESULT : formatNumber(t.pbValue, t.decimal_places)}
                            </span>
                            <span className="ath-test-date">
                              {t.pbDate ? formatDate(t.pbDate, timezone) : NO_RESULT}
                            </span>
                            <span className="ath-test-num">
                              {t.latestValue === null ? NO_RESULT : formatNumber(t.latestValue, t.decimal_places)}
                            </span>
                            <span className="ath-test-date">
                              {t.latestDate ? formatDate(t.latestDate, timezone) : NO_RESULT}
                            </span>
                            <span className="ath-test-delta" data-tone={delta?.tone ?? 'at'}>
                              {delta?.label ?? 'No comparison'}
                            </span>
                          </div>
                        );
                      })}
                      {/* The "squad percentiles are not shown" half is gone per
                          review — a one-athlete report showing one athlete is not
                          news. What stays is the sign convention, which is the
                          only place in the app that says a faster sprint counts
                          as a gain. */}
                      
                    </>
                  )}
                </section>

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
                {report.wellness.every((p) => p.value === null) ? (
                  <EmptyState
                    headingLevel={3}
                    title={wellnessEmpty.title}
                    body={wellnessEmpty.body}
                    action={
                      wellnessEmpty.action
                        ? { href: `/reports/athlete/${athleteId}?period=${wellnessEmpty.action.period}`, label: wellnessEmpty.action.label }
                        : null
                    }
                  />
                ) : (
                  <WellnessChart series={report.wellness} bars min={0} max={100} ticks={[0, 50, 100]} title={`Readiness for ${athlete.first_name} ${athlete.last_name}`} timezone={timezone} />
                )}
              </section>
            ),
          },
          {
            label: 'Load',
            content: (
              <div className="stack">
                {/* THE THREE TILES BELOW DO NOT MOVE WITH THE PERIOD CONTROL,
                    and the caption under them says so in words rather than
                    leaving the coach to infer it from the tile labels. ACWR is
                    DEFINED as trailing 7-day acute over trailing 28-day chronic
                    (lib/acwr.ts); there is no season-long or all-time ratio to
                    show. The risk this caption exists to close is specific: a
                    coach who has set the control to "Last 365 days" reads
                    "ACWR 1.42" beside it and takes it as a year-long figure.
                    Every panel BELOW this row — GPS totals, session load by
                    day — is genuinely period-scoped and is captioned "this
                    period" accordingly. */}
                <div className="grid3">
                  <div className="card">
                    <p className="tiny">Acute · trailing 7 days</p>
                    <p className="num" style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--w-black)' }}>
                      {report.load.acute === null ? 'Building baseline' : formatNumber(report.load.acute, 0)}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Chronic · trailing 28 days, weekly</p>
                    <p className="num" style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--w-black)' }}>
                      {report.load.chronic === null ? 'Building baseline' : formatNumber(report.load.chronic, 0)}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">ACWR · trailing 7:28</p>
                    <p className="num" style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--w-black)' }}>
                      {report.load.acwr === null ? 'Building baseline' : formatNumber(report.load.acwr, 2)}
                    </p>
                  </div>
                </div>
                <p className="cap">{ACWR_WINDOW_CAPTION}</p>
                {report.load.suppressed ? (
                  <p className="cap">{acwrInsufficiencyNote(report.load.daysWithData)}</p>
                ) : null}

                {/* The athlete report is free (reports/page.tsx marks it
                    premiumGated: false), but this one panel is GPS, which is
                    not. Never zeroed: an empty tile row would read as "this
                    athlete ran nothing", and absent is never zero. And never
                    silently absent either — D-20's second half (decision batch,
                    14 September 2026): a premium region inside a base page
                    shows a card. */}
                {isPremium(tier) ? (
                <section className="card" aria-labelledby="gps-title">
                  <h2 className="card-title" id="gps-title">
                    GPS, this period
                  </h2>
                  {report.load.gps.sessionsWithData === 0 ? (
                    /* PATTERN-S6 C8: the grammar — the most recent GPS record
                       on file, and the one action that widens the period. */
                    <EmptyState
                      headingLevel={3}
                      title={gpsEmpty.title}
                      body={gpsEmpty.body}
                      action={
                        gpsEmpty.action
                          ? { href: `/reports/athlete/${athleteId}?period=${gpsEmpty.action.period}`, label: gpsEmpty.action.label }
                          : null
                      }
                    />
                  ) : (
                    <div className="grid3">
                      <div>
                        <p className="tiny">Sessions with data</p>
                        <p className="num nm">{report.load.gps.sessionsWithData}</p>
                      </div>
                      <div>
                        <p className="tiny">Total distance</p>
                        <p className="num nm">{formatNumber(report.load.gps.totalDistanceM, 0)} m</p>
                      </div>
                      <div>
                        <p className="tiny">High speed distance</p>
                        <p className="num nm">{formatNumber(report.load.gps.highSpeedDistanceM, 0)} m</p>
                      </div>
                    </div>
                  )}
                </section>
                ) : (
                  <PlanGateCard
                    heading="GPS, this period"
                    body={GPS_REGION_BODY}
                    metadata="Premium · GPS totals for this athlete · sessions with data, total distance, high speed distance"
                  />
                )}

                <section className="card flush" aria-labelledby="load-days-title">
                  <h2 className="card-title" id="load-days-title" style={{ padding: 'var(--s-8) var(--s-8) 0' }}>
                    Session load by day
                  </h2>
                  {loadDaysWithValue.length === 0 ? (
                    <p className="tiny" style={{ padding: 'var(--sp-16)' }}>
                      No session load recorded in this period.
                    </p>
                  ) : (
                    loadDaysWithValue.map((d, i) => (
                      <div key={d.date}>
                        {i > 0 ? <div className="hair" /> : null}
                        <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                          <span className="sub num">{formatDate(d.date, timezone)}</span>
                          <span className="load-val num">{formatNumber(d.load, 0)}</span>
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
                    <p className="num" style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--w-black)' }}>
                      {report.gymAndTesting.sessionsLogged}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Completed</p>
                    <p className="num" style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--w-black)' }}>
                      {report.gymAndTesting.sessionsCompleted}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Programme{currentProgrammes.length === 1 ? '' : 's'}</p>
                    <p style={{ fontSize: 'var(--fs-15)', fontWeight: 'var(--w-bold)' }}>
                      {currentProgrammes.length === 0 ? 'None assigned' : currentProgrammes.map((p) => `${p.name} (${enumLabel(p.type)})`).join(', ')}
                    </p>
                  </div>
                </div>

                {/* PATTERN-S7 C1: the table shell. Not a ranking — one athlete's
                    tests — so no sort line; the count is the tests with a
                    result. */}
                <TableShell title="Testing" titleId="tests-title" sort={null} count={`${report.gymAndTesting.tests.length} test${report.gymAndTesting.tests.length === 1 ? '' : 's'} with a result`} className="flush">
                  {report.gymAndTesting.tests.length === 0 ? (
                    <div style={{ padding: 'var(--sp-16)' }}>
                      <EmptyState headingLevel={3} title={testsEmpty.title} body={testsEmpty.body} />
                    </div>
                  ) : (
                    <table className="tbl" style={{ margin: '0 var(--s-8)', width: 'calc(100% - 32px)' }}>
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
                            <td className="r num">{t.pbValue === null ? NO_RESULT : formatNumber(t.pbValue, t.decimal_places)}</td>
                            <td className="sub num">{t.pbDate ? formatDate(t.pbDate, timezone) : NO_RESULT}</td>
                            <td className="r num">{t.latestValue === null ? NO_RESULT : formatNumber(t.latestValue, t.decimal_places)}</td>
                            <td className="sub num">{t.latestDate ? formatDate(t.latestDate, timezone) : NO_RESULT}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </TableShell>
              </div>
            ),
          },
        ]}
      />

    </>
  );
}
