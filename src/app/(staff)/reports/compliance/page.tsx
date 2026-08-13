import Link from 'next/link';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { complianceAthletePct, fetchComplianceReport, fetchLatestComplianceExpectationDate, recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, enumLabel, formatDate, todayIso } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Compliance report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PERIODS = [7, 14, 28] as const;

/** screens/reports.md, report 3 of 5, built in full — see
 *  lib/queries/reports.ts's header for what this pass does and does not cover.
 *  Every open writes an audit_log row: a report is a data disclosure. */
export default async function ComplianceReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const days = PERIODS.includes(Number(params.days) as (typeof PERIODS)[number]) ? Number(params.days) : 7;
  const realToday = todayIso(timezone);
  const requestedTo = typeof params.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : null;

  // No ?to= at all: default to the most recent day this org actually has
  // expectations for, not real today — a rolling window ending real today
  // was landing on "0 of 0" whenever the org's own data trails the wall
  // clock (audit analysis finding 14). Once a coach has explicitly picked a
  // date (via ?to=, including "today" itself), that choice is respected
  // even if it's empty — this only changes what the report opens to.
  const latestDataDate = requestedTo === null ? await fetchLatestComplianceExpectationDate(db, orgId, groupIds) : null;
  const anchor = requestedTo ?? latestDataDate ?? realToday;
  const today = anchor > realToday ? realToday : anchor; // never park in the future
  const fromDate = addDays(today, -(days - 1));
  const usingLatestDataDefault = requestedTo === null && latestDataDate !== null && today !== realToday;

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchComplianceReport(db, orgId, groupIds, fromDate, today),
  ]);

  const groupQuery = groupIds.length > 0 ? `&groups=${groupIds.join(',')}` : '';

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'compliance', {
    from: fromDate,
    to: today,
    group_ids: groupIds,
  });

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> · Compliance
          </p>
          <h1>Compliance</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={`/reports/compliance/export?days=${days}&to=${today}${groupQuery}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/compliance/pdf?days=${days}&to=${today}${groupQuery}`} className="btn-ghost">
            Export PDF
          </a>
          <ThemeToggle />
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        {groupScopeLabel(groups, groupIds)} · {orgName} · {formatDate(fromDate)} to {formatDate(today)} · {report.athleteCount} athletes
      </p>

      {usingLatestDataDefault ? (
        <p className="sub" style={{ margin: '0 0 10px' }}>
          Showing the most recent window with data, ending <b>{formatDate(today)}</b> — real today is{' '}
          {formatDate(realToday)}. <Link href={`/reports/compliance?days=${days}&to=${realToday}${groupQuery}`} className="linklike">
            Jump to today instead
          </Link>
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <GroupFilter groups={groups} selected={groupIds} />
        <div className="chiprow">
          {PERIODS.map((d) => (
            <Link
              key={d}
              href={`/reports/compliance?days=${d}&to=${today}${groupQuery}`}
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
            label: 'Summary',
            content: (
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  {report.summary.map((s) => (
                    <div key={s.domain}>
                      <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>
                        {s.pct === null ? '—' : `${s.pct}%`}
                      </div>
                      <div className="tiny">{enumLabel(s.domain)}</div>
                      <div className="tiny" style={{ color: 'var(--faint)' }}>
                        {/* expected === 0 with no waivers either means nothing was ever
                            expected — a permanent gap for this domain, not a compliance
                            failure. "0 of 0 submitted" reads as an accusation; say what's
                            actually true instead (audit analysis finding 20). */}
                        {s.expected === 0 && s.waived === 0
                          ? 'No expectations configured for this domain'
                          : `${s.submitted} of ${s.expected} submitted${s.waived > 0 ? ` · ${s.waived} waived` : ''}`}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 14 }}>
                  Waivers are excluded from both the numerator and the denominator, and reported
                  separately — the difference between &ldquo;did not submit&rdquo; and &ldquo;was
                  not asked&rdquo;.
                </p>
              </div>
            ),
          },
          {
            label: 'By athlete',
            content: (
              <div className="card flush">
                {report.byAthlete.length === 0 ? (
                  <p className="tiny" style={{ padding: 16 }}>
                    No athletes in this filter.
                  </p>
                ) : (
                  report.byAthlete.map((a, index) => {
                    const pct = complianceAthletePct(a);
                    // A fully waived athlete (nothing left to chase, every
                    // expectation excused) reads distinctly from "no data" —
                    // never a bare "—" that could be misread as either
                    // perfect or unmeasured (audit analysis finding 19).
                    const fullyWaived = pct === null && a.waivedCount > 0;
                    return (
                      <div key={a.athlete_id}>
                        {index > 0 ? <div className="hair" /> : null}
                        <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                          <span className="nm">
                            {a.first_name} {a.last_name}
                          </span>
                          <span className="tiny">
                            {a.lastSubmission ? `Last ${formatDate(a.lastSubmission)}` : 'No submissions'}
                            {a.waivedCount > 0 ? ` · ${a.waivedCount} waived` : ''}
                          </span>
                          <span
                            className={`pill ${
                              fullyWaived ? 'pill-neutral' : pct === null ? 'pill-neutral' : pct < 60 ? 'pill-bad' : pct < 85 ? 'pill-warn' : 'pill-good'
                            }`}
                          >
                            {fullyWaived ? 'Waived' : pct === null ? '—' : `${pct}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ),
          },
          {
            label: 'By day',
            content: (
              <div className="card flush">
                {report.byDay.length === 0 ? (
                  <p className="tiny" style={{ padding: 16 }}>
                    No expectations in this period.
                  </p>
                ) : (
                  report.byDay.map((d, index) => {
                    const pct = d.expected > 0 ? Math.round((100 * d.submitted) / d.expected) : null;
                    return (
                      <div key={`${d.date}-${d.domain}`}>
                        {index > 0 ? <div className="hair" /> : null}
                        <div className="load-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                          <span className="nm">{formatDate(d.date)}</span>
                          <span className="tiny">{enumLabel(d.domain)}</span>
                          <span className={`pill ${pct === null ? 'pill-neutral' : pct < 60 ? 'pill-bad' : pct < 85 ? 'pill-warn' : 'pill-good'}`}>
                            {d.submitted}/{d.expected}
                            {d.waived > 0 ? ` (+${d.waived} waived)` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <p className="tiny" style={{ padding: '10px 16px' }}>
                  Squad-wide totals per day and domain &mdash; not the full athlete-by-day grid.
                </p>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
