'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* The athlete four-tab shell, ATHLETE-APP-SPEC.md §4 / CLAUDE.md §4.
 * Programme now has a real page — the gym/rehab session list from
 * my-programme.md — so it is back in the bar, same shell, no
 * restructuring, exactly as this comment used to say it would be. The
 * nutrition-guidance half of that screen still doesn't exist (its own
 * numbers landed on Today's "Fuelling today" card instead, a documented
 * simplification).
 *
 * Labelled "Gym", not "Programme", per Fydr Athlete App.dc.html — and it is
 * the better word for what the tab opens: a list of gym and rehab sessions.
 * The route stays /programme; renaming a URL would break every link an
 * athlete has already been sent.
 *
 * Each tab draws a real icon rather than the rounded square that stood in for
 * one. Gym's dumbbell keeps its domain colour (--gym) in every state, active
 * or not, which is what the design does: the other three are navigation, that
 * one is a place with a colour of its own everywhere else in the product. */
const TABS = [
  { href: '/today', label: 'Today', icon: 'clock' },
  { href: '/my-data', label: 'My data', icon: 'bars' },
  { href: '/programme', label: 'Gym', icon: 'dumbbell' },
  { href: '/me', label: 'Me', icon: 'person' },
] as const;

function TabIcon({ name }: { name: (typeof TABS)[number]['icon'] }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  if (name === 'bars') {
    return (
      <svg {...common}>
        <path d="M6 15v4M12 5v14M18 11v8" />
      </svg>
    );
  }
  if (name === 'dumbbell') {
    return (
      <svg {...common}>
        <path d="M4 9v6M7.5 7v10M16.5 7v10M20 9v6M7.5 12h9" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

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
            data-domain={tab.icon === 'dumbbell' ? 'gym' : undefined}
            aria-current={active ? 'page' : undefined}
          >
            <span className="athlete-tab-glyph" aria-hidden="true">
              <TabIcon name={tab.icon} />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
