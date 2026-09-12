/* STAFF-SS-02-05 C8, approved 2026-09-12: empty profile panels state the
 * requirement, never a zero — "a trend needs three weigh-ins", "no plan
 * assigned, targets are per kilogram, so a plan needs a weigh-in", "n = 0".
 */
import { readFileSync } from 'node:fs';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const flat = (p: string): string => readFileSync(p, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\s+/g, ' ');
const page = flat('src/app/(staff)/squad/[athleteId]/page.tsx');

console.log('body weight');
{
  assert(/No weigh-in recorded\. A trend needs three weigh-ins\./.test(page), 'no weigh-ins: "A trend needs three weigh-ins."');
  assert(/bodyWeight\.history\.length < 3 \? ' — a trend needs three weigh-ins' : ''/.test(page), 'one or two in the window: the caption says what a trend needs');
}
console.log('\nnutrition plan');
{
  assert(/No plan assigned\. Targets are per kilogram, so a plan needs a weigh-in\./.test(page), 'no plan: the requirement, stated');
  assert(/Targets are per kilogram, so this plan needs a weigh-in\./.test(page), 'a plan with no weigh-in to scale it: says so');
}
console.log('\nflags');
{
  const f = flat('src/components/PlayerProfileFlags/PlayerProfileFlags.tsx');
  assert(/No open flags for this athlete · n = 0\./.test(f), 'no open flags: n = 0');
}
console.log('\nthe spec');
{
  assert(/a trend needs three weigh-ins/.test(readFileSync('docs/screens/03-athlete-profile.md', 'utf8')), '03-athlete-profile.md records the empty-panel rule');
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
