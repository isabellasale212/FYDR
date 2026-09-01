import type { Tier } from '@/lib/tier';

/* "Preview this club on Basic" — the Plan card's switch, made to actually do
 * something.
 *
 * WHAT THIS IS NOT. It is not self-service billing. lib/tier.ts and the
 * Settings Plan card both say plainly that changing a club's plan is a sales
 * conversation with their Fydr contact, and that stays true: nothing here
 * writes organisations.tier, so a club's real, paid plan is untouched and
 * un-writable from the UI. What the switch changes is what THIS STAFF MEMBER'S
 * OWN SESSION renders, so someone can see the product as a Basic club sees it
 * without a second database, a second login, or a support ticket.
 *
 * DOWNGRADE ONLY, ENFORCED SERVER-SIDE. A preview may only ever show LESS than
 * the club has paid for. Honouring an upward preview would put GPS, the
 * training report and the analytics chart in front of a club that has not
 * bought them — a real entitlement leak dressed up as a preview — so
 * effectiveTier() below simply refuses any override that is not 'core', rather
 * than trusting the cookie to be sensible. The cookie is written by the
 * browser and is therefore untrusted input; this function is the only thing
 * that decides what it means.
 *
 * That is the same fail-closed shape lib/tier.ts's isPremium() already uses:
 * an unrecognised value resolves DOWN, never up, by construction rather than
 * by remembering to handle it.
 */

export const TIER_PREVIEW_COOKIE = 'fydr-tier-preview';

/** The only value the cookie may carry. Written out rather than reusing Tier,
 *  because the point is that 'performance' is NOT an accepted override. */
export const TIER_PREVIEW_VALUE = 'core';

/** The tier a session should actually render at.
 *
 *  `real` is the club's paid tier from organisations.tier. `cookie` is
 *  whatever arrived in the request, unvalidated. The result is never higher
 *  than `real`. */
export function effectiveTier(real: Tier, cookie: string | undefined): Tier {
  if (cookie !== TIER_PREVIEW_VALUE) return real;
  // Refused rather than honoured when the club is already on the lower tier:
  // there is nothing to preview, and reporting "previewing" for a state that
  // is simply the truth would make the banner lie.
  if (real !== 'performance') return real;
  return 'core';
}

/** True when the rendered tier is a preview rather than the club's real plan.
 *  Drives the banner — a staff member must never be left unsure whether the
 *  features they can't find are missing or merely hidden. */
export function isPreviewingTier(real: Tier, cookie: string | undefined): boolean {
  return effectiveTier(real, cookie) !== real;
}
