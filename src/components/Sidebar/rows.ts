/* The staff sidebar's rows — the nine destinations, their order, their
 * labels and who sees them (02-information-architecture.md §4.1). A plain
 * data module since STAFF-SS-01 (2026-09-12) so the phone shell
 * (StaffPhoneShell/shell.ts) draws from the SAME table as the sidebar and the
 * two cannot name a different set of destinations. The glyphs stay in
 * Sidebar.tsx, keyed by id.
 *
 * Narrowed from 20-route-map.md's count: Groups, Timetable and Testing each
 * used to have their own row and don't any more, each folded into a screen
 * it belongs to instead of standing beside it —
 *   - Groups → Squad overview's own "Manage groups" link (still the real
 *     /settings/groups screen; Settings keeps a second way in for admin,
 *     who can't reach Squad overview at all).
 *   - Timetable → merged at the navigation level into Schedule: one row,
 *     "Schedule", and a "Week plan / Today" toggle on both real pages.
 *   - Testing → its report (Reports → Testing) is now the entry point.
 *   - Flags → replaced entirely by a summary on the Dashboard itself
 *     (DashboardFlagsPanel); /flags is still the real full list, linked from
 *     that panel — and the phone shell's fourth slot for the flag roles.
 * Flat, nothing indented, one top-level segment each. Roles here hide a row;
 * they never grant access, which is RLS plus the middleware.
 *
 * Every row is reachable by every staff role, and the field stays per-row so a
 * destination can narrow later without the others moving with it. Analytics
 * is the exception, and the only one: §3.4 and D-02 both make it the sport
 * scientist's alone, confirmed 2026-09-05. */

import type { AppRole } from '@/lib/types/database';
import { ALL_STAFF, ANALYTICS } from '@/lib/access';

export type SidebarRow = {
  id: string;
  label: string;
  route: string;
  roles: readonly AppRole[];
};

/** Rows that disappear on Basic. Only Analytics qualifies as a whole
 *  destination: the training report and the GPS import live inside Reports and
 *  Settings, which both stay because their other contents are on every plan —
 *  those two gate on their own routes instead. */
export const PREMIUM_ONLY = new Set<string>(['staff.analytics']);

export const SIDEBAR_ROWS: readonly SidebarRow[] = [
  { id: 'staff.dashboard', label: 'Dashboard', route: '/dashboard', roles: ALL_STAFF },
  { id: 'staff.squad', label: 'Squad overview', route: '/squad', roles: ALL_STAFF },
  { id: 'staff.schedule', label: 'Schedule', route: '/schedule', roles: ALL_STAFF },
  { id: 'staff.reports', label: 'Reports', route: '/reports', roles: ALL_STAFF },
  { id: 'staff.nutrition', label: 'Nutrition', route: '/nutrition', roles: ALL_STAFF },
  { id: 'staff.programmes', label: 'Gym programme', route: '/programmes', roles: ALL_STAFF },
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
  { id: 'staff.leaderboards', label: 'Leaderboard', route: '/leaderboards', roles: ALL_STAFF },
  { id: 'staff.analytics', label: 'Analytics', route: '/analytics', roles: ANALYTICS },
  { id: 'staff.settings', label: 'Settings', route: '/settings', roles: ALL_STAFF },
];
