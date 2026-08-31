'use client';

import { useEffect, useRef } from 'react';
import { ReportSelectNav, type ReportSelectOption } from '@/components/ReportSelectNav/ReportSelectNav';
import { PERIOD_PARAM, RANGE_OPTIONS, type RangeKey } from '@/lib/period';

/**
 * The period control. docs/06-design-system.md §7.10, docs/02-information-
 * architecture.md §"Date / period selector", and the client's own instruction:
 * *"i want to be able to adjust the period of any data from the day to the
 * week to the season to the year to all"*.
 *
 * IT IS A WRAPPER, NOT A NEW CONTROL. Every visible behaviour comes from
 * ReportSelectNav, and that is the point. ReportSelectNav already does the one
 * genuinely hard thing correctly: it rebuilds the next href from the LIVE
 * `useSearchParams()` (ReportSelectNav.tsx:51-56), so every other param on the
 * URL survives the change — the group filter, the selected athlete, the mode,
 * the tab, whatever a future screen adds.
 *
 * Three of the hand-rolled period chip rows in this app do not do that, and
 * one of them is an outright bug: `/reports/athlete/[athleteId]` builds
 * `href={`/reports/athlete/${athleteId}?days=${d}`}` (page.tsx:120), which
 * drops `?groups=` entirely. A coach who has filtered to Forwards and then
 * changes the period silently loses the filter — a direct violation of
 * CLAUDE.md §3, caused by nothing more than hand-building an href from a fixed
 * list of known keys. Wrapping ReportSelectNav makes that class of bug
 * impossible for every screen that adopts this.
 *
 * §7.10 as written specifies chips (`.squad-chip` in a row) and a `Period`
 * discriminated union with `today | thisWeek | last7 | last28 | season |
 * custom`. Neither survived contact with the real code and the doc has been
 * corrected rather than followed:
 *  - the union predates the client's six keys, is missing `year` and `all`
 *    (both explicitly asked for), and carries `custom`, which nothing in the
 *    app implements;
 *  - the built control is a `<select>`, because that is what ReportSelectNav
 *    is and because a native option list is the only thing on this stack that
 *    can render a DISABLED option with its reason (see below). Chips would
 *    mean a second control to keep in sync with the first.
 *
 * ---------------------------------------------------------------------------
 * DISABLED VS ABSENT — two different facts, rendered differently
 * ---------------------------------------------------------------------------
 *
 * NOT ALLOWED ON THIS SCREEN → DISABLED, WITH THE REASON. This codebase's own
 * established rule (docs/screens/analytics.md: "Illegal combinations are
 * disabled with the reason, not hidden"), and ReportSelectNav grew its
 * `disabled?: boolean` for exactly this. `day` is meaningless for a metric
 * with a rolling band, `all` is meaningless for a ratio — see lib/period.ts's
 * header — but the capability plainly exists elsewhere in the app, so hiding
 * it makes the control a different length on every screen and gives the coach
 * nothing to reason about.
 *
 * NO CURRENT SEASON ROW → ABSENT. Different fact: the option does not exist
 * for this organisation anywhere, and there is nothing a coach can act on from
 * inside a period control. /analytics already resolves it this way
 * (analytics/page.tsx:230-231) and this matches it exactly.
 *
 * A native `<option>` has nowhere to put a reason except its own text, so a
 * disabled option renders as "Today — one day is one point, not a trend". That
 * is deliberate: an unexplained greyed-out option is worse than a long label.
 */

export type PeriodSelectorProps = {
  /** The key the page ACTUALLY resolved and queried, after clampPeriod() —
   *  not the raw URL value. The control must show what rendered, and a
   *  `<select>` whose value matches no option silently displays the first one
   *  instead. */
  value: RangeKey;

  /** The keys this screen's data can honestly express. Omitted means all six.
   *  Anything outside it renders disabled, never hidden. */
  allowed?: readonly RangeKey[];

  /** Why each disallowed key is disallowed, appended to its label. A key that
   *  is disallowed with no reason still renders disabled, but write one: the
   *  reason is the entire difference between a considered control and a
   *  broken-looking one. */
  reasons?: Partial<Record<RangeKey, string>>;

  /** The org's current season, from fetchCurrentSeason (queries/schedule.ts)
   *  or fetchCurrentSeasonWindow (queries/analytics.ts) — both filter
   *  `deleted_at`, which the partial `seasons_one_current` index makes
   *  mandatory. Null hides "This season" entirely.
   *
   *  REQUIRED, with no default, on purpose. Defaulting to "there is a season"
   *  would offer clubs an option that resolves against a season start of null;
   *  defaulting to "there is not" would silently delete one of the six periods
   *  the client asked for from any screen whose author forgot the prop.
   *  Neither is a failure worth having, so every caller states it. */
  season: { name: string } | null;

  /** Defaults to 'Period'. */
  label?: string;

  /** Defaults to PERIOD_PARAM ('period') — the canonical key per
   *  docs/20-route-map.md §6.2. Overridable ONLY so a screen mid-migration can
   *  keep writing its legacy key while its export and PDF handlers still read
   *  it; new screens must not pass this. */
  paramKey?: string;

  /** Whether this render should write the sticky `fydr-period` cookie.
   *  Defaults to TRUE — stickiness is the norm and no existing caller changes.
   *
   *  Pass FALSE for the one case it is wrong: a screen rendering its OWN
   *  DEFAULT rather than something the coach chose. The cookie is account-wide,
   *  so a screen-specific default that stickies silently re-scopes every other
   *  screen to a window the coach never picked and cannot see the origin of —
   *  they open a player profile once and carry `season` to Analytics. That is
   *  surprising in a way the user can neither see nor undo.
   *
   *  The distinction is CHOICE, not value: pass true whenever the value came
   *  from `?period=`, from the cookie itself, or from a click, and false in the
   *  two cases where the rendered key is not the reader's own —
   *
   *   1. the screen is showing a DEFAULT of its own invention, and
   *   2. the reader's real choice was ILLEGAL HERE and got clamped to this
   *      screen's fallback.
   *
   *  Both write a window nobody picked into a cookie every other screen reads,
   *  and (2) is the more destructive: /dashboard allows `day` and `week` alone
   *  and homeRoute() lands every coach there at sign-in, so stickying its clamp
   *  meant a coach's "This season" became `day` — a key no report accepts —
   *  on a visit where they touched nothing. lib/reportPeriod.server.ts's
   *  `periodSticky()` is this test, written once; /dashboard and
   *  /squad/[athleteId] spell it out inline because they clamp directly.
   *
   *  An explicit, legal choice must still stick everywhere — that is the
   *  behaviour the period model was asked for and this does not weaken it.
   *
   *  /squad/[athleteId] is the first caller: its default is `season` (body mass
   *  is a slow signal) where DEFAULT_RANGE is `month`, so without this it would
   *  seed the shared cookie for every first-time visitor. */
  sticky?: boolean;

  ariaLabel?: string;
};

/** Mirrors GROUP_FILTER_COOKIE / lib/period.server.ts. Duplicated as a literal
 *  for the same reason GroupFilter.tsx duplicates its own: importing
 *  period.server.ts here would pull next/headers into the client bundle. */
const PERIOD_COOKIE = 'fydr-period';
const PERIOD_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function PeriodSelector({
  value,
  allowed,
  reasons,
  season,
  label = 'Period',
  paramKey = PERIOD_PARAM,
  sticky = true,
  ariaLabel,
}: PeriodSelectorProps) {
  /* Stickiness, mirroring GroupFilter.tsx's cookie so a period chosen on one
   * screen survives navigation to another (02-information-architecture.md:
   * "Like the group filter, the selection persists across navigation").
   *
   * Written from an effect on the RESOLVED value rather than from an onChange
   * handler, which is the more truthful of the two and the reason this
   * component does not touch ReportSelectNav at all:
   *  - what gets stored is what the page actually rendered, so the cookie can
   *    never hold a key the screen did not really show.
   *  - it also catches a hand-typed or bookmarked URL, which an onChange never
   *    sees.
   *
   * Note this is about which VALUE to store once you are storing one. Whether
   * to store at all is `sticky`'s question, and a CLAMPED value answers it with
   * no: see that prop's doc.
   * Guarded against rewriting the same value on every render; a cookie write
   * is cheap but a pointless one on every navigation is still noise.
   *
   * `sticky === false` suppresses the write entirely — see the prop's own doc.
   * The reasoning above ("store what actually rendered") is about which VALUE
   * to store once you are storing one; it was never an argument for storing a
   * window the coach did not choose. A screen showing its own default opts out
   * and leaves any existing cookie untouched, so the next screen still honours
   * whatever the coach last really picked rather than this screen's opinion. */
  const lastWritten = useRef<RangeKey | null>(null);
  useEffect(() => {
    if (!sticky) return;
    if (lastWritten.current === value) return;
    lastWritten.current = value;
    document.cookie = `${PERIOD_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${PERIOD_COOKIE_MAX_AGE}`;
  }, [value, sticky]);

  const options: ReportSelectOption[] = [];
  for (const option of RANGE_OPTIONS) {
    const isSeason = option.key === 'season';

    // ABSENT: no season row. The one case where an option is removed rather
    // than disabled — but never remove the value that actually rendered, or
    // the select would display something other than the truth.
    if (isSeason && season === null && value !== 'season') continue;

    const notAllowed = allowed !== undefined && !allowed.includes(option.key);
    const reason = notAllowed ? reasons?.[option.key] : undefined;

    // Naming the season makes "This season" checkable against the club's own
    // calendar — same label /analytics already builds (page.tsx:234).
    const base = isSeason && season ? `${option.label} · ${season.name}` : option.label;

    options.push({
      value: option.key,
      label: reason ? `${base} — ${reason}` : base,
      disabled: notAllowed,
    });
  }

  /* Deliberately NO `clearValue`. GroupFilter deletes its param for "Whole
   * squad" because absent and "no filter" mean the same thing there. Here they
   * do not: an absent `?period=` means "inherit the sticky cookie"
   * (period.server.ts), so clearing the param on DEFAULT_RANGE would hand the
   * window back to whatever the coach last picked elsewhere the instant they
   * chose 28 days. Every selection writes the key explicitly. */
  return (
    <ReportSelectNav
      label={label}
      paramKey={paramKey}
      value={value}
      options={options}
      ariaLabel={ariaLabel ?? label}
    />
  );
}
