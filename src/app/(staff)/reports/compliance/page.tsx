import Link from 'next/link';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { fetchGroups } from '@/lib/queries/groups';
import { complianceAthletePct, fetchComplianceReport, recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { enumLabel, formatDate, todayIso } from '@/lib/format';
import { complianceAnchor, complianceQuery, resolveCompliancePeriod } from './period';
import { periodCaveat, periodParamsFrom, periodSticky } from '@/lib/reportPeriod.server';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Compliance report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  const realToday = todayIso(timezone);

  /* TWO ORTHOGONAL CONTROLS, AND THEY STAY ORTHOGONAL.
   *
   * `?to=` is the DAY ANCHOR: which day the window ends on. `?period=` is the
   * WINDOW LENGTH: how far back from that day it reaches. They compose, and
   * neither resets the other — which is exactly what the hand-rolled chip row
   * this replaces could not promise. That row built its own href from a fixed
   * list of keys (`?days=${d}&to=${today}${groupQuery}`), so it preserved
   * `groups` and `to` and silently dropped every other param on the URL,
   * including any a future pass adds. PeriodSelector wraps ReportSelectNav,
   * which rebuilds the next href from the live useSearchParams(), so nothing
   * can be dropped by omission again. */
  const anchor = await complianceAnchor(db, orgId, groupIds, params.to, realToday);
  const today = anchor.to;

  // Resolved against the ANCHOR, not the wall clock — see resolveCompliancePeriod.
  const period = await resolveCompliancePeriod(db, orgId, today, periodParamsFrom(params));
  const fromDate = period.range.from;
  const caveat = periodCaveat(period);
  const usingLatestDataDefault = anchor.usingLatestData;

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchComplianceReport(db, orgId, groupIds, fromDate, today),
  ]);

  // The RESOLVED key, never the raw URL value — a coerced period must not
  // travel to the export, or the download covers a window the screen did not
  // show. Built by the colocated module so the period cannot be the param that
  // goes missing from a hand-built href.
  const query = complianceQuery(period.key, today, groupIds);

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(db, orgId, claims.userId, actorRole, 'compliance', {
    from: fromDate,
    to: today,
    // The audit row records the named window as well as its dates: "this coach
    // opened the whole season" and "this coach opened 3 Feb to 28 Aug" are the
    // same disclosure but not the same fact about intent, and a report open is
    // a data disclosure (reports.ts's header).
    period: period.key,
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
          <a href={`/reports/compliance/export?${query}`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/reports/compliance/pdf?${query}`} className="btn-ghost">
            Export PDF
          </a>
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        {groupScopeLabel(groups, groupIds)} · {orgName} · {period.range.label} · {formatDate(fromDate, timezone)} to{' '}
        {formatDate(today, timezone)} · {report.athleteCount} athletes
      </p>

      {caveat ? (
        <p className="sub" style={{ margin: '0 0 10px' }}>
          {caveat}
        </p>
      ) : null}

      {usingLatestDataDefault ? (
        <p className="sub" style={{ margin: '0 0 10px' }}>
          Showing the most recent window with data, ending <b>{formatDate(today, timezone)}</b> — real today is{' '}
          {formatDate(realToday, timezone)}.{' '}
          <Link href={`/reports/compliance?${complianceQuery(period.key, realToday, groupIds)}`} className="linklike">
            Jump to today instead
          </Link>
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <GroupFilter groups={groups} selected={groupIds} />
        {/* `day` is offered DISABLED with its reason rather than hidden, per
          * screens/analytics.md's "Illegal combinations are disabled with the
          * reason, not hidden". "This season" is the one option that goes
          * ABSENT instead, and only for a club with no current season row —
          * a different fact, and one nothing a coach does in this control can
          * fix. Both are also clamped server-side in resolveReportPeriod,
          * because a disabled <option> does not stop a hand-typed URL. */}
        {/* NOT sticky when this is the report's own default (`week`, which is
          * deliberately not DEFAULT_RANGE) rather than something the coach
          * picked, and not sticky when their pick was clamped either — see
          * periodSticky(). */}
        <PeriodSelector
          value={period.key}
          allowed={period.allowed}
          reasons={period.reasons}
          season={period.season}
          sticky={periodSticky(period)}
        />
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
                            {a.lastSubmission ? `Last ${formatDate(a.lastSubmission, timezone)}` : 'No submissions'}
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
                          <span className="nm">{formatDate(d.date, timezone)}</span>
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
