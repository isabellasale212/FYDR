import type { Database } from '@/lib/types/database';

/* organisations.tier — real column (migration 0002), real enum
 * ('core' | 'performance', migration 0001), never read by application code
 * until SETTINGS-SPEC.md gave it a screen. This file is the one place the
 * raw DB values meet the spec's own UI labels ("Basic" and "Premium") —
 * every other file imports isPremium()/tierLabel() rather than comparing
 * the raw string, the same discipline enumLabel() enforces for every other
 * enum in this app.
 *
 * 12-product-tiers.md §2 recommends renaming the enum labels themselves to
 * 'club'/'premium' to match the client's own words. Not done here — that's
 * a real, cross-cutting migration (the doc's own §2.1 lists five other
 * places a rename has to reach by hand: Zod schemas, Edge Functions, seed
 * data, JWT claims, saved jsonb) and this pass only needed the UI label,
 * not the storage rename. The spec's "Basic" is this file's label for
 * 'core' — the doc's own recommended "Club" name is one word away and
 * either would be a legitimate choice; "Basic" is what the design spec
 * that drove this build actually says, so that's what ships.
 *
 * §2's "fail-closed rule": an unrecognised tier value is always treated as
 * the lower tier, never the higher one. There is exactly one real value
 * this can't happen with today ('core' | 'performance' is the whole enum),
 * but isPremium() is written as an explicit equality check against
 * 'performance' rather than a negation of 'core', so a future third tier
 * value fails closed by construction instead of by remembering to update
 * this function. */

export type Tier = Database['public']['Enums']['subscription_tier'];

export function isPremium(tier: Tier): boolean {
  return tier === 'performance';
}

export function tierLabel(tier: Tier): 'Basic' | 'Premium' {
  return isPremium(tier) ? 'Premium' : 'Basic';
}
