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
  /** From `getUser()`, which authenticates against the auth server before this
   *  is read — so it is as trustworthy as `roles` and usable for access
   *  decisions (lib/platformStaff.ts is the only one that does). Null only if
   *  the identity has no email at all, e.g. a phone-only sign-in. */
  email: string | null;
  orgId: string | null;
  athleteId: string | null;
  roles: readonly AppRole[];
};

/** The allow-list a JWT's roles are filtered through. It must hold every value
 *  in the app_role enum, because anything missing is silently DROPPED from the
 *  claims rather than rejected: a user whose only role is absent here arrives
 *  with an empty roles array and is treated as holding nothing at all.
 *
 *  That is exactly how auth_roles() broke in the database when 0063 renamed the
 *  enum (see 0065_role_model_function_bodies.sql). This is the same list, on the
 *  other side of the wire, and it drifted the same way: strength_conditioning
 *  and nutritionist existed in the enum and were missing here, so both roles
 *  were refused everywhere in the app. Fail-closed, but broken. */
const ROLES: readonly string[] = [
  'athlete',
  'coach',
  'medic',
  'sport_scientist',
  'strength_conditioning',
  'nutritionist',
];

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
    email: user.email ?? null,
    orgId: asString(fromToken.org_id) ?? asString(fromUser.org_id),
    athleteId: asString(fromToken.athlete_id) ?? asString(fromUser.athlete_id),
    roles,
  };
}

/** Staff is every role that is not the athlete, docs/access-matrix.md §1.
 *  Written as an explicit list rather than `!isAthlete()` so that a role added
 *  to the enum in future does not become staff by default. */
export function isStaff(claims: FydrClaims): boolean {
  return (
    claims.roles.includes('coach') ||
    claims.roles.includes('medic') ||
    claims.roles.includes('sport_scientist') ||
    claims.roles.includes('strength_conditioning') ||
    claims.roles.includes('nutritionist')
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
 *  order for it) and `01-roles-and-permissions.md (superseded)` §2 (`no` for "View squad
 *  dashboard") in the matrix's favour: "an admin-only user does not open
 *  /dashboard". This function used to send every staff member there
 *  regardless, which put an admin-only sign-in on a page not in their own
 *  sidebar (`Sidebar.tsx`'s `staff.dashboard` row is `['coach', 'medic']`,
 *  no admin) full of the named-athlete panels §1 says admin doesn't read.
 *  `/settings` is the one sidebar row that is entirely admin's own —
 *  users, subject access, retention and the audit log are admin-exclusive
 *  rows on that page, and 01-roles-and-permissions.md (superseded) §1 lists exactly
 *  those as what admin *can* do. An admin who also holds coach or medical
 *  still lands on /dashboard: the squad-facing shell is the bigger tool for
 *  them, same reasoning as the staff-vs-athlete choice above. */
export function homeRoute(claims: FydrClaims): string {
  /* Every staff role lands on the dashboard. This used to send anyone who was
     not a coach or a medic to /settings, which was correct while "anyone else"
     meant the admin, a club secretary with no squad data. That role is gone,
     its duties folded into the sport scientist, and the sport scientist has no
     restrictions at all, so the old branch sent the least restricted role in
     the product to the one page that assumed it could see almost nothing. */
  if (isStaff(claims)) return '/dashboard';
  if (isAthlete(claims)) return '/today';
  return '/login?e=no-roles';
}
