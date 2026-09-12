/* PATTERN-S5 (programme authoring) — the A items built 2026-09-12 under the
 * standing rule; C1 (the prescription snapshot, a migration) and the rest
 * are on the decision sheet.
 *
 *   A1 a bodyweight exercise says what it logs, in words — "logs reps only"
 *      as a plain value; no disabled input on the row
 *   A7 the coach's detail link is the tell: "Edit this programme" where the
 *      role may author, "View full detail" where it may not
 */
import { readFileSync } from 'node:fs';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('A1. logs reps only');
{
  const b = strip(read('src/components/ProgrammeBuilder/ProgrammeBuilder.tsx'));
  assert(/loadBasis === 'none' \? \(\s*<span className="nm pb-reads-only">logs reps only<\/span>/.test(b), 'the load slot reads "logs reps only" for a bodyweight exercise');
  assert(!/disabled=\{loadBasis === 'none'\}/.test(b), 'and there is no disabled input in its place');
}

console.log('\nA7. the detail link is the tell');
{
  const p = strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'));
  assert(/const canAuthorProgramme = hasAnyRole\(claims\.roles, PROGRAMME_AUTHOR\)/.test(p), 'decided from PROGRAMME_AUTHOR');
  assert(/\{canAuthorProgramme \? 'Edit this programme' : 'View full detail'\}/.test(p), '"Edit this programme" / "View full detail"');
  assert(/\{canAuthorProgramme \? 'Change plan' : 'View plan'\}/.test(p), 'the header pill likewise');
  assert(!/>\s*Edit ›\s*<\/Link>/.test(p.slice(p.indexOf('pp-goal-line') - 600, p.indexOf('pp-goal-line'))), 'the bare "Edit ›" is gone from the programme block');
}

console.log('\nthe spec');
assert(/logs reps only/.test(read('docs/screens/34-programme-builder.md')) && /View full detail/.test(read('docs/screens/03-athlete-profile.md')), 'the specs record the words');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
