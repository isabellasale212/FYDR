/* STAFF-SS-02 / SS-05 and PATTERN-S3 — the A items built on 2026-09-12 under
 * the standing rule (record, build A and B, append C and D to the decision
 * sheet). Copy and words only; the record is in
 * docs/overnight-records-2026-09-12.md.
 *
 *   A1 "Not recorded" is the only word for no availability status
 *   A2 the coach-visible note field carries the boundary hint, word for word
 *   A3 the corrections panel states the window and the two domains it does
 *      not correct
 *   A4 the empty injury panel says "This is not the same as being cleared."
 *   A5 a missing clinical value is "Not recorded", not a dash
 *   A6 an unset expected return is said: "Expected return not known"
 */
import { readFileSync } from 'node:fs';
import { AVAILABILITY_STATUS } from '@/lib/status';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const flat = (s: string): string => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\s+/g, ' ');

console.log('A1. Not recorded');
{
  assert(AVAILABILITY_STATUS.unknown.label === 'Not recorded', 'the unknown status reads "Not recorded"');
  assert(AVAILABILITY_STATUS.unknown.tone === 'neutral', 'on a neutral pill — no status is not a state of availability');
  assert(!/label: 'Not set'/.test(read('src/lib/status.ts')), '"Not set" is gone from the status table');
}

console.log('\nA2. the boundary hint on the coach-visible note');
{
  const f = flat(read('src/components/SetAvailabilityForm/SetAvailabilityForm.tsx'));
  assert(/Coach visible\. Describe the restriction, not the injury\. Do not name a diagnosis or a protocol\./.test(f), 'the sentence, word for word');
  assert(!/coach visible &mdash; not a clinical field/.test(f), 'the old parenthetical label is gone');
  assert(/htmlFor="avail-note"[^>]*> Note <\/label>/.test(f), 'the label is "Note"');
}

console.log('\nA3. corrections state the rules once');
{
  const f = flat(read('src/components/EntryCorrectionPanel/EntryCorrectionPanel.tsx'));
  assert(/entries are never overwritten\./.test(f) && /records a new, dated revision against your name/.test(f), 'never overwritten; a dated revision against your name');
  assert(/The window is a fixed 28 days\. Gym set logs and the weekly nutrition check-in are not correctable here\./.test(f), 'the window and the two domains this panel does not correct');
}

console.log('\nA4–A6. the injury card');
{
  const f = flat(read('src/components/InjuryCard/InjuryCard.tsx'));
  assert(/No current restrictions\. This is not the same as being cleared\./.test(f), 'the empty panel says it is not a clearance');
  assert(/\{value \?\? 'Not recorded'\}/.test(f), 'a missing clinical value is "Not recorded"');
  assert(!/\{value \?\? '—'\}/.test(f), 'and not a dash');
  assert(/Expected return not known/.test(f), 'an unset expected return is said');
}

console.log('\nthe specs');
{
  assert(/Not recorded/.test(read('docs/screens/02-squad-overview.md')), '02-squad-overview.md says "Not recorded"');
  assert(/not the same as being cleared/.test(read('docs/screens/03-athlete-profile.md')), '03-athlete-profile.md carries the injury panel\'s sentence');
  assert(/Do not name a\s+diagnosis or a protocol/.test(read('docs/screens/03-athlete-profile.md')), 'and the note field\'s hint');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
