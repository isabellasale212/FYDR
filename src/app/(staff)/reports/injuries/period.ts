import { todayIso } from '@/lib/format';
import { clampPeriod, rangeLabel, resolveRange, type RangeKey, type ResolvedRange } from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import type { Db } from '@/lib/queries/groups';
import { fetchEarliestInjuryOnset } from '@/lib/queries/reports';
import { fetchCurrentSeason } from '@/lib/queries/schedule';

/* The injury & availability report's period, resolved once for the three
 * surfaces that must agree about it: the page, the CSV export and the PDF.
 *
 * COLOCATED, NOT IN lib/. `?days=` was duplicated across NINE files precisely
 * because each of page.tsx / export/route.ts / pdf/route.tsx carried its own
 * copy of the allow-list and its own `.includes(...) ? ... : <default>` line,
 * and the three drifted (injuries/export/route.ts inlined `[28, 90, 180,
 * 365]` as a literal rather than naming the constant, so a grep for `PERIODS`
 * found only two of this report's three files). One module, three importers,
 * inside the route folder they all belong to: a value this report's page can
 * offer but its PDF cannot honour is now a type error rather than a PDF that
 * quietly covers 28 days.
 *
 * ---------------------------------------------------------------------------
 * WHY `day` AND `week` ARE NOT OFFERED
 * ---------------------------------------------------------------------------
 *
 * Not a rendering preference — the two figures this report exists to produce
 * cannot be read over them.
 *
 * ATHLETE-DAYS LOST is a sum over a window; over seven days a single
 * hamstring strain is "7 days lost" and over one day it is "1", and neither
 * number tells a coach anything about burden. AVAILABILITY % is worse: it is
 * `(athleteDays - daysLost) / athleteDays` with `athleteDays = squad ×
 * periodDays`, so at `day` the denominator is the squad size and one
 * unavailable player in a 20-man squad prints exactly 95% whatever is
 * actually happening. And BURDEN is bucketed BY WEEK (mondayOfIso in
 * queries/reports.ts) — at `week` it degrades to a single bar and at `day` to
 * a single bar covering a fraction of one, which is a chart of the control,
 * not of the squad.
 *
 * Handled the way this codebase already settled on and NOT by hiding them
 * (docs/screens/analytics.md, "Illegal combinations are disabled with the
 * reason, not hidden"): both keys render DISABLED with the reason in their
 * own label. `season` is the separate case — absent when the org has no
 * current season row, because that is a fact about the ORGANISATION rather
 * than about this screen, and there is nothing a coach can act on from inside
 * a period control. PeriodSelector draws that distinction; clampPeriod
 * enforces both server-side, because the control alone does not stop a
 * hand-typed or bookmarked URL. */

/** The keys this report can honestly express. */
export const INJURY_PERIODS: readonly RangeKey[] = ['month', 'season', 'year', 'all'];

/** Why each excluded key is excluded, appended to its own option label.
 *  Written as a reason a coach can act on, not as "unavailable". */
export const INJURY_PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'days lost and availability are counted over weeks, not one day',
  week: 'one week is too short to read injury burden',
};

/** The window this report falls back to for anything it cannot honour, and
 *  the one it has always defaulted to (`days=28`). Equal to DEFAULT_RANGE;
 *  named here so the three surfaces cannot disagree about it. */
export const INJURY_FALLBACK: RangeKey = 'month';

export type InjuryPeriod = ResolvedRange & {
  /** For PeriodSelector, and null when the org has no current season row —
   *  in which case "This season" is not offered at all. */
  season: { name: string; starts_on: string } | null;
  /** Set when the requested key was illegal here (or `season` with no season
   *  row) and was coerced to INJURY_FALLBACK, so the page can say so instead
   *  of silently rendering a different window than the URL asked for. */
  coercedFrom: RangeKey | null;
  /** The raw `?days=` a legacy bookmark asked for, when the key below is an
   *  approximation of it rather than an exact translation (`?days=90` and
   *  `?days=180` have no key; both widen to `year`, never narrow). Null
   *  otherwise. */
  approximatedFrom: number | null;
};

/** Every param this report's period can arrive in — the canonical key and the
 *  two legacy ones, so an existing `/reports/injuries?days=90` bookmark still
 *  renders a window rather than snapping back to the default. */
export type PeriodParams = { period?: string | string[]; range?: string | string[]; days?: string | string[] };

export async function resolveInjuryPeriod(
  db: Db,
  orgId: string,
  timezone: string,
  params: PeriodParams,
): Promise<InjuryPeriod> {
  const today = todayIso(timezone);
  const requested = await resolvePeriod(params);

  /* Both anchors are fetched unconditionally rather than only for the key
   * that needs them: `season` is needed by the control on EVERY render (to
   * decide whether to offer the option at all, and to name it), and the
   * earliest onset is a single ordered row with `.limit(1)`, not a scan. */
  const [season, earliest] = await Promise.all([
    fetchCurrentSeason(db, orgId),
    fetchEarliestInjuryOnset(db, orgId),
  ]);

  const { key, coercedFrom } = clampPeriod(requested.key, {
    allowed: INJURY_PERIODS,
    seasonAvailable: season !== null,
    fallback: INJURY_FALLBACK,
  });

  /* seasons.starts_on and injuries.onset_date are both `date` columns:
   * already calendar dates with no timezone in them, passed to resolveRange
   * as plain YYYY-MM-DD and compared as strings. CLAUDE.md rule 5 governs
   * INSTANTS; pushing either through dateInTz would shift it a day near
   * midnight (schedule.ts:843-847, the header on `fetchCurrentSeason`, states
   * this on the season lookup itself). */
  const range = resolveRange(key, today, season?.starts_on ?? null, earliest);

  return {
    ...range,
    season,
    coercedFrom,
    approximatedFrom: requested.approximated ? requested.legacyDays : null,
  };
}

/** Narrow a page's `searchParams` record to the three keys the period model
 *  reads. Written out rather than passing the whole record through, so the
 *  present/absent distinction resolvePeriod depends on (`?period=` present but
 *  EMPTY means "cleared", and must not fall through to the sticky cookie)
 *  survives on a plainly-typed object rather than an index signature. */
export function periodParamsFrom(params: Record<string, string | string[] | undefined>): PeriodParams {
  return { period: params.period, range: params.range, days: params.days };
}

/** The route handlers read a `URL`, not a Next searchParams record. Same
 *  three keys, same precedence, same sticky cookie — an export must resolve
 *  the period exactly as the page did or the document silently covers a
 *  different window than the screen it was exported from.
 *
 *  `?? undefined`, not `?? ''`: `get()` returns null only when the key is
 *  genuinely ABSENT, and returns `''` when it is present with an empty value.
 *  Those are different answers — absent falls back to the sticky cookie,
 *  present-and-empty means "cleared" and resolves to the default — so the null
 *  must become `undefined` and the `''` must survive as `''`
 *  (readPeriodParam step 2, period.server.ts's present/absent note). */
export function periodParamsFromUrl(url: URL): PeriodParams {
  return {
    period: url.searchParams.get('period') ?? undefined,
    range: url.searchParams.get('range') ?? undefined,
    days: url.searchParams.get('days') ?? undefined,
  };
}

/** The query string the page's own export links carry, so a PDF opened from a
 *  filtered, period-scoped page is scoped identically. Writes the canonical
 *  `?period=`, never `?days=`. */
export function exportQuery(key: RangeKey, groupIds: readonly string[]): string {
  const qs = new URLSearchParams({ period: key });
  if (groupIds.length > 0) qs.set('groups', groupIds.join(','));
  return qs.toString();
}

/** One sentence naming the real window and every way it differs from what was
 *  asked for. Null when nothing needs saying — the common case.
 *
 *  This exists because all three of these are silent by default and all three
 *  change what the reader is looking at: a clipped window shows less than its
 *  label promises, a coerced key shows a different window than the URL asked
 *  for, and an approximated legacy bookmark shows a wider one. */
export function periodCaveat(period: InjuryPeriod): string | null {
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
          // lib/period.ts's rangeLabel(). `day` and `week` are internal
          // vocabulary; the control beside this sentence says "Today" and
          // "Last 7 days".
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
