import type { RangeKey } from '@/lib/period';
import { fetchEarliestComplianceExpectationDate, fetchLatestComplianceExpectationDate } from '@/lib/queries/reports';
import type { Db } from '@/lib/queries/groups';
import { resolveReportPeriod, type PeriodParams, type ReportPeriod } from '@/lib/reportPeriod.server';

/* The compliance report's period, resolved once for the three surfaces that
 * must agree about it: the page, the CSV export and the PDF.
 *
 * COLOCATED, matching reports/injuries/period.ts and
 * reports/athlete/[athleteId]/period.ts — see the first of those for the full
 * case. The steps come from lib/reportPeriod.server.ts.
 *
 * THIS REPORT IS THE WORKED EXAMPLE OF WHY THE THREE SURFACES MUST SHARE A
 * MODULE. It carried the allow-list three times: `PERIODS = [7, 14, 28]` in
 * page.tsx, the same constant again in pdf/route.tsx, and — in
 * export/route.ts — the array INLINED AS A LITERAL, `[7, 14, 28].includes(…)`,
 * with no constant to grep for. That is one of the two files (the other is
 * injuries/export/route.ts) that a search for `PERIODS` does not find, so a
 * migration that trusted such a grep would have left this report's CSV reading
 * `?days=`, meeting `?period=season`, recognising nothing, and falling back to
 * SEVEN DAYS while the screen showed a season. Wrong, and silent.
 *
 * ---------------------------------------------------------------------------
 * WHY ONLY `day` IS EXCLUDED
 * ---------------------------------------------------------------------------
 *
 * A one-day compliance percentage is not a trend and barely a percentage: it
 * is the single question "did they submit today", which is what /dashboard
 * exists to answer and answers with names rather than a rate. Everything from
 * a week up is a real compliance window, so the other four are all offered —
 * this report widens from [7, 14, 28] to week/month/season/year/all.
 *
 * Disabled with the reason, never hidden (docs/screens/analytics.md's rule).
 * `season` is the separate case and is ABSENT when the org has no current
 * season row. clampPeriod enforces both server-side.
 *
 * ---------------------------------------------------------------------------
 * WHY THE DEFAULT STAYS `week`
 * ---------------------------------------------------------------------------
 *
 * DEFAULT_RANGE is `month`, and this report has always defaulted to 7 days.
 * Widening the window is the coach's call: silently quadrupling it during a
 * migration would change what every existing bookmark-free open of this report
 * shows, and a compliance rate over 28 days reads very differently from one
 * over 7 to someone who has been reading the 7-day number all season.
 *
 * That is what COMPLIANCE_FALLBACK says and it was NOT what the code did.
 * clampPeriod substitutes a fallback for an ILLEGAL key only, and an absent
 * `?period=` with no cookie arrives as DEFAULT_RANGE (`month`) — which is in
 * COMPLIANCE_PERIODS, so it passed the clamp untouched and this report
 * quadrupled its own window on deploy, silently, exactly as the paragraph above
 * forbids. Fixed in lib/reportPeriod.server.ts (`expressed`).
 *
 * The default must not STICKY either: `fydr-period` is account-wide, so writing
 * `week` there because this screen defaults to it would narrow every other
 * screen to seven days without the coach picking anything. page.tsx passes
 * `sticky={periodSticky(period)}`.
 *
 * ---------------------------------------------------------------------------
 * `?to=` AND `?period=` ARE ORTHOGONAL AND STAY THAT WAY
 * ---------------------------------------------------------------------------
 *
 * `?to=` is the DAY ANCHOR (which day the window ends on); `?period=` is the
 * WINDOW LENGTH (how far back from it). They compose and neither resets the
 * other. This is the one report with two window controls, and it is also why
 * the period must be resolved against the ANCHOR rather than against the wall
 * clock — see complianceAnchor below.
 */

/** The keys this report can honestly express. */
export const COMPLIANCE_PERIODS: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];

/** Why the one excluded key is excluded, appended to its own option label. */
export const COMPLIANCE_PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'a single day is “did they submit today”, which the dashboard answers',
};

/** The window this report has always defaulted to (`days=7`), named here so
 *  the three surfaces cannot disagree about it. Deliberately not
 *  DEFAULT_RANGE. */
export const COMPLIANCE_FALLBACK: RangeKey = 'week';

export type ComplianceAnchor = {
  /** The day the window ends on. */
  to: string;
  /** True when no `?to=` was given and the report fell back to the most recent
   *  day with data rather than the wall clock, so the page can say so and offer
   *  the jump to today. */
  usingLatestData: boolean;
};

/**
 * Which day the compliance window ends on — resolved identically for the page,
 * the CSV and the PDF, exactly as the period is.
 *
 * With no `?to=` at all the anchor is the most recent day this org actually has
 * expectations for, NOT real today: a rolling window ending real today read
 * "0 of 0" across the board whenever an org's own data trails the wall clock,
 * with nothing to distinguish that from a squad where nobody trains (audit
 * analysis finding 14). Once a coach has explicitly picked a date, that choice
 * is respected even when it turns out empty — this only changes what the report
 * OPENS to. The anchor never parks in the future.
 */
export async function complianceAnchor(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  toParam: string | string[] | undefined,
  realToday: string,
): Promise<ComplianceAnchor> {
  const raw = Array.isArray(toParam) ? toParam[0] : toParam;
  const requested = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  const latestDataDate = requested === null ? await fetchLatestComplianceExpectationDate(db, orgId, groupIds) : null;
  const anchor = requested ?? latestDataDate ?? realToday;
  const to = anchor > realToday ? realToday : anchor;
  return { to, usingLatestData: requested === null && latestDataDate !== null && to !== realToday };
}

/**
 * `anchor` is this report's own day anchor, NOT `todayIso(timezone)`.
 *
 * That is load-bearing and is the one place this report's period resolution
 * differs from every other report's. Resolving the window against real today
 * while querying against the anchor would reintroduce audit finding 14 one
 * layer down: the window would end on a day the org has no data for, and the
 * report would again read "0 of 0" for reasons the screen cannot explain.
 */
export async function resolveCompliancePeriod(db: Db, orgId: string, anchor: string, params: PeriodParams): Promise<ReportPeriod> {
  return resolveReportPeriod(db, orgId, params, {
    allowed: COMPLIANCE_PERIODS,
    fallback: COMPLIANCE_FALLBACK,
    reasons: COMPLIANCE_PERIOD_REASONS,
    anchor,
    earliest: () => fetchEarliestComplianceExpectationDate(db, orgId),
  });
}

/** The query string this report's own links carry — export, PDF and the "jump
 *  to today" link — so anything opened from a filtered, period-scoped page is
 *  scoped identically. Writes the canonical `?period=`, never `?days=`, and
 *  always the RESOLVED key: a coerced key must not travel, or the download
 *  covers a window the screen did not show. `to` rides along because the day
 *  anchor is the other half of this report's window. */
export function complianceQuery(key: RangeKey, to: string, groupIds: readonly string[]): string {
  const qs = new URLSearchParams({ period: key, to });
  if (groupIds.length > 0) qs.set('groups', groupIds.join(','));
  return qs.toString();
}
