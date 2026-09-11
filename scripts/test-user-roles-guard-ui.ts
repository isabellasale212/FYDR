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
  for (const [name, src] of [['UserDetailPanel', detail], ['UserManagementPanel', list]] as const) {
    assert(/roleToggleRefusal\(role, /.test(src), `${name} asks roleToggleRefusal for every chip`);
    assert(/disabled=\{busyRole === role \|\| [^}]*refusal !== null\}/.test(src), `${name} disables the chip on a refusal`);
    assert(/title=\{refusal \?\? undefined\}/.test(src), `${name} says why in the chip's title`);
  }
  assert(/fetchSportScientistCount\(db, orgId\)/.test(page) && /sportScientistCount=\{sportScientistCount\}/.test(page), 'the detail page counts sport_scientist rows and passes the count');
  assert(/u\.roles\.includes\('sport_scientist'\)/.test(list) && /sportScientistCount=\{sportScientistCount\}/.test(list), 'the list panel derives the count from the same list its rows render from');
}

console.log('\nsetUserRoles says it first');
{
  const q = read('src/lib/queries/userManagement.ts');
  assert(/targetUserId === actorId && next\.has\('medic'\) && !current\.has\('medic'\)/.test(q), 'a self-grant of medic is refused before any write');
  assert(/return \{ error: ROLE_REFUSALS\.selfMedic/.test(q) && /return \{ error: ROLE_REFUSALS\.lastAdmin/.test(q), 'with the same words the chips carry');
  assert(ROLE_REFUSALS.selfMedic.includes('medic'), 'and the words name the role');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
