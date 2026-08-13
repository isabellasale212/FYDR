import Link from 'next/link';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchInjuryAvailabilityReport, recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, enumLabel, formatDate, todayIso } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Injury & availability report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PERIODS = [28, 90] as const;

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
  const days = PERIODS.includes(Number(params.days) as (typeof PERIODS)[number]) ? Number(params.days) : 28;

  const today = todayIso(timezone);
  const fromDate = addDays(today, -(days - 1));

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchInjuryAvailabilityReport(db, orgId, groupIds, fromDate, today, isMedical),
  ]);

  const actorRole = (isMedical ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'injury_availability', {
    from: fromDate,
    to: today,
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
          <a href={`/reports/injuries/export?days=${days}${groupIds.length ? `&groups=${groupIds.join(',')}` : ''}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/injuries/pdf?days=${days}${groupIds.length ? `&groups=${groupIds.join(',')}` : ''}`} className="btn-ghost">
            Export PDF
          </a>
          <ThemeToggle />
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
        {groupScopeLabel(groups, groupIds)} · {orgName} · {formatDate(fromDate)} to {formatDate(today)} · {report.summary.athleteCount} athletes
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <GroupFilter groups={groups} selected={groupIds} />
        <div className="chiprow">
          {PERIODS.map((d) => (
            <Link
              key={d}
              href={`/reports/injuries?days=${d}${groupIds.length ? `&groups=${groupIds.join(',')}` : ''}`}
              className="squad-chip"
              aria-pressed={days === d}
            >
              {d} days
            </Link>
          ))}
        </div>
      </div>

      <ReportPager
        pages={[
          {
            label: 'Current',
            content: (
              <div className="card flush">
                {report.current.length === 0 ? (
                  /* The audit's worst S4 case (analysis finding 27): this said
                   * "Everyone is available." while a forgotten group filter hid
                   * two unavailable and three modified players. An empty list
                   * under an active filter proves something about the scope,
                   * never about the squad — so say which. */
                  <p className="tiny" style={{ padding: 16 }}>
                    {groupIds.length > 0
                      ? `No unavailable or modified athletes in the current scope (${groupScopeLabel(groups, groupIds)}) — clear the filter to check all squads.`
                      : 'Everyone is available.'}
                  </p>
                ) : (
                  report.current.map((row, index) => (
                    <div key={row.athlete_id}>
                      {index > 0 ? <div className="hair" /> : null}
                      <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                        <div>
                          <span className="nm">{row.name}</span>
                          <div className="tiny">
                            {row.body_area
                              ? enumLabel(row.body_area)
                              : row.restrictions.join(', ') ||
                                (row.reason_category ? enumLabel(row.reason_category) : 'Restricted')}
                            {row.expected_return ? ` · back ${formatDate(row.expected_return)}` : ''}
                          </div>
                        </div>
                        <span className={`pill ${AVAIL_PILL[row.status] ?? 'pill-neutral'}`}>{enumLabel(row.status)}</span>
                      </div>
                    </div>
                  ))
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
                        <span className="nm">Week of {formatDate(w.weekStart)}</span>
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
