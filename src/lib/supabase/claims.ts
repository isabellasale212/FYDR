import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, Database } from '@/lib/types/database';

/* The claims the custom access token hook writes into every JWT.
 * supabase/migrations/0010 §auth_hooks.custom_access_token_hook, and the
 * public.auth_org_id / auth_athlete_id / auth_roles helpers that read them.
 *
 * CONTRACT.md rule 2: roles come from here and from nowhere else. Never from a
 * form field, a query string, a table read on the client, or a cookie we set. */
export type FydrClaims = {
  userId: string;
  orgId: string | null;
  athleteId: string | null;
  roles: readonly AppRole[];
};

const ROLES: readonly string[] = ['athlete', 'coach', 'medical', 'admin'];

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = Buffer.from(
      part.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readAppMetadata(source: unknown): Record<string, unknown> {
  if (typeof source !== 'object' || source === null) return {};
  const meta = (source as Record<string, unknown>).app_metadata;
  return typeof meta === 'object' && meta !== null
    ? (meta as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRoles(value: unknown): AppRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is AppRole => typeof v === 'string' && ROLES.includes(v));
}

/**
 * Resolve the signed-in user and the claims the database will apply.
 *
 * `getUser` is the authenticating call: it round-trips to the auth server, so
 * the session cookie cannot be forged. The token payload is only read *after*
 * that call has succeeded, and only for the custom claims the hook adds, which
 * the user endpoint does not return.
 */
export async function getClaims(
  supabase: SupabaseClient<Database>,
): Promise<FydrClaims | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const fromToken = session?.access_token
    ? readAppMetadata(decodePayload(session.access_token))
    : {};
  const fromUser = readAppMetadata(user);

  const roles = asRoles(fromToken.roles ?? fromUser.roles);

  return {
    userId: user.id,
    orgId: asString(fromToken.org_id) ?? asString(fromUser.org_id),
    athleteId: asString(fromToken.athlete_id) ?? asString(fromUser.athlete_id),
    roles,
  };
}

export function isStaff(claims: FydrClaims): boolean {
  return (
    claims.roles.includes('coach') ||
    claims.roles.includes('medical') ||
    claims.roles.includes('admin')
  );
}

export function isAthlete(claims: FydrClaims): boolean {
  return claims.roles.includes('athlete');
}

/** The landing route for a set of roles. Staff win when a user holds both,
 *  which is the case for a player-coach: the staff shell is the larger tool.
 *
 *  `/dashboard`'s own route roles are `coach`/`medical` only — G-1 in
 *  `docs/20-route-map.md` §11 resolves the contradiction between
 *  `02-information-architecture.md` §4.2 (which sketches an admin panel
 *  order for it) and `01-roles-and-permissions.md` §2 (`no` for "View squad
 *  dashboard") in the matrix's favour: "an admin-only user does not open
 *  /dashboard". This function used to send every staff member there
 *  regardless, which put an admin-only sign-in on a page not in their own
 *  sidebar (`Sidebar.tsx`'s `staff.dashboard` row is `['coach', 'medical']`,
 *  no admin) full of the named-athlete panels §1 says admin doesn't read.
 *  `/settings` is the one sidebar row that is entirely admin's own —
 *  users, subject access, retention and the audit log are admin-exclusive
 *  rows on that page, and 01-roles-and-permissions.md §1 lists exactly
 *  those as what admin *can* do. An admin who also holds coach or medical
 *  still lands on /dashboard: the squad-facing shell is the bigger tool for
 *  them, same reasoning as the staff-vs-athlete choice above. */
export function homeRoute(claims: FydrClaims): string {
  if (isStaff(claims)) {
    const hasSquadAccess = claims.roles.includes('coach') || claims.roles.includes('medical');
    return hasSquadAccess ? '/dashboard' : '/settings';
  }
  if (isAthlete(claims)) return '/today';
  return '/login?e=no-roles';
}
