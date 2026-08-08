'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/types/database';

/* The sidebar rows, from 20-route-map.md §3 plus Testing, added the same way
 * Gym programme and Leaderboard were: a top-level destination this build's
 * route map nests differently (under /schedule/testing, a session-scheduling
 * model this pass cuts — see lib/queries/testing.ts's header) but which
 * every other major feature this session has made a direct sidebar entry.
 * Flat, nothing indented, one top-level segment each. Roles here hide a row;
 * they never grant access, which is RLS plus the middleware. A user holding
 * only admin sees four rows, and that is the deliberate friction in
 * 01-roles-and-permissions.md §1. */

type Row = {
  id: string;
  label: string;
  route: string;
  roles: readonly AppRole[];
  icon: React.ReactNode;
};

const icon = (paths: React.ReactNode) => (
  <svg
    className="ic"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    aria-hidden="true"
  >
    {paths}
  </svg>
);

const SIGN_OUT_ICON = icon(
  <>
    <path d="M6.6 1.8H3.4a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h3.2" />
    <path d="M10.8 11.2 14.2 8l-3.4-3.2M14.2 8H5.8" />
  </>,
);

export const SIDEBAR: readonly Row[] = [
  {
    id: 'staff.dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    roles: ['coach', 'medical'],
    icon: icon(
      <>
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
      </>,
    ),
  },
  {
    id: 'staff.flags',
    label: 'Flags',
    route: '/flags',
    roles: ['coach', 'medical'],
    icon: icon(
      <>
        <path d="M3.6 1.8v12.4M3.6 2.4h8l-1.6 3 1.6 3h-8" />
      </>,
    ),
  },
  {
    id: 'staff.squad',
    label: 'Squad overview',
    route: '/squad',
    roles: ['coach', 'medical'],
    icon: icon(
      <>
        <circle cx="8" cy="5" r="2.6" />
        <path d="M2.6 14c0-3 2.4-4.6 5.4-4.6S13.4 11 13.4 14" />
      </>,
    ),
  },
  {
    id: 'staff.groups',
    label: 'Groups',
    route: '/settings/groups',
    // 01-roles-and-permissions.md §2, "Manage groups": Y for coach, medical
    // and admin. Its own row, not nested under Squad overview, because admin
    // cannot reach that screen at all but does manage squad structure
    // (screens/groups.md, roles table).
    roles: ['coach', 'medical', 'admin'],
    icon: icon(
      <>
        <circle cx="5.4" cy="5.4" r="2.2" />
        <circle cx="11.2" cy="5.4" r="2.2" />
        <path d="M1.8 14c0-2.6 1.9-4 3.6-4s3.6 1.4 3.6 4M8.6 10.3c1.5.2 2.6 1.5 2.6 3.7" />
      </>,
    ),
  },
  {
    id: 'staff.schedule',
    label: 'Schedule',
    route: '/schedule',
    roles: ['coach', 'medical'],
    icon: icon(
      <>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 4.4V8l2.4 1.6" />
      </>,
    ),
  },
  {
    id: 'staff.reports',
    label: 'Reports',
    route: '/reports',
    roles: ['coach', 'medical', 'admin'],
    icon: icon(
      <>
        <path d="M3.5 1.8h6l3 3v9.4h-9z" />
        <path d="M6 8h4M6 10.6h4" />
      </>,
    ),
  },
  {
    id: 'staff.nutrition',
    label: 'Nutrition',
    route: '/nutrition',
    roles: ['coach', 'medical'],
    icon: icon(<path d="M8 1.8 14.2 8 8 14.2 1.8 8z" />),
  },
  {
    id: 'staff.programmes',
    label: 'Gym programme',
    route: '/programmes',
    roles: ['coach', 'medical'],
    icon: icon(<path d="M9.2 1.8 3.4 9.2h3.6l-1 5 5.8-7.4H8.2z" />),
  },
  {
    id: 'staff.leaderboards',
    label: 'Leaderboard',
    route: '/leaderboards',
    roles: ['coach', 'medical', 'admin'],
    icon: icon(
      <>
        <path d="M2.4 13.6V8M6.8 13.6V4.4M11.2 13.6V6.6" />
        <path d="M1.4 13.6h13.2" />
      </>,
    ),
  },
  {
    id: 'staff.analytics',
    label: 'Analytics',
    route: '/analytics',
    roles: ['coach', 'medical'],
    icon: icon(
      <>
        <rect x="1.6" y="2.4" width="12.8" height="11.2" rx="1.4" />
        <path d="M1.6 6h12.8M6 6v7.6" />
      </>,
    ),
  },
  {
    id: 'staff.testing',
    label: 'Testing',
    route: '/testing',
    roles: ['coach', 'medical'],
    icon: icon(
      <>
        <circle cx="8" cy="8" r="6.2" />
        <circle cx="8" cy="8" r="2.4" />
      </>,
    ),
  },
  {
    id: 'staff.settings',
    label: 'Settings',
    route: '/settings',
    roles: ['coach', 'medical', 'admin'],
    icon: icon(
      <>
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.6v1.8M8 12.6v1.8M14.4 8h-1.8M3.4 8H1.6M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3M12.5 12.5l-1.3-1.3M4.8 4.8 3.5 3.5" />
      </>,
    ),
  },
];

type Props = {
  roles: readonly AppRole[];
  fullName: string;
  orgName: string;
};

export function Sidebar({ roles, fullName, orgName }: Props) {
  const pathname = usePathname();
  const visible = SIDEBAR.filter((row) =>
    row.roles.some((r) => roles.includes(r)),
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        {/* 06-design-system.md §10.2: sidebarCollapsedWidth 64 at the md
         * (768px) tablet tier, "sidebar collapses to icons". The full
         * wordmark doesn't fit a 64px rail — .wm-mono is the icon-tier
         * fallback, a bare "F", visually-hidden at every other width the
         * same way the nav labels below are, not a second, different
         * component. */}
        <div className="wm">
          <span className="wm-full">Fydr</span>
          <span className="wm-mono" aria-hidden="true">
            F
          </span>
          <i>.</i>
        </div>
      </div>
      <nav className="nav" aria-label="Main">
        {visible.map((row) => {
          const active =
            pathname === row.route || pathname.startsWith(`${row.route}/`);
          return (
            <Link
              key={row.id}
              href={row.route}
              className="nav-item"
              aria-current={active ? 'page' : undefined}
              title={row.label}
            >
              {row.icon}
              <span className="nav-label">{row.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="nav-foot">
        <div className="nav-who">
          <b>{fullName}</b>
          {orgName} · {roles.join(', ')}
        </div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="nav-item" title="Sign out">
            {SIGN_OUT_ICON}
            <span className="nav-label">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
