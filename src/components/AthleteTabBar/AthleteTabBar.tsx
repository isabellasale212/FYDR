'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* The athlete four-tab shell, ATHLETE-APP-SPEC.md §4 / CLAUDE.md §4.
 * Programme now has a real page — the gym/rehab session list from
 * my-programme.md — so it is back in the bar, same shell, no
 * restructuring, exactly as this comment used to say it would be. The
 * nutrition-guidance half of that screen still doesn't exist (its own
 * numbers landed on Today's "Fuelling today" card instead, a documented
 * simplification); Programme here is the gym and rehab session list only.
 * Tab order follows the spec's own: Today · My data · Programme · Me —
 * this file previously listed Programme second; reordered to match. */
const TABS = [
  { href: '/today', label: 'Today' },
  { href: '/my-data', label: 'My data' },
  { href: '/programme', label: 'Programme' },
  { href: '/me', label: 'Me' },
] as const;

export function AthleteTabBar() {
  const pathname = usePathname();

  return (
    <nav className="athlete-tabbar" aria-label="Main">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="athlete-tab"
            aria-current={active ? 'page' : undefined}
          >
            <span className="athlete-tab-glyph" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
