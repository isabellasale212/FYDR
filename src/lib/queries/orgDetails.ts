import type { Db } from './groups';
import type { OrgSport } from '@/lib/types/database';
import { mustAffect } from '@/lib/write';

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
  /* G-36. organisations UPDATE is the sport scientist's alone (§3.6). The
     screen already hides this behind isAdmin, so this is the second lock. */
  return mustAffect(
    db
      .from('organisations')
      .update({ name: input.name, sport: input.sport, timezone: input.timezone, country_code: input.countryCode })
      .eq('id', orgId)
      .select('id'),
    { refusal: 'Not saved: club details belong to the sport scientist.' },
  );
}

/** The RPE club setting (migration 0118, 2026-09-13). The sport scientist's
 *  alone, the same organisations UPDATE policy as the details above; audited
 *  as its own action because switching it changes what every athlete is
 *  asked and what every load surface can show. */
export async function setCollectsRpe(
  db: Db,
  orgId: string,
  actorId: string,
  collectsRpe: boolean,
): Promise<{ error: string | null }> {
  const result = await mustAffect(
    db.from('organisations').update({ collects_rpe: collectsRpe }).eq('id', orgId).select('id'),
    { refusal: 'Not saved: the RPE setting belongs to the sport scientist.' },
  );
  if (result.error) return result;
  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    actor_role: 'sport_scientist',
    action: 'org.collects_rpe.changed',
    entity_type: 'organisation',
    entity_id: orgId,
    metadata: { collects_rpe: collectsRpe },
  });
  return { error: null };
}

/** PATTERN-S3 C8 (0122): whether a coach may read the body site and side of
 *  an open injury. Off by default. The sport scientist's; audited as its own
 *  action. Enforced by the injuries_staff view, which reads the column. */
export async function setCoachSeesInjurySite(db: Db, orgId: string, actorId: string, on: boolean): Promise<{ error: string | null }> {
  const result = await mustAffect(
    db.from('organisations').update({ coach_sees_injury_site: on }).eq('id', orgId).select('id'),
    { refusal: 'Not saved: this setting belongs to the sport scientist.' },
  );
  if (result.error) return result;
  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    actor_role: 'sport_scientist',
    action: 'org.coach_sees_injury_site.changed',
    entity_type: 'organisation',
    entity_id: orgId,
    metadata: { coach_sees_injury_site: on },
  });
  return { error: null };
}
