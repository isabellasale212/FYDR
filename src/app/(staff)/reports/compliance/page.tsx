import Link from 'next/link';
import { ReportPager } from '@/components/ReportPager/ReportPager';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { fetchGroups } from '@/lib/queries/groups';
import { complianceAthletePct, fetchComplianceReport, recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { enumLabel, formatDate, todayIso } from '@/lib/format';
import { mondayOf } from '@/lib/queries/schedule';
import { complianceAnchor, complianceQuery, resolveCompliancePeriod } from './period';
import { periodCaveat, periodParamsFrom, periodSticky } from '@/lib/reportPeriod.server';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Compliance report · Fydr' };

/* ---------------------------------------------------------------------------
 * Fydr Compliance.dc.html — the two tables rebuilt as meters.
 *
 * ONE ROW PER DAY, NOT PER DAY-AND-DOMAIN. The By day table used to emit a row
 * for every (date, domain) pair, so a single morning appeared as two or three
 * rows a coach had to reconcile by eye. The design's own words for why that is
 * wrong: "so a thin morning shows up as a pair rather than two rows". Same
 * ComplianceDayCell data, pivoted.
 *
 * THREE DOMAINS, NOT THE DESIGN'S TWO. The drawing pairs Wellness with Session
 * RPE; this build's REPORT_DOMAINS is wellness, training_rpe AND gym. Rendering
 * the design's two would silently drop a real column, so the row carries all
 * three. Noted rather than done quietly, per CLAUDE.md §5.
 *
 * A DASH IS NOT A ZERO. A day with nothing expected leaves the mean instead of
 * scoring 0% — the same rule the rest of this app follows, and the reason the
 * footer says so in words. */
const DAY_TONE = (pct: number): 'good' | 'warn' | 'bad' => (pct >= 85 ? 'good' : pct >= 70 ? 'warn' : 'bad');

/** A band's tone drives its fill, its label and its legend swatch together, so
 *  the three can never disagree about what "under half" looks like. */
type BandTone = 'bad' | 'warn' | 'accent' | 'neutral';

function Meter({ tone, pct, count }: { tone: BandTone | 'good' | 'none'; pct: number | null; count: string }) {
  return (
    <div className="cmpl-meter">
      <span className="cmpl-meter-count cmpl-tone" data-tone={pct === null ? 'none' : tone}>
        {count}
      </span>
      <span className="cmpl-track">
        {pct === null ? null : <span className="cmpl-fill" data-tone={tone} style={{ width: `${Math.min(100, pct)}%` }} />}
      </span>
    </div>
  );
}


type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/reports.md, report 3 of 5, built in full — see
 *  lib/queries/reports.ts's header for what this pass does and does not cover.
 *  Every open writes an audit_log row: a report is a data disclosure. */
export default async function ComplianceReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims, timezone } = await requireReport('compliance');
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
    fetchComplianceReport(db, orgId, groupIds, fromDate, today, timezone),
  ]);

  /* The four headline numbers, all derived from report.byAthlete rather than
   * re-queried, so a card can never disagree with the table beneath it. */
  const athletePcts = report.byAthlete.map((a) => ({ row: a, pct: complianceAthletePct(a) }));
  const measured = athletePcts.filter((x) => x.pct !== null);
  const squadMean = measured.length > 0 ? Math.round(measured.reduce((s, x) => s + x.pct!, 0) / measured.length) : null;
  const underHalf = measured.filter((x) => x.pct! < 50).length;
  const waivedDays = report.byAthlete.reduce((s, a) => s + a.waivedCount, 0);
  const waivedAthletes = report.byAthlete.filter((a) => a.waivedCount > 0).length;

  /* Bands, worst first. The fourth is not in the design and is not decoration:
   * an athlete with nothing expected of them, or with every expectation waived,
   * has no percentage at all — and dropping them would make the table quietly
   * disagree with its own "n = N athletes" footer. */
  const BANDS: { name: string; tone: BandTone; test: (pct: number | null) => boolean }[] = [
    { name: 'Under half', tone: 'bad', test: (p) => p !== null && p < 50 },
    { name: 'Half to four fifths', tone: 'warn', test: (p) => p !== null && p >= 50 && p < 80 },
    { name: 'Four fifths and up', tone: 'accent', test: (p) => p !== null && p >= 80 },
    { name: 'Not measured', tone: 'neutral', test: (p) => p === null },
  ];

  /* By day, pivoted onto one row per date. Domains keep REPORT_DOMAINS' own
   * order so the columns never reshuffle between periods. */
  /* Wellness and gym only on this tab. Session RPE is expected per SESSION,
     not per day, so a day with two sessions and one RPE scored 50% here while
     meaning something different from a wellness entry that is one-per-day —
     two denominators in one row. It keeps its place in the Summary tab, where
     it is read as a domain rather than compared across a row. */
  const DAY_DOMAINS = ['wellness', 'gym'] as const;
  const byDate = new Map<string, Map<string, { expected: number; submitted: number; waived: number }>>();
  for (const cell of report.byDay) {
    const forDate = byDate.get(cell.date) ?? new Map();
    forDate.set(cell.domain, { expected: cell.expected, submitted: cell.submitted, waived: cell.waived });
    byDate.set(cell.date, forDate);
  }
  const dayRows = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, domains]) => ({
      date,
      cells: DAY_DOMAINS.map((d) => {
        const cell = domains.get(d);
        const pct = cell && cell.expected > 0 ? Math.round((100 * cell.submitted) / cell.expected) : null;
        return { domain: d, pct, count: pct === null ? '—' : `${cell!.submitted} of ${cell!.expected}` };
      }),
    }));
  // Grouped by the week each day falls in, which is how a coach reads a run of
  // days — and the week header carries its own mean so the group is not just a
  // divider.
  const dayWeeks = [...dayRows.reduce((m, r) => {
    const wk = mondayOf(r.date);
    m.set(wk, [...(m.get(wk) ?? []), r]);
    return m;
  }, new Map<string, typeof dayRows>()).entries()];
  const DAY_GRID = { gridTemplateColumns: 'minmax(120px, 1fr) repeat(2, minmax(0, 1.35fr))' };
  const ATH_GRID = { gridTemplateColumns: 'minmax(0, 1.5fr) 96px 78px 116px minmax(180px, 218px)' };


  // The RESOLVED key, never the raw URL value — a coerced period must not
  // travel to the export, or the download covers a window the screen did not
  // show. Built by the colocated module so the period cannot be the param that
  // goes missing from a hand-built href.
  const query = complianceQuery(period.key, today, groupIds);

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
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
      {/* The period scopes every tab, so it rides the tab row rather than a
          row of its own above it. */}
      <ReportPager
        header={{
          groups,
          groupIds,
          eyebrow: 'Reports · Compliance',
          title: 'Compliance',
          sub: (
            <div className="rhead-sub">
              <p className="eyebrow" style={{ marginBottom: 'var(--sp-10)' }}>
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
            </div>
          ),
          actions: (
            <>
              <a href={`/reports/compliance/export?${query}`} className="rhead-btn">
                Export CSV
              </a>
              <a href={`/reports/compliance/pdf?${query}`} className="rhead-btn">
                Export PDF
              </a>
            </>
          ),
        }}
        right={
          /* `day` is offered DISABLED with its reason rather than hidden, per
           * screens/analytics.md's "Illegal combinations are disabled with the
           * reason, not hidden". "This season" is the one option that goes
           * ABSENT instead, and only for a club with no current season row —
           * a different fact, and one nothing a coach does in this control can
           * fix. Both are also clamped server-side in resolveReportPeriod,
           * because a disabled <option> does not stop a hand-typed URL.
           *
           * NOT sticky when this is the report's own default (`week`, which is
           * deliberately not DEFAULT_RANGE) rather than something the coach
           * picked, and not sticky when their pick was clamped either — see
           * periodSticky(). */
          <PeriodSelector
            value={period.key}
            allowed={period.allowed}
            reasons={period.reasons}
            season={period.season}
            sticky={periodSticky(period)}
          />
        }
        pages={[
          {
            label: 'Summary',
            content: (
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-16)' }}>
                  {report.summary.map((s) => (
                    <div key={s.domain}>
                      <div className="num" style={{ fontSize: 'var(--fs-24)', fontWeight: 800 }}>
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
                <p className="tiny" style={{ marginTop: 'var(--sp-14)' }}>
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
              <>
                <div className="card cmpl-stats">
                  <div className="cmpl-stat">
                    <span className="cmpl-stat-label">Squad mean</span>
                    <span className="cmpl-stat-value">
                      {squadMean === null ? '—' : squadMean}
                      {squadMean === null ? null : <small>%</small>}
                    </span>
                    <span className="cmpl-stat-sub">
                      n = {measured.length} athlete{measured.length === 1 ? '' : 's'} · {report.byDay.length > 0 ? `${new Set(report.byDay.map((d) => d.date)).size} days` : 'no days'}
                    </span>
                  </div>
                  <div className="cmpl-stat" data-tone={underHalf > 0 ? 'bad' : undefined}>
                    <span className="cmpl-stat-label">Under half</span>
                    <span className="cmpl-stat-value">{underHalf}</span>
                    <span className="cmpl-stat-sub">athletes below 50%</span>
                  </div>
                  <div className="cmpl-stat">
                    <span className="cmpl-stat-label">Waived days</span>
                    <span className="cmpl-stat-value">{waivedDays}</span>
                    <span className="cmpl-stat-sub">
                      {waivedAthletes} athlete{waivedAthletes === 1 ? '' : 's'} · left out of their denominators
                    </span>
                  </div>
                </div>

                <div className="card cmpl-table">
                  {report.byAthlete.length === 0 ? (
                    <p className="tiny" style={{ padding: '0 0 14px' }}>
                      No athletes in this filter.
                    </p>
                  ) : (
                    <>
                      <div className="cmpl-head" style={ATH_GRID}>
                        <span>Athlete</span>
                        <span style={{ textAlign: 'right' }}>Submitted</span>
                        <span style={{ textAlign: 'right' }}>Waived</span>
                        <span style={{ textAlign: 'right' }}>Last entry</span>
                        <span style={{ textAlign: 'right' }}>Compliance</span>
                      </div>
                      {BANDS.map((band) => {
                        const rows = athletePcts.filter((x) => band.test(x.pct));
                        if (rows.length === 0) return null;
                        return (
                          <div key={band.name}>
                            <div className="cmpl-band">
                              <span className="cmpl-band-name" data-tone={band.tone}>
                                {band.name}
                              </span>
                              <span className="cmpl-band-count">
                                {rows.length} of {report.byAthlete.length} athletes
                              </span>
                            </div>
                            {rows.map(({ row, pct }) => {
                              const expected = Object.values(row.perDomain).reduce((s, d) => s + d.expected, 0);
                              const submitted = Object.values(row.perDomain).reduce((s, d) => s + d.submitted, 0);
                              return (
                                <div key={row.athlete_id} className="cmpl-row" style={ATH_GRID}>
                                  <span className="cmpl-name">
                                    {row.first_name} {row.last_name}
                                  </span>
                                  <span className="cmpl-num">
                                    {expected === 0 ? '—' : `${submitted} of ${expected}`}
                                  </span>
                                  <span className="cmpl-num" data-quiet={row.waivedCount === 0}>
                                    {row.waivedCount === 0 ? '—' : row.waivedCount}
                                  </span>
                                  <span className="cmpl-last">
                                    {row.lastSubmission ? formatDate(row.lastSubmission, timezone) : '—'}
                                  </span>
                                  <span className="cmpl-meter">
                                    <span className="cmpl-track">
                                      {pct === null ? null : (
                                        <span className="cmpl-fill" data-tone={band.tone} style={{ width: `${Math.min(100, pct)}%` }} />
                                      )}
                                      <span className="cmpl-tick" />
                                    </span>
                                    <span className="cmpl-meter-pct cmpl-tone" data-tone={pct === null ? 'none' : band.tone}>
                                      {/* A fully waived athlete is not 0% and not
                                          100% — nothing was asked of them. */}
                                      {pct === null ? (row.waivedCount > 0 ? 'Waived' : '—') : `${pct}%`}
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      <div className="cmpl-foot">
                        <span className="cmpl-foot-note">
                          Sorted worst first · the tick at halfway is 50%, not a club standard · n ={' '}
                          {report.byAthlete.length} athletes
                        </span>
                        <span className="cmpl-legend">
                          <span>
                            <span className="cmpl-swatch" style={{ background: 'var(--bad)' }} />
                            Under half
                          </span>
                          <span>
                            <span className="cmpl-swatch" style={{ background: 'var(--warn)' }} />
                            Half to four fifths
                          </span>
                          <span>
                            <span className="cmpl-swatch" style={{ background: 'var(--accent)' }} />
                            Four fifths and up
                          </span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </>
            ),
          },
          {
            label: 'By day',
            content: (
              <div className="card cmpl-table">
                {dayWeeks.length === 0 ? (
                  <p className="tiny" style={{ padding: '0 0 14px' }}>
                    No expectations in this period.
                  </p>
                ) : (
                  <>
                    <div className="cmpl-head" style={DAY_GRID}>
                      <span>Day</span>
                      {DAY_DOMAINS.map((d) => (
                        <span key={d}>{enumLabel(d)}</span>
                      ))}
                    </div>
                    {dayWeeks.map(([weekStart, rows]) => {
                      /* The week's own mean, over the cells that actually had
                         an expectation — a day with nothing scheduled leaves
                         the mean rather than dragging it to zero. */
                      const scored = rows.flatMap((r) => r.cells.map((x) => x.pct)).filter((p): p is number => p !== null);
                      const mean = scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p, 0) / scored.length) : null;
                      return (
                        <div key={weekStart}>
                          <div className="cmpl-band">
                            <span className="cmpl-band-name" data-tone="accent">
                              Week of {formatDate(weekStart, timezone)}
                            </span>
                            <span className="cmpl-band-count">
                              {mean === null ? 'no expectations' : `mean ${mean}%`} · {rows.length} day
                              {rows.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          {rows.map((r) => (
                            <div key={r.date} className="cmpl-row" style={DAY_GRID}>
                              <span className="cmpl-name">{formatDate(r.date, timezone)}</span>
                              {r.cells.map((cell) => (
                                <Meter
                                  key={cell.domain}
                                  tone={cell.pct === null ? 'none' : DAY_TONE(cell.pct)}
                                  pct={cell.pct}
                                  count={cell.count}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div className="cmpl-foot">
                      <span className="cmpl-foot-note">
                        A dash means nothing was expected that day, so it leaves the mean rather than
                        scoring zero · waived days are excluded from the denominator, not counted as
                        misses
                      </span>
                      <span className="cmpl-legend">
                        <span>
                          <span className="cmpl-swatch" style={{ background: 'var(--good)' }} />
                          85% and up
                        </span>
                        <span>
                          <span className="cmpl-swatch" style={{ background: 'var(--warn)' }} />
                          70 to 84%
                        </span>
                        <span>
                          <span className="cmpl-swatch" style={{ background: 'var(--bad)' }} />
                          Under 70%
                        </span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
