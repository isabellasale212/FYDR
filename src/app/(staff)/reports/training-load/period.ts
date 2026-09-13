import type { RangeKey } from '@/lib/period';
import { fetchEarliestComplianceExpectationDate, fetchLatestComplianceExpectationDate } from '@/lib/queries/reports';
import type { Db } from '@/lib/queries/groups';
import { resolveReportPeriod, type PeriodParams, type ReportPeriod } from '@/lib/reportPeriod.server';

/* The Training load report's period, resolved once for the three surfaces that
 * must agree about it: the page, the CSV export and the PDF. Colocated, like
 * reports/compliance/period.ts, whose reasoning this borrows wholesale: the
 * report reads the same expectation rows the compliance report reads (the
 * sessions an athlete was expected at), so it anchors and bounds the same way.
 *
 * WHY `day` IS EXCLUDED. A day's load is one session's RPE × minutes, which
 * the athlete's own profile and My data already show per session; a load is
 * read as a sum over a window or it is not a load.
 *
 * WHY THE DEFAULT IS `month`. The acute:chronic ratio everything else rests on
 * is trailing 7 over 28 days; the month is the chronic window and the shortest
 * read that means anything against it. A week is offered, not defaulted.
 *
 * `?to=` (the day anchor) and `?period=` (the window length) are orthogonal
 * and stay that way — the compliance report's rule, for the same reason. */

export const TRAINING_LOAD_PERIODS: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];

export const TRAINING_LOAD_PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'a single day is one session’s load, which the athlete’s profile shows per session',
};

export const TRAINING_LOAD_FALLBACK: RangeKey = 'month';

export type TrainingLoadAnchor = { to: string; usingLatestData: boolean };

/** Which day the window ends on — the most recent day this org has an RPE
 *  expectation for when no `?to=` is given, never the future, and a coach's
 *  explicit pick otherwise (reports/compliance/period.ts complianceAnchor). */
export async function trainingLoadAnchor(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  toParam: string | string[] | undefined,
  realToday: string,
): Promise<TrainingLoadAnchor> {
  const raw = Array.isArray(toParam) ? toParam[0] : toParam;
  const requested = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  const latestDataDate = requested === null ? await fetchLatestComplianceExpectationDate(db, orgId, groupIds) : null;
  const anchor = requested ?? latestDataDate ?? realToday;
  const to = anchor > realToday ? realToday : anchor;
  return { to, usingLatestData: requested === null && latestDataDate !== null && to !== realToday };
}

export async function resolveTrainingLoadPeriod(db: Db, orgId: string, anchor: string, params: PeriodParams): Promise<ReportPeriod> {
  return resolveReportPeriod(db, orgId, params, {
    allowed: TRAINING_LOAD_PERIODS,
    fallback: TRAINING_LOAD_FALLBACK,
    reasons: TRAINING_LOAD_PERIOD_REASONS,
    anchor,
    earliest: () => fetchEarliestComplianceExpectationDate(db, orgId),
  });
}

/** The query string the export, the PDF and the window links carry — the
 *  RESOLVED key, never a coerced one, and the anchor with it. */
export function trainingLoadQuery(key: RangeKey, to: string, groupIds: readonly string[]): string {
  const qs = new URLSearchParams({ period: key, to });
  if (groupIds.length > 0) qs.set('groups', groupIds.join(','));
  return qs.toString();
}
