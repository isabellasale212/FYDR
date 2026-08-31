import { ACWR_ACUTE_WINDOW_DAYS, ACWR_CHRONIC_WINDOW_DAYS } from '@/lib/acwr';
import { todayIso } from '@/lib/format';
import { clampPeriod, rangeLabel, resolveRange, type RangeKey, type ResolvedRange } from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import { fetchEarliestAthleteEntryDate } from '@/lib/queries/athleteReport';
import type { Db } from '@/lib/queries/groups';
import { fetchCurrentSeason } from '@/lib/queries/schedule';

/* The athlete report's period, resolved once for the page, the CSV export and
 * the PDF — colocated in the route folder all three live in, for the reason
 * the sibling module under /reports/injuries states at length: `?days=` was
 * duplicated across nine files precisely because each surface carried its own
 * copy of the allow-list, and the copies drifted.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE PERIOD DOES **NOT** TOUCH: ACWR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Read this before adding an option or a panel.
 *
 * The acute:chronic workload ratio is DEFINED as a trailing 7-day acute load
 * over a trailing 28-day chronic load (ACWR_ACUTE_WINDOW_DAYS and
 * ACWR_CHRONIC_WINDOW_DAYS, lib/acwr.ts — a sports-science definition, not a
 * view preference). There is no season-long ACWR and no all-time ACWR.
 * Widening the window does not widen the ratio; it would only change how many
 * already-trailing ratios you are looking at, and this report shows exactly
 * one — the figure as it stands today.
 *
 * So the control is scoped to the panels whose numbers are genuinely windowed
 * — compliance, wellness readiness, session load by day, GPS totals, gym
 * counts, testing — and the Load tab's three ACWR tiles carry their own fixed
 * windows in their own labels (ACWR_WINDOW_CAPTION below). A coach reading a
 * year-scoped page must not be able to think the dial moved with it.
 *
 * This is enforced in two places and needs both:
 *   - queries/athleteReport.ts derives acwrFrom/acuteFrom from `today` alone
 *     and never from the period's `from`, and takes the ratio's 28-day slice
 *     out of a wider read rather than narrowing the read to it;
 *   - this screen prints the fixed windows next to the numbers.
 *
 * ---------------------------------------------------------------------------
 * WHY `day` IS NOT OFFERED
 * ---------------------------------------------------------------------------
 *
 * Every headline on this report is computed over a trailing band or a window,
 * so at one day they are all either a single point or a division by one:
 *
 *  - READINESS is drawn against the athlete's OWN 14-day rolling mean and ±1SD
 *    band (wellnessSeries(..., 14)). One day is one point with no band to read
 *    it against — /analytics states the general form of this already ("A
 *    single day is one point, not a trend").
 *  - COMPLIANCE over one day is "did they submit today", which is the Today
 *    screen's job, not a report's.
 *  - SESSION LOAD BY DAY over one day is one row.
 *
 * `week` IS offered, unlike on the injury report: a week of readiness against
 * an existing 14-day band is a real read (the band is built from data outside
 * the window, so it does not collapse), and a week of session load is the
 * unit a coach actually plans in.
 *
 * THAT PARENTHESIS IS A LOAD-BEARING CLAIM ABOUT ANOTHER FILE, and it was not
 * true when it was written: queries/athleteReport.ts read wellness over the
 * window alone, so at `week` the band had at most seven points against
 * rollingBand's minObservations of 4 and the first three days drew no band at
 * all. It now reads from `from - 14` and slices the lead-in off after building
 * the series (WELLNESS_ROLLING_WINDOW there). If that lead-in is ever removed,
 * `week` must come off this allow-list with it.
 *
 * Disabled with the reason, never hidden (docs/screens/analytics.md, "Illegal
 * combinations are disabled with the reason, not hidden"). `season` is the
 * other case: ABSENT when the org has no current season row, because that is
 * a fact about the organisation rather than about this screen. */

/** The keys this report can honestly express. */
export const ATHLETE_PERIODS: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];

export const ATHLETE_PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'readiness is read against a 14-day band, and one day is one point',
};

/** The window this report has always defaulted to (`days=28`), and the one it
 *  falls back to for anything it cannot honour. Equal to DEFAULT_RANGE. */
export const ATHLETE_FALLBACK: RangeKey = 'month';

/** Printed beside the three load tiles, verbatim, on the page and in the PDF.
 *  Built from the same two constants the computation uses so the caption and
 *  the maths cannot drift — the failure mode this whole caption exists to
 *  prevent is a coach reading "ACWR" under a "Last 365 days" control and
 *  believing the ratio covers the year. */
export const ACWR_WINDOW_CAPTION = `Fixed windows: acute is the trailing ${ACWR_ACUTE_WINDOW_DAYS} days and chronic the trailing ${ACWR_CHRONIC_WINDOW_DAYS} days, ending today. The ratio is defined that way, so the period above does not change it.`;

export type AthletePeriod = ResolvedRange & {
  season: { name: string; starts_on: string } | null;
  coercedFrom: RangeKey | null;
  approximatedFrom: number | null;
};

export type PeriodParams = { period?: string | string[]; range?: string | string[]; days?: string | string[] };

export async function resolveAthletePeriod(
  db: Db,
  orgId: string,
  athleteId: string,
  timezone: string,
  params: PeriodParams,
): Promise<AthletePeriod> {
  const today = todayIso(timezone);
  const requested = await resolvePeriod(params);

  const [season, earliest] = await Promise.all([
    fetchCurrentSeason(db, orgId),
    // Athlete-scoped, not org-scoped: "all on record" on a one-athlete report
    // means all of THIS athlete's record. See the function's own comment.
    fetchEarliestAthleteEntryDate(db, orgId, athleteId),
  ]);

  const { key, coercedFrom } = clampPeriod(requested.key, {
    allowed: ATHLETE_PERIODS,
    seasonAvailable: season !== null,
    fallback: ATHLETE_FALLBACK,
  });

  // seasons.starts_on and both entry_date columns are `date`-typed: plain
  // YYYY-MM-DD, compared as strings, never through dateInTz (rule 5 governs
  // instants; these have no timezone in them to convert).
  const range = resolveRange(key, today, season?.starts_on ?? null, earliest);

  return {
    ...range,
    season,
    coercedFrom,
    approximatedFrom: requested.approximated ? requested.legacyDays : null,
  };
}

/** Narrow a page's `searchParams` record to the three keys the period model
 *  reads, so the present/absent distinction resolvePeriod depends on survives
 *  on a plainly-typed object rather than an index signature. */
export function periodParamsFrom(params: Record<string, string | string[] | undefined>): PeriodParams {
  return { period: params.period, range: params.range, days: params.days };
}

/** The route handlers read a `URL`, not a Next searchParams record. Same three
 *  keys, same precedence, same sticky cookie — an export must resolve the
 *  period exactly as the page did. */
export function periodParamsFromUrl(url: URL): PeriodParams {
  return {
    period: url.searchParams.get('period') ?? undefined,
    range: url.searchParams.get('range') ?? undefined,
    days: url.searchParams.get('days') ?? undefined,
  };
}

/** The export links' query string.
 *
 *  The href this replaces was `/reports/athlete/${athleteId}/export?days=${d}`
 *  — and the on-page chip row's was `/reports/athlete/${athleteId}?days=${d}`,
 *  which DROPPED EVERY OTHER PARAM INCLUDING `groups`. A coach who filtered to
 *  Forwards and then changed the period silently lost the filter, a direct
 *  CLAUDE.md §3 violation caused by nothing but hand-building an href from a
 *  fixed list of known keys. The chip row is gone; PeriodSelector rebuilds
 *  from the live URL. This helper only has to carry the params the export
 *  itself reads. */
export function exportQuery(key: RangeKey): string {
  return new URLSearchParams({ period: key }).toString();
}

/** One sentence naming the real window and every way it differs from what was
 *  asked for — a clipped cap, a coerced key, or a legacy `?days=` bookmark
 *  that had to widen. Null when nothing needs saying. */
export function periodCaveat(period: AthletePeriod): string | null {
  const parts: string[] = [];
  if (period.approximatedFrom !== null) {
    parts.push(
      `A bookmarked ${period.approximatedFrom}-day window has no exact equivalent in this control and was widened to “${period.label}” rather than narrowed`,
    );
  }
  if (period.coercedFrom !== null) {
    parts.push(
      period.coercedFrom === 'season'
        ? 'This club has no current season set up, so “This season” is not available'
        : // The coerced key by its OWN LABEL, never the raw RangeKey — see
          // lib/period.ts's rangeLabel(). `day` is internal vocabulary; the
          // control beside this sentence says "Today".
          `“${rangeLabel(period.coercedFrom)}” is not a period this report can express, so it fell back to “${period.label}”`,
    );
  }
  if (period.clipped) {
    parts.push(
      `“${period.label}” is capped at ${period.days} days, so this covers ${period.from} onward rather than everything on record`,
    );
  }
  return parts.length === 0 ? null : `${parts.join('. ')}.`;
}
