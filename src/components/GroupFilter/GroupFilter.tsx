'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { Group } from '@/lib/queries/groups';

type Props = {
  groups: readonly Group[];
  selected: readonly string[];
};

const GROUP_FILTER_COOKIE = 'fydr-group-filter';

/**
 * The group filter, held in the URL.
 *
 * CLAUDE.md §3: every screen that shows more than one athlete is filterable by
 * group. Holding it in `?groups=` rather than in a context means the selection
 * survives a refresh, can be sent to a colleague, and is readable by the server
 * component that runs the query, so the filter is applied in the database and
 * not after the rows have already been fetched.
 *
 * docs/06-design-system.md §7.9 additionally wants the choice to "persist
 * across navigation" even when the destination has no `?groups=` of its own —
 * a plain sidebar link, for instance. apply() below mirrors every change into
 * a `fydr-group-filter` cookie, which lib/groupFilter.server.ts's
 * resolveGroupFilter() reads as a fallback whenever a page's own URL doesn't
 * specify a filter at all. Clearing to "All squad" clears the cookie in the
 * same call — that's deliberate: this component deletes the `groups` param
 * entirely rather than setting it empty, so "no param in the URL" has to mean
 * the same thing whether the user never chose a filter or just cleared one,
 * and an empty cookie is what makes those two cases resolve identically.
 */
export function GroupFilter({ groups, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = useCallback(
    (next: string[]) => {
      const search = new URLSearchParams(params.toString());
      if (next.length === 0) {
        search.delete('groups');
        document.cookie = `${GROUP_FILTER_COOKIE}=; path=/; max-age=0`;
      } else {
        search.set('groups', next.join(','));
        // 180 days: a squad-filter preference, not a session-scoped value —
        // no reason to make a coach re-pick it every time they sign back in.
        document.cookie = `${GROUP_FILTER_COOKIE}=${encodeURIComponent(next.join(','))}; path=/; max-age=${60 * 60 * 24 * 180}`;
      }
      const query = search.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router],
  );

  const toggle = (id: string) => {
    apply(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="chiprow" role="group" aria-label="Filter by squad group">
      <button
        type="button"
        className="squad-chip"
        aria-pressed={selected.length === 0}
        onClick={() => apply([])}
      >
        All squads
      </button>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          className="squad-chip"
          aria-pressed={selected.includes(group.id)}
          onClick={() => toggle(group.id)}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}
