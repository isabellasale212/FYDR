/* STAFF-SS-01 C2, the role versions (2026-09-13). The board's frame 7: "S&C,
 * and the nutritionist · differences only". The sport scientist, the coach
 * and the medic read the full dashboard; an S&C reads four summary cards
 * (attention on load readings, Gym today, Weigh-ins, Availability) and the
 * week strip gives way; a nutritionist reads two (attention on their own
 * domain, Weigh-ins) and — docs/access-matrix.md §4.2, which outranks the
 * board — nothing derived from availability, so the Available card and the
 * matchday readiness card are absent for them, not reduced.
 *
 * Roles add up (access.ts's rule): anyone holding a full-dashboard role reads
 * the full dashboard, whatever else they hold. Pure — the page resolves the
 * version from the claims and hands it down; the guard imports this file. */
import { NUTRITIONIST_FLAG_DOMAIN } from '@/lib/access';
import type { AppRole, FlagDomain } from '@/lib/types/database';

export type DashboardVersion = 'full' | 'sc' | 'nutritionist';

const FULL_DASHBOARD = ['sport_scientist', 'coach', 'medic'] as const;

export function dashboardVersion(roles: readonly AppRole[]): DashboardVersion {
  if (roles.some((r) => (FULL_DASHBOARD as readonly string[]).includes(r))) return 'full';
  if (roles.includes('strength_conditioning')) return 'sc';
  if (roles.includes('nutritionist')) return 'nutritionist';
  /* A staff account with none of the five (an admin-only row, or none) —
     the widest read is the safe default: the page's own role gate, not
     this function, decides whether they are here at all. */
  return 'full';
}

/** The flag domains the version's attention card, "Need you" tile and Flags
 *  badge count — the board's "load and weigh-ins only" for the S&C. Load is
 *  the four domains the thresholds engine raises about training load and
 *  performance (GPS, session RPE, the gym, testing); no threshold exists for body mass (metric_definitions seeds
 *  `wellness.body_mass_kg` ineligible), so a weigh-in never raises a flag in
 *  either version. The nutritionist's is the one domain they may act on. */
export const LOAD_FLAG_DOMAINS: readonly FlagDomain[] = ['gps', 'training', 'gym', 'testing'];

export function attentionDomains(version: DashboardVersion): 'all' | readonly FlagDomain[] {
  if (version === 'sc') return LOAD_FLAG_DOMAINS;
  if (version === 'nutritionist') return [NUTRITIONIST_FLAG_DOMAIN];
  return 'all';
}

/** Which summary cards the version draws, in order. */
export type DashboardTile = 'needYou' | 'wellness' | 'available' | 'openFlags' | 'toMatchday' | 'gymToday' | 'weighIns';

export function dashboardTiles(version: DashboardVersion): readonly DashboardTile[] {
  if (version === 'sc') return ['needYou', 'gymToday', 'weighIns', 'available'];
  if (version === 'nutritionist') return ['needYou', 'weighIns'];
  return ['needYou', 'wellness', 'available', 'openFlags', 'toMatchday'];
}

/** The "Need you" tile's footer names the domains it counts, in the
 *  version's own words; the full dashboard's line is unchanged. */
export function needYouFoot(version: DashboardVersion): string {
  if (version === 'sc') return 'load readings only ›';
  if (version === 'nutritionist') return 'nutrition readings only ›';
  return 'across wellness and GPS ›';
}

/** The week strip gives way for the S&C (the board: "the week is one
 *  sidebar row away, the five names are not") and, the nutritionist's frame
 *  being the S&C's minus two cards, for them too. */
export function showsWeekStrip(version: DashboardVersion): boolean {
  return version === 'full';
}

/** Availability-derived regions — the Available card, the matchday
 *  readiness card's ring, split and named rows — are withheld from the
 *  nutritionist (access-matrix §4.2: MET-013 "wherever it appears"). */
export function showsAvailability(version: DashboardVersion): boolean {
  return version !== 'nutritionist';
}
