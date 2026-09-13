/* PATTERN-S8 C7 (2026-09-13): the audit log's filters as a sheet on a
 * phone (the button reads back the count it will show), a person filter,
 * the header carrying the active filter count. */
import { readFileSync } from 'node:fs';
import { activeFilterCount, filtersButtonLabel, showEntriesLabel } from '@/lib/auditFilterWords';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the active count');
{
  const none = { type: '', from: '', to: '', actor: '', athlete: '', q: '', allTime: false, usingDefaultWindow: true };
  assert(activeFilterCount(none) === 0, 'the 30-day default is not a filter the person chose');
  assert(activeFilterCount({ ...none, usingDefaultWindow: false, from: '2026-09-01' }) === 1, 'a chosen date is one');
  assert(activeFilterCount({ ...none, usingDefaultWindow: false, from: '2026-09-01', to: '2026-09-13' }) === 1, 'from and to are one filter, the range');
  assert(activeFilterCount({ ...none, usingDefaultWindow: false, allTime: true }) === 1, 'all time is a choice too');
  assert(activeFilterCount({ ...none, type: 'route', actor: 'u1', athlete: 'a1', q: 'D-1' }) === 4, 'kind, person, athlete, search');
  assert(filtersButtonLabel(0) === 'Filters' && filtersButtonLabel(3) === 'Filters · 3', 'the button carries the count');
}

console.log('\n2. the button reads back what it will show');
{
  assert(showEntriesLabel(null, true) === 'Counting…', 'while counting');
  assert(showEntriesLabel(null, false) === 'Show entries', 'before any count');
  assert(showEntriesLabel(128, false) === 'Show 128 entries' && showEntriesLabel(1, false) === 'Show 1 entry' && showEntriesLabel(1988, false) === 'Show 1,988 entries', 'the count with its noun');
  assert(showEntriesLabel(0, false) === 'Show — nothing matches', 'zero is a sentence, never a bare 0');
}

console.log('\n3. the screens');
{
  const comp = strip(read('src/components/AuditLogFilters/AuditLogFilters.tsx'));
  assert(/className="card audit-filters-desktop"/.test(comp) && /className="audit-filters-phone"/.test(comp), 'the same state rendered for desktop and for the phone');
  assert(/className="ph-sheet-scrim"/.test(comp) && /className="ph-sheet audit-sheet" role="dialog" aria-modal="true"/.test(comp), 'the phone form is the shell\'s sheet pattern: scrim, dialog');
  assert(/filtersButtonLabel\(applied\)/.test(comp) && /aria-expanded=\{open\}/.test(comp), 'the opener carries the applied count');
  assert(/fetch\(`\/settings\/audit\/count\?\$\{search\.toString\(\)\}`/.test(comp) && /showEntriesLabel\(count, counting\)/.test(comp), 'the sheet asks the count route and the button reads it back');
  assert(/htmlFor=\{`\$\{prefix\}-actor`\}/.test(comp) && /All staff/.test(comp), 'the person filter');
  assert(/<option value="">Every kind<\/option>/.test(comp), 'the kind is a select inside the sheet');
  assert(/e\.key === 'Escape'/.test(comp), 'Escape closes it');
  const route = strip(read('src/app/(staff)/settings/audit/count/route.ts'));
  assert(/hasAnyRole\(claims\.roles, SETTINGS_ADMIN\)/.test(route) && /status: 403/.test(route) && /countAuditLog\(db, orgId, filters, timezone\)/.test(route), 'the count route is gated as the page is and counts the same filter');
  assert(/DEFAULT_WINDOW_DAYS = 30/.test(route), 'with the same 30-day default');
  const q = strip(read('src/lib/queries/auditLog.ts'));
  assert(/async function auditQuery\(/.test(q) && /export async function countAuditLog/.test(q) && (q.match(/auditQuery\(db, orgId, filters, timezone, (true|false)\)/g) ?? []).length === 2, 'one query builder, shared by the page and the count');
  const page = strip(read('src/app/(staff)/settings/audit/page.tsx'));
  assert(/activeFilterCount\(\{/.test(page) && /audit-active-pill/.test(page) && /\{active\} filter\{active === 1 \? '' : 's'\}/.test(page), 'the header carries the active count');
  assert(/className="chiprow audit-type-chips"/.test(page), 'the kind chips are named so the phone can hide them');
  const css = strip(read('src/styles/base.css'));
  assert(/@media \(max-width: 767px\) \{\s*\.audit-filters-desktop,\s*\.audit-type-chips \{\s*display: none;/.test(css) && /\.audit-filters-phone \{\s*display: flex;/.test(css), 'below 768 the card and chips go, the button and sheet come');
  assert(/\.audit-filters-open \{\s*min-height: 44px;/.test(css), 'the opener is 44px');
  assert(/sheet/i.test(read('docs/screens/51-audit-log.md')) && /count/i.test(read('docs/screens/51-audit-log.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
