/* The staff phone shell's data — STAFF-SS-01, decided by Isabella 2026-09-12:
 * below 768px the sidebar becomes a bottom bar of four plus More, and the
 * sections the bar does not carry live in a More sheet with Log out. The
 * desktop sidebar (1024+) and the 64px rail (768–1023) are unchanged; this
 * file only decides what goes where on a phone, from the SAME row table the
 * sidebar draws, so the two cannot name a different set of destinations.
 *
 * THE FOURTH SLOT FOLLOWS THE ROLE (the board's rule): Flags for the sport
 * scientist, coach and medic — the three who act on a flag; Gym for S&C;
 * Nutrition for the nutritionist. A person holding one of the three flag
 * roles alongside another gets Flags: the sport scientist is the superset
 * role, and a coach who also runs the gym is still the one who is asked
 * about a flagged athlete. Whatever takes the slot leaves the sheet and
 * Flags joins it, so all nine sections — and Flags, which has no sidebar row
 * (02-information-architecture.md §4.1) — are reachable in exactly one place.
 */

import type { AppRole } from '@/lib/types/database';
import { PREMIUM_ONLY, SIDEBAR_ROWS } from '@/components/Sidebar/rows';

export type PhoneRow = { id: string; label: string; route: string };

const FLAGS: PhoneRow = { id: 'staff.flags', label: 'Flags', route: '/flags' };
const FIXED = ['/dashboard', '/squad', '/schedule'] as const;
const FLAG_ROLES: readonly AppRole[] = ['sport_scientist', 'coach', 'medic'];

function visibleSidebar(roles: readonly AppRole[], premium: boolean): PhoneRow[] {
  return SIDEBAR_ROWS.filter(
    (row) => row.roles.some((r) => roles.includes(r)) && (premium || !PREMIUM_ONLY.has(row.id)),
  ).map((row) => ({ id: row.id, label: row.label, route: row.route }));
}

export function phoneSlot(roles: readonly AppRole[]): PhoneRow {
  if (roles.some((r) => FLAG_ROLES.includes(r))) return FLAGS;
  if (roles.includes('strength_conditioning')) return { id: 'staff.programmes', label: 'Gym', route: '/programmes' };
  if (roles.includes('nutritionist')) return { id: 'staff.nutrition', label: 'Nutrition', route: '/nutrition' };
  return FLAGS;
}

/** The four destinations in the bar, in the board's order. Labels are the
 *  bar's own short forms ("Squad" for Squad overview, "Gym" for Gym
 *  programme); the sheet keeps the sidebar's full labels. */
export function barRows(roles: readonly AppRole[], premium: boolean): PhoneRow[] {
  const sidebar = visibleSidebar(roles, premium);
  const short: Record<string, string> = { '/squad': 'Squad', '/programmes': 'Gym' };
  const fixed = FIXED.map((route) => sidebar.find((r) => r.route === route)).filter((r): r is PhoneRow => !!r)
    .map((r) => ({ ...r, label: short[r.route] ?? r.label }));
  return [...fixed, phoneSlot(roles)];
}

/** Everything the bar does not carry, in the sidebar's order, plus Flags when
 *  the slot went to another role. */
export function sheetRows(roles: readonly AppRole[], premium: boolean): PhoneRow[] {
  const inBar = new Set(barRows(roles, premium).map((r) => r.route));
  const rows = visibleSidebar(roles, premium).filter((r) => !inBar.has(r.route));
  return inBar.has(FLAGS.route) ? rows : [...rows, FLAGS];
}

/** The screen's name for the title bar, from the same route table: the
 *  sidebar row whose route prefixes the path, plus the three routes that
 *  were folded into a row (Sidebar.tsx's own header lists them) and Flags.
 *  The brand when nothing matches, so the bar is never blank. */
const FOLDED: Record<string, string> = { '/timetable': 'Schedule', '/testing': 'Reports', '/flags': 'Flags', '/compliance': 'Reports', '/injuries': 'Dashboard' };
export function pageTitle(pathname: string): string {
  const hit = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  const row = SIDEBAR_ROWS.find((r) => hit(r.route));
  if (row) return row.label;
  const folded = Object.keys(FOLDED).find((route) => hit(route));
  return folded ? (FOLDED[folded] ?? 'Fydr') : 'Fydr';
}
