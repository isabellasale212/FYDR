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
  /* PATTERN-S5 C7 (2026-09-13): with no weigh-in the resolver serves the
     club's absolute default (04-data-model §17.3), so the card used to say
     "this plan needs a weigh-in" above numbers it was showing anyway. Now it
     says what the numbers are. */
  assert(!/Targets are per kilogram, so this plan needs a weigh-in\./.test(page), 'the contradiction is gone');
  assert(/noWeighInLine\(\{ firstName: athlete\.first_name, sourceScope: nutrition\.source_scope \}\)/.test(page), 'a plan with no weigh-in says what the figures are and whose');
  const words = readFileSync('src/lib/nutritionNoWeighIn.ts', 'utf8');
  assert(/squad_default/.test(words) && /club default figures, not scaled to/.test(words) && /set as absolute targets, not scaled to/.test(words), 'the words: club default vs an absolute personal or group target');
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
