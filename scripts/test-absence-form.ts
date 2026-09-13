/* PATTERN-S3 C5 (decision sheet group (c), 2026-09-12): the coach's
 * availability form is an ABSENCE form — the reason first (illness, personal,
 * academic, representative, other), then the availability words with
 * Available withheld ("an absence that leaves an athlete fully available is
 * not a record"), a well naming what an absence does not carry, and one way
 * to end an absence that is separate from recording one. Permissions are the
 * database's, unchanged: coach and sport scientist for a non-injury row
 * (0068), the medic unconditionally.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const form = strip(read('src/components/SetAvailabilityFormCoach/SetAvailabilityFormCoach.tsx'));

console.log('the shape');
{
  assert(/<p className="label">Record an absence<\/p>/.test(form), 'titled "Record an absence"');
  assert(/this form cannot\s*open an injury record and does not create one/.test(form.replace(/\s+/g, ' ')), 'and says what it cannot do');
  const reasonBlock = form.slice(form.indexOf('id="avail-coach-reason-label"'), form.indexOf('id="avail-coach-status-label"'));
  assert(/NON_INJURY_REASONS\.map/.test(reasonBlock) && /className="squad-chip"/.test(reasonBlock) && /aria-pressed=\{reasonCategory === r\.value\}/.test(reasonBlock), 'the reason comes first, as chips');
  assert(/const ABSENCE_STATUSES = \['modified', 'unavailable'\] as const;/.test(form), 'the availability words are Modified and Unavailable');
  assert(/Available is not offered here: an absence that leaves an athlete fully available is not a record\./.test(form), 'and the form says why Available is withheld');
  assert(/className="absence-well"/.test(form) && /No clinical record/.test(form) && /Medical staff are not notified\./.test(form), 'the well names what an absence does not carry');
  assert(/Visible to the athlete and to all staff\. This is not a medical record — do not describe symptoms\./.test(form), 'the note says who reads it');
  assert(/Record absence\s*<\/button>/.test(form), 'the primary is "Record absence"');
}

console.log('\nending an absence is its own act');
{
  assert(/currentAbsence: boolean;/.test(form), 'the page says whether a non-injury absence is open');
  assert(/currentAbsence \? \(/.test(form) && /Mark available again/.test(form), '"Mark available again" appears only while one is open');
  assert(/status: ending \? 'available' : status/.test(form) || /ending \? 'available'/.test(form), 'and writes the Available row through the same audience-confirmed path');
  const page = strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'));
  assert(/currentAbsence=\{\s*!!availabilityRow &&\s*availabilityRow\.injury_id === null &&\s*availabilityRow\.reason_category !== null &&\s*availabilityRow\.reason_category !== 'injury' &&\s*availabilityRow\.status !== 'available'\s*\}/.test(page), 'the profile derives it from the current availability row — no injury link, a real non-injury reason, not Available');
}

console.log('\nthe styles and the spec');
{
  const css = read('src/styles/base.css');
  assert(/\.absence-well\s*\{[^}]*background:\s*var\(--surf2\)/.test(css), '.absence-well is the surf2 well');
  const spec = read('docs/screens/03-athlete-profile.md');
  assert(/Record an absence/.test(spec) && /Mark available again/.test(spec), '03-athlete-profile.md describes the absence form');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
