import { ACWR_CHRONIC_WINDOW_DAYS } from '@/lib/acwr';
import { addDays } from '@/lib/format';

/* THE PERIOD MODEL — one definition of "over what window", for every screen.
 *
 * The client's instruction, verbatim: *"i want to be able to adjust the period
 * of any data from the day to the week to the season to the year to all"*.
 * Those are exactly the six keys below. This file is the foundation for that;
 * it does not migrate any screen, it gives every screen one thing to migrate
 * TO.
 *
 * WHERE THIS CAME FROM. Every export here was lifted VERBATIM out of
 * lib/analyticsBuilder.ts (which now re-exports them, so /analytics is
 * unchanged). The logic is not new and was not touched: it is already
 * timezone-correct, season-aware, capped, and honest about degrading when the
 * database cannot supply a season start or an earliest entry date. It was
 * simply stuck in a file that also holds METRICS, CHART_OPTIONS and the
 * analytics tier gate, so nothing outside /analytics could import the range
 * model without dragging the whole analytics catalogue into its bundle.
 *
 * WHAT LIVES HERE AND WHAT DOES NOT. This file is PURE: no React, no
 * next/headers, no `Db`, no imports beyond two constant/date helpers that are
 * themselves import-free. That is deliberate and load-bearing — the
 * PeriodSelector is a client component and the export/PDF route handlers are
 * server-only, and both must be able to import this. The cookie fallback,
 * which needs next/headers and therefore cannot run in a client bundle, lives
 * in the separate lib/period.server.ts, exactly as lib/groupFilter.ts and
 * lib/groupFilter.server.ts are already split for the same reason.
 *
 * ------------------------------------------------------------------------
 * TWO OPTIONS THAT ARE NEVER UNIVERSALLY LEGAL
 * ------------------------------------------------------------------------
 *
 * Read this before wiring a PeriodSelector to a screen. The six keys are the
 * vocabulary, not a promise that all six mean something everywhere. Two of
 * them are meaningless for whole classes of metric, and a control that offers
 * them anyway draws an empty chart and calls it data.
 *
 *  1. `day` IS MEANINGLESS FOR ANYTHING WITH A ROLLING BAND. A 14-day
 *     wellness baseline or a 28-day chronic load is not a value that exists
 *     "on" a day at one-day resolution — one day gives it one point and
 *     nothing to draw a band against. /analytics already states the general
 *     form of this (`chartUnavailableReason`: "A single day is one point, not
 *     a trend"). Same rule, wider: if the number a screen shows is itself
 *     computed over a trailing window, `day` is not a period for it.
 *
 *  2. `all` IS MEANINGLESS FOR A RATIO. ACWR is DEFINED as a trailing 7-day
 *     acute load over a trailing 28-day chronic load (ACWR_ACUTE_WINDOW_DAYS
 *     and ACWR_CHRONIC_WINDOW_DAYS, lib/acwr.ts). There is no
 *     all-time ACWR: widening the window does not widen the ratio, it only
 *     changes how many already-trailing ratios you are looking at. The same
 *     goes for any metric whose `aggregate` is `trailing` in
 *     analyticsBuilder.ts — its value is the figure as it stands on the LAST
 *     day of the window, so "all on record" and "last 28 days" print the
 *     identical number and only the chart's x-axis differs.
 *
 * Both are handled the same way, and it is the way this codebase already
 * settled on: DISABLE WITH THE REASON, NEVER HIDE (docs/screens/analytics.md,
 * "Illegal combinations are disabled with the reason, not hidden"). Pass the
 * legal keys as PeriodSelector's `allowed` and the rest render disabled with
 * the reason in the label. Hiding them makes the control a different length
 * on every screen and leaves the coach nothing to reason about.
 *
 * ------------------------------------------------------------------------
 * WIDENING A WINDOW MULTIPLIES ROWS — PAGE, OR TRUNCATE SILENTLY
 * ------------------------------------------------------------------------
 *
 * This is the one way this feature breaks data rather than layout, so it gets
 * its own heading. PostgREST returns AT MOST `db-max-rows` rows (1000 here,
 * `max_rows` in supabase/config.toml) and DOES NOT ERROR when it hits the
 * ceiling — it returns exactly 1000 rows that look like a complete answer.
 *
 * A query that was safe at `week` is not automatically safe at `year` or
 * `all`. A 40-athlete squad logging most days is ~40 rows a day: fine over 7
 * days (280), over the ceiling before the 25th day, and 14,600 rows over a
 * year. Three separate silent-truncation bugs were found in this codebase in
 * one week, all of this exact shape.
 *
 * So: ANY QUERY WHOSE WINDOW CAN NOW GROW MUST PAGE, via `fetchAllPaged`
 * (lib/queries/paged.ts), AND ITS `ORDER BY` MUST END IN A UNIQUE KEY. The
 * second half is not optional and is the subtler half: `.range()` re-runs the
 * query per page, so ties in the sort key can be broken differently on each
 * page and a row is then returned twice or skipped entirely — which, for a
 * metric the caller SUMS, is an inflated or deflated number with no error and
 * no short page to notice it. Order by what the reader wants AND `id`.
 *
 * MAX_WINDOW_DAYS (730) is the backstop, not the fix. It bounds `season` and
 * `all`; it does nothing for `year`, which is under it and still 14k rows. */

export type RangeKey = 'day' | 'week' | 'month' | 'season' | 'year' | 'all';

/** analytics.md's own validation table caps a window at 730 days ("The window
 *  must be between 1 day and 2 years"). "All" and "Season" both honour that
 *  cap rather than issuing an unbounded scan: a club three seasons deep would
 *  otherwise pull every wellness row it has ever written to draw one line. */
export const MAX_WINDOW_DAYS = 730;

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  from: string;
  to: string;
  days: number;
  /** True when MAX_WINDOW_DAYS clipped the window the label promises, so the
   *  page can say so instead of quietly showing less than it claims. */
  clipped: boolean;
};

export const RANGE_OPTIONS: readonly { key: RangeKey; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: `Last ${ACWR_CHRONIC_WINDOW_DAYS} days` },
  { key: 'season', label: 'This season' },
  { key: 'year', label: 'Last 365 days' },
  { key: 'all', label: 'All on record' },
];

export const DEFAULT_RANGE: RangeKey = 'month';

/** A key as the CONTROL itself spells it — "Last 28 days", not `month`.
 *
 *  Anything a coach reads must go through this. `day`, `month` and `all` are
 *  internal vocabulary that appears nowhere on any screen, so a sentence that
 *  quotes the raw key (the coercion caveat used to) names something the reader
 *  cannot find in the select sitting right beside it. Falls back to the key
 *  only if RANGE_OPTIONS ever loses an entry, which would be a bug rather than
 *  a state worth a nicer sentence for. */
export function rangeLabel(key: RangeKey): string {
  return RANGE_OPTIONS.find((r) => r.key === key)?.label ?? key;
}

export function isRangeKey(raw: unknown): raw is RangeKey {
  return typeof raw === 'string' && RANGE_OPTIONS.some((r) => r.key === raw);
}

/**
 * Turn a range key into real dates.
 *
 * `today` is already the org-timezone date (todayIso(timezone)) — CLAUDE.md
 * rule 5: never read UTC components to decide what "today" is for a club in
 * another zone. `seasonStart` and `earliest` are passed in because only the
 * database knows them; when either is missing the range degrades to a
 * bounded window rather than inventing a start date.
 *
 * The `from`/`to` this returns are plain YYYY-MM-DD CALENDAR DATES, not
 * instants, and that distinction is the whole of CLAUDE.md rule 5 at the call
 * site — see the "APPLYING A RESOLVED RANGE TO A COLUMN" note below before
 * putting either of them into a query.
 */
export function resolveRange(
  key: RangeKey,
  today: string,
  seasonStart: string | null,
  earliest: string | null,
): ResolvedRange {
  const label = rangeLabel(key);

  // Fixed-length windows. `days` counts inclusively, so "Last 7 days" is
  // today plus the six before it, the same convention lib/acwr.ts uses.
  const fixed: Partial<Record<RangeKey, number>> = { day: 1, week: 7, month: ACWR_CHRONIC_WINDOW_DAYS, year: 365 };
  const fixedDays = fixed[key];
  if (fixedDays !== undefined) {
    return { key, label, from: addDays(today, -(fixedDays - 1)), to: today, days: fixedDays, clipped: false };
  }

  // Open-ended windows: season-to-date and everything on record. Both are
  // anchored on a real date from the database, then clipped to the cap.
  const anchor = key === 'season' ? seasonStart : earliest;
  const floor = addDays(today, -(MAX_WINDOW_DAYS - 1));
  const clipped = anchor !== null && anchor < floor;
  // A club can legitimately have a current season that starts next month
  // (pre-season admin), and an anchor after today would produce from > to —
  // an inverted window, which reads downstream as "no data" rather than as
  // "this has not started". Collapse it to the single day instead.
  const raw = anchor === null || anchor < floor ? floor : anchor;
  const from = raw > today ? today : raw;
  return { key, label, from, to: today, days: inclusiveDays(from, today), clipped };
}

/** Inclusive day count between two YYYY-MM-DD dates. Deliberately not
 *  lib/format.ts's daysBetween(), which is exclusive; getting these two
 *  confused is a silent off-by-one in every window on this screen. */
export function inclusiveDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}

/* ------------------------------------------------------------------ *
 * APPLYING A RESOLVED RANGE TO A COLUMN
 * ------------------------------------------------------------------ *
 *
 * There is no helper for this because there cannot be one: the correct
 * conversion depends on the COLUMN TYPE, which only the query file knows.
 * Getting it wrong is a silent off-by-one-day, not an error, so both halves
 * are written out here.
 *
 *  A `timestamptz` COLUMN — sessions.starts_at, flags.raised_at, audit_log
 *  timestamps — is an INSTANT. A calendar date is not a bound on it until it
 *  has been anchored in the club's timezone. Push both edges through
 *  `rangeBounds(from, to, timezone)` (lib/queries/schedule.ts:48), which uses
 *  `zonedTimeToUtcIso` for local midnight and local next-midnight-minus-1ms.
 *  The naive version of this (`${date}T00:00:00Z`) was a real shipped bug:
 *  Europe/London is UTC+1 for half the year, so every session between 23:00
 *  and midnight UTC landed on the wrong calendar day.
 *
 *  A `date` COLUMN — seasons.starts_on / ends_on, test_results.test_date,
 *  wellness_entries.entry_date — is ALREADY a calendar date with no timezone
 *  in it. Compare `from`/`to` to it as plain YYYY-MM-DD strings and do NOT
 *  push it through `dateInTz`, which would shift it by a day near midnight
 *  (schedule.ts:843-847, the header on `fetchCurrentSeason`, states this on
 *  the season lookup itself).
 *
 * SEASON BOUNDS come from `fetchCurrentSeason` (schedule.ts:848) or
 * `fetchCurrentSeasonWindow` (queries/analytics.ts:391). Both filter
 * `deleted_at`, which matters: the `seasons_one_current` unique index is
 * PARTIAL (`where is_current and deleted_at is null`), so a soft-deleted
 * season that was current when it was deleted can legally coexist with the
 * live one and an unfiltered `maybeSingle()` throws on two rows. Do NOT use
 * `fetchCurrentSeasonId`, which has that gap documented as a latent bug.
 */

/* ------------------------------------------------------------------ *
 * The URL param
 * ------------------------------------------------------------------ */

/** The canonical query key, per docs/20-route-map.md §6.2. Everything new
 *  writes `?period=`. */
export const PERIOD_PARAM = 'period';

/** Legacy keys still live in the tree, in three mutually incompatible
 *  vocabularies. Named here so the compat helper below and the screens that
 *  migrate agree on exactly what is being replaced:
 *
 *   - `?range=` on /analytics — the SAME six keys as RangeKey. A pure rename.
 *   - `?range=` on /reports/training — `day|week` only, and it does not mean
 *     "the reporting window", it means WHICH VIEW (one session or the week
 *     around it). A different concept wearing the same param name; migrating
 *     it is a rename of the OTHER control, not a period migration.
 *   - `?range=all` on /settings/audit — a third meaning again ("lift the
 *     default 90-day bound"), boolean-shaped, not a key.
 *   - `?days=<number>` on /reports/compliance, /reports/injuries and
 *     /reports/athlete/[athleteId] — a raw integer from a per-screen
 *     allow-list, duplicated across NINE files: each report's page.tsx,
 *     export/route.ts and pdf/route.tsx all carry their own copy of the same
 *     numbers and their own `.includes(...) ? ... : <default>` line. Grep for
 *     the numbers, not for `PERIODS`: compliance/export/route.ts:24 and
 *     injuries/export/route.ts:26 inline the array literal
 *     (`[7, 14, 28].includes(...)`) instead of naming a constant, so a search
 *     for `PERIODS` finds only seven of the nine and a migration that trusts
 *     it leaves two exports reading the old param.
 *
 *  Only the first and last are period vocabularies. `readPeriodParam` handles
 *  both; the training and audit meanings are deliberately NOT auto-converted,
 *  because silently reinterpreting `?range=week` on the training report as a
 *  seven-day window would change what that screen shows. */
export const LEGACY_PERIOD_PARAMS = ['range', 'days'] as const;

/** The nominal inclusive length of a fixed-length key, or null for the two
 *  open-ended keys whose length only the database can decide. Deliberately
 *  the same numbers `resolveRange` uses, read from the same place, so a fixed
 *  window and its day count can never drift. */
export function nominalDays(key: RangeKey): number | null {
  switch (key) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return ACWR_CHRONIC_WINDOW_DAYS;
    case 'year':
      return 365;
    default:
      // season and all: anchored on a database date, not a fixed length.
      return null;
  }
}

/** Where a resolved period key actually came from. Screens use this to say so
 *  — a period inherited from the cookie is not the same fact as one the coach
 *  just picked, and a snapped legacy bookmark is neither. */
export type PeriodSource = 'period' | 'legacy-range' | 'legacy-days' | 'default';

export type PeriodResolution = {
  key: RangeKey;
  source: PeriodSource;
  /** The raw `?days=` integer that produced `key`, when that is what happened.
   *  Kept rather than discarded because a screen that still has its own
   *  `PERIODS` array can keep honouring the exact number the bookmark asked
   *  for instead of the widened key. Null otherwise. */
  legacyDays: number | null;
  /** True when `key` is an APPROXIMATION of `legacyDays` rather than an exact
   *  translation — `?days=90` has no RangeKey, so it becomes the nearest one.
   *  A screen that renders an approximated period should say it approximated;
   *  quietly showing 365 days to someone who bookmarked 90 is the silent
   *  substitution this whole helper exists to prevent. */
  approximated: boolean;
};

/**
 * Read a period out of a screen's search params, canonical key first, legacy
 * keys second.
 *
 * THE CONTRACT, in order:
 *
 *  1. `?period=<RangeKey>` present and valid  → that key, source 'period'.
 *  2. `?period=` present but EMPTY or invalid → DEFAULT_RANGE, source
 *     'default'. Present-and-empty is "the user explicitly cleared it" and
 *     must NOT fall through to a legacy param or to the cookie. This is the
 *     same present/absent distinction resolveGroupFilter draws
 *     (groupFilter.server.ts:31-34) and it is the whole reason that function
 *     tests `!== undefined` rather than truthiness.
 *  3. `?range=<RangeKey>` (the /analytics vocabulary) → that key, source
 *     'legacy-range'. Only the six real keys convert; `?range=week` arriving
 *     from the TRAINING report's different `day|week` control is
 *     indistinguishable from the analytics one at this level, which is
 *     precisely why the training report must not adopt this helper for that
 *     control (see LEGACY_PERIOD_PARAMS).
 *  4. `?days=<number>` → the exact key when the number is one of the nominal
 *     lengths (1, 7, 28, 365), otherwise the NEAREST-NOT-NARROWER key with
 *     `approximated: true`. Never narrower: showing a coach less than the
 *     bookmark asked for hides data, showing more shows data they can see is
 *     extra.
 *  5. Nothing at all → DEFAULT_RANGE, source 'default'. On a server component
 *     this is the point where `resolvePeriod` in lib/period.server.ts
 *     substitutes the sticky cookie instead; this pure function has no
 *     opinion about cookies and deliberately cannot read one.
 *
 * `params` is the Next `searchParams` shape (a value may legally be an array
 * when the key repeats). An array takes its first entry, matching how every
 * other param on these screens is read.
 */
export function readPeriodParam(params: {
  period?: string | string[];
  range?: string | string[];
  days?: string | string[];
}): PeriodResolution {
  const period = firstValue(params.period);
  if (period !== undefined) {
    // Present, in any form, wins outright. Invalid or empty resolves to the
    // default rather than throwing — a URL is user input and a stale bookmark
    // must render a screen, not a 500 (same rule as resolveMetric).
    return { key: isRangeKey(period) ? period : DEFAULT_RANGE, source: isRangeKey(period) ? 'period' : 'default', legacyDays: null, approximated: false };
  }

  const range = firstValue(params.range);
  if (range !== undefined && isRangeKey(range)) {
    return { key: range, source: 'legacy-range', legacyDays: null, approximated: false };
  }

  const daysRaw = firstValue(params.days);
  if (daysRaw !== undefined && daysRaw !== '') {
    const days = Number(daysRaw);
    if (Number.isInteger(days) && days > 0) {
      const match = periodFromLegacyDays(days);
      return { key: match.key, source: 'legacy-days', legacyDays: days, approximated: !match.exact };
    }
  }

  return { key: DEFAULT_RANGE, source: 'default', legacyDays: null, approximated: false };
}

/** `?days=<n>` → the key that means it, or the nearest not-narrower key.
 *
 *  The real values in the tree are 7, 14, 28 (compliance), 28, 90, 180, 365
 *  (injuries) and 28, 90 (athlete report). Four of those seven have no exact
 *  key, which is why this reports `exact` rather than pretending. Anything
 *  past a year becomes `all`: a bookmark asking for more days than the
 *  longest fixed window is asking for everything, and `all` is capped at
 *  MAX_WINDOW_DAYS anyway. */
export function periodFromLegacyDays(days: number): { key: RangeKey; exact: boolean } {
  const fixed: readonly RangeKey[] = ['day', 'week', 'month', 'year'];
  for (const key of fixed) {
    const n = nominalDays(key)!;
    if (days === n) return { key, exact: true };
    if (days < n) return { key, exact: false };
  }
  return { key: 'all', exact: false };
}

/**
 * The other direction, and the one that matters most right now: a period key
 * → the `?days=` integer a NOT-YET-MIGRATED handler should use.
 *
 * WHY THIS EXISTS. `?days=` is duplicated across three files per report —
 * page.tsx, export/route.ts and pdf/route.tsx each carry their own `PERIODS`
 * array and their own `PERIODS.includes(...) ? ... : <default>` line. The
 * moment a screen's control starts writing `?period=season`, every one of
 * those handlers meets a value it does not recognise and falls back to its
 * default — so the coach clicks "This season", gets a PDF, and the PDF
 * silently covers 7 days. That is the failure this function exists to stop:
 * the export is wrong and says nothing.
 *
 * The contract:
 *
 *  - Returns null for `season` and `all`. There is no honest fixed day count
 *    for either; their length comes from a database row. A handler that gets
 *    null must resolve the real window via `resolveRange` (with the season
 *    start / earliest date) or state on the document that it covers a fixed
 *    window instead. It must NOT quietly substitute its default.
 *  - Otherwise returns the offered value closest to the key's nominal length,
 *    with `exact` false when it had to snap. `offered` is the handler's own
 *    existing `PERIODS` array, passed in rather than assumed, because the
 *    three reports offer three different sets and none of them is wrong.
 *  - Ties break WIDER (28 is nearer to 28 than to 7; 17 between 7 and 28
 *    would take 28), for the same reason as periodFromLegacyDays: over-
 *    showing is visible, under-showing is invisible.
 */
export function periodToOfferedDays(
  key: RangeKey,
  offered: readonly number[],
): { days: number; exact: boolean } | null {
  const target = nominalDays(key);
  if (target === null) return null;
  // Reading offered[0] and testing it, rather than testing offered.length:
  // under noUncheckedIndexedAccess an index read is `number | undefined`
  // however the length was checked, so the guard has to be on the value.
  const first = offered[0];
  if (first === undefined) return null;
  let best = first;
  for (const candidate of offered) {
    const d = Math.abs(candidate - target);
    const bestD = Math.abs(best - target);
    if (d < bestD || (d === bestD && candidate > best)) best = candidate;
  }
  return { days: best, exact: best === target };
}

/**
 * Coerce a requested key to one this screen can actually honour, so the
 * control and the query never disagree.
 *
 * Two DIFFERENT causes of "you cannot have that", kept apart on purpose
 * because they are rendered differently (see PeriodSelector):
 *
 *  - NOT ALLOWED: the screen's own metric cannot express it — `day` for a
 *    rolling band, `all` for a ratio. The capability exists, it is illegal
 *    HERE. Rendered DISABLED with the reason.
 *  - NO SEASON ROW: the club has not set a current season up. The option does
 *    not exist for this organisation on any screen. Rendered ABSENT, matching
 *    what /analytics already does (analytics/page.tsx:230-231) — an option
 *    that silently means something else is worse than an option that is not
 *    there, and there is no reason a coach can act on from inside a period
 *    control.
 *
 * Both coerce to `fallback` (DEFAULT_RANGE unless the screen says otherwise),
 * and both must be coerced SERVER-SIDE as well as disabled in the control:
 * the control alone does not stop a hand-typed or bookmarked URL.
 */
export function clampPeriod(
  key: RangeKey,
  opts: { allowed?: readonly RangeKey[]; seasonAvailable: boolean; fallback?: RangeKey },
): { key: RangeKey; coercedFrom: RangeKey | null } {
  const fallback = opts.fallback ?? DEFAULT_RANGE;
  const legal =
    (key !== 'season' || opts.seasonAvailable) && (opts.allowed === undefined || opts.allowed.includes(key));
  if (legal) return { key, coercedFrom: null };
  return { key: fallback, coercedFrom: key };
}

/** Next's searchParams value can be a string, a repeated string[], or absent.
 *  First entry wins, matching every other param reader on these screens. An
 *  empty-string value is returned AS an empty string, not as undefined —
 *  present-and-empty is a meaningful state (see readPeriodParam step 2). */
function firstValue(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
