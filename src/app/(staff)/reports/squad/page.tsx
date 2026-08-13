import Link from 'next/link';
import { AttentionRow } from '@/components/AttentionRow/AttentionRow';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { Pill } from '@/components/Pill/Pill';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadWeeklyReport } from '@/lib/queries/squadWeeklyReport';
import { recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { ACWR_BAND_TEXT, acwrBandTone, acwrInsufficiencyNote, acwrSuppressedLabel } from '@/lib/acwr';
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

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchSquadWeeklyReport(db, orgId, groupIds, timezone, endDate),
  ]);

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
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={`/reports/squad/export?${exportQuery}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/squad/pdf?${exportQuery}`} className="btn-ghost">
            Export PDF
          </a>
          <ThemeToggle />
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        {groupScopeLabel(groups, groupIds)} · {orgName} · {report.athleteCount} athletes
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <Link href={toQuery(prevWeek)} className="btn-ghost" aria-label="Previous week">
          ‹ Previous week
        </Link>
        <p className="mono" style={{ fontWeight: 700, margin: 0, flex: 1, textAlign: 'center' }}>
          {formatDate(report.from)} to {formatDate(report.to)}
          {isCurrentWeek ? <span className="tiny" style={{ fontWeight: 400 }}> · current week</span> : null}
        </p>
        {isCurrentWeek ? (
          <span className="btn-ghost" aria-disabled="true" style={{ opacity: 0.4, pointerEvents: 'none' }}>
            Next week ›
          </span>
        ) : (
          <Link href={toQuery(nextWeek)} className="btn-ghost" aria-label="Next week">
            Next week ›
          </Link>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <div className="stack">
        <div className="grid3">
          <div className="card">
            <p className="tiny">Compliance, this week</p>
            <p className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
              {report.tiles.compliancePct === null ? '—' : `${report.tiles.compliancePct}%`}
            </p>
          </div>
          <div className="card">
            <p className="tiny">Available today</p>
            <p className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
              {report.tiles.availablePct === null ? '—' : `${report.tiles.availablePct}%`}
            </p>
          </div>
          <div className="card">
            <p className="tiny">Open flags</p>
            <p className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
              {report.tiles.openFlagCount}
            </p>
          </div>
          <div className="card">
            {/* Never "0 outside the band" over an all-suppressed table —
                the headline names how many were computable at all
                (audit S1/B4's false reassurance). */}
            <p className="tiny">ACWR outside {ACWR_BAND_TEXT}</p>
            <p className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
              {report.tiles.acwr.computable === 0 ? '—' : report.tiles.acwr.outsideBand}
            </p>
            <p className="tiny">
              {report.tiles.acwr.computable} computable · {report.tiles.acwr.suppressed} suppressed
            </p>
          </div>
        </div>

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
        </section>

        <section className="card" aria-labelledby="wellness-title">
          <h2 className="card-title" id="wellness-title">
            Wellness
          </h2>
          <div className="grid2" style={{ marginBottom: 14 }}>
            <div>
              <p className="tiny">Squad median readiness</p>
              <p className="mono nm" style={{ fontSize: 18 }}>
                {report.wellness.medianReadiness === null ? BLANK : formatNumber(report.wellness.medianReadiness, 0)}
              </p>
            </div>
            <div>
              <p className="tiny">More than 1.5 SD below their own norm</p>
              <p className="mono nm" style={{ fontSize: 18 }}>
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
                <p className="mono nm">{d.pct === null ? BLANK : `${d.pct}%`}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card flush" aria-labelledby="load-title">
          <h2 className="card-title" id="load-title" style={{ padding: '16px 16px 0' }}>
            Load, weekly per athlete
          </h2>
          <p className="import-sub" style={{ padding: '0 16px' }}>
            ACWR distribution, worst first. {ACWR_BAND_TEXT} is the descriptive band used everywhere the ratio
            appears; the flag rule itself is set on the Thresholds screen. {acwrInsufficiencyNote()}
          </p>
          {report.load.length === 0 ? (
            <p className="tiny" style={{ padding: 16 }}>
              No athlete in this filter.
            </p>
          ) : (
            <table className="tbl" style={{ margin: '0 16px 16px', width: 'calc(100% - 32px)' }}>
              <thead>
                <tr>
                  <th scope="col">Athlete</th>
                  <th scope="col" className="r">
                    Acute
                  </th>
                  <th scope="col" className="r">
                    Chronic
                  </th>
                  <th scope="col" className="r">
                    ACWR
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.load.map((r) => (
                  <tr key={r.athlete_id}>
                    <td>
                      <Link href={`/squad/${r.athlete_id}`} className="nm">
                        {r.first_name} {r.last_name}
                      </Link>
                    </td>
                    <td className="r mono">{r.acute === null ? BLANK : formatNumber(r.acute, 0)}</td>
                    <td className="r mono">{r.chronic === null ? BLANK : formatNumber(r.chronic, 0)}</td>
                    <td className="r">
                      {r.acwr === null ? (
                        <span className="tiny">{r.suppressed ? acwrSuppressedLabel(r.days_with_data) : BLANK}</span>
                      ) : (
                        <span className={`pill pill-${acwrBandTone(r.acwr)}`}>{formatNumber(r.acwr, 2)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
                      <span className="mono tiny">
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
                      <span className="mono tiny">
                        {formatNumber(t.value, 1)} {t.unit}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="card flush" aria-labelledby="availability-title">
          <h2 className="card-title" id="availability-title" style={{ padding: '16px 16px 0' }}>
            Availability
          </h2>
          {report.availability.length === 0 ? (
            <p className="tiny" style={{ padding: 16 }}>
              Everyone in this filter is fully available.
            </p>
          ) : (
            report.availability.map((a, i) => (
              <div key={a.athlete_id}>
                {i > 0 ? <div className="hair" /> : null}
                <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto', padding: '9px 16px' }}>
                  <Link href={`/squad/${a.athlete_id}`} className="nm">
                    {a.name}
                  </Link>
                  <span className="tiny">{a.body_area ? `${enumLabel(a.body_area)}${a.side ? ` (${enumLabel(a.side)})` : ''}` : a.restrictions.map(enumLabel).join(', ') || BLANK}</span>
                  <Pill status={availabilityStatus(a.status === 'unknown' ? null : a.status)} />
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}
