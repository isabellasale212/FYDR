/* The athlete shell's block rhythm, one step down — decided by Isabella
 * 2026-09-12 ("the vertical gaps in the athlete app are too large"): --gap-body
 * 28px → 20px, the --sp-20 step. A token VALUE change, so under CLAUDE.md §0.01
 * it is dated beside the value and is its own commit. Athlete app only: the
 * token has one reader, .phone-body, and --gap-stack (the staff .stack rhythm)
 * is untouched.
 *
 * check-athlete-spacing.ts pins that .phone-body reads --gap-body; this pins
 * the value and the fence around it.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const css = readFileSync('src/styles/base.css', 'utf8');
const rule = (sel: string, src = strip(css)): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(src)?.[1] ?? '';
};

console.log('the value: 20px, the --sp-20 step, dated');
{
  assert(/^\s*--gap-body:\s*20px;/m.test(strip(tokens)), '--gap-body is 20px');
  assert(/^\s*--sp-20:\s*20px;/m.test(strip(tokens)), 'which is the existing --sp-20 step — no new value');
  const at = tokens.indexOf('--gap-body: 20px');
  const around = tokens.slice(Math.max(0, at - 1200), at + 200);
  assert(/12 Sept 2026/.test(around) && /Isabella/.test(around), "dated beside the value: 12 Sept 2026, Isabella's decision");
  assert(!/--gap-body:\s*28px/.test(tokens), 'and 28px is gone from the token');
}

console.log('\nthe reader: the athlete shell, and only the athlete shell');
{
  assert(/gap:\s*var\(--gap-body\)/.test(rule('.phone-body')), '.phone-body still reads --gap-body (check-athlete-spacing pins this too)');
  const readers = (strip(css).match(/var\(--gap-body\)/g) ?? []).length;
  assert(readers === 1, `--gap-body has exactly one reader in base.css (${readers})`);
  assert(/^\s*--gap-stack:\s*14px;/m.test(strip(tokens)), '--gap-stack is still 14px — the staff .stack rhythm is untouched');
  assert(/gap:\s*var\(--gap-stack\)/.test(rule('.stack')), 'and .stack still reads it');
}

console.log('\nthe list gap inside the shell');
{
  /* Judged at 375×812 after the first step (Today, My data, the check-in
     form): 14px between cards in a list beside 20px between sections reads
     as one rhythm, not loose. Left at --gap-stack; asserted so the decision
     is visible rather than implied by absence. */
  assert(rule('.phone-body .stack') === '', 'no athlete-scoped .stack override: the in-list gap stays at --gap-stack (14px)');
}

console.log('\nthe design-system doc');
{
  const doc = readFileSync('docs/06-design-system.md', 'utf8');
  assert(/\| \*\*Athlete body gap\*\* \| \*\*20px\*\* \| `--gap-body` \|/.test(doc), '06-design-system.md §2.7 says 20px');
  assert(/2026-09-12/.test(doc.slice(doc.indexOf('Athlete body gap'), doc.indexOf('Athlete body gap') + 3000)), 'and records the date of the change');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
