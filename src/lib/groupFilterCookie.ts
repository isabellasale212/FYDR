/* THE ONE PLACE THE GROUP-FILTER COOKIE IS WRITTEN — §0ak, decided by Isabella
 * 2026-09-11, built 2026-09-12.
 *
 * The rule: the group filter is shared across every multi-athlete screen, in
 * both directions. Every such screen reads and writes the same cookie
 * (`fydr-group-filter`); pressing a chip anywhere writes it and applies
 * everywhere. A `?groups=` URL parameter overrides only for that page load —
 * it exists for shared links — and never writes the cookie: the server
 * (lib/groupFilter.server.ts) only ever reads.
 *
 * What went wrong: GroupFilter (the chip row on /squad and fourteen other
 * screens) wrote the cookie and the URL; ReportHeader (the chips on the
 * reports and the schedule) wrote the URL only. So a filter chosen on Squad
 * overview reached the squad report — the report falls back to the cookie
 * when its URL is bare — but a filter chosen on the report was gone by the
 * time the sport scientist was back on Squad overview. Measured both ways by
 * the reviewer. Both chip rows now call writeGroupFilterCookie() below; the
 * assignment string is a pure function so a test can read it.
 *
 * No 'use client' directive: this file is a plain module. It touches
 * document.cookie only inside writeGroupFilterCookie(), which only a client
 * component calls; the constant and the pure builder are safe anywhere.
 */

export const GROUP_FILTER_COOKIE = 'fydr-group-filter';

/** 180 days: a squad-filter preference, not a session-scoped value — no reason
 *  to make a coach re-pick it every time they sign back in. */
export const GROUP_FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** The `document.cookie` assignment for a selection. Empty clears the cookie
 *  (max-age 0), which is what makes "no param in the URL" resolve the same
 *  whether the coach never chose a filter or just cleared one. */
export function groupFilterCookie(next: readonly string[]): string {
  if (next.length === 0) return `${GROUP_FILTER_COOKIE}=; path=/; max-age=0`;
  return `${GROUP_FILTER_COOKIE}=${encodeURIComponent(next.join(','))}; path=/; max-age=${GROUP_FILTER_COOKIE_MAX_AGE}`;
}

export function writeGroupFilterCookie(next: readonly string[]): void {
  document.cookie = groupFilterCookie(next);
}
