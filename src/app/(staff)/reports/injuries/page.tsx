import Link from 'next/link';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchInjuryAvailabilityReport, recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { enumLabel, formatDate } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
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

const AVAIL_PILL: Record<string, string> = {
  modified: 'pill-warn',
  unavailable: 'pill-bad',
  unknown: 'pill-neutral',
};

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
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const isMedical = claims.roles.includes('medical');
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

  const actorRole = (isMedical ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
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
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> · Injury &amp; availability
          </p>
          <h1>Injury &amp; availability</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={`/reports/injuries/export?${exportQuery(period.key, groupIds)}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/injuries/pdf?${exportQuery(period.key, groupIds)}`} className="btn-ghost">
            Export PDF
          </a>
        </div>
      </div>

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

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <GroupFilter groups={groups} selected={groupIds} />
        {/* `value` is the CLAMPED key, not the raw URL value: a select whose
            value matches no option silently displays the first one instead,
            so the control must show what actually rendered. `allowed` leaves
            `day` and `week` visible-but-disabled with their reasons; `season`
            is passed through so the option is absent entirely when the club
            has no current season row. */}
        <PeriodSelector
          value={period.key}
          allowed={INJURY_PERIODS}
          reasons={INJURY_PERIOD_REASONS}
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
            label: 'Current',
            content: (
              <div className="card flush">
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
                <p className="cap" style={{ padding: '14px 16px 0' }}>
                  Availability as of {formatDate(today, timezone)} — not a snapshot of the
                  selected period. The period applies to the summary and burden figures.
                </p>
                {report.current.length === 0 ? (
                  /* The audit's worst S4 case (analysis finding 27): this said
                   * "Everyone is available." while a forgotten group filter hid
                   * two unavailable and three modified players. An empty list
                   * under an active filter proves something about the scope,
                   * never about the squad — so say which. */
                  <p className="tiny" style={{ padding: 16 }}>
                    {groupIds.length > 0
                      ? `No unavailable or modified athletes in the current scope (${groupScopeLabel(groups, groupIds)}) — clear the filter to check the whole squad.`
                      : 'Everyone is available.'}
                  </p>
                ) : (
                  report.current.map((row, index) => {
                    // Everything rendered below already comes from
                    // NotFullyAvailableRow — availability.ts's own header:
                    // "injury_clinical is not selected from, not joined to,
                    // and is not named in the Database type this client is
                    // built against, so it cannot be." Expanding this row
                    // reveals more of that same coach-safe shape, never a
                    // new, separately-fetched field.
                    const hasDetail =
                      Boolean(row.squad_number) ||
                      Boolean(row.position) ||
                      Boolean(row.body_area) ||
                      row.restrictions.length > 0 ||
                      Boolean(row.reason_category) ||
                      Boolean(row.expected_return) ||
                      Boolean(row.injury_id);
                    return (
                      <div key={row.athlete_id}>
                        {index > 0 ? <div className="hair" /> : null}
                        <details className="avail-row">
                          <summary className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                            <div>
                              <span className="nm">{row.name}</span>
                              <div className="tiny">
                                {row.body_area
                                  ? enumLabel(row.body_area)
                                  : row.restrictions.join(', ') ||
                                    (row.reason_category ? enumLabel(row.reason_category) : 'Restricted')}
                                {row.expected_return ? ` · back ${formatDate(row.expected_return, timezone)}` : ''}
                              </div>
                            </div>
                            <span className={`pill ${AVAIL_PILL[row.status] ?? 'pill-neutral'}`}>{enumLabel(row.status)}</span>
                            <span className="avail-row-caret" aria-hidden="true">
                              ⌄
                            </span>
                          </summary>
                          <div className="disclose-body" style={{ padding: '2px 4px 14px' }}>
                            {[row.squad_number ? `Squad #${row.squad_number}` : null, row.position]
                              .filter(Boolean).length > 0 ? (
                              <p className="tiny">
                                {[row.squad_number ? `Squad #${row.squad_number}` : null, row.position]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : null}
                            {row.body_area ? (
                              <p className="tiny">
                                {enumLabel(row.body_area)}
                                {row.side ? ` · ${enumLabel(row.side)}` : ''}
                              </p>
                            ) : null}
                            {row.restrictions.length > 0 ? (
                              <div className="chiprow" style={{ marginTop: 4 }}>
                                {row.restrictions.map((r) => (
                                  <span key={r} className="chip-static">
                                    {enumLabel(r)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {row.reason_category ? (
                              <p className="tiny">Reason: {enumLabel(row.reason_category)}</p>
                            ) : null}
                            {row.expected_return ? (
                              <p className="tiny">Expected back {formatDate(row.expected_return, timezone)}</p>
                            ) : null}
                            {!hasDetail ? <p className="tiny">No further detail on record.</p> : null}
                            {row.injury_id ? (
                              <Link href={`/injuries/${row.injury_id}`} className="tiny" style={{ fontWeight: 700, display: 'inline-block', marginTop: 4 }}>
                                View full injury record →
                              </Link>
                            ) : null}
                          </div>
                        </details>
                      </div>
                    );
                  })
                )}
              </div>
            ),
          },
          {
            label: 'Period summary',
            content: (
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                      {report.summary.newInjuries}
                    </div>
                    <div className="tiny">New injuries</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                      {report.summary.daysLost}
                    </div>
                    <div className="tiny">Athlete-days lost</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                      {report.summary.availabilityPct === null ? '—' : `${report.summary.availabilityPct}%`}
                    </div>
                    <div className="tiny">Availability</div>
                  </div>
                </div>
                {isMedical && report.clinical ? (
                  <div style={{ marginTop: 16 }}>
                    <p className="label">New injuries by body area</p>
                    {report.clinical.byBodyAreaOfNewInjuries.length === 0 ? (
                      <p className="tiny">None in this period.</p>
                    ) : (
                      <div className="chiprow" style={{ marginTop: 8 }}>
                        {report.clinical.byBodyAreaOfNewInjuries.map((c) => (
                          <span key={c.bodyArea} className="chip-static">
                            {enumLabel(c.bodyArea)} · {c.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                <p className="tiny" style={{ marginTop: 14 }}>
                  Days lost and availability are computed from each injury&rsquo;s onset and
                  return date, not a day-by-day reconstruction of every availability change.
                  {/* Only worth saying once the window can outlive the squad
                      list it is divided by. Availability % is (squad × days −
                      days lost) / (squad × days), and `squad` is TODAY's live
                      roster — so over a season or all on record it counts
                      days for athletes who had not joined yet and none for
                      athletes who have since left. Honest at 28 days,
                      increasingly approximate beyond it, and the reader
                      should know which they are looking at. */}
                  {period.days > 90
                    ? ' Availability is measured against the current squad, so over a window this long it counts days for athletes who joined part-way through it.'
                    : ''}
                </p>
              </div>
            ),
          },
          {
            label: 'Burden',
            content: (
              <div className="card flush">
                {report.burden.length === 0 ? (
                  <p className="tiny" style={{ padding: 16 }}>
                    No days lost in this period.
                  </p>
                ) : (
                  report.burden.map((w, index) => (
                    <div key={w.weekStart}>
                      {index > 0 ? <div className="hair" /> : null}
                      <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                        <span className="nm">Week of {formatDate(w.weekStart, timezone)}</span>
                        <span className="mono">{w.daysLost} days</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
