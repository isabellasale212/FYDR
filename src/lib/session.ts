import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClaims, isAthlete, isStaff, type FydrClaims } from '@/lib/supabase/claims';
import type { Db } from '@/lib/queries/groups';

export type StaffContext = {
  db: Db;
  claims: FydrClaims;
  orgId: string;
  orgName: string;
  timezone: string;
  fullName: string;
};

export type AthleteContext = {
  db: Db;
  claims: FydrClaims;
  orgId: string;
  athleteId: string;
  timezone: string;
  firstName: string;
  lastName: string;
};

async function base() {
  const supabase = await createClient();
  const claims = await getClaims(supabase);
  if (!claims) redirect('/login');
  if (!claims.orgId) redirect('/login?e=no-roles');
  return { supabase, claims, orgId: claims.orgId };
}

/** Server-side gate for the staff shell. The middleware has already turned an
 *  athlete away; this is the second lock, and RLS is the third. */
export async function requireStaff(): Promise<StaffContext> {
  const { supabase, claims, orgId } = await base();
  if (!isStaff(claims)) redirect('/today');

  const [org, user] = await Promise.all([
    supabase
      .from('organisations')
      .select('name, timezone')
      .eq('id', orgId)
      .maybeSingle(),
    supabase.from('users').select('full_name').eq('id', claims.userId).maybeSingle(),
  ]);

  return {
    db: supabase,
    claims,
    orgId,
    orgName: org.data?.name ?? 'Your club',
    timezone: org.data?.timezone ?? 'Europe/London',
    fullName: user.data?.full_name ?? '',
  };
}

/** docs/screens/user-management.md's own words: "An admin who needs squad
 *  data holds the coach role as well, which is the deliberate friction."
 *  docs/screens/reports.md's role table says the same thing from the other
 *  side: "Admin: Aggregate compliance and usage only... Named athlete data
 *  is not in an admin's report set." Every report this build ships is
 *  named-athlete data — there's no aggregate-only view built to fall back
 *  to — so the correct gate for an admin-only staff member (no coach or
 *  medical role) is the same one GPS import already uses for a
 *  coach/medical-only feature, applied in the other direction. Used by
 *  every report page and every report export/pdf Route Handler, so an
 *  admin is blocked the same way regardless of which door they try. */
export async function requireReportAccess(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.claims.roles.includes('coach') && !ctx.claims.roles.includes('medical')) redirect('/settings?e=no-report-access');
  return ctx;
}

/** 09-security-and-compliance.md §6 and screens/exports.md's own role
 *  table: an admin opens a subject access request and releases the
 *  finished pack, medical records the clinical withhold/include decision
 *  a request with clinical data needs before it can be released. Neither
 *  role alone is the whole feature, so the queue page itself is open to
 *  both — a coach has no part in this workflow at all and is turned away,
 *  same shape as requireReportAccess just above, applied to a different
 *  pair of roles. */
export async function requireSubjectAccess(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.claims.roles.includes('admin') && !ctx.claims.roles.includes('medical')) redirect('/settings?e=no-sar-access');
  return ctx;
}

export async function requireAthlete(): Promise<AthleteContext> {
  const { supabase, claims, orgId } = await base();
  if (!isAthlete(claims)) redirect('/dashboard');
  if (!claims.athleteId) redirect('/login?e=no-roles');

  const [org, athlete] = await Promise.all([
    supabase.from('organisations').select('timezone').eq('id', orgId).maybeSingle(),
    supabase
      .from('athletes')
      .select('first_name, last_name')
      .eq('id', claims.athleteId)
      .maybeSingle(),
  ]);

  return {
    db: supabase,
    claims,
    orgId,
    athleteId: claims.athleteId,
    timezone: org.data?.timezone ?? 'Europe/London',
    firstName: athlete.data?.first_name ?? '',
    lastName: athlete.data?.last_name ?? '',
  };
}
