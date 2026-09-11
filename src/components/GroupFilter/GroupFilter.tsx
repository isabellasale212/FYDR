'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { useState } from 'react';
import { groupScopeLabel } from '@/lib/groupFilter';
import { writeGroupFilterCookie } from '@/lib/groupFilterCookie';
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
 *
 * That very persistence is what the audit called silent and dangerous (S4):
 * a filter chosen days ago kept re-scoping every screen with nothing but chip
 * highlighting to show for it. So the component now states its own state
 * (coach finding 17):
 *
 * - Selected chips carry a ✓ glyph. The chips are multi-select (each click
 *   toggles one group in or out of a union) but were styled identically to
 *   the app's radio-like single-select chip rows; the checkmark is the
 *   checkbox affordance that says clicks accumulate.
 * - While the server round-trip that re-runs the page query is in flight
 *   (~seconds), the clicked selection is shown optimistically and the row
 *   dims — clicks used to give no feedback at all until the page re-rendered.
 * - Whenever any filter is active, a "Filtered to <names> — Clear filter"
 *   line renders under the chips: a plainly visible indicator plus a real
 *   clear affordance, on every screen this component is mounted on, which is
 *   every screen the filter can scope.
 */
export function GroupFilter({ groups, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<readonly string[] | null>(null);

  // While the navigation is pending, render the selection the user just
  // clicked; once the server responds, props are the truth again.
  const effective = isPending && optimistic !== null ? optimistic : selected;

  const apply = useCallback(
    (next: string[]) => {
      const search = new URLSearchParams(params.toString());
      if (next.length === 0) search.delete('groups');
      else search.set('groups', next.join(','));
      /* The cookie is the shared state (§0ak, 2026-09-11): pressing a chip
         here writes it and the choice applies on every multi-athlete screen.
         The URL is the transport for THIS page and for a link a colleague can
         open; ReportHeader's chips write the same cookie the same way. */
      writeGroupFilterCookie(next);
      const query = search.toString();
      setOptimistic(next);
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [params, pathname, router],
  );

  const toggle = (id: string) => {
    apply(
      effective.includes(id)
        ? effective.filter((s) => s !== id)
        : [...effective, id],
    );
  };

  return (
    <div aria-busy={isPending} style={isPending ? { opacity: 0.6 } : undefined}>
      <div className="chiprow" role="group" aria-label="Filter by squad group">
        <button
          type="button"
          className="squad-chip"
          aria-pressed={effective.length === 0}
          onClick={() => apply([])}
        >
          {effective.length === 0 ? <span aria-hidden="true">✓ </span> : null}
          Whole squad
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className="squad-chip"
            aria-pressed={effective.includes(group.id)}
            onClick={() => toggle(group.id)}
          >
            {effective.includes(group.id) ? <span aria-hidden="true">✓ </span> : null}
            {group.name}
          </button>
        ))}
      </div>
      {effective.length > 0 ? (
        <p className="cap" role="status">
          Filtered to <b>{groupScopeLabel(groups, effective)}</b> — this filter follows you
          to every screen, report and export until cleared.{' '}
          <button type="button" className="linklike" onClick={() => apply([])}>
            Clear filter
          </button>
        </p>
      ) : null}
    </div>
  );
}
