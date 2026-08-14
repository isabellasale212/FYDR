import type { AppRole } from '@/lib/types/database';

/* Shared MFA (TOTP) types and small pure helpers.
 *
 * docs/09-security-and-compliance.md §8.1: "MFA for coach, medical, admin: Mandatory."
 * See src/components/MfaEnrollment/MfaEnrollment.tsx for what "mandatory" actually means
 * in this build (a strong, undismissable prompt, not a login-blocking gate — that call and
 * why it was made this way, not the fully-enforced version the doc names, is recorded
 * there) and supabase/migrations/0048_mfa_aal2_helper.sql for the RLS side, which is
 * shipped as an inert, unused helper rather than wired into policies this pass.
 *
 * Supabase Auth's TOTP MFA has no recovery/backup-code concept anywhere in
 * @supabase/supabase-js (checked the shipped .d.ts before writing this, not assumed) —
 * unlike, say, GitHub's or Google's 2FA. The only account-recovery path this build offers
 * a staff member who loses their authenticator is an admin removing the factor for them,
 * UserDetailPanel's own "Remove MFA factor" action. Say that honestly in the UI rather than
 * invent a recovery-code system Supabase doesn't provide.
 */

export const STAFF_MFA_REQUIRED_ROLES: readonly AppRole[] = ['coach', 'medical', 'admin'];

export function mfaRequiredForRoles(roles: readonly AppRole[]): boolean {
  return roles.some((r) => STAFF_MFA_REQUIRED_ROLES.includes(r));
}

export type MfaFactorSummary = {
  id: string;
  status: 'verified' | 'unverified';
  created_at: string;
};

/** The one verified factor to show as "your" enrollment, if more than one somehow exists
 *  (Supabase's API technically allows enrolling several TOTP factors; this build's UI only
 *  ever creates one at a time, so "the most recently verified" is the same as "the only
 *  one" in every real case). */
export function currentVerifiedFactor(factors: readonly MfaFactorSummary[]): MfaFactorSummary | null {
  const verified = factors.filter((f) => f.status === 'verified');
  if (verified.length === 0) return null;
  return [...verified].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

/** Supabase's enroll() response embeds the QR code as a bare SVG document string, not a
 *  data: URI — GoTrueMFAApi's own TSDoc on AuthMFAEnrollTOTPResponse says to prepend this
 *  exact prefix before handing it to an <img src>. */
export function qrCodeDataUri(svg: string): string {
  return `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`;
}
