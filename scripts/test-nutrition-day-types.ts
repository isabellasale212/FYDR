/* Day-type carbohydrate targets: three independent numbers.
 *
 * WHAT WAS REPLACED. nutrition_rules stored ONE carb_g_per_kg, and the day type
 * applied a fixed multiplier on top — training x1, match x1.25, rest x0.58.
 * The editor showed `carb * multiplier` and, on change, divided the entered
 * value back by that multiplier into the single shared field. So typing a
 * match-day number silently moved training and rest as well: one rate, three
 * views of it, and no way to say "match day is 7.5 and rest day is 3.0" unless
 * the ratio between them happened to be 1.25 : 0.58.
 *
 * The model is now three independent columns, one per day type. Changing one
 * cannot affect another because there is no longer anything shared to change.
 * Decided deliberately as a REMOVAL of the auto-scaling design — not a
 * refactor of it, and not to be re-derived later from a rate plus ratios.
 *
 * The guideline values (6.0 / 7.5 / 3.5) survive only as a printed reference
 * beside each field. They are never written, never defaulted onto an existing
 * rule, and nothing clamps to them.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const read = (p: string) => readFileSync(p, 'utf8');

const lib = read('src/lib/nutritionRules.ts');
const libCode = strip(lib);
const queries = read('src/lib/queries/nutritionRules.ts');
const qCode = strip(queries);
const ws = read('src/components/NutritionWorkspace/NutritionWorkspace.tsx');
const wsCode = strip(ws);
const migrations = readFileSync('supabase/migrations/0083_nutrition_day_type_carbs.sql', 'utf8');

console.log('the shared rate is gone from the model');
assert(!/multiplier/.test(libCode), 'nutritionRules.ts no longer computes with a multiplier');
assert(
  !/carbGPerKg\s*:/.test(libCode.slice(libCode.indexOf('MacroRule'), libCode.indexOf('MacroRule') + 400)),
  'MacroRule no longer carries one shared carb rate',
);
assert(/carbGPerKgByDay/.test(libCode), 'it carries a value per day type instead');

console.log('\ncomputeTargets reads the day\'s own number');
{
  const fn = libCode.slice(libCode.indexOf('export function computeTargets'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(/dayType/.test(body), 'it takes a day type, not a multiplier');
  assert(!/\*\s*dayMultiplier|dayMultiplier/.test(body), 'and multiplies by nothing');
  assert(
    /carbGPerKgByDay\[dayType\]/.test(body),
    'carbs come from that day type\'s own field',
  );
}

console.log('\nthe day types carry a guideline, not a multiplier');
{
  const decl = libCode.slice(libCode.indexOf('export const DAY_TYPES'), libCode.indexOf('export const DAY_TYPES') + 400);
  assert(!/multiplier/.test(decl), 'DAY_TYPES has no multiplier');
  assert(/guideline/.test(decl), 'it has a guideline instead');
  for (const [day, val] of [['training', '6'], ['match', '7.5'], ['rest', '3.5']] as const) {
    assert(new RegExp(`'${day}'[\\s\\S]{0,80}${val.replace('.', '\\.')}`).test(decl), `${day}'s guideline is ${val}`);
  }
}

console.log('\nthe guideline is a reference and nothing more');
assert(
  !/guideline/.test(qCode),
  'no query layer code reads it — it is never written and never defaulted onto a rule',
);
assert(/guideline/.test(wsCode), 'the editor shows it beside the field');

console.log('\nthree columns, and the old one is gone');
for (const col of ['carb_g_per_kg_training', 'carb_g_per_kg_match', 'carb_g_per_kg_rest']) {
  assert(migrations.includes(col), `0083 adds ${col}`);
  assert(qCode.includes(col), `the query layer reads and writes ${col}`);
}
assert(/drop column[\s\S]{0,60}carb_g_per_kg\b/.test(migrations), '0083 drops the single shared column');
assert(
  !/\bcarb_g_per_kg\b(?!_)/.test(qCode),
  'and nothing selects the dropped column any more',
);

console.log('\nthe migration preserves every existing athlete\'s numbers');
{
  assert(/1\.25/.test(migrations) && /0\.58/.test(migrations),
    'the backfill uses the multipliers that were in force, so nobody\'s target moves on deploy');
  assert(/not null/i.test(migrations), 'the new columns end up NOT NULL, like the one they replace');
}

console.log('\nthe editor changes one day and only one day');
{
  assert(
    !/\/ dayTypeInfo\.multiplier|\* dayTypeInfo\.multiplier|\* dt\.multiplier/.test(wsCode),
    'nothing multiplies or divides by a day-type factor any more',
  );
  assert(
    /setCarbForDay\(/.test(wsCode),
    'the stepper writes to the selected day\'s own value',
  );
  const fn = wsCode.slice(wsCode.indexOf('function setCarbForDay'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert(
    /\[dayType\]: /.test(body) && /\.\.\.cur/.test(body),
    'by patching that key and copying the rest — the other two are carried through untouched',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
