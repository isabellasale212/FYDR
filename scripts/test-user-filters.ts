/* PATTERN-S8 C3 (2026-09-13): the users list — search by name or email,
 * filters by role and status, a denominator on the count line, and a
 * card stack at 375 with no sideways table. */
import { readFileSync } from 'node:fs';
import { EMPTY_FILTER, filterUsers, parseUserFilter, userFilterSummary, ROLE_FILTERS, STATUS_FILTERS } from '@/lib/userFilters';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

type U = { full_name: string; email: string; roles: ('coach' | 'medic' | 'sport_scientist' | 'athlete' | 'strength_conditioning' | 'nutritionist')[]; status: 'active' | 'invited' | 'suspended' | 'deactivated' };
const users: U[] = [
  { full_name: 'Jane Pemberton', email: 'j.pemberton@ashcomberfc.example', roles: ['sport_scientist'], status: 'active' },
  { full_name: 'Peter Ackland', email: 'p.ackland@ashcomberfc.example', roles: ['coach'], status: 'active' },
  { full_name: 'Ruth Callaghan', email: 'r.callaghan@ashcomberfc.example', roles: ['medic'], status: 'active' },
  { full_name: 'Marcus Hale', email: 'm.hale@ashcomberfc.example', roles: ['coach'], status: 'invited' },
  { full_name: 'Dan Okonkwo', email: 'd.okonkwo@ashcomberfc.example', roles: ['athlete'], status: 'active' },
  { full_name: 'Old Coach', email: 'old@ashcomberfc.example', roles: ['coach'], status: 'deactivated' },
];

console.log('1. search, role, status');
{
  assert(filterUsers(users, EMPTY_FILTER).length === 6, 'no filter shows everyone');
  assert(filterUsers(users, { ...EMPTY_FILTER, q: 'okon' }).map((u) => u.full_name).join() === 'Dan Okonkwo', 'search matches a name');
  assert(filterUsers(users, { ...EMPTY_FILTER, q: 'M.HALE@' }).map((u) => u.full_name).join() === 'Marcus Hale', 'search matches an email, case-insensitively');
  assert(filterUsers(users, { ...EMPTY_FILTER, role: 'coach' }).length === 3, 'role filter: three coaches');
  assert(filterUsers(users, { ...EMPTY_FILTER, role: 'coach', status: 'active' }).length === 1, 'role and status combine');
  assert(filterUsers(users, { ...EMPTY_FILTER, status: 'invited' }).map((u) => u.full_name).join() === 'Marcus Hale', 'status filter: the outstanding invitation');
  assert(filterUsers(users, { q: 'callaghan', role: 'coach', status: 'all' }).length === 0, 'a search that matches nobody in the role is empty, not everyone');
}

console.log('\n2. the count line always carries its denominator');
{
  assert(userFilterSummary({ shown: 6, total: 6, filter: EMPTY_FILTER }) === '6 accounts', 'unfiltered: the total');
  assert(userFilterSummary({ shown: 3, total: 6, filter: { ...EMPTY_FILTER, role: 'coach' } }) === '3 of 6 accounts · coaches', 'filtered: shown of total, the filter in words');
  assert(userFilterSummary({ shown: 1, total: 6, filter: { q: 'hale', role: 'coach', status: 'invited' } }) === '1 of 6 accounts · coaches · invited, not yet signed in · matching "hale"', 'every active filter named');
  assert(userFilterSummary({ shown: 0, total: 6, filter: { ...EMPTY_FILTER, role: 'nutritionist' } }) === 'No account matches — nutritionists. Clear the filters to see all 6.', 'empty is a sentence with the way out, not "0"');
  assert(userFilterSummary({ shown: 1, total: 1, filter: EMPTY_FILTER }) === '1 account', 'singular noun');
}

console.log('\n3. the URL form');
{
  const f = parseUserFilter({ q: 'ok', role: 'coach', status: 'invited' });
  assert(f.q === 'ok' && f.role === 'coach' && f.status === 'invited', 'reads q, role and status');
  const g = parseUserFilter({ role: 'admin', status: 'gone' });
  assert(g.role === 'all' && g.status === 'all', 'an unknown role or status is "all", never a silent empty list');
  assert(parseUserFilter({ q: ['a', 'b'] }).q === 'a', 'a repeated param takes the first');
  assert(ROLE_FILTERS.map((r) => r.value).join() === 'all,sport_scientist,coach,strength_conditioning,medic,nutritionist,athlete', 'the six roles plus everyone');
  assert(STATUS_FILTERS.map((s) => s.value).join() === 'all,active,invited,suspended,deactivated', 'the four statuses plus any');
}

console.log('\n4. the panel and the phone');
{
  const panel = strip(read('src/components/UserManagementPanel/UserManagementPanel.tsx'));
  assert(/filterUsers\(users, filter\)/.test(panel) && /userFilterSummary\(/.test(panel), 'the panel filters through the module and reads the summary back');
  assert(/type="search"/.test(panel) && /ROLE_FILTERS\.map/.test(panel) && /STATUS_FILTERS\.map/.test(panel), 'a search field, role chips, status chips');
  assert(/aria-pressed=\{filter\.role === r\.value\}/.test(panel) && /aria-pressed=\{filter\.status === s\.value\}/.test(panel), 'the chips say which is on');
  assert(/className="um-row"/.test(panel) && !/gridTemplateColumns: '1fr auto auto'/.test(panel), 'the row is a class, not an inline grid');
  assert(/Clear filters/.test(panel) && /setFilter\(EMPTY_FILTER\)/.test(panel), 'the empty state has a way out');
  const page = strip(read('src/app/(staff)/settings/users/page.tsx'));
  assert(/parseUserFilter\(/.test(page) && /initialFilter=/.test(page), 'the page reads ?q=&role=&status= so a link can land filtered');
  const css = strip(read('src/styles/base.css'));
  assert(/\.um-row\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) auto auto/.test(css), 'desktop: name, chips, status in one row');
  assert(/@media \(max-width: 767px\) \{[^}]*\.um-row\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/.test(css), 'phone: the row stacks into a card, nothing scrolls sideways');
  assert(/\.um-filters\s*\{/.test(css) && /\.um-filters \.field\s*\{[^}]*min-height: 44px/.test(css), 'the search field is 44px');
  assert(/search by name or email/i.test(read('docs/screens/48-users.md')) && /card/i.test(read('docs/screens/48-users.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
