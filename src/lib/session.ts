import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TIER_PREVIEW_COOKIE, effectiveTier, isPreviewingTier } from '@/lib/tierPreview';
import { getClaims, isAthlete, isStaff, type FydrClaims } from '@/lib/supabase/claims';
import { isPlatformStaff } from '@/lib/platformStaff';
import type { Db } from '@/lib/queries/groups';

export type StaffContext = {
  db: Db;
  claims: FydrClaims;
  orgId: string;
  orgName: string;
  timezone: string;
  fullName: string;
  /** organisations.tier, the real column migration 0002 created and
   *  nothing read until SETTINGS-SPEC.md's Plan card and gate screen gave
   *  it a reason to. Raw DB values ('core' | 'performance') on purpose —
   *  lib/tier.ts maps them to the spec's "Basic"/"Premium" labels at the
   *  UI edge, the same enumLabel()-style split this app already uses
   *  everywhere else, rather than renaming the enum. 12-product-tiers.md
   *  §2 does recommend renaming the enum itself to club/premium; that's a
   *  separate, larger, cross-cutting migration this pass didn't take on.
   *
   *  THIS IS THE EFFECTIVE TIER, not necessarily the club's paid one. An
   *  admin can preview the product on Basic (lib/tierPreview.ts), and this
   *  field carries that preview so every existing gate honours it without
   *  knowing it exists — analytics, reports/training, settings/imports and
   *  the leaderboard metric picker all read `tier` from here and all four
   *  started respecting the preview the moment this line did. A preview can
   *  only ever resolve DOWNWARD; see effectiveTier(). */
  tier: 'core' | 'performance';
  /** The club's real, paid tier, ignoring any preview. Only the Plan card
   *  needs this — everything that gates a feature must use `tier` above, so
   *  that a preview actually previews something. */
  realTier: 'core' | 'performance';
  /** True while `tier` is a preview rather than the real plan. The Plan card
   *  renders a banner on this: a staff member must never be left wondering
   *  whether a missing feature is un-bought or merely hidden. */
  previewingTier: boolean;
};

export type AthleteContext = {
  db: Db;
  claims: FydrClaims;
  orgId: string;
  athleteId: string;
  timezone: string;
  firstName: string;
  lastName: string;
  /** The club's plan. The athlete surface needs it for exactly one thing: the
   *  Apple Health permission, which is a Premium feature and so must not be
   *  offered to an athlete whose club has not bought it. Real tier, never the
   *  preview — a club's own athletes must not see a staff member's Basic
   *  preview change what they are allowed to switch on. */
  tier: 'core' | 'performance';
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
      .select('name, timezone, tier')
      .eq('id', orgId)
      .maybeSingle(),
    supabase.from('users').select('full_name').eq('id', claims.userId).maybeSingle(),
  ]);

  /* The preview is a FYDR-STAFF affordance, checked here rather than only in
   * the UI that offers it: the cookie is browser-written, so anyone who set it
   * by hand would otherwise silently downgrade their own session and read it
   * as the product being broken. It used to be gated on the `admin` role,
   * which was wrong in both directions — every club's own administrator got a
   * switch that is not theirs to flip, and Fydr staff running an upgrade
   * conversation had to hold a role inside the customer's org to use it. See
   * lib/platformStaff.ts. The email comes from the verified session, never
   * from the client, the same as roles do (CLAUDE.md rule 2). */
  const realTier = org.data?.tier ?? 'core';
  const previewCookie = isPlatformStaff(claims.email)
    ? (await cookies()).get(TIER_PREVIEW_COOKIE)?.value
    : undefined;

  return {
    db: supabase,
    claims,
    orgId,
    orgName: org.data?.name ?? 'Your club',
    timezone: org.data?.timezone ?? 'Europe/London',
    fullName: user.data?.full_name ?? '',
    tier: effectiveTier(realTier, previewCookie),
    realTier,
    previewingTier: isPreviewingTier(realTier, previewCookie),
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
  if (!REPORT_ROLES.some((r) => ctx.claims.roles.includes(r))) redirect('/settings?e=no-report-access');
  return ctx;
}

/** The four roles the access matrix gives broad report access, §4 rows.
 *  sport_scientist is here because the matrix's own one-line summary for it is
 *  "Everything. The role with no restrictions" — before the five-role model
 *  this gate said `coach or medical`, and admin was excluded deliberately.
 *  Renaming admin to sport_scientist therefore locked the new owner of the
 *  product out of every report, which is the wrong direction.
 *
 *  Nutritionist is NOT here, and that is knowingly incomplete rather than a
 *  decision: the matrix gives a nutritionist real access to some reports
 *  (Compliance report V, Reports hub and Squad weekly VP) and none to others
 *  (Testing, Training, Athlete, Injury). One blanket gate cannot express a
 *  per-report split, so this keeps the pre-existing behaviour for that role
 *  rather than inventing a rule. Recorded in docs/spec-gaps.md. */
const REPORT_ROLES = ['coach', 'medic', 'sport_scientist', 'strength_conditioning'] as const;

/** The injury and availability gate, docs/access-matrix.md §3.2.
 *
 *  One shared guard rather than four hand-written copies, which is G-01's whole
 *  point. Before this the four injury screens disagreed with each other and
 *  both of them were wrong, in opposite directions:
 *
 *    /injuries and /injuries/[injuryId]  had no role check at all beyond
 *        requireStaff(), so a nutritionist could open either one. That is the
 *        D-01 hole, the highest-ranked item in the gap queue.
 *    /injuries/rehab-groups and /injuries/team-allocation  each carried their
 *        own `coach || medic` test, which refused the sport scientist and the
 *        S&C coach even though §3.2 grants both (VE and VP on those rows).
 *
 *  Written as an ALLOW list, never as "not a nutritionist". Roles are additive
 *  and the matrix says so in its own words at §2: "Giving a nutritionist any
 *  second role that can see injury information will let them see it." A deny
 *  test would refuse somebody who is a nutritionist AND a coach, which is the
 *  opposite of how every other gate here behaves. */
const INJURY_ROLES = ['coach', 'medic', 'sport_scientist', 'strength_conditioning'] as const;

export async function requireInjuryAccess(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!INJURY_ROLES.some((r) => ctx.claims.roles.includes(r))) redirect('/?e=no-injury-access');
  return ctx;
}

/** The route-handler equivalent of PlanGate.
 *
 *  A page can refuse by rendering something; a route handler has to refuse with
 *  a status. This exists because the two training-report export routes had no
 *  tier check at all: the PAGE gated correctly and its export buttons sit after
 *  that early return, so on Basic the buttons were never drawn — and everyone
 *  reading the screen concluded the feature was gated. It was not. Both routes
 *  answered a bare GET with the complete per-athlete GPS board. That is the
 *  whole lesson of docs/12-product-tiers.md §655: a hidden button is not a
 *  gate, because the URL is still there.
 *
 *  403 rather than 404: the club is authenticated and the report genuinely
 *  exists, it is their plan that does not include it. Saying so is also what
 *  makes the upgrade conversation possible. Plain text because the caller is a
 *  download, not a screen — a browser that follows this link shows the sentence
 *  instead of silently saving a file full of markup. */
export function premiumOnlyResponse(feature: string): Response {
  return new Response(`${feature} is a Premium feature, and this club is on Basic.\n`, {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
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
  if (!ctx.claims.roles.includes('sport_scientist') && !ctx.claims.roles.includes('medic')) redirect('/settings?e=no-sar-access');
  return ctx;
}

export async function requireAthlete(): Promise<AthleteContext> {
  const { supabase, claims, orgId } = await base();
  if (!isAthlete(claims)) redirect('/dashboard');
  if (!claims.athleteId) redirect('/login?e=no-roles');

  const [org, athlete] = await Promise.all([
    supabase.from('organisations').select('timezone, tier').eq('id', orgId).maybeSingle(),
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
    tier: org.data?.tier ?? 'core',
  };
}
