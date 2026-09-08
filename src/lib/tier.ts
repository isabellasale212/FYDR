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

/** The GPS prefix every metric_definitions key sourced from gps_records carries.
 *  With the dot: a key merely beginning "gps" is not a GPS metric. */
const GPS_PREFIX = 'gps.';

/**
 * Must this metric be withheld from this club's plan?
 *
 * WHY THIS IS A FUNCTION AND NOT A FOURTH COPY OF THE CONDITION. The rule
 * `metric_key.startsWith('gps.') && !isPremium(tier)` already existed twice in
 * the staff tree — leaderboards/new filters the catalogue with it,
 * leaderboards/[leaderboardId] gates the page with it — and Q-29 found the two
 * athlete board screens missing it entirely. Adding it inline twice more is how
 * this repository ended up with the minor-age threshold written in three places
 * (see migration 0093's header). One function, unit tested on real tier values.
 *
 * FAILS CLOSED for the same reason isPremium does: an equality check against
 * 'performance' rather than a negation of 'core', so a tier value this build has
 * never seen is treated as the lower plan rather than the higher one. On the
 * athlete screens there is a second layer under it — requireAthlete() defaults a
 * missing tier to 'core'.
 *
 * COMMERCIAL, NOT AUTHORISATION, and worth saying so. GPS is a Premium upsell
 * (docs/12-product-tiers.md §2: "The client put it behind Premium explicitly"),
 * not medical data. This is the right altitude for that — a page-level check,
 * the same altitude both staff GPS surfaces use. It is genuinely not
 * server-enforced: leaderboards/new's own header concedes a direct PostgREST
 * insert could still create a GPS board on a Basic org, and closing that
 * properly needs the tier inside compute_leaderboard. Named here rather than
 * papered over, exactly as that file names it.
 */
export function gpsMetricBlocked(metricKey: string, tier: Tier): boolean {
  return metricKey.startsWith(GPS_PREFIX) && !isPremium(tier);
}
