import { cookies } from 'next/headers';
import { DEFAULT_RANGE, isRangeKey, readPeriodParam, type PeriodResolution, type PeriodSource } from './period';

/* Server-only companion to period.ts, split for exactly the reason
 * groupFilter.server.ts is split from groupFilter.ts (see that file's header):
 * resolvePeriod() needs next/headers's cookies(), which only runs in a Server
 * Component, Server Action or Route Handler. Putting it in period.ts would
 * break the build the moment PeriodSelector.tsx ('use client') imports that
 * same file for RangeKey and RANGE_OPTIONS — which it does. Kept separate so
 * period.ts stays framework-agnostic and never gets near a client bundle.
 */

/** Mirrors GROUP_FILTER_COOKIE. Same prefix, same 180-day lifetime, written
 *  by PeriodSelector.tsx on the client and read only here. */
const PERIOD_COOKIE = 'fydr-period';

/** 180 days: a reporting-window preference, not a session-scoped value —
 *  no reason to make a coach re-pick it every time they sign back in. Same
 *  number GroupFilter.tsx uses, exported so the two cannot drift. */
export const PERIOD_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/**
 * Resolve the period for a screen: URL first, sticky cookie second, default
 * last.
 *
 * docs/02-information-architecture.md §"Date / period selector": "Like the
 * group filter, the selection persists across navigation." Holding it in
 * `?period=` per page is the deliberate choice (a filtered view is a link a
 * coach can paste, and the window is applied in the database query, not
 * after) — but that alone means clicking a sidebar link with no `?period=` of
 * its own silently drops back to 28 days, which is what this closes.
 *
 * THE PRESENT/ABSENT DISTINCTION IS THE WHOLE POINT, and it is copied from
 * resolveGroupFilter (groupFilter.server.ts:31-34) rather than reinvented:
 *
 *   The URL wins whenever `?period=` is present AT ALL — including present
 *   and empty. Present-and-empty is indistinguishable from "the user just
 *   cleared it" and must stay that way, resolving to DEFAULT_RANGE rather
 *   than reviving a stale cookie. Only a GENUINELY ABSENT param (the key
 *   itself missing, not merely empty) falls back to the cookie.
 *
 * A legacy `?range=`/`?days=` on the URL also counts as present and also
 * beats the cookie: a bookmark is a deliberate statement about the window,
 * and a period chosen on some other screen ten minutes ago is not.
 *
 * The cookie value is validated, not trusted: a cookie is client-writable and
 * an unrecognised one resolves to the default rather than throwing. Nothing
 * security-relevant rides on it — it selects a window, never a scope; the
 * org and group scoping are resolved separately and server-side.
 */
/** Everything readPeriodParam reports, plus the one origin only the server can
 *  produce. Written as an Omit-and-widen rather than an intersection because
 *  `A & { source: X | 'cookie' }` collapses back to A's narrower `source` and
 *  would silently make 'cookie' unassignable. */
export type ResolvedPeriod = Omit<PeriodResolution, 'source'> & { source: PeriodSource | 'cookie' };

export async function resolvePeriod(params: {
  period?: string | string[];
  range?: string | string[];
  days?: string | string[];
}): Promise<ResolvedPeriod> {
  const fromUrl = readPeriodParam(params);
  // `source: 'default'` from readPeriodParam means one of two things: nothing
  // was on the URL, or something was and it was junk. Only the first should
  // reach the cookie, so the absence test is made here against the raw params
  // rather than inferred from the resolution.
  const urlSaidSomething =
    params.period !== undefined || params.range !== undefined || params.days !== undefined;
  if (urlSaidSomething) return fromUrl;

  const store = await cookies();
  const sticky = store.get(PERIOD_COOKIE)?.value;
  if (isRangeKey(sticky)) {
    return { key: sticky, source: 'cookie', legacyDays: null, approximated: false };
  }
  return { key: DEFAULT_RANGE, source: 'default', legacyDays: null, approximated: false };
}

export { PERIOD_COOKIE };
