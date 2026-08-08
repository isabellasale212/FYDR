import { cookies } from 'next/headers';
import { parseGroupParam } from './groupFilter';

/* Server-only companion to groupFilter.ts. resolveGroupFilter() needs
 * next/headers's cookies(), which can only run in a Server Component,
 * Server Action or Route Handler — importing it into the existing shared
 * groupFilter.ts would break the build the moment GroupFilter.tsx
 * ('use client') imports that same file for parseGroupParam, the same
 * class of problem groupFilter.ts's own header already describes for a
 * different function. Kept as a separate file specifically so that never
 * happens: parseGroupParam stays framework-agnostic, this file never gets
 * anywhere near a client bundle.
 */

const GROUP_FILTER_COOKIE = 'fydr-group-filter';

/** docs/06-design-system.md §7.9: the group filter "persists across
 *  navigation and app restarts, via the global filter context backed by
 *  storage." The real implementation holds it in `?groups=` per page, a
 *  deliberate choice (see groupFilter.ts's header) so a filtered view is
 *  shareable and the filter is applied in the database query, not after —
 *  but that alone means clicking a sidebar link with no `?groups=` of its
 *  own silently drops back to "All squad", which is what this closes.
 *
 *  The URL wins whenever `?groups=` is present at all — including present
 *  and empty, which is indistinguishable from "the user just cleared the
 *  filter" and must stay that way, not fall back to a stale cookie. Only
 *  a genuinely absent param (the param key itself missing, not just
 *  empty) falls back to the cookie GroupFilter.tsx's own apply() keeps in
 *  sync with the last filter the user actually chose anywhere in the app. */
export async function resolveGroupFilter(value: string | string[] | undefined): Promise<string[]> {
  if (value !== undefined) return parseGroupParam(value);
  const store = await cookies();
  return parseGroupParam(store.get(GROUP_FILTER_COOKIE)?.value);
}

export { GROUP_FILTER_COOKIE };
