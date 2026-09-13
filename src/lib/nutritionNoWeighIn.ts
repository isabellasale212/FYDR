/* PATTERN-S5 C7 (2026-09-13): the profile's nutrition card when the athlete
 * has no weigh-in on record. Targets are per kilogram, so nothing can be
 * scaled to them — but the resolver (0019, 04-data-model §17.3) still serves
 * a target: the club's absolute default, or an absolute personal or group
 * target written at assignment. The card used to say "this plan needs a
 * weigh-in" above numbers it was showing anyway. It now says what the numbers
 * are and whose. The board's alternative — four dashes and exclusion — is a
 * decision on the sheet (S5 C7, resolved side); the sentence here is true
 * under today's model. Pure; exercised by scripts/test-profile-empty-panels.ts. */
export function noWeighInLine(o: { firstName: string; sourceScope: string }): string {
  if (o.sourceScope === 'squad_default') {
    return `No weigh-in on record, so these are the club default figures, not scaled to ${o.firstName}. Targets are per kilogram; a weigh-in scales them.`;
  }
  return `No weigh-in on record: these figures were set as absolute targets, not scaled to ${o.firstName}. Targets are per kilogram; a weigh-in scales them.`;
}
