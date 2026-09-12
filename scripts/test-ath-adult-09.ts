/* ATH-ADULT-09 — the gym logger, the A items of the "Gym logger pattern"
 * board (2026-09-12). The board is a set-by-set rebuild; what is built here
 * is what moves onto its rules without changing what the screen does. The
 * record is docs/overnight-records-2026-09-12.md.
 *
 *   A3 structure from spacing: no border on the exercise card
 *   A4 the header never scrolls away
 * Not built: the one-accent chip states and the neutral deviation line —
 * composable, but they reverse the 2026-09-08 colour decisions that
 * 05-gym-session.md §13 records and test-gym-logger-redesign.ts pins (D4);
 * the 48px numbers and 56/52px targets (new tokens, B); the rebuild,
 * offline flush, Wake Lock, haptics, the summaries (C); "Not logged"
 * wording (D1: 12-13 owns My data's rows).
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = strip(read('src/styles/base.css'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('D4 — reversed 2026-09-12 (the logger is one accent; pinned in test-gym-logger-redesign.ts)');
{
  assert(!/--gym-rgb/.test(rule('.gym-set-key[data-logged]')), 'logged keys are no longer gym-tinted');
  assert(!/--warn-pill-text/.test(rule('.gym-weight-label .n[data-warn]')), 'the deviation sub-line is no longer amber');
  assert(!/background:\s*var\(--gym\)/.test(rule('.gym-progress-fill')), 'the progress fill is no longer gold');
}

console.log('B4 — the set keys stand on the 44px floor (decision sheet group (a), 2026-09-12)');
{
  const key = rule('.gym-set-key');
  assert(/min-height:\s*44px/.test(key), 'a set key is at least 44px tall');
  assert(!/42px/.test(key), 'the 42px height is gone');
}

console.log('\nC3 — the stepper moves by the exercise\'s own step (migration 0108, 2026-09-12)');
{
  const logger = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(!/WEIGHT_STEP_KG/.test(logger), 'the constant 2.5 is gone from the logger');
  assert(/bumpWeight\(ex, -ex\.weight_step_kg\)/.test(logger) && /bumpWeight\(ex, ex\.weight_step_kg\)/.test(logger), '− and + move by ex.weight_step_kg');
  assert(/by \$\{ex\.weight_step_kg\} kg/.test(logger), 'and the buttons say the step');
  const q = strip(read('src/lib/queries/programmes.ts'));
  assert(/weight_step_kg: number;/.test(q) && /from\('exercises'\)\.select\('id, weight_step_kg'\)/.test(q) && /weight_step_kg: steps\.get\(r\.exercise_id\) \?\? 2\.5/.test(q), 'fetchSessionExercises reads the step for the resolved exercise ids, 2.5 when unknown');
  const mig = read('supabase/migrations/0108_exercise_weight_step.sql');
  assert(/add column weight_step_kg numeric\(5,2\) not null default 2\.5/.test(mig) && /check \(weight_step_kg > 0/.test(mig), '0108: the column, default 2.5, checked positive');
  const form = strip(read('src/components/ExerciseForm/ExerciseForm.tsx'));
  assert(/<span className="exlib-flabel">Weight step<\/span>/.test(form) && /weightStepKg,/.test(form) && !/<span className="exlib-flabel">Unit<\/span>/.test(form), 'the library form sets it in the slot the inert Unit picker held');
  assert(/WEIGHT_STEPS = \[0\.5, 1, 1\.25, 2, 2\.5, 5\]/.test(form), 'with 1.25, 2 and 2.5 among the choices');
}

console.log('\nA3/A4. spacing, and a pinned header');
{
  const card = rule('.gym-ex-card');
  assert(/border:\s*none/.test(card) && /background:\s*var\(--surf\)/.test(card), 'the exercise card is a white surface with no border');
  assert(/border-radius:\s*var\(--r-toggle\)/.test(card), 'on the athlete card radius');
  const head = rule('.gym-head');
  assert(/position:\s*sticky/.test(head) && /top:\s*0/.test(head) && /background:\s*var\(--phone-bg\)/.test(head) && /z-index/.test(head), 'the header is sticky on the shell ground');
  assert(/border-bottom:\s*1px solid var\(--hair\)/.test(head), 'and keeps its hairline — one of the two the board allows');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/05-gym-session.md');
  assert(/no border/i.test(spec) && /pinned|stays at the top|never scrolls away/i.test(spec), '05-gym-session.md describes the borderless card and the pinned header');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
