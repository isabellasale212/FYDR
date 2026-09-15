/* The injury form split by permission — PATTERN-S3 C9, built 2026-09-14.
 * Left column, every injury role: athlete, date, site, availability,
 * restrictions, expected return. Right column, medical staff and the athlete
 * only: diagnosis, mechanism, severity. Save works with the right column
 * empty and the well says so. The two fields the board draws for a coach that
 * rules already gate — injury-linked availability (the medic's write, 0012 /
 * 0042) and the body site (withheld from the coach while the club's setting
 * is off, C8) — follow the rules: the status buttons are the medic's, the
 * site fields are absent for a coach who cannot read them. On a phone the
 * left column is the pitch-side form at 44px.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const form = strip(readFileSync('src/components/NewInjuryForm/NewInjuryForm.tsx', 'utf8'));
const page = strip(readFileSync('src/app/(staff)/injuries/new/page.tsx', 'utf8'));
const css = readFileSync('src/styles/base.css', 'utf8');

console.log('two columns, split by permission');
assert(/className="inj-cols"/.test(form) && /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(css.slice(css.indexOf('.inj-cols {'))), 'a two-column grid at minmax(0, 1fr) each, the board\'s own');
assert(/@media \(max-width: 767px\) \{\s*\.inj-cols \{\s*grid-template-columns: minmax\(0, 1fr\);/.test(css), 'one column at phone width');
const rightAt = form.indexOf('data-injury-clinical-column');
assert(rightAt > -1 && /\{clinical \? \(\s*<div className="inj-clinical" data-injury-clinical-column>/.test(form), 'the right column renders for medical staff only');
for (const id of ['new-inj-diagnosis', 'new-inj-mechanism', 'new-inj-severity']) {
  assert(form.indexOf(`id="${id}"`) > rightAt, `${id.replace('new-inj-', '')} sits in the right column`);
}
assert(/Saving works with this column empty/.test(form), 'and the well says save works with it empty');
assert(/Nothing in this column is ever shown to coaching staff/.test(form), 'and who never reads it');

console.log('\nthe left column, and the two rules the board did not know');
for (const id of ['new-inj-athlete', 'new-inj-onset', 'new-inj-area', 'new-inj-side', 'new-inj-occurred', 'new-inj-expected']) {
  assert(form.indexOf(`id="${id}"`) < rightAt, `${id.replace('new-inj-', '')} sits in the left column`);
}
assert(/\{siteVisible \? \(/.test(form) && /bodyArea: siteVisible \? bodyArea : 'other'/.test(form), 'the site fields are absent for a coach who cannot read the site (C8), and the write says nothing');
assert(/\{clinical \? \(\s*<>\s*<p className="label"[^>]*>\s*Availability/.test(form), 'the status buttons are the medic\'s — injury-linked availability is medical staff\'s write');
assert(/className="inj-status"/.test(form) && /\.inj-status > \.squad-chip \{[^}]*flex: 1;[^}]*min-height: var\(--tap-min\)/.test(css), 'three full-width status buttons at the 44px floor');
assert(/data-injury-availability-well/.test(form) && /Availability for an injury is set by medical staff from this record/.test(form), 'every other role is told who sets it and that the current status stands');
assert(/injuryId: id,/.test(form) && /reasonCategory: status === 'available' \? null : 'injury'/.test(form), 'the availability written is injury-linked, reason injury');

console.log('\nsaving says what it does');
assert(/`Log the injury and set \$\{label\(status\)\}`/.test(form) && /'Log the injury'/.test(form), 'the save button names the availability it sets, or just the injury');
assert(/<AvailabilityAudience/.test(form) && /setConfirming\(true\)/.test(form), 'a status change names its audience before it lands (C4), as the availability form does');
assert(/The injury was recorded, but \{partial\.what\}/.test(form) && /Open the record/.test(form), 'a failure after the injury row says which part did not land and where to finish');

console.log('\nthe page');
assert(/clinical=\{hasAnyRole\(claims\.roles, CLINICAL_ONLY\)\}/.test(page), 'clinical resolved from CLINICAL_ONLY');
assert(/siteVisible = hasAnyRole\(claims\.roles, SITE_ALWAYS\) \|\| siteRow\.data\?\.coach_sees_injury_site === true/.test(page), 'site visibility from SITE_ALWAYS and the club\'s setting, as the list does');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
