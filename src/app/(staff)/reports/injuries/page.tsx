import Link from 'next/link';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchInjuryAvailabilityReport, recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { enumLabel, formatDate } from '@/lib/format';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import {
  exportQuery,
  INJURY_PERIOD_REASONS,
  INJURY_PERIODS,
  periodCaveat,
  periodParamsFrom,
  resolveInjuryPeriod,
} from './period';

export const metadata = { title: 'Injury & availability report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* The `?days=[28, 90, 180, 365]` chip row that used to live here is gone,
 * replaced by the shared PeriodSelector. Three things went with it, all of
 * them deliberate:
 *
 *  - THE HAND-BUILT HREF. Each chip rebuilt its own URL from a fixed list of
 *    keys it happened to know about (`?days=${d}` plus `groups`), which is
 *    the exact shape of the bug on /reports/athlete/[athleteId] — any param
 *    added to this screen later would have been silently dropped on every
 *    period change. ReportSelectNav, under PeriodSelector, rebuilds from the
 *    live useSearchParams() instead, so nothing can be lost.
 *  - 90 AND 180 AS CHOOSABLE WINDOWS. Neither has a RangeKey, and the six
 *    keys are the client's own vocabulary ("from the day to the week to the
 *    season to the year to all"). A bookmarked `?days=90` or `?days=180`
 *    still renders — readPeriodParam widens it to `year`, never narrows it —
 *    and the page says so rather than substituting silently (periodCaveat).
 *  - `?days=` AS THIS SCREEN'S PARAM. The page now writes `?period=`, and
 *    both handlers under this folder read the same module, so a PDF exported
 *    from a season-scoped page covers the season. */

/** screens/reports.md, report 4 of 5. The coach and medical versions are two
 *  different reads, not one report with hidden fields — the clinical
 *  breakdown only ever comes from fetchInjuryAvailabilityReport's own
 *  isMedical branch, which is the same "never a join a non-medical query
 *  could accidentally make" discipline the rest of this build already holds
 *  for injury_clinical. Simplified against the spec's own 4-to-7 page medical
 *  section (injury detail, treatment record, rehab progress, RTP milestones)
 *  into clinical figures folded into the existing pages — that detail already
 *  lives on the injury record and rehab groups screens, and a full separate
 *  report section duplicating it is cut, documented, not built. */
export default async function InjuryAvailabilityReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims, timezone } = await requireReport('injuries');
  const isMedical = hasAnyRole(claims.roles, CLINICAL_ONLY);
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const period = await resolveInjuryPeriod(db, orgId, timezone, periodParamsFrom(params));
  const fromDate = period.from;
  const today = period.to;
  const caveat = periodCaveat(period);

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchInjuryAvailabilityReport(db, orgId, groupIds, fromDate, today, isMedical),
  ]);

  /* The five headline numbers, all counted off report.current so a card can
   * never disagree with the rows beneath it. "Available now" is the squad
   * minus everyone on that list, which is what the list is: only athletes who
   * are NOT fully available appear on it. */
  const byStatus = (s: string) => report.current.filter((r) => r.status === s);
  const unavailable = byStatus('unavailable');
  const modified = byStatus('modified');
  const unknown = byStatus('unknown');
  const availableNow = Math.max(0, report.summary.athleteCount - report.current.length);
  const availablePct =
    report.summary.athleteCount > 0 ? Math.round((100 * availableNow) / report.summary.athleteCount) : null;
  /* "2 injury · 1 academic" — the reasons actually on file, counted, rather
   * than a guess. An athlete with no reason recorded is not silently folded
   * into one. */
  const unavailableReasons = [...unavailable.reduce((m, r) => {
    const key = r.reason_category ? enumLabel(r.reason_category).toLowerCase() : 'no reason recorded';
    m.set(key, (m.get(key) ?? 0) + 1);
    return m;
  }, new Map<string, number>()).entries()].map(([k, n]) => `${n} ${k}`).join(' · ');
  const daysLostAthletes = new Set(report.current.filter((r) => r.injury_id).map((r) => r.athlete_id)).size;

  /* Status carries the grouping, worst first, so the row does not repeat it as
   * a pill on every line. */
  /* The Burden tab is gone: its headline was the same days-lost figure the
     Period summary already leads with, re-derived per week. meanPerFullWeek,
     the three-week trend and the per-week and per-site peaks went with it.
     report.burden and .bySite are still fetched and still correct; nothing on
     this screen reads them now. */
  const peakUnit = report.byUnit.reduce((m, u) => Math.max(m, u.days), 0);
  const peakAthlete = report.byAthlete.reduce((m, a) => Math.max(m, a.days), 0);
  const athleteDaysAvailable = report.summary.athleteCount * period.days;

  const STATUS_GROUPS: { key: string; name: string; rows: typeof report.current }[] = [
    { key: 'unavailable', name: 'Unavailable', rows: unavailable },
    { key: 'modified', name: 'Modified', rows: modified },
    { key: 'unknown', name: 'Unknown', rows: unknown },
  ];

  const actorRole = (isMedical ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  // The audit row records the RESOLVED window and the key that produced it,
  // not the raw param: "a report is a data disclosure that leaves the system"
  // (screens/reports.md), and `period=all` alone does not say what was
  // actually disclosed — the dates do.
  await recordReportView(db, orgId, claims.userId, actorRole, 'injury_availability', {
    from: fromDate,
    to: today,
    period: period.key,
    group_ids: groupIds,
    medical: isMedical,
  });

  return (
    <>
      {/* The period scopes every tab, so it rides the tab row rather than a
          row of its own above it. */}
      <ReportPager
        header={{
          groups,
          groupIds,
          eyebrow: 'Reports · Injury & availability',
          title: 'Injury & availability',
          sub: (
            <div className="rhead-sub">
              {isMedical ? (
              <div className="note" style={{ marginBottom: 14, borderColor: 'var(--warn)' }}>
              <div className="note-glyph">i</div>
              <p className="note-text">
              <b>Medical in confidence.</b> This version includes clinical detail not shown to
              coaching staff.
              </p>
              </div>
              ) : null}

              <p className="eyebrow" style={{ marginBottom: 10 }}>
              {groupScopeLabel(groups, groupIds)} · {orgName} · {period.label} · {formatDate(fromDate, timezone)} to {formatDate(today, timezone)} · {report.summary.athleteCount} athletes
              </p>

              {caveat ? (
              <p className="cap" style={{ marginBottom: 12 }}>
              {caveat}
              </p>
              ) : null}
            </div>
          ),
          actions: (
            <>
              <a href={`/reports/injuries/export?${exportQuery(period.key, groupIds)}`} className="rhead-btn">
                Export CSV
              </a>
              <a href={`/reports/injuries/pdf?${exportQuery(period.key, groupIds)}`} className="rhead-btn">
                Export PDF
              </a>
            </>
          ),
        }}
        right={
            /* `value` is the CLAMPED key, not the raw URL value: a select
               whose value matches no option silently displays the first one
               instead, so the control must show what actually rendered.
               `allowed` leaves `day` and `week` visible-but-disabled with their
               reasons; `season` is passed through so the option is absent
               entirely when the club has no current season row. */
            <PeriodSelector
              value={period.key}
              allowed={INJURY_PERIODS}
              reasons={INJURY_PERIOD_REASONS}
              season={period.season}
              ariaLabel="Reporting period"
            />
        }
        pages={[
          {
            label: 'Current',
            content: (
              <>
                <div className="card cmpl-stats" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                  <div className="cmpl-stat">
                    <span className="cmpl-stat-label">Available now</span>
                    <span className="cmpl-stat-value">
                      {availableNow}
                      <small style={{ fontWeight: 400 }}>of {report.summary.athleteCount}</small>
                    </span>
                    <span className="cmpl-stat-sub">
                      {availablePct === null ? 'no athletes in scope' : `${availablePct}% of the squad`}
                    </span>
                  </div>
                  <div className="cmpl-stat" data-tone={unavailable.length > 0 ? 'bad' : undefined}>
                    <span className="cmpl-stat-label">Unavailable</span>
                    <span className="cmpl-stat-value">{unavailable.length}</span>
                    <span className="cmpl-stat-sub">{unavailableReasons || 'nobody is out'}</span>
                  </div>
                  <div className="cmpl-stat" data-tone={modified.length > 0 ? 'warn' : undefined}>
                    <span className="cmpl-stat-label">Modified</span>
                    <span className="cmpl-stat-value">{modified.length}</span>
                    <span className="cmpl-stat-sub">training with restrictions</span>
                  </div>
                  <div className="cmpl-stat">
                    <span className="cmpl-stat-label">Unknown</span>
                    <span className="cmpl-stat-value">{unknown.length}</span>
                    <span className="cmpl-stat-sub">no medical entry on file</span>
                  </div>
                  <div className="cmpl-stat">
                    <span className="cmpl-stat-label">Days lost</span>
                    <span className="cmpl-stat-value">{report.summary.daysLost}</span>
                    <span className="cmpl-stat-sub">
                      across {daysLostAthletes} athlete{daysLostAthletes === 1 ? '' : 's'} · {period.label.toLowerCase()}
                    </span>
                  </div>
                </div>

                <div className="card cmpl-table">
                  {/* Said out loud now that the period control can read
                      "This season" or "All on record" beside it. This list is
                      NOT windowed and must not become so: fetchNotFullyAvailable
                      answers "who cannot train today" from the live availability
                      row, with no date bound anywhere in it, which is exactly
                      what stops a longer period from appearing to change who is
                      injured. Date-bounding it would hide an athlete whose
                      injury started before `from` and who is still unavailable —
                      the same false-reassurance class as the group-filter case
                      below. The PDF carries this sentence too. */}
                  {report.current.length === 0 ? (
                    /* The audit's worst S4 case (analysis finding 27): this said
                     * "Everyone is available." while a forgotten group filter hid
                     * two unavailable and three modified players. An empty list
                     * under an active filter proves something about the scope,
                     * never about the squad — so say which. */
                    <p className="tiny" style={{ padding: '0 0 14px' }}>
                      {groupIds.length > 0
                        ? `No unavailable or modified athletes in the current scope (${groupScopeLabel(groups, groupIds)}) — clear the filter to check the whole squad.`
                        : 'Everyone is available.'}
                    </p>
                  ) : (
                    <>
                      <div className="inj-head">
                        <span>Athlete</span>
                        <span>Site</span>
                        <span>What they can do</span>
                        <span>Expected back</span>
                        <span />
                      </div>
                      {STATUS_GROUPS.map((group) =>
                        group.rows.length === 0 ? null : (
                          <div key={group.key}>
                            <div className="inj-group">
                              <span className="inj-dot" data-status={group.key} aria-hidden="true" />
                              <span className="inj-group-name" data-status={group.key}>
                                {group.name}
                              </span>
                              <span className="inj-group-count">
                                {group.rows.length} of {report.summary.athleteCount} athletes
                              </span>
                            </div>
                            {group.rows.map((row) => {
                              /* Every field below already comes from
                                 NotFullyAvailableRow — availability.ts's own
                                 header: "injury_clinical is not selected from,
                                 not joined to, and is not named in the Database
                                 type this client is built against, so it cannot
                                 be." The site and the restriction line are the
                                 coach-safe half by construction; diagnosis and
                                 treatment notes are not reachable from here. */
                              const overdue =
                                row.expected_return !== null && row.expected_return < today;
                              const canDo =
                                row.restrictions.length > 0
                                  ? row.restrictions.map((r) => enumLabel(r)).join(' · ')
                                  : row.reason_category
                                    ? enumLabel(row.reason_category)
                                    : 'Marked restricted with no reason recorded';
                              return (
                                <Link
                                  key={row.athlete_id}
                                  href={row.injury_id ? `/injuries/${row.injury_id}` : `/squad/${row.athlete_id}`}
                                  className="inj-row"
                                  data-status={row.status}
                                >
                                  <span>
                                    <span className="inj-name">{row.name}</span>
                                    <span className="inj-unit" style={{ display: 'block' }}>
                                      {row.position ?? '—'}
                                    </span>
                                  </span>
                                  <span className="inj-site">
                                    {row.body_area
                                      ? `${enumLabel(row.body_area)}${row.side ? ` · ${enumLabel(row.side)}` : ''}`
                                      : '—'}
                                  </span>
                                  <span className="inj-can">{canDo}</span>
                                  <span className="inj-back">
                                    {row.expected_return ? formatDate(row.expected_return, timezone) : '—'}
                                    {/* An overdue date is not a failure of the
                                        athlete, it is a record that needs
                                        updating — and an unknown status with no
                                        entry at all is the stronger of the two. */}
                                    {row.status === 'unknown' ? (
                                      <span className="inj-flag" data-tone="bad">
                                        needs a medical entry
                                      </span>
                                    ) : overdue ? (
                                      <span className="inj-flag" data-tone="warn">
                                        return date passed
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="inj-chev" aria-hidden="true">
                                    &rsaquo;
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        ),
                      )}
                      {/* The who-sees-what paragraph is gone per review. It
                          described a rule the database enforces either way
                          (CLAUDE.md §2 rule 3, in RLS), so it was telling a
                          coach about a permission they cannot exercise.
                          What survives is the one fact the period control makes
                          easy to misread: this tab is live, not period-scoped. */}
                      <p className="inj-foot">
                        Availability as of {formatDate(today, timezone)}, not the selected period.
                        n = {report.summary.athleteCount} athletes.
                      </p>
                    </>
                  )}
                </div>
              </>
            ),
          },
          {
            label: 'Period summary',
            content: (
              <div className="stack">
                <div className="card cmpl-stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <div className="cmpl-stat">
                    <span className="cmpl-stat-label">New injuries</span>
                    <span className="cmpl-stat-value">{report.summary.newInjuries}</span>
                    <span className="cmpl-stat-sub">
                      {report.summary.newInjuries === 0
                        ? 'nothing new opened in the window'
                        : `opened inside ${period.label.toLowerCase()}`}
                    </span>
                  </div>
                  <div className="cmpl-stat" data-tone={report.summary.daysLost > 0 ? 'bad' : undefined}>
                    <span className="cmpl-stat-label">Athlete-days lost</span>
                    <span className="cmpl-stat-value">{report.summary.daysLost}</span>
                    <span className="cmpl-stat-sub">
                      {report.byAthlete.length} athlete{report.byAthlete.length === 1 ? '' : 's'} · of{' '}
                      {athleteDaysAvailable.toLocaleString('en-GB')} athlete-days available
                    </span>
                  </div>
                  <div className="cmpl-stat">
                    <span className="cmpl-stat-label">Availability</span>
                    <span className="cmpl-stat-value">
                      {report.summary.availabilityPct === null ? '—' : report.summary.availabilityPct}
                      {report.summary.availabilityPct === null ? null : <small>%</small>}
                    </span>
                    <span className="cmpl-stat-sub">
                      {(athleteDaysAvailable - report.summary.daysLost).toLocaleString('en-GB')} of{' '}
                      {athleteDaysAvailable.toLocaleString('en-GB')} athlete-days
                    </span>
                  </div>
                </div>

                {/* "Where the days went" is gone — every row of the card below
                    already carries the athlete's own site, so the by-site bars
                    were the same days counted a second way with no athlete
                    attached. "By positional unit" is NOT the same cut and is
                    back (Design.pdf p16): it answers where the squad is thin if
                    this happens again, which no per-athlete row can. Removing
                    it with the by-site card was my error. */}

                <div className="ath-summary-grid">
                <section className="card" aria-labelledby="inj-who">
                  <h2 className="ath-card-title" id="inj-who">
                    Who the days belong to
                  </h2>
                  <p className="tiny" style={{ color: 'var(--muted)', margin: '6px 0 12px' }}>
                    {report.byAthlete.length === 0
                      ? 'Nobody lost a day in this period.'
                      : `${report.byAthlete.length} athlete${report.byAthlete.length === 1 ? '' : 's'} account for all ${report.summary.daysLost} days. Nobody else lost one.`}
                  </p>
                  {report.byAthlete.slice(0, 8).map((a) => (
                    <div key={a.athlete_id} className="cmpl-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) 110px minmax(0, 1.4fr) 76px' }}>
                      <span className="cmpl-name">{a.name}</span>
                      <span className="inj-site">{a.bodyArea ? enumLabel(a.bodyArea) : '—'}</span>
                      <span className="cmpl-track">
                        <span
                          className="cmpl-fill"
                          data-tone={peakAthlete > 0 && a.days / peakAthlete >= 0.75 ? 'bad' : 'warn'}
                          style={{ width: `${peakAthlete > 0 ? Math.round((100 * a.days) / peakAthlete) : 0}%` }}
                        />
                      </span>
                      <span
                        className="ath-test-delta"
                        data-tone={peakAthlete > 0 && a.days / peakAthlete >= 0.75 ? 'heavy' : 'off'}
                      >
                        {a.days} days
                      </span>
                    </div>
                  ))}
                  {isMedical && report.clinical && report.clinical.byBodyAreaOfNewInjuries.length > 0 ? (
                    <div style={{ marginTop: 14 }}>
                      <p className="label">New injuries by body area</p>
                      <div className="chiprow" style={{ marginTop: 8 }}>
                        {report.clinical.byBodyAreaOfNewInjuries.map((cl) => (
                          <span key={cl.bodyArea} className="chip-static">
                            {enumLabel(cl.bodyArea)} · {cl.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="inj-foot">
                    Days lost and availability are computed from each injury&rsquo;s onset and return
                    date, not a day-by-day reconstruction of every availability change. n ={' '}
                    {report.summary.athleteCount} athletes over {period.days} days.
                    {/* Only worth saying once the window can outlive the squad
                        list it is divided by. Availability % is (squad × days −
                        days lost) / (squad × days), and `squad` is TODAY's live
                        roster — so over a season or all on record it counts
                        days for athletes who had not joined yet and none for
                        athletes who have since left. */}
                    {period.days > 90
                      ? ' Availability is measured against the current squad, so over a window this long it counts days for athletes who joined part-way through it.'
                      : ''}
                  </p>
                </section>

                <section className="card" aria-labelledby="inj-unit">
                  <h2 className="ath-card-title" id="inj-unit">
                    By positional unit
                  </h2>
                  <p className="tiny" style={{ color: 'var(--muted)', margin: '6px 0 12px' }}>
                    Where the squad is thin if it happens again.
                  </p>
                  {report.byUnit.length === 0 ? (
                    <p className="tiny" style={{ color: 'var(--muted)' }}>No days lost in this period.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {report.byUnit.map((u) => (
                        <div key={u.unit} className="ath-loadday">
                          <span className="ath-loadday-day" style={{ width: 110 }}>{u.unit}</span>
                          <span className="cmpl-track">
                            <span
                              className="cmpl-fill"
                              data-tone="accent"
                              style={{ width: `${peakUnit > 0 ? Math.round((100 * u.days) / peakUnit) : 0}%` }}
                            />
                          </span>
                          <span className="ath-loadday-val">{u.days}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                </div>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
