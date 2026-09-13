/* ATH-ADULT-11 C2 (decision sheet group (c), 2026-09-12): after a
 * correction the logger says so where the set is — "Set 1 corrected · was
 * 100 kg × 8" beneath the exercise's set keys — reading the superseded row
 * the way My data has since §0v, rather than showing only the live value
 * and leaving the athlete to trust that the save landed.
 */
import { readFileSync } from 'node:fs';
import { wasLine } from '@/lib/gymSummary';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the line');
{
  assert(wasLine({ reps_completed: 8, load_kg: 100 }) === '100 kg × 8', '"100 kg × 8"');
  assert(wasLine({ reps_completed: 10, load_kg: null }) === '× 10', 'no load: "× 10"');
  assert(wasLine({ reps_completed: null, load_kg: 100 }) === '100 kg × no reps', 'no reps says so');
  assert(wasLine({ reps_completed: 8, load_kg: 102.5 }) === '102.5 kg × 8', 'one decimal kept');
}

console.log('\nthe read and the page');
{
  const page = strip(read('src/app/(athlete)/gym/[sessionId]/page.tsx'));
  assert(/fetchGymSetRevisionChains\(db, orgId, gymSessionLogId\)/.test(page), 'the page reads the session\'s revision chains (the base table, as My data does)');
  assert(/corrections=\{corrections\}/.test(page) && /priorRevisions\.length > 0/.test(page), 'and passes each corrected live set with what it replaced');
}

console.log('\nthe logger');
{
  const l = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/corrections: readonly \{ id: string; was: \{ reps_completed: number \| null; load_kg: number \| null \} \}\[\];/.test(l), 'the prop is the live set id and what it was');
  assert(/className="gym-corrected-strip num"/.test(l) && /Set \{row\.set_number\} corrected · was \{wasLine\(c\.was\)\}/.test(l), '"Set 1 corrected · was 100 kg × 8" beneath the set keys');
  assert(/logged, corrected,/.test(l) || /corrected\. Correct it/.test(l) || /\$\{correctedIds\.has\(loggedRow\.id\) \? ', corrected' : ''\}/.test(l), 'the logged key says it was corrected');
  const css = strip(read('src/styles/base.css'));
  assert(/\.gym-corrected-strip\s*\{[^}]*color:\s*var\(--muted\)/.test(css), 'the strip is a muted line — the neutral marker, no bar');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/05-gym-session.md');
  assert(/corrected · was/.test(spec), '05-gym-session.md describes the strip');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
