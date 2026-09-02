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

/** Spec §6's icon paths, verbatim: a 14-unit viewBox rendered at 23×23,
 *  fill none / stroke currentColor / stroke-width 1.4, except the dumbbell.
 *
 *  These replace hand-drawn 24-unit equivalents. The difference is not
 *  cosmetic in one case: the spec's clock hand runs 12→centre→4-o-clock as a
 *  single stroked path, and the bar chart is three separate subpaths in one
 *  `d` rather than three elements, so the round caps land identically. */
function TabIcon({ name }: { name: (typeof TABS)[number]['icon'] }) {
  const common = {
    viewBox: '0 0 14 14',
    width: 23,
    height: 23,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    'aria-hidden': true,
  };
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="5.4" />
        <path d="M7 4.2 L7 7 L9.2 8.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'bars') {
    return (
      <svg {...common}>
        <path d="M2.4 11 L2.4 7.6 M7 11 L7 3.6 M11.6 11 L11.6 5.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'dumbbell') {
    /* Spec §6: "the only coloured icon in the product — gold in both themes,
       inheriting nothing from the active state." Filled, not stroked, and the
       colour is the literal --gym, which is #f5c518 in both themes. */
    return (
      <svg viewBox="0 0 14 14" width={23} height={23} fill="var(--gym)" stroke="none" aria-hidden>
        <path
          d="M1 5.4 h1.7 v3.2 H1 Z M3.3 4.3 h1.9 v5.4 H3.3 Z M5.6 6.4 h2.8 v1.2 H5.6 Z
             M8.8 4.3 h1.9 v5.4 H8.8 Z M11.3 5.4 H13 v3.2 h-1.7 Z"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="7" cy="4.8" r="2.4" />
      <path d="M2.6 12 C3 9.4 4.8 8.4 7 8.4 C9.2 8.4 11 9.4 11.4 12" strokeLinecap="round" />
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
