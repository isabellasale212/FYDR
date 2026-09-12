/* §0ap (fourth bullet) — the three staff screens that scrolled sideways at
 * 375px. The entry's fix: the two tables get the overflow-x: auto wrapper
 * the reports already use; the leaderboard ranking row clamps its columns
 * on a phone so its gap column no longer runs past the edge.
 */
import { readFileSync } from 'node:fs';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the tables scroll inside their own container');
{
  const sar = read('src/app/(staff)/settings/subject-access/page.tsx');
  assert(/<div style=\{\{ overflowX: 'auto' \}\}>\s*<table className="tbl">/.test(sar), '/settings/subject-access: the table is wrapped');
  const ret = read('src/app/(staff)/settings/retention/page.tsx');
  assert((ret.match(/<div style=\{\{ overflowX: 'auto' \}\}>\s*<table className="tbl">/g) ?? []).length === 2, '/settings/retention: both tables are wrapped');
}

console.log('\nthe ranking row fits a phone');
{
  const css = read('src/styles/base.css');
  const block = /@media \(max-width: 767px\)\s*\{\s*\.lb-head,\s*\.lb-row\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/grid-template-columns:\s*30px minmax\(0, 1fr\) 64px minmax\(0, 1fr\) 72px 56px/.test(block), 'below 768 the fixed columns sum to 222px');
  assert(/gap:\s*var\(--sp-6\)/.test(block), 'with 6px gaps — 252px fixed, leaving the name and the bar 91px of 343');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
