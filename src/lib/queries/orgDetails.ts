import type { Db } from './groups';
import type { OrgSport } from '@/lib/types/database';

/* screens/settings.md §"Organisation settings" and migration 0012's own
 * comment: "'Manage organisation settings: name, timezone, sport, season
 * dates, branding' is admin only." This file covers name, sport and
 * timezone using organisations_admin_update, an RLS policy that has existed
 * since early in this build and had nothing writing to it until now.
 * Branding (the logo) is a sibling write path, not this file's — see
 * lib/queries/orgLogo.ts, which goes through Storage rather than a plain
 * column update the way this file's three fields do.
 *
 * Cut, and real: season dates (seasons is its own table with its own
 * creation flow — a real, separate feature, not a settings field).
 * Subscription tier is deliberately not editable here at all: 12-product-
 * tiers.md §7.2 is explicit this product is sold, not self-served — a tier
 * change is a sales conversation the club has with Fydr, never a toggle
 * the club flips itself.
 */

export async function updateOrgDetails(
  db: Db,
  orgId: string,
  input: { name: string; sport: OrgSport; timezone: string; countryCode: string },
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('organisations')
    .update({ name: input.name, sport: input.sport, timezone: input.timezone, country_code: input.countryCode })
    .eq('id', orgId);
  return { error: error?.message ?? null };
}
