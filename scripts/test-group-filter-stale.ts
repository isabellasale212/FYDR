/* PATTERN-S8 D9 + §0ak (2026-09-13, Isabella's ruling): an unresolvable group
 * id — an archived group still named by the sticky cookie or a shared link —
 * is dropped from the scope on every request, the cookie is rewritten without
 * it, and the shell says so once; nothing renders "1 unknown group". Before
 * this, archiving set groups.deleted_at only, memberships stayed live, and a
 * cookie naming the archived group kept scoping every screen to its athletes
 * while the chip row could not show it. */
import { readFileSync } from 'node:fs';
import { dropUnresolvable, groupScopeLabel, staleFilterLine } from '@/lib/groupFilter';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the rule');
{
  const live = new Set(['a', 'b']);
  assert(JSON.stringify(dropUnresolvable(['a', 'x'], live)) === JSON.stringify({ groupIds: ['a'], dropped: ['x'] }), 'an unresolvable id is dropped, the live one kept');
  assert(JSON.stringify(dropUnresolvable(['x'], live)) === JSON.stringify({ groupIds: [], dropped: ['x'] }), 'only unresolvable ids: the scope is the whole squad');
  assert(JSON.stringify(dropUnresolvable(['a', 'b'], live)) === JSON.stringify({ groupIds: ['a', 'b'], dropped: [] }), 'all live: nothing dropped');
  assert(JSON.stringify(dropUnresolvable(['a', 'x'], null)) === JSON.stringify({ groupIds: ['a', 'x'], dropped: [] }), 'when the live set cannot be read nothing is dropped — never guess');
  assert(groupScopeLabel([{ id: 'a', name: 'Forwards' }], ['a', 'x']) === 'Forwards', 'the scope label never says "unknown group": an id it cannot name is not named');
  assert(groupScopeLabel([{ id: 'a', name: 'Forwards' }], ['x']) === 'Whole squad', 'and with nothing it can name the scope is the whole squad');
  assert(staleFilterLine({ droppedNames: ['Leadership'], scopeLabel: 'Whole squad' }) === 'Filter updated: Leadership was archived. Showing Whole squad.', 'the one sentence, one group');
  assert(staleFilterLine({ droppedNames: ['Leadership', 'Colts'], scopeLabel: 'Forwards' }) === 'Filter updated: Leadership and Colts were archived. Showing Forwards.', 'two groups');
  assert(staleFilterLine({ droppedNames: [], scopeLabel: 'Forwards' }) === 'Filter updated: a group that no longer exists was removed from it. Showing Forwards.', 'a name the app cannot find any more');
}

console.log('\n2. the server resolves against live groups, on every request');
{
  const server = strip(read('src/lib/groupFilter.server.ts'));
  assert(/const liveGroupIds = cache\(async \(\)/.test(server) && /\.from\('groups'\)\s*\.select\('id'\)\s*\.is\('deleted_at', null\)/.test(server), 'one request-scoped read of the live group ids');
  assert(/export async function resolveGroupFilterDetailed\(/.test(server) && /dropUnresolvable\(requested, live\)/.test(server), 'resolveGroupFilterDetailed drops unresolvable ids');
  assert(/export async function resolveGroupFilter\(value[^)]*\)[^{]*\{\s*return \(await resolveGroupFilterDetailed\(value\)\)\.groupIds;\s*\}/.test(server), 'and resolveGroupFilter — every page and route — is that, so no caller changes and none can miss it');
  const layout = strip(read('src/app/(staff)/layout.tsx'));
  assert(/resolveGroupFilterDetailed\(undefined\)/.test(layout) && /<StaleGroupFilter valid=\{filter\.groupIds\} droppedNames=\{droppedNames\} scopeLabel=\{groupLabel\} \/>/.test(layout), 'the staff shell rewrites the cookie and says so, once per page load, when the cookie held a stale id');
  const sync = strip(read('src/components/StaleGroupFilter/StaleGroupFilter.tsx'));
  assert(/^'use client';/.test(sync.trimStart()) && /writeGroupFilterCookie\(valid\)/.test(sync) && /role="status"/.test(sync) && /staleFilterLine\(/.test(sync), 'the client writes the cleaned cookie through the one writer and announces the sentence once');
  const groups = strip(read('src/lib/queries/groups.ts'));
  assert(/export async function fetchGroupNames\(/.test(groups) && /\.in\('id', \[\.\.\.ids\]\)/.test(groups) && !/fetchGroupNames[\s\S]{0,400}deleted_at/.test(groups), 'the archived names are read by id, deleted or not, for the sentence');
  assert(/unresolvable group id/i.test(read('docs/06-design-system.md')) || /unresolvable group id/i.test(read('docs/access-matrix.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
