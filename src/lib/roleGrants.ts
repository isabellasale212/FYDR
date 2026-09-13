/* PATTERN-S8 C4 (2026-09-13): what a role change grants and what it removes,
 * said before the button, from access.ts's own sets — never a second
 * opinion typed next to the chips. Each capability below IS a set in
 * access.ts with the sentence a sport scientist reads for it; the preview
 * takes the union over the roles held before and after and diffs the two,
 * because roles are additive and a person with two roles has the union.
 * Pure: the detail panel and the guard read the same thing. */

import {
  ALL_STAFF,
  ANALYTICS,
  ATHLETE_BIO_EDIT,
  ATHLETE_GYM,
  AVAILABILITY_EDIT,
  BODY_MASS_VIEW,
  CLINICAL_ONLY,
  ENTRY_CORRECTION,
  FLAG_EDIT_ANY_DOMAIN,
  GPS_IMPORT,
  GROUP_EDIT,
  INJURY_ACCESS,
  LEADERBOARD_EDIT,
  MEAL_LIBRARY_EDIT,
  NUTRITION_EDIT,
  PROGRAMME_EDIT,
  REHAB_ALLOCATION,
  REHAB_PROGRAMME,
  REPORT_ACCESS,
  REPORT_VISIBILITY,
  SESSION_EDIT,
  SETTINGS_ADMIN,
  THRESHOLD_EDIT,
  WEIGH_IN_EDIT,
  hasAnyRole,
} from '@/lib/access';
import type { AppRole } from '@/lib/types/database';

export type Capability = { key: string; label: string; roles: readonly AppRole[] };

/** In the order the preview lists them: the widest first, the clinical
 *  boundary last so it is read. The athlete role is not a staff set: it
 *  opens the athlete app for the person's own record and nothing here. */
export const CAPABILITIES: readonly Capability[] = [
  { key: 'staff', label: 'The staff app: squad, schedule, wellness and nutrition screens', roles: ALL_STAFF },
  { key: 'reports_all', label: 'The compliance and injury reports', roles: REPORT_VISIBILITY.compliance },
  { key: 'reports', label: 'The training, athlete, squad weekly and testing reports, and exports', roles: REPORT_ACCESS },
  { key: 'injury', label: 'Injury records: body area, status, restrictions and expected return', roles: INJURY_ACCESS },
  { key: 'athlete_gym', label: "An athlete's gym screen, where rehab work shows", roles: ATHLETE_GYM },
  { key: 'flags', label: 'Acting on flags in every domain', roles: FLAG_EDIT_ANY_DOMAIN },
  { key: 'sessions', label: 'Creating and editing sessions and week templates', roles: SESSION_EDIT },
  { key: 'thresholds', label: 'Thresholds', roles: THRESHOLD_EDIT },
  { key: 'groups', label: 'Creating, renaming and archiving groups', roles: GROUP_EDIT },
  { key: 'availability', label: "Setting an athlete's availability", roles: AVAILABILITY_EDIT },
  { key: 'bio', label: "Editing an athlete's profile", roles: ATHLETE_BIO_EDIT },
  { key: 'corrections', label: "Correcting an athlete's entries", roles: ENTRY_CORRECTION },
  { key: 'programmes', label: 'Gym programmes and the exercise library', roles: PROGRAMME_EDIT },
  { key: 'rehab_programmes', label: 'Rehab programmes', roles: REHAB_PROGRAMME },
  { key: 'rehab_allocation', label: 'Allocating an athlete to a rehab group', roles: REHAB_ALLOCATION },
  { key: 'leaderboards', label: 'Creating and editing leaderboards', roles: LEADERBOARD_EDIT },
  { key: 'nutrition', label: 'Nutrition targets', roles: NUTRITION_EDIT },
  { key: 'meals', label: 'The meal library', roles: MEAL_LIBRARY_EDIT },
  { key: 'body_mass', label: 'Body mass: seeing weigh-ins and the latest figure', roles: BODY_MASS_VIEW },
  { key: 'weigh_in', label: 'Recording a weigh-in', roles: WEIGH_IN_EDIT },
  { key: 'analytics', label: 'Analytics', roles: ANALYTICS },
  { key: 'gps', label: 'GPS imports', roles: GPS_IMPORT },
  { key: 'settings_admin', label: 'Users, the audit log, data retention, subject access release and club details', roles: SETTINGS_ADMIN },
  { key: 'clinical', label: 'Clinical detail: diagnosis, mechanism, severity, treatment notes, and the clinical review of a subject access request', roles: CLINICAL_ONLY },
];

export function capabilitiesFor(roles: readonly AppRole[]): Capability[] {
  return CAPABILITIES.filter((c) => hasAnyRole(roles, c.roles));
}

export const ROLE_WORDS: Record<AppRole, string> = {
  sport_scientist: 'Sport scientist',
  coach: 'Coach',
  medic: 'Medic',
  strength_conditioning: 'S&C',
  nutritionist: 'Nutritionist',
  athlete: 'Athlete',
};

export type RoleChangePreview = {
  /** "Adding Coach", "Removing Medic", "Adding Coach, removing Nutritionist". */
  heading: string;
  /** One line: what it gains and what it removes, with the counts. */
  sentence: string;
  gains: string[];
  loses: string[];
  keeps: number;
  /** The standing rules this change trips, in full sentences. */
  warnings: string[];
};

const list = (roles: AppRole[]) => roles.map((r) => ROLE_WORDS[r]).join(', ');
const things = (n: number) => `${n} thing${n === 1 ? '' : 's'}`;

export function roleChangePreview(current: readonly AppRole[], next: readonly AppRole[]): RoleChangePreview | null {
  const added = next.filter((r) => !current.includes(r));
  const removed = current.filter((r) => !next.includes(r));
  if (added.length === 0 && removed.length === 0) return null;

  const before = capabilitiesFor(current);
  const after = capabilitiesFor(next);
  const gains = after.filter((c) => !before.some((b) => b.key === c.key)).map((c) => c.label);
  const loses = before.filter((c) => !after.some((a) => a.key === c.key)).map((c) => c.label);
  const keeps = after.filter((c) => before.some((b) => b.key === c.key)).length;

  const parts: string[] = [];
  if (added.length) parts.push(`Adding ${list(added)}`);
  if (removed.length) parts.push(`removing ${list(removed)}`);
  const heading = parts.join(', ').replace(/^removing/, 'Removing');

  const gainWords = gains.length ? `gains ${things(gains.length)}` : 'gains nothing';
  const loseWords = loses.length ? `removes ${things(loses.length)}` : 'removes nothing';
  const sentence = `${gainWords} and ${loseWords}${keeps ? `; ${things(keeps)} unchanged` : ''}.`;

  const warnings: string[] = [];
  const staffAfter = next.filter((r) => r !== 'athlete');
  if (next.includes('nutritionist') && hasAnyRole(next, INJURY_ACCESS) && !(current.includes('nutritionist') && hasAnyRole(current, INJURY_ACCESS))) {
    warnings.push('Roles add up. With this, the nutritionist reads injury information — availability, body area, restrictions — that the nutritionist role alone withholds. That is the rule the nutritionist role exists to keep; grant it only if this person should read it.');
  }
  if (next.includes('nutritionist') && staffAfter.length === 1 && current.some((r) => INJURY_ACCESS.includes(r as (typeof INJURY_ACCESS)[number]))) {
    warnings.push('Left as a nutritionist alone, they no longer read injury information or the squad weekly, training, athlete and testing reports.');
  }
  if (staffAfter.length === 0 && next.includes('athlete')) {
    warnings.push('With only the athlete role, they open the athlete app for their own record and nothing in the staff app.');
  }
  if (next.length === 0) {
    warnings.push('With no role at all, they can sign in and reach nothing. Deactivate the account instead if their access should end.');
  }
  if (removed.includes('medic') && !next.includes('medic')) {
    warnings.push('Clinical records they wrote stay, with their name against them; they can no longer open them.');
  }
  return { heading, sentence, gains, loses, keeps, warnings };
}

/** The standing sentence under every preview: when it applies and where it
 *  is written. The claims version bumps on any role change (migration
 *  0010's trigger), so the next request carries the new roles. */
export const ROLE_CHANGE_EFFECT = 'Takes effect on their next page load — a screen they already have open stays until they move — and is written to the audit log with your name against it.';
