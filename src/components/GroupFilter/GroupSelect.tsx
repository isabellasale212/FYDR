'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { groupScopeLabel } from '@/lib/groupFilter';
import { writeGroupFilterCookie } from '@/lib/groupFilterCookie';

/* THE GROUP FILTER AS A DROPDOWN, everywhere (Isabella, 16 September 2026,
 * the overnight queue, 3.5: "the group filter becomes a dropdown in the top
 * right, replacing the row of buttons — the same change as the mobile one").
 * One native select: Whole squad, every live group, and — when the cookie or
 * the address holds more than one group, chosen with the chips before this
 * — that union as its own option, so the control never says "Whole squad"
 * over a filtered page. It writes the same cookie the chips wrote (§0ak,
 * lib/groupFilterCookie.ts) and pushes the same ?groups=, every other param
 * kept, so the page re-runs its query the same way. The phone title bar's
 * dropdown (StaffPhoneShell) is this control's twin. */
type Props = {
  groups: readonly { id: string; name: string }[];
  selected: readonly string[];
  ariaLabel?: string;
};

export function GroupSelect({ groups, selected, ariaLabel = 'Filter by squad group' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const current = selected.length === 0 ? '' : selected.join(',');
  const value = isPending && optimistic !== null ? optimistic : current;
  const multi = value.includes(',') ? value : null;

  const apply = (next: string) => {
    const ids = next ? next.split(',') : [];
    const search = new URLSearchParams(params.toString());
    if (ids.length === 0) search.delete('groups');
    else search.set('groups', ids.join(','));
    writeGroupFilterCookie(ids);
    const query = search.toString();
    setOptimistic(next);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <label className="rsel group-select" aria-busy={isPending} style={isPending ? { opacity: 0.6 } : undefined}>
      <span className="rsel-label">Group</span>
      <span className="rsel-wrap">
        <select value={value} onChange={(e) => apply(e.target.value)} aria-label={ariaLabel}>
          <option value="">Whole squad</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          {multi ? <option value={multi}>{groupScopeLabel(groups, multi.split(','))}</option> : null}
        </select>
        <span className="rsel-chev" aria-hidden="true">
          &#9660;
        </span>
      </span>
    </label>
  );
}
