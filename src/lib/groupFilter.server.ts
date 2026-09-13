import { cookies } from 'next/headers';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { dropUnresolvable, parseGroupParam } from './groupFilter';
import { GROUP_FILTER_COOKIE } from './groupFilterCookie';

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
/* PATTERN-S8 D9 + §0ak (2026-09-13, Isabella's ruling): an unresolvable
 * group id clears out of the filter rather than scoping the screen. Archiving
 * a group sets groups.deleted_at only — its memberships stay live — so a
 * cookie or a shared link that still named an archived group kept scoping
 * every multi-athlete screen to that group's athletes while the chip row
 * (which lists live groups) could not show it, and the scope line read
 * "1 unknown group". Every denominator on every report was then wrong by a
 * filter nobody could see.
 *
 * The live group ids are read once per request (React cache; RLS scopes the
 * read to the caller's org) and every requested id is checked against them,
 * URL and cookie alike. The staff layout does the rest for the cookie case:
 * it rewrites the cookie without the dropped ids through the one writer
 * (StaleGroupFilter, client) and says so once. resolveGroupFilter keeps its
 * signature, so all thirty-nine callers get the rule without a change and
 * none can miss it. */
const liveGroupIds = cache(async (): Promise<Set<string> | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('groups')
    .select('id')
    .is('deleted_at', null);
  if (error) return null;
  return new Set((data ?? []).map((g) => g.id));
});

export type ResolvedGroupFilter = {
  /** The scope: the requested ids that are live groups. */
  groupIds: string[];
  /** Requested ids that are not live groups — archived, or never this org's. */
  dropped: string[];
  /** Whether the request came from the sticky cookie (no ?groups= on the URL). */
  fromCookie: boolean;
};

export async function resolveGroupFilterDetailed(value: string | string[] | undefined): Promise<ResolvedGroupFilter> {
  const fromCookie = value === undefined;
  const requested = fromCookie ? parseGroupParam((await cookies()).get(GROUP_FILTER_COOKIE)?.value) : parseGroupParam(value);
  if (requested.length === 0) return { groupIds: [], dropped: [], fromCookie };
  const live = await liveGroupIds();
  const { groupIds, dropped } = dropUnresolvable(requested, live);
  return { groupIds, dropped, fromCookie };
}

export async function resolveGroupFilter(value: string | string[] | undefined): Promise<string[]> {
  return (await resolveGroupFilterDetailed(value)).groupIds;
}

export { GROUP_FILTER_COOKIE };
