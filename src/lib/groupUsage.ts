/* PATTERN-S8 C5 (2026-09-13): what renaming or archiving a group does to
 * the things that use it, in full sentences, before the button. The counts
 * come from queries/groups.ts's fetchGroupUsage; this turns them into the
 * consequence a coach reads. What archiving DOES NOT stop is stated,
 * because it is the surprise: membership rows are untouched, so sessions,
 * programme assignments and group nutrition targets keep resolving through
 * them (schedule.ts's expected-attendee walk and resolve_nutrition_targets
 * read group_memberships, never groups.deleted_at). Pure. */

export type GroupUsage = {
  members: number;
  sessionsUpcoming: number;
  sessionsPast: number;
  programmesActive: number;
  nutritionTargets: number;
  nutritionRules: number;
  leaderboards: number;
  thresholds: number;
};

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
const joinList = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/** Every current use, as "2 upcoming sessions", "1 nutrition target"… */
export function groupUseParts(u: GroupUsage): string[] {
  const parts: string[] = [];
  if (u.sessionsUpcoming) parts.push(n(u.sessionsUpcoming, 'upcoming session', 'upcoming sessions'));
  if (u.programmesActive) parts.push(n(u.programmesActive, 'active programme assignment', 'active programme assignments'));
  if (u.nutritionTargets) parts.push(n(u.nutritionTargets, 'nutrition target', 'nutrition targets'));
  if (u.nutritionRules) parts.push(n(u.nutritionRules, 'nutrition rule', 'nutrition rules'));
  if (u.leaderboards) parts.push(n(u.leaderboards, 'leaderboard', 'leaderboards'));
  if (u.thresholds) parts.push(n(u.thresholds, 'threshold', 'thresholds'));
  return parts;
}

export function isGroupInUse(u: GroupUsage): boolean {
  return groupUseParts(u).length > 0;
}

/** Above the rename form's Save. */
export function renameConsequence(name: string, u: GroupUsage): string {
  const parts = groupUseParts(u);
  const past = u.sessionsPast ? ` and ${n(u.sessionsPast, 'past session', 'past sessions')}` : '';
  if (parts.length === 0 && !u.sessionsPast) return `Nothing uses ${name} yet, so the new name appears only in the group filter and on its members.`;
  if (parts.length === 0) return `Renaming ${name} changes the name on ${n(u.sessionsPast, 'past session', 'past sessions')} too — the schedule shows the new name, not the one it had. Nothing else changes.`;
  return `${name} is in use. Renaming it changes the name on ${joinList(parts)}${past}, the schedule and the filter — everywhere it appears, including in the past. Nothing else changes: who is in it, what they are expected at and what they are prescribed all stay.`;
}

/** The lines in the archive card, in reading order: what stops, what does
 *  not stop, what is untouched. */
export function archiveConsequence(name: string, u: GroupUsage): { lead: string; keeps: string[]; note: string } {
  const lead = `Archiving ${name} removes it from the group filter, from every picker and from the groups list. Anyone filtering by it sees Whole squad and is told why. Its ${n(u.members, 'member stays', 'members stay')} in the squad; nothing about them is deleted.`;
  const keeps: string[] = [];
  if (u.sessionsUpcoming) keeps.push(`${n(u.sessionsUpcoming, 'upcoming session still expects', 'upcoming sessions still expect')} its members. Expectations follow membership, and archiving does not remove anyone from the group.`);
  if (u.programmesActive) keeps.push(`${n(u.programmesActive, 'active programme assignment keeps', 'active programme assignments keep')} running for its members until it ends or is ended.`);
  if (u.nutritionTargets) keeps.push(`${n(u.nutritionTargets, 'nutrition target keeps', 'nutrition targets keep')} applying to its members.`);
  if (u.nutritionRules) keeps.push(`${n(u.nutritionRules, 'nutrition rule keeps', 'nutrition rules keep')} applying to its members.`);
  if (u.leaderboards) keeps.push(`${n(u.leaderboards, 'leaderboard keeps', 'leaderboards keep')} ranking its members.`);
  if (u.thresholds) keeps.push(`${n(u.thresholds, 'threshold keeps', 'thresholds keep')} flagging its members.`);
  const note = u.sessionsPast
    ? `${n(u.sessionsPast, 'past session keeps', 'past sessions keep')} the group in their record. Restore brings the group back exactly as it was.`
    : 'Restore brings the group back exactly as it was.';
  return { lead, keeps, note };
}
