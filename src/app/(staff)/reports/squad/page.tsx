import Link from 'next/link';
import { AttentionRow } from '@/components/AttentionRow/AttentionRow';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { Pill } from '@/components/Pill/Pill';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadWeeklyReport } from '@/lib/queries/squadWeeklyReport';
import { recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { ACWR_BAND_TEXT, acwrBandTone, acwrInsufficiencyNote } from '@/lib/acwr';
import { BLANK, addDays, enumLabel, formatDate, formatNumber, todayIso } from '@/lib/format';
import { availabilityStatus } from '@/lib/status';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Squad weekly report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Band, tone and suppression copy all from lib/acwr.ts — the one shared
// ACWR definition (audit S1).

/** screens/reports.md, report 2 of 5 — see lib/queries/squadWeeklyReport.ts's
 *  header for the full scope reasoning. Trailing 7 days ending a navigable
 *  ?to= date, defaulting to real today — not a Monday-start week pinned to
 *  a fixture, matching "what happened in the 7 days up to this point" being
 *  the report's own fixed question. Previous/next week just shift ?to= by
 *  7 days, the same URL-state pattern the schedule grid's week nav uses.
 *  Added because a permanently-"today" window could never show a week that
 *  actually had data (audit B4). */
export default async function SquadWeeklyReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const realToday = todayIso(timezone);
  const requestedTo = typeof params.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : realToday;
  // Never let a stray ?to= park the report in the future — clamp to today.
  const endDate = requestedTo > realToday ? realToday : requestedTo;
  const prevWeek = addDays(endDate, -7);
  const nextWeek = addDays(endDate, 7);
  const isCurrentWeek = endDate === realToday;

  /* The previous week, fetched for one reason: the design's deltas. A KPI
   * with no comparison is a number a coach cannot act on — 72% compliance
   * means something different when last week was 66% than when it was 78%.
   * It is a second full report read rather than a narrow one because the
   * figures have to be computed identically to this week's or the delta is
   * measuring the method, not the squad. */
  const [groups, report, prior] = await Promise.all([
    fetchGroups(db, orgId),
    fetchSquadWeeklyReport(db, orgId, groupIds, timezone, endDate),
    fetchSquadWeeklyReport(db, orgId, groupIds, timezone, addDays(endDate, -7)),
  ]);

  /* A delta reads against what is GOOD for the squad, not against its sign.
   * Flags rising is bad; compliance rising is good; the arrow alone cannot
   * say which, so `higherIsBetter` carries the judgement and the arrow only
   * the direction. Absent on either side means no comparison exists — never
   * a zero, which would claim "no change" from missing data. */
  const delta = (
    now: number | null,
    then: number | null,
    higherIsBetter: boolean,
    unit = '',
  ): { text: string; tone: 'good' | 'bad' | 'flat' } | null => {
    if (now === null || then === null) return null;
    const diff = Math.round((now - then) * 10) / 10;
    if (diff === 0) return { text: 'level', tone: 'flat' };
    const better = higherIsBetter ? diff > 0 : diff < 0;
    return {
      text: `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}${unit}`,
      tone: better ? 'good' : 'bad',
    };
  };

  const groupQuery = groupIds.length > 0 ? `&groups=${groupIds.join(',')}` : '';
  const toQuery = (d: string) => `/reports/squad?to=${d}${groupQuery}`;
  const exportQuery = `${groupIds.length ? `groups=${groupIds.join(',')}&` : ''}to=${endDate}`;

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'squad_weekly', {
    from: report.from,
    to: report.to,
    group_ids: groupIds,
  });

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> · Squad weekly
          </p>
          <h1>Squad weekly</h1>
          <p className="tiny" style={{ color: 'var(--muted)', marginTop: 4 }}>
            {groupScopeLabel(groups, groupIds)} · {orgName} · {report.athleteCount} athlete
            {report.athleteCount === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* The week nav sits with the exports rather than in a band of its
              own: it names which week everything below is about, so it belongs
              beside the title, not between the title and the numbers. */}
          <span className="week-nav">
            <Link href={toQuery(prevWeek)} aria-label="Previous week">
              &lsaquo;
            </Link>
            <b>
              {formatDate(report.from, timezone)} – {formatDate(report.to, timezone)}
            </b>
            {isCurrentWeek ? (
              <span aria-disabled="true" data-disabled="true">
                &rsaquo;
              </span>
            ) : (
              <Link href={toQuery(nextWeek)} aria-label="Next week">
                &rsaquo;
              </Link>
            )}
          </span>
          <a href={`/reports/squad/export?${exportQuery}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/squad/pdf?${exportQuery}`} className="btn-ghost">
            Export PDF
          </a>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
        <span className="tiny" style={{ marginLeft: 'auto', color: 'var(--faint)' }}>
          Compared with the previous week, {formatDate(prior.from, timezone)}–
          {formatDate(prior.to, timezone)}
        </span>
      </div>

      <div className="stack">
        <div className="sw-kpis">
          {[
            {
              label: 'Wellness compliance',
              value: report.tiles.compliancePct === null ? BLANK : `${report.tiles.compliancePct}%`,
              trend: delta(report.tiles.compliancePct, prior.tiles.compliancePct, true, ' pts'),
              note: 'submitted against expected, across every domain this week',
            },
            {
              label: 'Median readiness',
              value:
                report.wellness.medianReadiness === null
                  ? BLANK
                  : formatNumber(report.wellness.medianReadiness, 0),
              trend: delta(report.wellness.medianReadiness, prior.wellness.medianReadiness, true),
              /* Over the entries that EXIST. Readiness only exists where an
                 entry was submitted, so this median says nothing about the
                 athletes who did not submit — the compliance tile beside it
                 is where they show up. */
              note: `over the entries submitted · ${report.wellness.outliers.length} more than 1.5 SD below their own norm`,
            },
            {
              label: 'Available today',
              value:
                report.tiles.availablePct === null
                  ? BLANK
                  : `${report.athleteCount - report.availability.length} of ${report.athleteCount}`,
              trend: delta(report.tiles.availablePct, prior.tiles.availablePct, true, '%'),
              note: `${report.tiles.availablePct ?? 0}% · ${report.availability.filter((a) => a.status === 'modified').length} modified, ${report.availability.filter((a) => a.status === 'unavailable').length} unavailable`,
            },
            {
              label: 'Open flags',
              value: String(report.tiles.openFlagCount),
              trend: delta(report.tiles.openFlagCount, prior.tiles.openFlagCount, false),
              note: `${report.attention.length} shown here, ranked by severity`,
            },
          ].map((k) => (
            <div key={k.label} className="card sw-kpi">
              <span className="sw-kpi-label">{k.label}</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="sw-kpi-value">{k.value}</span>
                {k.trend ? (
                  <span className="sw-kpi-trend" data-tone={k.trend.tone}>
                    {k.trend.text}
                  </span>
                ) : null}
              </span>
              <span className="sw-kpi-note">{k.note}</span>
            </div>
          ))}
        </div>

        <div className="sw-body">
        <section className="card" aria-labelledby="attention-title">
          <h2 className="card-title" id="attention-title">
            Needing attention
          </h2>
          <p className="import-sub">Each against the athlete&rsquo;s own baseline. Capped at ten, ranked by severity.</p>
          {report.attention.length === 0 ? (
            <EmptyState headingLevel={3} title="Nothing is asking for attention" body="No open flag on any athlete in this filter." />
          ) : (
            report.attention.map((row, i) => <AttentionRow key={row.athlete_id} row={row} rank={i + 1} />)
          )}
          {report.tiles.openFlagCount > report.attention.length ? (
            <p style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <Link href={`/flags${groupIds.length > 0 ? `?groups=${groupIds.join(',')}` : ''}`} className="tiny" style={{ fontWeight: 600 }}>
                See all {report.tiles.openFlagCount} open flags &rsaquo;
              </Link>
            </p>
          ) : null}
        </section>

        <div className="sw-side">
          <section className="card" aria-labelledby="load-title">
            <div className="sw-card-head">
              <h2 className="ath-card-title" id="load-title">
                Load
              </h2>
              <span className="sw-card-meta">
                {report.tiles.acwr.computable} of {report.athleteCount} computable
              </span>
            </div>
            {/* The suppressed majority, said in the card rather than left to be
                inferred from a table of dashes. An ACWR estimated from too few
                days is worse than none, so those figures are WITHHELD, not
                zero — the distinction the whole tile exists to protect. */}
            {report.tiles.acwr.suppressed > 0 ? (
              <div className="ath-note" style={{ marginTop: 10 }}>
                <span className="ath-note-body">
                  {report.tiles.acwr.suppressed} athlete{report.tiles.acwr.suppressed === 1 ? ' is' : 's are'} still
                  building a baseline — {acwrInsufficiencyNote()} Their acute and chronic figures are withheld,
                  not zero.
                </span>
              </div>
            ) : null}
            {/* Branch on the COMPUTABLE rows, not on report.load: with every
                athlete suppressed the list is 29 long and none of it is
                renderable, which was printing a column header over nothing. */}
            {report.load.filter((r) => r.acwr !== null).length === 0 ? (
              <p className="tiny" style={{ marginTop: 10, color: 'var(--muted)' }}>
                {report.load.length === 0
                  ? 'No athlete in this filter.'
                  : 'No athlete has enough trailing days for a ratio yet, so there is nothing to rank.'}
              </p>
            ) : (
              <>
                <div className="sw-load-head" style={{ marginTop: 10 }}>
                  <span>Computable, worst first</span>
                  <span style={{ textAlign: 'right' }}>Acute</span>
                  <span style={{ textAlign: 'right' }}>Chronic</span>
                  <span style={{ textAlign: 'right' }}>ACWR</span>
                </div>
                {report.load
                  .filter((r) => r.acwr !== null)
                  .map((r) => (
                    <Link key={r.athlete_id} href={`/squad/${r.athlete_id}`} className="sw-load-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <span className="sw-load-name">
                        {r.first_name} {r.last_name}
                      </span>
                      <span className="sw-load-num">{r.acute === null ? BLANK : formatNumber(r.acute, 0)}</span>
                      <span className="sw-load-num">{r.chronic === null ? BLANK : formatNumber(r.chronic, 0)}</span>
                      <span className="sw-load-acwr" data-out={acwrBandTone(r.acwr!) !== 'good'}>
                        {formatNumber(r.acwr!, 2)}
                      </span>
                    </Link>
                  ))}
                <p className="cap" style={{ marginTop: 10 }}>
                  {ACWR_BAND_TEXT} is the descriptive band used everywhere the ratio appears; the flag rule
                  itself is set on the Thresholds screen.
                </p>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="avail2-title">
            <div className="sw-card-head">
              <h2 className="ath-card-title" id="avail2-title">
                Availability
              </h2>
              <span className="sw-card-meta">
                {report.availability.length} of {report.athleteCount} not fully available
              </span>
            </div>
            {report.availability.length === 0 ? (
              <p className="tiny" style={{ marginTop: 10, color: 'var(--muted)' }}>
                Everyone in this filter is available.
              </p>
            ) : (
              report.availability.map((a) => (
                <div key={a.athlete_id} className="sw-avail-row">
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="sw-avail-name" style={{ display: 'block' }}>
                      {a.name}
                    </span>
                    {/* The RESTRICTION line only — CLAUDE.md rule 3. */}
                    {a.restrictions.length > 0 || a.body_area ? (
                      <span className="sw-avail-note">
                        {[
                          a.body_area ? `${enumLabel(a.body_area)}${a.side ? `, ${enumLabel(a.side)}` : ''}` : null,
                          a.restrictions.length > 0 ? a.restrictions.map(enumLabel).join(' · ') : null,
                          a.expected_return ? `review ${formatDate(a.expected_return, timezone)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <Pill status={availabilityStatus(a.status === 'unknown' ? null : a.status)} />
                </div>
              ))
            )}
            <p className="cap" style={{ marginTop: 10 }}>
              Restriction only — diagnosis and treatment notes are visible to medical staff and the athlete
              concerned.
            </p>
          </section>
        </div>
        </div>

        <section className="card" aria-labelledby="wellness-title">
          <h2 className="card-title" id="wellness-title">
            Wellness
          </h2>
          <div className="grid2" style={{ marginBottom: 14 }}>
            <div>
              <p className="tiny">Squad median readiness</p>
              <p className="num nm" style={{ fontSize: 18 }}>
                {report.wellness.medianReadiness === null ? BLANK : formatNumber(report.wellness.medianReadiness, 0)}
              </p>
            </div>
            <div>
              <p className="tiny">More than 1.5 SD below their own norm</p>
              <p className="num nm" style={{ fontSize: 18 }}>
                {report.wellness.outliers.length}
              </p>
            </div>
          </div>
          {report.wellness.outliers.length > 0 ? (
            <div className="chiprow" style={{ marginBottom: 14 }}>
              {report.wellness.outliers.map((o) => (
                <Link key={o.athlete_id} href={`/squad/${o.athlete_id}`} className="chip-static">
                  {o.first_name} {o.last_name}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="grid3">
            {report.wellness.complianceByDomain.map((d) => (
              <div key={d.domain}>
                <p className="tiny">{enumLabel(d.domain)} compliance</p>
                <p className="num nm">{d.pct === null ? BLANK : `${d.pct}%`}</p>
              </div>
            ))}
          </div>
        </section>


        <section className="card" aria-labelledby="gym-testing-title">
          <h2 className="card-title" id="gym-testing-title">
            Gym and testing
          </h2>
          <p className="import-sub">Sessions logged this week, and any test result recorded this week.</p>
          <div className="grid2">
            <div>
              <p className="tiny" style={{ marginBottom: 6 }}>
                Gym sessions by athlete
              </p>
              {report.gymByAthlete.length === 0 ? (
                <p className="tiny">No gym session logged this week.</p>
              ) : (
                report.gymByAthlete.map((g, i) => (
                  <div key={g.athlete_id}>
                    {i > 0 ? <div className="hair" /> : null}
                    <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                      <span className="sub">{g.name}</span>
                      <span className="num tiny">
                        {g.sessionsCompleted} of {g.sessionsLogged} complete
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div>
              <p className="tiny" style={{ marginBottom: 6 }}>
                Test results moved this week
              </p>
              {report.testsThisWeek.length === 0 ? (
                <p className="tiny">No test result logged this week.</p>
              ) : (
                report.testsThisWeek.map((t, i) => (
                  <div key={`${t.athlete_id}-${t.test_name}-${t.test_date}-${i}`}>
                    {i > 0 ? <div className="hair" /> : null}
                    <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                      <span className="sub">
                        {t.name} &middot; {t.test_name}
                      </span>
                      <span className="num tiny">
                        {formatNumber(t.value, 1)} {t.unit}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
