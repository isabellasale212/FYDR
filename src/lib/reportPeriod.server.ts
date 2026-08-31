import { clampPeriod, rangeLabel, resolveRange, type PeriodSource, type RangeKey, type ResolvedRange } from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import { fetchCurrentSeason, type CurrentSeason } from '@/lib/queries/schedule';
import type { Db } from '@/lib/queries/groups';

/* THE STEPS EVERY REPORT'S PERIOD MODULE TAKES, IN THE SAME ORDER.
 *
 * Read this next to `reports/injuries/period.ts`, which wrote the pattern
 * first and states the case for COLOCATION at length: `?days=` was duplicated
 * across nine files because each report's page.tsx, export/route.ts and
 * pdf/route.tsx carried its own allow-list and its own
 * `.includes(...) ? ... : <default>` line, and the three drifted. One module
 * per report, three importers, inside the route folder they belong to.
 *
 * That argument is about WHICH MODULE the three surfaces import. It says
 * nothing about the resolve step being retyped per report — and by the fourth
 * report it plainly should not be, because "resolve the param, look up the
 * season, clamp, resolve the range" is identical everywhere and only the
 * allow-list, the fallback and the anchors differ. So the colocated module
 * stays the single import point for its own three surfaces (that is the part
 * that stops a PDF covering the wrong window), and the steps live here once.
 *
 * `reports/injuries/period.ts` and `reports/athlete/[athleteId]/period.ts`
 * still spell the steps out inline. They are correct and are deliberately left
 * alone — they belong to another pass and their public shape does not change
 * if they are later moved onto this. Do not "unify" them mid-flight.
 *
 * Server-only (`.server` suffix, the convention groupFilter.server.ts and
 * period.server.ts already set) because it reaches the sticky `fydr-period`
 * cookie through resolvePeriod and the season row through `Db`. Neither can go
 * anywhere near a client bundle, and PeriodSelector is a client component that
 * imports lib/period.ts — which is exactly why that file is kept pure.
 *
 * THE STEPS:
 *  1. `resolvePeriod` — `?period=` first, legacy `?range=`/`?days=` second, the
 *     sticky cookie only when the URL is genuinely silent (present-and-empty
 *     means "cleared" and must NOT revive the cookie). An existing `?days=28`
 *     bookmark keeps working on all three surfaces at once.
 *  2. `fetchCurrentSeason` — the `deleted_at`-filtered lookup, never
 *     `fetchCurrentSeasonId`, whose missing filter is a documented latent bug
 *     against the partial `seasons_one_current` index.
 *  3. `clampPeriod` — SERVER-SIDE coercion, not merely a disabled `<option>`.
 *     A control cannot stop a hand-typed or bookmarked URL, and the clamped key
 *     is handed back to the control so the two can never disagree. The SCREEN
 *     DEFAULT is applied here too, before clamping, for the case where nothing
 *     was expressed at all — see `expressed` below.
 *  4. `resolveRange` — real `from`/`to`, as plain YYYY-MM-DD CALENDAR dates.
 *     Every column these reports bound against (test_results.test_date,
 *     compliance_expectations.expectation_date, wellness/training entry_date,
 *     gym_session_logs.entry_date, seasons.starts_on) is `date`-typed, so they
 *     are compared as strings and must NOT go through dateInTz / rangeBounds.
 *     CLAUDE.md rule 5 governs INSTANTS; shifting an already-calendar date by a
 *     timezone is a silent off-by-one day.
 */

export type ReportPeriod = {
  /** The key that was actually queried, after clamping. Hand this straight to
   *  PeriodSelector's `value`: a `<select>` whose value matches no option
   *  silently shows the first one instead. */
  key: RangeKey;
  range: ResolvedRange;
  /** Null when the org has no current season row — PeriodSelector renders the
   *  "This season" option ABSENT for that club rather than disabled, because
   *  that is a fact about the ORGANISATION and there is nothing a coach can act
   *  on from inside a period control. */
  season: CurrentSeason | null;
  source: PeriodSource | 'cookie';
  legacyDays: number | null;
  /** Whether the reader actually expressed a period: a `?period=`, a legacy
   *  `?range=`/`?days=` bookmark, or a sticky `fydr-period` cookie they set by
   *  picking one somewhere else. False means resolvePeriod found NOTHING (or
   *  found a present-but-empty/junk `?period=`, which is "cleared"), and this
   *  screen is therefore rendering `opts.fallback` — its OWN default, not a
   *  choice.
   *
   *  Hand it to PeriodSelector as `sticky` via `periodSticky()`. Same
   *  distinction squad/[athleteId]/page.tsx draws under the name `expressed`. */
  expressed: boolean;
  /** The requested key was illegal on this screen and was coerced. Say so;
   *  silently rendering a different window than the URL asked for is the exact
   *  substitution this whole model exists to prevent.
   *
   *  Null whenever `expressed` is false: the screen default is legal by
   *  contract (`fallback` must be in `allowed`), so an unexpressed period is
   *  never coerced and there is nothing to caveat. */
  coercedFrom: RangeKey | null;
  /** A legacy `?days=` bookmark whose number has no exact key (14, 90, 180 …)
   *  and was widened to the nearest not-narrower one. */
  approximated: boolean;
  /** Echoed back from the screen's own preset so the page can hand `allowed`
   *  and `reasons` to PeriodSelector without importing the preset a second time
   *  and risking the two drifting apart. */
  allowed: readonly RangeKey[];
  reasons: Partial<Record<RangeKey, string>>;
};

export type ReportPeriodOptions = {
  /** The keys this screen's data can honestly express. Everything else renders
   *  DISABLED WITH ITS REASON, never hidden — the rule analytics.md already
   *  sets ("Illegal combinations are disabled with the reason, not hidden"). */
  allowed: readonly RangeKey[];
  /** Where an ILLEGAL key lands, and equally the screen's own DEFAULT for when
   *  no key was expressed at all. Must itself be in `allowed`.
   *
   *  Both halves matter and only one of them used to work. resolvePeriod
   *  answers an absent `?period=` with no cookie as DEFAULT_RANGE (`month`),
   *  and `month` is legal on most screens — so clamping alone left `fallback`
   *  DEAD on the absent path, and a report whose stated default is `season` or
   *  `week` silently opened on 28 days instead. `resolveReportPeriod`
   *  substitutes it before clamping now, so the documented default is the one
   *  a coach actually gets. */
  fallback: RangeKey;
  /** Used instead of `fallback` when `fallback` is `season` and the club has no
   *  season row — otherwise the fallback would be illegal too and every request
   *  from a seasonless club would resolve to a key the control cannot show. */
  fallbackNoSeason?: RangeKey;
  /** Why each disallowed key is disallowed, appended to its own option label.
   *  Write one for every excluded key: a key disabled with no reason still
   *  renders disabled, but an unexplained grey option is worse than a long
   *  label. */
  reasons?: Partial<Record<RangeKey, string>>;
  /** The window's `to` edge, as an org-timezone calendar date. Usually
   *  `todayIso(timezone)` — but the compliance report anchors on the most
   *  recent day it actually HAS data for, and its window must end where that
   *  anchor does, not at the wall clock. */
  anchor: string;
  /** The earliest date on record for this report's own subject, for `all`.
   *  Called ONLY when the resolved key is `all`, so a screen never pays for a
   *  lookup it will not use. Null degrades `all` to the MAX_WINDOW_DAYS floor
   *  rather than inventing a start date. */
  earliest: () => Promise<string | null>;
};

export async function resolveReportPeriod(
  db: Db,
  orgId: string,
  params: PeriodParams,
  opts: ReportPeriodOptions,
): Promise<ReportPeriod> {
  /* The season row is fetched on EVERY render, not only for `?period=season`:
   * the control needs it to decide whether to offer the option at all and to
   * name it. The earliest date is the opposite — needed by one key only, and
   * therefore deferred behind a thunk. */
  const [requested, season] = await Promise.all([resolvePeriod(params), fetchCurrentSeason(db, orgId)]);

  const seasonAvailable = season !== null;
  const fallback = opts.fallback === 'season' && !seasonAvailable ? (opts.fallbackNoSeason ?? 'month') : opts.fallback;

  /* THE SCREEN DEFAULT, APPLIED BEFORE THE CLAMP — the absent half of
   * `fallback`'s contract, which clampPeriod alone cannot serve.
   *
   * clampPeriod only substitutes `fallback` for an ILLEGAL key, and
   * resolvePeriod hands an absent period back as DEFAULT_RANGE (`month`) with
   * `source: 'default'`. `month` is legal on both reports that set a fallback
   * of their own, so nothing was ever illegal and nothing was ever
   * substituted: the testing report opened on 28 days despite documenting
   * `season` (and never reached `year` for a seasonless club at all), and the
   * compliance report quietly widened its long-standing 7-day rate to 28.
   *
   * `source: 'default'` is resolvePeriod's way of saying "nobody expressed a
   * preference" — no `?period=`, no legacy bookmark, and no usable
   * `fydr-period` cookie either (a present-but-empty or junk `?period=` lands
   * here too, and means "cleared", which is also not a preference). Every
   * other source is a real choice and is honoured untouched, so a coach who
   * picked "Last 7 days" elsewhere keeps it. Exactly the test
   * squad/[athleteId]/page.tsx already makes under the name `expressed`. */
  const expressed = requested.source !== 'default';

  const { key, coercedFrom } = clampPeriod(expressed ? requested.key : fallback, {
    allowed: opts.allowed,
    seasonAvailable,
    fallback,
  });

  const earliest = key === 'all' ? await opts.earliest() : null;
  const range = resolveRange(key, opts.anchor, season?.starts_on ?? null, earliest);

  return {
    key,
    range,
    season,
    source: requested.source,
    legacyDays: requested.legacyDays,
    expressed,
    coercedFrom,
    approximated: requested.approximated,
    allowed: opts.allowed,
    reasons: opts.reasons ?? {},
  };
}

/**
 * Whether this render should write the account-wide sticky `fydr-period`
 * cookie — PeriodSelector's `sticky` prop, computed once so the screens cannot
 * each answer it differently.
 *
 * TRUE ONLY WHEN THE RENDERED KEY IS THE READER'S OWN, UNALTERED. Two ways it
 * can fail to be, and both write a window the coach never picked into a cookie
 * every other screen then reads:
 *
 *  - NOT EXPRESSED. The screen is showing `opts.fallback`, its own default.
 *    PeriodSelector's `sticky` doc gives this case by name: a screen-specific
 *    default that stickies "silently re-scopes every other screen to a window
 *    the coach never picked and cannot see the origin of".
 *  - COERCED. The coach's real choice was illegal HERE and was clamped to this
 *    screen's fallback. Writing the clamped value back would let the narrowest
 *    allow-list in the app overwrite a preference that is perfectly legal
 *    everywhere else — /dashboard offers `day` and `week` alone, so before
 *    this every sign-in (homeRoute() lands coaches there) rewrote the cookie
 *    to `day`, which no report accepts, and each report then clamped it to a
 *    different fallback and printed a caveat about a choice nobody made.
 *
 * The existing cookie is left ALONE in both cases rather than overwritten, so
 * the next screen still honours whatever the coach last really picked.
 */
export function periodSticky(period: ReportPeriod): boolean {
  return period.expressed && period.coercedFrom === null;
}

/** Every param a period can arrive in: the canonical key and the two legacy
 *  ones, so an existing `?days=28` bookmark still renders a window rather than
 *  snapping back to the default. Same shape `reports/injuries/period.ts`
 *  exports under this name. */
export type PeriodParams = { period?: string | string[]; range?: string | string[]; days?: string | string[] };

/** Narrow a page's `searchParams` record to the three keys the period model
 *  reads. Written out rather than passing the whole record through, so the
 *  present/absent distinction resolvePeriod depends on survives on a plainly
 *  typed object rather than an index signature. */
export function periodParamsFrom(params: Record<string, string | string[] | undefined>): PeriodParams {
  return { period: params.period, range: params.range, days: params.days };
}

/** The route handlers read a `URL`, not a Next searchParams record. Same three
 *  keys, same precedence, same sticky cookie — an export must resolve the
 *  period exactly as its page did, or the document silently covers a different
 *  window than the screen it was exported from.
 *
 *  `?? undefined` and not `?? ''`: `searchParams.get()` returns null for
 *  ABSENT, while PRESENT-BUT-EMPTY is `''`. Those are different answers — the
 *  first inherits the sticky cookie, the second means "cleared" and must not.
 *  See readPeriodParam's step 2. */
export function periodParamsFromUrl(url: URL): PeriodParams {
  return {
    period: url.searchParams.get('period') ?? undefined,
    range: url.searchParams.get('range') ?? undefined,
    days: url.searchParams.get('days') ?? undefined,
  };
}

/** One sentence naming every way the window that rendered differs from the one
 *  the URL asked for. Null when there is nothing to say, which is the common
 *  case, so a screen can render it unconditionally.
 *
 *  All three of these are silent by default and all three change what the
 *  reader is looking at: a coerced key shows a different window than was asked
 *  for, an approximated legacy bookmark shows a wider one, and a clipped window
 *  shows less than its own label promises. */
export function periodCaveat(period: ReportPeriod): string | null {
  const parts: string[] = [];
  if (period.approximated && period.legacyDays !== null) {
    parts.push(
      `A bookmarked ${period.legacyDays}-day window has no exact equivalent in this control and was widened to “${period.range.label}” rather than narrowed`,
    );
  }
  if (period.coercedFrom !== null) {
    parts.push(
      period.coercedFrom === 'season'
        ? 'This club has no current season set up, so “This season” is not available'
        : // The coerced key by its OWN LABEL, never the raw RangeKey. `day` and
          // `month` are internal vocabulary; a coach reads “Today” and “Last 28
          // days” in the control right beside this sentence, and quoting the key
          // instead names something that appears nowhere on the screen.
          `“${rangeLabel(period.coercedFrom)}” is not a period this report can express, so it fell back to “${period.range.label}”`,
    );
  }
  if (period.range.clipped) {
    parts.push(
      `“${period.range.label}” is capped at ${period.range.days} days, so this covers ${period.range.from} onward rather than everything on record`,
    );
  }
  return parts.length === 0 ? null : `${parts.join('. ')}.`;
}
