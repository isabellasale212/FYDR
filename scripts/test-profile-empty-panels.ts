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
  /* The nutrition plan card left the profile on 16 Sept 2026 (3.1): the
     athlete's nutrition page carries the plan; the profile carries none. */
  assert(!/pp-nutrition-title/.test(page), 'no nutrition plan card on the profile (16 Sept 2026)');
  /* PATTERN-S5 C7 (2026-09-13): with no weigh-in the resolver serves the
     club's absolute default (04-data-model §17.3), so the card used to say
     "this plan needs a weigh-in" above numbers it was showing anyway. Now it
     says what the numbers are. */
  assert(!/Targets are per kilogram, so this plan needs a weigh-in\./.test(page), 'the contradiction is gone');
  assert(!/noWeighInLine\(/.test(page), 'and the no-weigh-in line went with it (the nutrition page and NutritionTargetsCard still say whose the figures are)');
  /* PATTERN-S5 C7, Isabella's ruling 2026-09-13: show the club default,
     labelled as the club default, on every resolved surface. */
  /* The card is one component since 15 Sept 2026 (mobile queue #8), drawn on
     Programme and on Today; the provenance line lives in the component. */
  const targetsCard = flat('src/components/NutritionTargetsCard/NutritionTargetsCard.tsx');
  /* REPINNED 16 Sept 2026 (Isabella's evening queue, the text rule): the
     provenance line is a definition sentence (category 3) and is gone from
     the athlete app; the staff surfaces above keep theirs. */
  assert(!/targetProvenanceLine\(/.test(targetsCard), 'the athlete\'s own targets card no longer says whose the numbers are (the text rule, 16 Sept 2026)');
  assert(/<NutritionTargetsCard/.test(flat('src/app/(athlete)/programme/page.tsx')) && /<NutritionTargetsCard/.test(flat('src/app/(athlete)/today/page.tsx')), 'and Programme and Today both draw that card');
  const staffNutrition = flat('src/app/(staff)/squad/[athleteId]/nutrition/page.tsx');
  assert(/targetProvenanceLine\(\{ sourceScope: resolved\.source_scope, hasWeighIn: latestOwn !== null, you: false \}\)/.test(staffNutrition), 'and so does the staff athlete nutrition page');
  const words = readFileSync('src/lib/nutritionNoWeighIn.ts', 'utf8');
  assert(/The club default target, the same for everyone on it\./.test(words) && /Not scaled to \$\{o\.you \? 'your' : 'their'\} weight — no weigh-in on record\./.test(words), 'the club default is labelled as the club default; unscaled says so');
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
