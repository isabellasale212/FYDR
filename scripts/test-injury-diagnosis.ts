/* Tier 2: the athlete's own diagnosis on their own screen.
 *
 * THE RISK IS ONE-DIRECTIONAL AND IT IS DISCLOSURE. Two things have to hold, and
 * this file asserts the first while supabase/tests/490 asserts the second:
 *
 *   1. The query cannot ask for more than the diagnosis, and the component
 *      cannot render what it was not given. (Here.)
 *   2. The database refuses the whole view to an athlete under 18, whatever any
 *      component does. (490_clinical_view_age_gate_test.sql.)
 *
 * The second is the one that matters. The first is what stops a bug becoming a
 * disclosure before the second catches it — the same split as the staff injury
 * card, test-injury-card.ts and supabase/tests/390.
 *
 * WHAT IS ASSERTED IS ABSENCE, and that is the whole design of this file.
 * injury_clinical_athlete_view exposes seven fields. Isabella's decision of
 * 2026-09-08, taken after looking at diagnosis-only on a real record: the screen
 * shows the diagnosis. Imaging and the detailed treatment plan are held back;
 * MECHANISM IS PENDING a look at the real text and is not a no. So the database
 * is deliberately more permissive than the product, and a test asserting that
 * `diagnosis` is fetched would pass just as well if all seven were. The six that
 * are not fetched are named one by one below.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const query = strip(readFileSync('src/lib/queries/injuryDiagnosis.ts', 'utf8'));
const view = strip(readFileSync('src/components/InjuryDiagnosis/InjuryDiagnosis.tsx', 'utf8'));
const today = strip(readFileSync('src/app/(athlete)/today/page.tsx', 'utf8'));
const banner = strip(readFileSync('src/components/AvailabilityBanner/AvailabilityBanner.tsx', 'utf8'));

const HELD_BACK = ['mechanism', 'severity', 'tissue_type', 'imaging', 'referral', 'treatment_plan'];

console.log('the query asks for one column, and the six held back are named');
{
  const select = /\.select\(\s*'([^']*)'\s*\)/.exec(query)?.[1] ?? '';
  assert(select === 'diagnosis', `the select list is exactly "diagnosis" (saw "${select}")`);
  for (const field of HELD_BACK) {
    assert(!select.includes(field), `${field} is not fetched`);
  }
  assert(!query.includes('*'), 'and there is no select star in the module');
  assert(
    !query.includes('clinical_notes'),
    'clinical_notes is not asked for — the view withholds it, and this does not try',
  );
}

console.log('\nand the component cannot render what it was never given');
{
  assert(/diagnosis/.test(view), 'the component renders the diagnosis');
  for (const field of [...HELD_BACK, 'clinical_notes']) {
    assert(!view.includes(field), `it has no prop and no branch for ${field}`);
  }
  assert(
    /if \(!diagnosis\) return null/.test(view),
    'and renders nothing at all when there is none — no empty label, no "withheld" line',
  );
}

console.log('\nnothing explains WHY it is missing, which for a minor is the disclosure');
{
  /* An athlete told "this is withheld from you" learns that the withheld thing
     exists. For a reader under 18 that is precisely what the gate exists to
     prevent, so no-diagnosis, no-injury and under-18 all render identically. */
  for (const tell of ['withheld', 'not available to you', 'under 18', 'minor', 'guardian']) {
    assert(!view.toLowerCase().includes(tell), `the component never says "${tell}"`);
  }
}

console.log('\nthe age gate is the database\'s job, and the app does not duplicate it badly');
{
  assert(
    !query.includes('athlete_is_minor'),
    'the query does not call athlete_is_minor — authenticated cannot execute it, so a call here would throw',
  );
  assert(
    !today.includes('is_minor') && !today.includes('athlete_age_view'),
    'and the page does not second-guess the view with an age lookup of its own',
  );
  assert(
    query.includes('0093') || query.includes('view'),
    'the query records where the gate actually lives',
  );
}

console.log('\nthe availability banner is still clinical-free');
{
  /* Kept, not spent. Availability is a squad fact a coach also sees; a diagnosis
     is a clinical one only this athlete and medical see. Two disclosure rules on
     one screen is exactly when to keep them in two components. */
  for (const field of ['diagnosis', ...HELD_BACK, 'clinical_notes']) {
    assert(!banner.includes(field), `AvailabilityBanner still never mentions ${field}`);
  }
}

console.log('\nthe temporary preview is gone, not merely disabled');
{
  for (const gone of [
    'src/lib/diagnosisPreview.ts',
    'src/components/DiagnosisPreview/DiagnosisPreview.tsx',
  ]) {
    let exists = true;
    try { readFileSync(gone, 'utf8'); } catch { exists = false; }
    assert(!exists, `${gone} is deleted`);
  }
  assert(!today.includes('FYDR_PREVIEW_DIAGNOSIS'), 'the page reads no preview flag');
  assert(!today.includes('DiagnosisPreview'), 'and renders no preview component');
  assert(
    !readFileSync('package.json', 'utf8').includes('test:diagnosis-preview'),
    'and the preview test is out of prebuild',
  );
}

console.log('\nthe page wires it once, from the injury availability resolved');
{
  const calls = [...today.matchAll(/fetchAthleteDiagnosis\(/g)].length;
  assert(calls === 1, `exactly one clinical read on this page (saw ${calls})`);
  assert(
    /fetchAthleteDiagnosis\(db, availability\.injury\?\.id\)/.test(today),
    'keyed to the injury the availability row names, not to any injury on file',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
