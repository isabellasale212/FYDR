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
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

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

console.log('\nC2 / B4. the squad list on a phone: 60px rows, the name as the link, the pill right, the restriction line on the row (2026-09-12)');
{
  const roster = strip(read('src/components/RosterTable/RosterTable.tsx'));
  assert(/<table className="tbl roster" role="table">/.test(roster) && /role="row"/.test(roster) && /role="cell"/.test(roster) && /role="columnheader"/.test(roster), 'the table carries its roles explicitly, so the phone grid keeps table semantics');
  assert(/className="sub roster-restrictions"[^>]*data-empty=\{row\.restrictions\.length === 0 \? '' : undefined\}/.test(roster), 'the restriction cell says when it is empty, so the phone row can drop it');
  const css = read('src/styles/base.css');
  const phone = css.slice(css.indexOf('.roster thead {'), css.indexOf('.roster thead {') + 2200);
  assert(/@media \(max-width: 767px\)[\s\S]{0,400}\.roster tr \{/.test(css), 'the phone layout is below 768px only — desktop keeps the five columns');
  assert(/\.roster tr \{[^}]*display:\s*grid[^}]*min-height:\s*60px/.test(phone), 'a row is a 60px grid');
  assert(/\.roster thead \{[^}]*display:\s*none/.test(phone) && /table\.tbl\.roster td\.r \{[^}]*display:\s*none/.test(phone), 'the header row and the squad number are not drawn on a phone');
  assert(/\.roster td:nth-child\(4\) \{[^}]*grid-column:\s*2[^}]*grid-row:\s*1 \/ span 2/.test(phone), 'the pill sits right, across the name and position');
  assert(/table\.tbl\.roster td\.roster-restrictions\[data-empty\] \{[^}]*display:\s*none/.test(phone), 'an empty restriction line is not drawn');
  assert(/table\.tbl\.roster td a\.nm \{[^}]*min-height:\s*44px/.test(phone) && /table\.tbl\.roster td a\.nm \{[^}]*font-size:\s*var\(--fs-16\)/.test(phone), 'the name is the tap target, at the row\'s size');
}

console.log('\nthe specs');
{
  assert(/Not recorded/.test(read('docs/screens/02-squad-overview.md')), '02-squad-overview.md says "Not recorded"');
  assert(/not the same as being cleared/.test(read('docs/screens/03-athlete-profile.md')), '03-athlete-profile.md carries the injury panel\'s sentence');
  assert(/Do not name a\s+diagnosis or a protocol/.test(read('docs/screens/03-athlete-profile.md')), 'and the note field\'s hint');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
