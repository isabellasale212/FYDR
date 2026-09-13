/* PATTERN-S8 C1 (2026-09-13): the setup checklist — five steps with a count
 * and a done / outstanding state; a list of remaining defaults, not a gate.
 * D8: no creator means default. */
import { readFileSync } from 'node:fs';
import { setupDashboardLine, setupSteps, setupSummary, type SetupCounts } from '@/lib/setupChecklist';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fresh: SetupCounts = { athletes: 0, groups: 0, athletesInNoGroup: 0, thresholdsActive: 0, thresholdsDefault: 0, staffAccounts: 0, staffSignedIn: 0, staffInvited: 0, accountsWithoutRole: 0 };
const board: SetupCounts = { athletes: 30, groups: 5, athletesInNoGroup: 3, thresholdsActive: 6, thresholdsDefault: 6, staffAccounts: 7, staffSignedIn: 6, staffInvited: 1, accountsWithoutRole: 1 };

console.log('1. the five steps, the board\'s numbers');
{
  const s = setupSteps(board, 'Ashcombe');
  assert(s.map((x) => x.title).join(' · ') === 'Add athletes · Make groups · Set thresholds · Invite staff · Assign roles', 'five steps, in the order that saves the most rework');
  assert(s[0]!.done && s[0]!.count === '30 athletes' && s[0]!.href === '/squad', 'athletes: done, 30');
  assert(s[1]!.done && s[1]!.count === '5 groups · 3 athletes in none', 'groups: done, and who is in none');
  assert(!s[2]!.done && s[2]!.count === '0 of 6 lines changed — all Fydr defaults' && s[2]!.href === '/settings/thresholds', 'thresholds: outstanding while every line is a default (D8)');
  assert(!s[3]!.done && s[3]!.state === '1 invitation outstanding' && s[3]!.count === '6 of 7 accounts signed in' && s[3]!.href === '/settings/users?status=invited', 'staff: the outstanding invitation, linking the list filtered to it');
  assert(!s[4]!.done && s[4]!.count === '1 account has no role', 'roles: the account with none');
  const sum = setupSummary(s);
  assert(sum.count === '2 of 5 done' && !sum.complete && sum.mattersMost?.key === 'thresholds', '2 of 5 done; thresholds is the one that matters most');
  assert(setupDashboardLine(sum, 'Ashcombe') === 'Getting Ashcombe set up: 2 of 5 done. Set thresholds is still outstanding — every colour and flag on this dashboard is a Fydr default, not yours.', 'the dashboard line names the step and its cost');
}

console.log('\n2. a fresh club, and a finished one');
{
  const f = setupSteps(fresh, 'New FC');
  assert(f.every((x) => !x.done) && f[0]!.count === 'No athletes yet' && f[0]!.href === '/squad/new' && f[2]!.count === 'No thresholds — nothing raises a flag', 'nothing done: each step says so and points at the door');
  assert(setupSummary(f).mattersMost?.key === 'thresholds', 'thresholds still leads, ahead of the order');
  const done = setupSteps({ ...board, thresholdsDefault: 2, staffInvited: 0, staffSignedIn: 7, accountsWithoutRole: 0 }, 'Ashcombe');
  const sum = setupSummary(done);
  assert(sum.complete && sum.count === '5 of 5 done' && setupDashboardLine(sum, 'Ashcombe') === null, 'all five done: the dashboard line goes; the page stays');
  assert(done[2]!.count === "4 lines of 6 Ashcombe's own", 'thresholds done once one line is the club\'s own');
}

console.log('\n3. the screens');
{
  const q = strip(read('src/lib/queries/setupChecklist.ts'));
  assert(/\.is\('created_by', null\)/.test(q) && /eq\('is_active', true\)/.test(q), 'a default threshold is one with no creator (D8), among the active');
  const page = strip(read('src/app/(staff)/settings/setup/page.tsx'));
  assert(/hasAnyRole\(claims\.roles, SETTINGS_ADMIN\)/.test(page) && /setupSteps\(counts, orgName\)/.test(page) && /not a gate/.test(page), 'the page: the sport scientist\'s, the steps, "not a gate"');
  assert(/The one that matters most/.test(page) && /summary\.mattersMost\?\.key === 'thresholds'/.test(page), 'the thresholds consequence card when thresholds are outstanding');
  const hub = strip(read('src/lib/settingsHub.ts'));
  assert(/key: 'setup', label: 'Setup checklist'/.test(hub) && /\$\{o\.counts\.setup\.done\} of \$\{o\.counts\.setup\.total\} done/.test(hub), 'the hub\'s Club group carries the row with its denominator');
  const dash = strip(read('src/app/(staff)/dashboard/page.tsx'));
  assert(/setupDashboardLine\(/.test(dash) && /className="card setup-line" role="status"/.test(dash) && /Continue setup/.test(dash), 'the dashboard: one status line, not the emphasised card');
  assert(/gate/i.test(read('docs/screens/64-club-setup.md')) && /setup/.test(read('docs/20-route-map.md')), 'the spec and the route map say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
