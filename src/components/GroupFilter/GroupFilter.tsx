'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { Group } from '@/lib/queries/groups';

type Props = {
  groups: readonly Group[];
  selected: readonly string[];
};

/**
 * The group filter, held in the URL.
 *
 * CLAUDE.md §3: every screen that shows more than one athlete is filterable by
 * group. Holding it in `?groups=` rather than in a context means the selection
 * survives a refresh, can be sent to a colleague, and is readable by the server
 * component that runs the query, so the filter is applied in the database and
 * not after the rows have already been fetched.
 */
export function GroupFilter({ groups, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = useCallback(
    (next: string[]) => {
      const search = new URLSearchParams(params.toString());
      if (next.length === 0) search.delete('groups');
      else search.set('groups', next.join(','));
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
