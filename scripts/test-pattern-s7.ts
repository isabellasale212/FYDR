/* PATTERN-S7 — reports and analytics, the A item (2026-09-13). The record is
 * docs/overnight-records-2026-09-12.md (Step 1 answered from the code there).
 *
 *   A1 the reports index is grouped by what the question is about: "About the
 *      squad over a period" and "About one athlete, session or test"
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('A1. the index is grouped by what the question is about');
{
  const page = strip(read('src/app/(staff)/reports/page.tsx'));
  assert(/about: 'squad'/.test(page) && /about: 'one'/.test(page), 'each report says what it is about');
  assert(/const GROUPS = \[/.test(page) && /About the squad over a period/.test(page) && /About one athlete, session or test/.test(page), 'two groups, named as the board names them');
  assert(/<h2 className="eyebrow rep-group-title"/.test(page), 'each group has its heading');
  const squad = page.slice(page.indexOf("key: 'compliance'"), page.indexOf("key: 'athlete'"));
  assert((squad.match(/about: 'squad'/g) ?? []).length === 3 && /key: 'squad'[\s\S]{0,400}about: 'squad'/.test(page), 'Compliance, Injury & availability, Training report and Squad weekly are about the squad');
  assert(/key: 'athlete'[\s\S]{0,300}about: 'one'/.test(page) && /key: 'testing'[\s\S]{0,300}about: 'one'/.test(page), 'Athlete report and Testing are about one athlete, session or test');
  const spec = read('docs/screens/17-reports-hub.md');
  assert(/About the squad over a period/.test(spec), '17-reports-hub.md describes the grouping');
}

console.log('\nC5. the group filter reaches every export route as the page reads it (confirmed 2026-09-13)');
{
  /* The sheet's "why" said the routes read ?groups= only. They resolve it
     through resolveGroupFilter — the URL, then the sticky cookie every chip
     row writes — so a bare export URL is scoped the way the screen was. The
     exports hub posts the scope the page resolved. Pinned so it stays so. */
  const routes = ['training', 'injuries', 'compliance', 'testing', 'squad'];
  for (const r of routes) {
    const src = read(`src/app/(staff)/reports/${r}/export/route.ts`);
    assert(/resolveGroupFilter\(url\.searchParams\.get\('groups'\) \?\? undefined\)/.test(src), `${r}: the URL, then the sticky cookie`);
    assert(!/parseGroupParam\(url\.searchParams/.test(src), `${r}: never the raw param alone`);
  }
  const hub = read('src/components/ExportBuilderForm/ExportBuilderForm.tsx');
  assert(/body: JSON\.stringify\(\{ domains: \[\.\.\.selected\], groupIds, from: fromVal, to: toVal \}\)/.test(hub), 'the exports hub posts the scope the page resolved');
  assert(/sticky|cookie/.test(read('docs/screens/17-reports-hub.md')) || /sticky|cookie/.test(read('docs/screens/07-schedule.md')), 'the spec says the scope is the sticky one');
}

console.log('\nthe record and the sheet');
{
  const rec = read('docs/overnight-records-2026-09-12.md');
  assert(/## PATTERN-S7 — Reports and analytics/.test(rec) && /### Step 1, answered from the code/.test(rec), 'the S7 record answers Step 1');
  const sheet = read('docs/design-decisions-outstanding.md');
  assert(/\| PATTERN-S7 \| C1 \|/.test(sheet) && /\| PATTERN-S7 \| D3 \|/.test(sheet), 'C1–C11 and D1–D3 are on the sheet');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
