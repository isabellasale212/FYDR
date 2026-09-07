'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/types/database';
import { ALL_STAFF, ANALYTICS } from '@/lib/access';

/* The sidebar rows, from 20-route-map.md §3, since narrowed from that map's
 * count: Groups, Timetable and Testing each used to have their own row and
 * don't any more, each folded into a screen it belongs to instead of
 * standing beside it —
 *   - Groups → Squad overview's own "Manage groups" link (still the real
 *     /settings/groups screen; Settings keeps a second way in for admin,
 *     who can't reach Squad overview at all).
 *   - Timetable → merged at the navigation level into Schedule: one row,
 *     "Schedule", and a "Week plan / Today" toggle on both real pages
 *     (still two routes — screens/schedule.md and screens/timetable.md
 *     still draw a real distinction, planning vs pitch-side attendance
 *     capture, that a single page would lose).
 *   - Testing → its report (Reports → Testing) is now the entry point:
 *     "+ Log a result" and a per-test "+" in the by-athlete table link
 *     into the real /testing/:testDefId grid; /testing itself (the
 *     definition library) is still reachable from there.
 *   - Flags → replaced entirely by a summary on the Dashboard itself
 *     (DashboardFlagsPanel) rather than folded into another sidebar row;
 *     /flags is still the real full list, linked from that panel.
 * Flat, nothing indented, one top-level segment each. Roles here hide a row;
 * they never grant access, which is RLS plus the middleware. */

type Row = {
  id: string;
  label: string;
  route: string;
  roles: readonly AppRole[];
  icon: React.ReactNode;
};

/* Solid glyphs on a 14-unit grid, ported from FydrSidebar.dc.html. They were
 * 1.4px outline strokes on a 16-unit grid; the design's are filled, which is
 * what gives the rail its weight at 17px. The sign-out arrow stays a stroke
 * because the design draws that one as a stroke too. */
const icon = (paths: React.ReactNode) => (
  <svg className="ic" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    {paths}
  </svg>
);

const SIGN_OUT_ICON = (
  <svg
    className="ic"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <path d="M5.4 12.4H2.4V1.6h3M8 4.2l2.8 2.8L8 9.8M10.8 7H5.6" />
  </svg>
);

/** Rows that disappear on Basic. Only Analytics qualifies as a whole
 *  destination: the training report and the GPS import live inside Reports and
 *  Settings, which both stay because their other contents are on every plan —
 *  those two gate on their own routes instead. */
const PREMIUM_ONLY = new Set<string>(['staff.analytics']);

/* Every row is reachable by every staff role, and the field stays per-row so a
 * destination can narrow later without the others moving with it.
 *
 * These arrays read ['coach', 'medic'] until the five-role migration, which was
 * the same phrase it was in the policies and the guards: "any staff", because
 * coach and medic were the only two non-admin staff values that existed. The
 * effect once the enum grew was that an S&C or a nutritionist signed in to a
 * sidebar with nothing in it, and the sport scientist, the role that is meant to
 * have no restrictions at all, was missing six of the nine rows: Dashboard,
 * Squad overview, Schedule, Nutrition, Gym programme and Analytics.
 *
 * Analytics is the exception, and the only one: §3.4 and D-02 both make it the
 * sport scientist's alone, which was confirmed on 2026-09-05. Every other row
 * is reachable by every staff role. */

export const SIDEBAR: readonly Row[] = [
  {
    id: 'staff.dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    roles: ALL_STAFF,
    icon: icon(
      <>
        <rect x="0.8" y="0.8" width="5.2" height="12.4" rx="1.4" />
        <rect x="7.4" y="0.8" width="5.8" height="5.6" rx="1.4" />
        <rect x="7.4" y="7.6" width="5.8" height="5.6" rx="1.4" />
      </>,
    ),
  },
  {
    id: 'staff.squad',
    label: 'Squad overview',
    route: '/squad',
    roles: ALL_STAFF,
    icon: icon(
      <>
        <circle cx="5.2" cy="4" r="2.9" />
        <path d="M5.2 7.9c2.4 0 4.3 1.7 4.8 3.9 0.1 0.7-0.4 1.4-1.1 1.4H1.5c-0.7 0-1.2-0.7-1.1-1.4 0.5-2.2 2.4-3.9 4.8-3.9z" />
        <path d="M10.5 2.2c1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2c-0.3 0-0.6-0.1-0.9-0.2 0.4-0.6 0.7-1.3 0.7-2 0-0.8-0.3-1.5-0.7-2.1 0.3-0.1 0.6-0.1 0.9-0.1z" />
        <path d="M11 7.7c1.4 0.2 2.5 1.2 2.9 2.6 0.2 0.7-0.4 1.3-1.1 1.3h-1.4c-0.1-1.5-0.7-2.9-1.7-3.9h1.3z" />
      </>,
    ),
  },
  {
    id: 'staff.schedule',
    label: 'Schedule',
    route: '/schedule',
    roles: ALL_STAFF,
    icon: icon(
      <g fillRule="evenodd">
        <path d="M7 0.7a6.3 6.3 0 1 0 0 12.6A6.3 6.3 0 0 0 7 0.7zm0 2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6z" />
        <rect x="6.3" y="3.5" width="1.4" height="4" rx="0.7" />
        <rect x="6.8" y="6.3" width="3.4" height="1.4" rx="0.7" />
      </g>,
    ),
  },
  {
    id: 'staff.reports',
    label: 'Reports',
    route: '/reports',
    roles: ALL_STAFF,
    icon: icon(
      <g fillRule="evenodd">
        <path d="M5.1 0.6h3.8c0.9 0 1.6 0.7 1.6 1.6v0.9h-1.7V2.3H5.2v0.8H3.5V2.2c0-0.9 0.7-1.6 1.6-1.6z" />
        <path d="M1.5 3.8h11c0.7 0 1.3 0.6 1.3 1.3v1.7H8.1v1.1H5.9V6.8H0.2V5.1c0-0.7 0.6-1.3 1.3-1.3z" />
        <path d="M0.2 7.9h5.7v1.1h2.2V7.9h5.7v3.9c0 0.7-0.6 1.3-1.3 1.3h-11c-0.7 0-1.3-0.6-1.3-1.3z" />
      </g>,
    ),
  },
  {
    id: 'staff.nutrition',
    label: 'Nutrition',
    route: '/nutrition',
    roles: ALL_STAFF,
    icon: icon(
      <g fillRule="evenodd">
        <path d="M1.1 0.6h1.5v3.6h0.8V0.6h1.5v3.6h0.8V0.6h1.5v4.3c0 1-0.6 1.8-1.5 2.1v6.4H2.6V7c-0.9-0.3-1.5-1.1-1.5-2.1z" />
        <path d="M10.7 0.6c1.4 0 2.4 1.5 2.4 3.6 0 1.8-0.7 3.2-1.7 3.5v5.7H9.9V7.7C8.9 7.4 8.3 6 8.3 4.2c0-2.1 1-3.6 2.4-3.6z" />
      </g>,
    ),
  },
  {
    id: 'staff.programmes',
    label: 'Gym programme',
    route: '/programmes',
    roles: ALL_STAFF,
    icon: icon(
      <>
        <rect x="0.4" y="4" width="2.2" height="6" rx="0.9" />
        <rect x="3.2" y="2.6" width="2.2" height="8.8" rx="0.9" />
        <rect x="8.6" y="2.6" width="2.2" height="8.8" rx="0.9" />
        <rect x="11.4" y="4" width="2.2" height="6" rx="0.9" />
        <rect x="5" y="6.1" width="4" height="1.8" />
      </>,
    ),
  },
  {
    // Admin stays in this row's roles deliberately — 20-route-map.md's own
    // sidebar array keeps it (`roles: ["coach", "medic", "sport_scientist"]`), and
    // 01-roles-and-permissions.md (superseded) §2 gives admin `A` (aggregate), not `no`,
    // for "View leaderboards". /leaderboards/manage (board config, no named
    // data) is genuinely admin's to use, and this row is the only door to
    // it. The wall itself (/leaderboards, LeaderboardWall) still denies an
    // admin-only visitor server-side with an explanation and a link
    // straight to Manage — see that page's own header. The alternative,
    // pointing this row at /leaderboards/manage directly per-role, was
    // considered and rejected: a route swap keyed on role is a new kind of
    // complexity this sidebar doesn't have anywhere else, for a click an
    // admin only pays once.
    id: 'staff.leaderboards',
    label: 'Leaderboard',
    route: '/leaderboards',
    roles: ALL_STAFF,
    icon: icon(
      <>
        <rect x="0.6" y="7.8" width="3.8" height="5.6" rx="1.2" />
        <rect x="5.1" y="2.6" width="3.8" height="10.8" rx="1.2" />
        <rect x="9.6" y="5.6" width="3.8" height="7.8" rx="1.2" />
      </>,
    ),
  },
  {
    id: 'staff.analytics',
    label: 'Analytics',
    route: '/analytics',
    roles: ANALYTICS,
    icon: icon(
      <>
        <path d="M1.4 9.5 5.3 5.6l2.5 2.5 3.3-3.3 1.4 1.4-4.7 4.7-2.5-2.5-2.5 2.5z" />
        <path d="M8.6 3.1h4.7v4.7l-1.7-1.7-1.3-1.3z" />
      </>,
    ),
  },
  {
    id: 'staff.settings',
    label: 'Settings',
    route: '/settings',
    roles: ALL_STAFF,
    icon: icon(
      <path
        fillRule="evenodd"
        d="M5.9 0.4h2.2l0.35 1.85 1.25 0.52 1.5-1.13 1.56 1.56-1.13 1.5 0.52 1.25 1.85 0.35v2.2l-1.85 0.35-0.52 1.25 1.13 1.5-1.56 1.56-1.5-1.13-1.25 0.52-0.35 1.85H5.9l-0.35-1.85-1.25-0.52-1.5 1.13-1.56-1.56 1.13-1.5-0.52-1.25L0 8.1V5.9l1.85-0.35 0.52-1.25-1.13-1.5 1.56-1.56 1.5 1.13 1.25-0.52z M7 4.55a2.45 2.45 0 1 0 0 4.9 2.45 2.45 0 0 0 0-4.9z"
      />,
    ),
  },
];

type Props = {
  /** True while this admin is previewing the product on the Basic plan
   *  (lib/tierPreview.ts). The Plan card in Settings says so too, but the
   *  whole point of the preview is to go and look at other screens, and a
   *  coach finding GPS missing with no explanation on any of them would
   *  reasonably report it as a fault. This is the indicator that travels. */
  previewingTier?: boolean;
  roles: readonly AppRole[];
  fullName: string;
  orgName: string;
  /** The plan this session renders at, already resolved through
   *  effectiveTier() — so a Basic preview hides the same rows a real Basic
   *  club never sees. Hiding is presentation only: every route it hides is
   *  also gated server-side, because a missing link is not access control. */
  premium: boolean;
};

export function Sidebar({ roles, fullName, orgName, premium, previewingTier = false }: Props) {
  const pathname = usePathname();
  const visible = SIDEBAR.filter(
    (row) =>
      row.roles.some((r) => roles.includes(r)) &&
      // Premium-only destinations leave the rail entirely on Basic rather than
      // standing there as a link to a locked page.
      (premium || !PREMIUM_ONLY.has(row.id)),
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
          {/* The mark itself: a GPS trace stepping under the wordmark and
              ending in a ringed dot. Light draws trace and ring as accent
              tints with a solid accent dot; dark is one flat colour, because
              a tint of the accent on a dark panel reads as muddy rather than
              quiet. SCALED TO 40px on the 64px collapsed rail, not hidden —
              this comment said "hidden" for months and no CSS ever did it, so
              the trace rendered at its full 132px and overflowed the rail by
              68px. See the rail block in base.css. */}
          <svg
            className="wm-trace wm-trace-full"
            viewBox="0 0 242 66"
            aria-hidden="true"
          >
            <path
              d="M3 36 L44 36 L56 54 L92 54 L104 36 L188 36 L206 27"
              fill="none"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle className="wm-ring" cx="220" cy="21" r="17" fill="none" strokeWidth={3} />
            <circle className="wm-dot" cx="220" cy="21" r="7" />
          </svg>
          {/* THE SAME DRAWING, CROPPED, for the 64px rail — the icon tier of the
              mark, exactly as .wm-mono is the icon tier of the wordmark. Both
              sit in the DOM and the media query picks one, rather than a third
              mechanism for the same idea.

              WHY A CROP AND NOT A SMALLER FULL TRACE. Scaling the whole 242x66
              drawing to fit 64px does fit, and renders the ringed dot at 6px:
              correct, contained, and too faint to be the mark. The viewBox here
              is the same geometry at the same coordinates, showing only the
              tail — the rise out of the last trough and the dot it ends in — so
              the ring lands near 18px instead. Same path data, same circles,
              same numbers; only the window onto them changes. */}
          <svg
            className="wm-trace wm-trace-mono"
            viewBox="184 2 56 40"
            aria-hidden="true"
          >
            <path
              d="M3 36 L44 36 L56 54 L92 54 L104 36 L188 36 L206 27"
              fill="none"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle className="wm-ring" cx="220" cy="21" r="17" fill="none" strokeWidth={3} />
            <circle className="wm-dot" cx="220" cy="21" r="7" />
          </svg>
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
        {previewingTier ? (
          <Link
            href="/settings#plan"
            className="pill"
            style={{
              background: 'var(--wash-warn)',
              color: 'var(--warn-pill-text)',
              margin: '0 0 10px',
              textDecoration: 'none',
            }}
            title="You are previewing the Basic plan. Your club’s real plan is unchanged. Opens the Plan card, where you can switch back."
          >
            Previewing Basic
          </Link>
        ) : null}
        <div className="nav-who">
          <b>{fullName}</b>
          <span>
            {orgName} · {roles.join(', ')}
          </span>
        </div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="nav-signout" title="Log out">
            {SIGN_OUT_ICON}
            <span className="nav-label">Log out</span>
          </button>
        </form>
        {/* 13-legal-and-trademark.md §3: the Fydr trademark is unregistered
         * as of this build, so this uses no ® anywhere — a criminal
         * offence under s.95 of the Trade Marks Act 1994 before
         * registration. Copyright is a separate right that exists
         * automatically on creation, with no registration step, so a
         * plain © notice is safe today; the year is computed, never
         * hardcoded, so this doesn't go stale. */}
        <p className="nav-copyright">© {new Date().getFullYear()} Fydr</p>
      </div>
    </aside>
  );
}
