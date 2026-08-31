import { todayIso } from '@/lib/format';
import type { RangeKey } from '@/lib/period';
import { fetchEarliestTestDate } from '@/lib/queries/testingReport';
import type { Db } from '@/lib/queries/groups';
import { resolveReportPeriod, type PeriodParams, type ReportPeriod } from '@/lib/reportPeriod.server';

/* The testing report's period, resolved once for the three surfaces that must
 * agree about it: the page, the CSV export and the PDF.
 *
 * COLOCATED, matching reports/injuries/period.ts and
 * reports/athlete/[athleteId]/period.ts — see the first of those for the full
 * case. The steps themselves come from lib/reportPeriod.server.ts, which is the
 * fourth report's worth of evidence that "resolve the param, look up the
 * season, clamp, resolve the range" is the same everywhere and only the
 * allow-list and the anchors differ.
 *
 * ---------------------------------------------------------------------------
 * THIS REPORT HAD NO WINDOW AT ALL BEFORE THIS PASS
 * ---------------------------------------------------------------------------
 *
 * Not a narrow one — none. There was no `days`, no `from` and no `todayIso`
 * anywhere in reports/testing/, and all three of testingReport.ts's queries
 * took `(db, orgId, groupIds, testDefinitionId)` with no dates, the
 * longitudinal one simply `.order('test_date')`. So "Squad median over time"
 * plotted every result the club had ever recorded: a squad three seasons deep
 * got a trend dominated by athletes who have left, and the "personal best"
 * grid ranked a leaver's 2023 number beside a current athlete's. Past
 * PostgREST's silent 1000-row ceiling it was also arbitrarily truncated, with
 * no error and no short page to notice it by.
 *
 * ---------------------------------------------------------------------------
 * WHY `day` AND `week` ARE NOT OFFERED
 * ---------------------------------------------------------------------------
 *
 * The mirror image of the rolling-band case lib/period.ts's header describes.
 * There the metric is computed over a trailing window, so one day is one point
 * with no band to read it against. Here the DATA is episodic: a club runs a
 * test battery every few weeks, not every day, so a seven-day window on a test
 * usually contains exactly one session. That is not a report — it is
 * `/testing/[testDefId]`, the single-session grid, which already exists and
 * already shows it better. The squad-median trend degenerates to one point and
 * "best in the window" degenerates to "that day's result".
 *
 * Disabled with the reason, never hidden (docs/screens/analytics.md's rule).
 * `season` is the separate case and is ABSENT when the org has no current
 * season row, because that is a fact about the organisation rather than about
 * this screen. clampPeriod enforces both server-side; the control alone does
 * not stop a hand-typed URL.
 *
 * ---------------------------------------------------------------------------
 * WHY THE DEFAULT IS `season`, NOT `month`
 * ---------------------------------------------------------------------------
 *
 * DEFAULT_RANGE is 28 days, which is under most clubs' retest interval — a
 * `month` default would open this report EMPTY for a squad that tests every six
 * weeks, which is the worst possible first impression of a report whose whole
 * job is showing movement between tests. `season` is also the window
 * fetchCurrentSeason was added to this codebase for: its own header names "the
 * testing report's season's best tile" as the reason it exists.
 *
 * A club with no season row falls to `year`, not `month`, for the same retest
 * interval reason — 28 days is not a useful floor for episodic data.
 *
 * BOTH OF THOSE WERE DEAD UNTIL resolveReportPeriod LEARNED THE ABSENT CASE.
 * clampPeriod only substituted a fallback for an ILLEGAL key, and an absent
 * `?period=` with no cookie arrives as DEFAULT_RANGE (`month`) — which is in
 * TESTING_PERIODS, so it was never illegal and never replaced. The paragraph
 * above described behaviour the code did not have: a club testing every six
 * weeks opened this report on 28 days and read "No result recorded for this
 * test in last 28 days" against an empty squad-median trend, which is the exact
 * first impression the `season` default was written to prevent, and
 * TESTING_FALLBACK_NO_SEASON was unreachable entirely. Fixed in
 * lib/reportPeriod.server.ts (`expressed`), not worked around here.
 *
 * THE DEFAULT MUST NOT STICKY, and that is the other half of the same fix. The
 * `fydr-period` cookie is account-wide, so a screen rendering its OWN default
 * into a sticky control re-scopes every other screen to a window the coach
 * never picked. page.tsx passes `sticky={periodSticky(period)}` — see that
 * function, and PeriodSelector's `sticky` prop doc.
 */

/** The keys this report can honestly express. */
export const TESTING_PERIODS: readonly RangeKey[] = ['month', 'season', 'year', 'all'];

/** Why each excluded key is excluded, appended to its own option label.
 *  Written as something a coach can act on, not as "unavailable". */
export const TESTING_PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'testing is episodic — one day is one session, which the test page already shows',
  week: 'a week of a test battery is usually a single session, not a trend',
};

/** Named here so the three surfaces cannot disagree about it. */
export const TESTING_FALLBACK: RangeKey = 'season';
export const TESTING_FALLBACK_NO_SEASON: RangeKey = 'year';

export async function resolveTestingPeriod(db: Db, orgId: string, timezone: string, params: PeriodParams): Promise<ReportPeriod> {
  return resolveReportPeriod(db, orgId, params, {
    allowed: TESTING_PERIODS,
    fallback: TESTING_FALLBACK,
    fallbackNoSeason: TESTING_FALLBACK_NO_SEASON,
    reasons: TESTING_PERIOD_REASONS,
    anchor: todayIso(timezone),
    earliest: () => fetchEarliestTestDate(db, orgId),
  });
}

/** The window in the shape testingReport.ts's three readers take. */
export function testingWindow(period: ReportPeriod): { from: string; to: string } {
  return { from: period.range.from, to: period.range.to };
}

/** The query string this report's export, PDF and test-selector links carry, so
 *  anything opened from a filtered, period-scoped page is scoped identically.
 *  Writes the canonical `?period=`, never `?days=`, and always the RESOLVED key
 *  — a key that was coerced must not travel, or the download would cover a
 *  window the screen did not show.
 *
 *  `test` is part of it because the "By test" chip row hand-builds its href
 *  from a fixed list of keys, which is precisely how a param gets dropped by
 *  omission. Building it here means the period cannot be the one that goes
 *  missing. */
export function testingQuery(key: RangeKey, groupIds: readonly string[], testId?: string | null): string {
  const qs = new URLSearchParams({ period: key });
  if (testId) qs.set('test', testId);
  if (groupIds.length > 0) qs.set('groups', groupIds.join(','));
  return qs.toString();
}
