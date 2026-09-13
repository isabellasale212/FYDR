/* §0ae's two refusals, in the app's own controls — the courtesy in front of
 * the database's rule.
 *
 * The rule itself is user_roles_guard (0101, 0102), pinned by pgTAP 570 and
 * 580. What this pins is that the panels stop a person hitting it: the
 * self-row "Medic" chip is disabled when not held, the self-row "Sport
 * scientist" chip is disabled when it is the org's only one, and setUserRoles
 * says why in words before the database says it in its own.
 */
import { readFileSync } from 'node:fs';
import { ROLE_REFUSALS, roleToggleRefusal } from '@/lib/queries/userManagement';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (p: string): string => strip(readFileSync(p, 'utf8'));

console.log('the rule, as the chips read it');
{
  assert(roleToggleRefusal('medic', false, true, 2) === ROLE_REFUSALS.selfMedic, 'self, medic not held: refused — granting it to yourself');
  assert(roleToggleRefusal('medic', true, true, 2) === null, 'self, medic held: allowed — removing it from yourself is fine');
  assert(roleToggleRefusal('medic', false, false, 1) === null, 'someone else, medic: allowed — the decision keeps grants to others');
  assert(roleToggleRefusal('sport_scientist', true, true, 1) === ROLE_REFUSALS.lastAdmin, 'self, the only sport scientist: refused');
  assert(roleToggleRefusal('sport_scientist', true, true, 2) === null, 'self, one of two: allowed');
  assert(roleToggleRefusal('sport_scientist', true, false, 1) === null, "someone else's only-admin row: the chip is not disabled here — setUserRoles and the database refuse it with the message");
  assert(roleToggleRefusal('coach', false, true, 1) === null, 'self, any other role: allowed');
}

console.log('\nboth panels use it, and the pages supply the count');
{
  const detail = read('src/components/UserDetailPanel/UserDetailPanel.tsx');
  const list = read('src/components/UserManagementPanel/UserManagementPanel.tsx');
  const page = read('src/app/(staff)/settings/users/[userId]/page.tsx');
  /* PATTERN-S8 C4 (2026-09-13): the list no longer toggles roles — it
     states them and links to the account page — so only the detail panel
     asks the rule; and a refused chip is a BlockedButton (aria-disabled,
     the reason on tap or focus), never `disabled` + `title`, which the
     constitution rules out. */
  assert(/roleToggleRefusal\(role, /.test(detail), 'UserDetailPanel asks roleToggleRefusal for every chip');
  assert(/blocked=\{blocked !== null \|\| busyRoles\}/.test(detail) && /reason=\{blocked \?\? 'Saving…'\}/.test(detail), 'UserDetailPanel blocks the chip on a refusal and says why on tap');
  assert(!/title=\{refusal/.test(detail) && !/disabled=\{busyRole === role/.test(detail), 'never in a title, never the disabled attribute');
  assert(!/roleToggleRefusal|setUserRoles/.test(list) && /chip-static/.test(list), 'UserManagementPanel states roles and does not write them');
  assert(/fetchSportScientistCount\(db, orgId\)/.test(page) && /sportScientistCount=\{sportScientistCount\}/.test(page), 'the detail page counts sport_scientist rows and passes the count');
}

console.log('\nsetUserRoles says it first');
{
  const q = read('src/lib/queries/userManagement.ts');
  assert(/targetUserId === actorId && next\.has\('medic'\) && !current\.has\('medic'\)/.test(q), 'a self-grant of medic is refused before any write');
  assert(/return \{ error: ROLE_REFUSALS\.selfMedic/.test(q) && /return \{ error: ROLE_REFUSALS\.lastAdmin/.test(q), 'with the same words the chips carry');
  assert(ROLE_REFUSALS.selfMedic.includes('medic'), 'and the words name the role');
}

console.log('\n§0bd (0109): the account guard\'s refusals reach the screen as sentences');
{
  const q = readFileSync('src/lib/queries/userManagement.ts', 'utf8');
  assert(/export const STATUS_REFUSALS = \{/.test(q), 'STATUS_REFUSALS names the three');
  assert(/users_self_update_profile_only/.test(q) && /own status/.test(q), 'a self status change: "you cannot change your own status"');
  assert(/last sport scientist/.test(q) && /last active sport scientist|only active sport scientist/.test(q), 'the last-sport-scientist account: said in words');
  assert(/users_admin_update_no_identity/.test(q), 'the identity refusal');
  const fn = q.slice(q.indexOf('export async function setUserStatus'), q.indexOf('\nexport ', q.indexOf('export async function setUserStatus') + 10));
  assert(/onError: statusRefusal/.test(fn) || /onError: \(m\) => statusRefusal\(m\)/.test(fn), 'setUserStatus maps the trigger\'s message through them');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
