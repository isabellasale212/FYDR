import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { Pill } from '@/components/Pill/Pill';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import { acwrInsufficiencyNote, acwrSuppressedLabel } from '@/lib/acwr';
import { fetchAthleteReport } from '@/lib/queries/athleteReport';
import { recordReportView } from '@/lib/queries/reports';
import { BLANK, ageFrom, enumLabel, formatDate, formatNumber, formatTime } from '@/lib/format';
import { availabilityStatus, SEVERITY_STATUS } from '@/lib/status';
import { requireReportAccess } from '@/lib/session';
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
 * "At PB" is a real third state, not a zero: it says the latest result IS his
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
  const { db, orgId, claims, timezone } = await requireReportAccess();
  const sp = await searchParams;
  const period = await resolveAthletePeriod(db, orgId, athleteId, timezone, periodParamsFrom(sp));
  const caveat = periodCaveat(period);

  const report = await fetchAthleteReport(db, orgId, athleteId, timezone, { from: period.from, to: period.to });
  if (!report) notFound();

  const { athlete, compliancePct, openFlags, currentProgrammes } = report.summary;
  const status = availabilityStatus(athlete.availability?.status ?? null);
  const restrictions = athlete.availability?.restrictions ?? [];
  const age = ageFrom(athlete.date_of_birth, timezone);
  const openInjury = athlete.open_injuries[0];

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
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
  // fetchAthleteSessionsInWindow sorts most-recent-first (screens/schedule.md's
  // own "recent sessions" convention), so index 0 is the latest, not the last.
  // It is also no longer capped at 200 rows, so the count in the footer is the
  // real one at a year or a season rather than a ceiling.
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
          <a href={`/reports/athlete/${athleteId}/export?${exportQuery(period.key)}`} className="btn-ghost">
            Export CSV
          </a>
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
              {enumLabel(openInjury.body_area)}
              {openInjury.side ? ` (${enumLabel(openInjury.side)})` : ''}, back{' '}
              {openInjury.expected_return ? formatDate(openInjury.expected_return, timezone) : 'not set'}
            </span>
          ) : null}
        </span>
        {/* Carried over from the summary tiles this card replaced rather than
            dropped with them: cross-domain compliance is a different question
            from the Wellness card's own "days submitted", and it was the one
            headline figure the design's identity row had no home for. */}
        <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <span className="ath-stat-label">Compliance</span>
          <span className="ath-stat-value" style={{ fontSize: 20 }}>
            {compliancePct === null ? BLANK : `${compliancePct}%`}
          </span>
          <span className="tiny" style={{ display: 'block', color: 'var(--faint)' }}>
            {period.label.toLowerCase()}
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="eyebrow">
          {period.label} · {formatDate(report.from, timezone)} to {formatDate(report.to, timezone)}
        </span>
        {/* `value` is the CLAMPED key, not the raw URL value — a select whose
            value matches no option silently shows the first one instead.
            `allowed` leaves `day` visible-but-disabled with its reason;
            `season` is absent entirely when the club has no season row. */}
        <PeriodSelector
          value={period.key}
          allowed={ATHLETE_PERIODS}
          reasons={ATHLETE_PERIOD_REASONS}
          season={period.season}
          ariaLabel="Reporting period"
        />
      </div>

      {caveat ? (
        <p className="cap" style={{ marginBottom: 12 }}>
          {caveat}
        </p>
      ) : null}

      <ReportPager
        pages={[
          {
            label: 'Summary',
            content: (
              <div className="stack">
                <div className="ath-summary-grid">
                  <section className="card" aria-labelledby="sum-wellness">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                      <h2 className="ath-card-title" id="sum-wellness">
                        Wellness
                      </h2>
                      <span className="ath-latest">
                        {latestWellness === null ? '—' : latestWellness.value}
                      </span>
                      <span className="tiny" style={{ color: 'var(--faint)' }}>
                        {latestWellness === null
                          ? 'nothing submitted'
                          : `latest, ${formatDate(latestWellness.date, timezone)}`}
                      </span>
                    </div>
                    <p className="tiny" style={{ color: 'var(--muted)', margin: '8px 0 10px' }}>
                      Composite readiness against {athlete.first_name}&apos;s own 14-day rolling mean
                      and &plusmn;1 SD band.
                    </p>
                    {report.wellness.every((p) => p.value === null) ? (
                      <EmptyState
                        headingLevel={3}
                        title="No wellness entries in this period"
                        body="Nothing submitted in this window."
                      />
                    ) : (
                      <>
                        <WellnessChart
                          series={report.wellness}
                          min={0}
                          max={100}
                          ticks={[0, 25, 50, 75, 100]}
                          title={`Readiness for ${athlete.first_name} ${athlete.last_name}`}
                          timezone={timezone}
                        />
                        <p className="tiny" style={{ color: 'var(--muted)', marginTop: 10 }}>
                          {wellnessSubmitted} of {report.wellness.length} days submitted
                        </p>
                      </>
                    )}
                  </section>

                  <section className="card" aria-labelledby="sum-load">
                    <h2 className="ath-card-title" id="sum-load" style={{ marginBottom: 12 }}>
                      Load
                    </h2>
                    {/* THE THREE TILES DO NOT MOVE WITH THE PERIOD CONTROL —
                        acute is trailing 7 days and chronic trailing 28 by
                        definition (lib/acwr.ts). When the baseline is still
                        building they show a dash and say so: an estimate from
                        too few days is worse than no estimate. */}
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
                            {tile.value === null ? '—' : formatNumber(tile.value, tile.dp)}
                          </span>
                          <span className="ath-tile-sub">{tile.sub}</span>
                        </div>
                      ))}
                    </div>
                    <div className="ath-stats" style={{ marginTop: 12 }}>
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
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 8px' }}>
                        Session load by day
                        {loadDaysWithValue.length > 0 ? (
                          <span className="tiny" style={{ fontWeight: 400, color: 'var(--faint)' }}>
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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
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
                    <p className="tiny" style={{ padding: '12px 0 14px' }}>
                      No test result recorded for this athlete.
                    </p>
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
                              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</span>{' '}
                              <span className="tiny" style={{ color: 'var(--faint)' }}>
                                ({t.unit})
                              </span>
                            </span>
                            <span className="ath-test-num">
                              {t.pbValue === null ? BLANK : formatNumber(t.pbValue, t.decimal_places)}
                            </span>
                            <span className="ath-test-date">
                              {t.pbDate ? formatDate(t.pbDate, timezone) : BLANK}
                            </span>
                            <span className="ath-test-num">
                              {t.latestValue === null ? BLANK : formatNumber(t.latestValue, t.decimal_places)}
                            </span>
                            <span className="ath-test-date">
                              {t.latestDate ? formatDate(t.latestDate, timezone) : BLANK}
                            </span>
                            <span className="ath-test-delta" data-tone={delta?.tone ?? 'at'}>
                              {delta?.label ?? BLANK}
                            </span>
                          </div>
                        );
                      })}
                      <p className="inj-foot">
                        Squad percentiles are not shown on a one-athlete report — see the Testing report
                        for squad-wide comparisons. Vs PB compares the latest result with{' '}
                        {athlete.first_name}&apos;s own best, and is direction-corrected for the tests
                        where lower is better.
                      </p>
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
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.load.acute === null ? '—' : formatNumber(report.load.acute, 0)}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">Chronic · trailing 28 days, weekly</p>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.load.chronic === null ? '—' : formatNumber(report.load.chronic, 0)}
                    </p>
                  </div>
                  <div className="card">
                    <p className="tiny">ACWR · trailing 7:28</p>
                    <p className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                      {report.load.acwr === null ? '—' : formatNumber(report.load.acwr, 2)}
                    </p>
                  </div>
                </div>
                <p className="cap">{ACWR_WINDOW_CAPTION}</p>
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
