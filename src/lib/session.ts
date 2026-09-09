import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TIER_PREVIEW_COOKIE, effectiveTier, isPreviewingTier } from '@/lib/tierPreview';
import { getClaims, isAthlete, isStaff, type FydrClaims, claimsStale } from '@/lib/supabase/claims';
import { isPlatformStaff } from '@/lib/platformStaff';
import { INJURY_ACCESS, REPORT_ACCESS, REPORT_VISIBILITY, SETTINGS_ADMIN, CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import type { ReportKey } from '@/lib/access';
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

  /* THE REVOCATION CHECK. Roles live in the JWT — the hook stamps them, RLS
     reads them — so a token minted before a role change carried the old
     authority until it expired. On production that is 3600 seconds, where
     docs/05-architecture.md gives 30 minutes as the worst case, and the Edge
     Function config.toml used to advertise for this never existed. `cv` was
     being written into every token and read by nothing.
     One indexed primary-key read, here rather than in each guard, because every
     guard funnels through this function: requireStaff and requireAthlete call it
     directly, and requireInjuryAccess / requirePlatformStaff / requireReportAccess
     are built on requireStaff. It costs one sequential round trip per guarded
     request, which is the price of the window closing on the next request
     instead of within the hour.
     A MISSING ROW IS STALE, not absent-therefore-fine: a user deleted or hidden
     by RLS mid-session must stop, and this is the one place that can tell. */
  const { data: live } = await supabase
    .from('users')
    .select('claims_version, full_name')
    .eq('id', claims.userId)
    .maybeSingle();
  if (!live || claimsStale(claims.claimsVersion, live.claims_version)) {
    redirect('/auth/stale-claims');
  }

  return { supabase, claims, orgId: claims.orgId, fullName: live.full_name ?? '' };
}

/** Server-side gate for the staff shell. The middleware has already turned an
 *  athlete away; this is the second lock, and RLS is the third. */
export async function requireStaff(): Promise<StaffContext> {
  const { supabase, claims, orgId, fullName } = await base();
  if (!isStaff(claims)) redirect('/today');

  /* base() already read this user's row for the revocation check, and took
     full_name in the same statement — so the extra round trip that check costs
     is offset here rather than added on top of a second users query. */
  const org = await supabase
    .from('organisations')
    .select('name, timezone, tier')
    .eq('id', orgId)
    .maybeSingle();

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
    fullName,
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
  if (!hasAnyRole(ctx.claims.roles, REPORT_ACCESS)) redirect('/settings?e=no-report-access');
  return ctx;
}

/** The gate for one named report, access.ts's REPORT_VISIBILITY grid.
 *
 *  Every report page and every one of their export/pdf Route Handlers goes
 *  through this, so a role admitted to the page is admitted to its CSV and its
 *  PDF and no other report's. That matters more than it sounds: the reports hub
 *  is a list of links, and a gate that lives only on the index is not a gate at
 *  all — the URLs are guessable and the export routes were always reachable
 *  directly. This is why the fix could not simply be "hide the cards".
 *
 *  requireReportAccess above is kept, unchanged, for the surfaces that are not
 *  one of the six: settings/exports, the subject-access review queue, and the
 *  per-athlete testing exports. Those have their own rule and no per-report
 *  grid to consult. */
export async function requireReport(key: ReportKey): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!hasAnyRole(ctx.claims.roles, REPORT_VISIBILITY[key])) redirect('/reports?e=no-report-access');
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


export async function requireInjuryAccess(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!hasAnyRole(ctx.claims.roles, INJURY_ACCESS)) redirect('/?e=no-injury-access');
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
  if (!hasAnyRole(ctx.claims.roles, SETTINGS_ADMIN) && !hasAnyRole(ctx.claims.roles, CLINICAL_ONLY)) redirect('/settings?e=no-sar-access');
  return ctx;
}

/** Fydr's own staff, not a club's — the ONLY gate in this product that is not
 *  a role, and the only one RLS cannot help with.
 *
 *  `lib/platformStaff.ts` explains why there is no `platform` role: it would
 *  live in `app_metadata.roles`, which is club-scoped data on a club's user,
 *  and granting one to a Fydr employee would put them inside a customer's org
 *  and inside its RLS boundary. The consequence is that no policy can express
 *  "platform staff", so a platform surface reads with the service role and THIS
 *  FUNCTION IS THE WHOLE PROTECTION. A page that forgets it is a cross-tenant
 *  leak rather than a missing feature.
 *
 *  Built on requireStaff() rather than beside it, so a platform surface still
 *  requires a real authenticated session first and the email is the VERIFIED
 *  one — getClaims() round-trips to the auth server before it is read, so this
 *  satisfies CLAUDE.md rule 2 exactly as roles do.
 *
 *  UNSET MEANS NOBODY. With `FYDR_PLATFORM_EMAILS` absent — which is its state
 *  on both projects today — every caller is redirected. That is the correct
 *  default and it means shipping this surface changes nothing for anybody until
 *  the variable is deliberately set. */
export async function requirePlatformStaff(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!isPlatformStaff(ctx.claims.email)) redirect('/?e=not-platform-staff');
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
