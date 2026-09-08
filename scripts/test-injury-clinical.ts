/* Tier 2: the athlete's own diagnosis and mechanism on their own screen.
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
 * injury_clinical_athlete_view exposes seven fields. Two are shown. Isabella
 * confirmed diagnosis on 2026-09-08 after looking at it on a real record, then
 * mechanism the same way, after reading every mechanism on file rather than one
 * sample — they are short factual phrases, under ten words, describing how the
 * injury happened.
 *
 * FIVE ARE STILL HELD BACK: severity, tissue_type, imaging, referral and
 * treatment_plan. So the database remains deliberately more permissive than the
 * product, and a test asserting that `diagnosis` and `mechanism` are fetched
 * would pass just as well if all seven were. The five that are not fetched are
 * named one by one below, which is the assertion that actually holds the line.
 *
 * ONE THING WORTH REMEMBERING ABOUT MECHANISM. It is free text with no length
 * limit and no format, and Selby's — "Head to hip contact making a tackle, no
 * loss of consciousness" — carries a clinical assessment finding rather than a
 * description of the event. Eight tidy entries today are not a guarantee about
 * the ninth. Nothing here can enforce that; it is written down so the next
 * person to widen this knows what kind of field they are widening.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const query = strip(readFileSync('src/lib/queries/athleteInjuryClinical.ts', 'utf8'));
const view = strip(readFileSync('src/components/InjuryClinical/InjuryClinical.tsx', 'utf8'));
const today = strip(readFileSync('src/app/(athlete)/today/page.tsx', 'utf8'));
const banner = strip(readFileSync('src/components/AvailabilityBanner/AvailabilityBanner.tsx', 'utf8'));

const SHOWN = ['diagnosis', 'mechanism'];
const HELD_BACK = ['severity', 'tissue_type', 'imaging', 'referral', 'treatment_plan'];

console.log('the query asks for two columns, and the five held back are named');
{
  const select = /\.select\(\s*'([^']*)'\s*\)/.exec(query)?.[1] ?? '';
  const columns = select.split(',').map((c) => c.trim()).filter(Boolean).sort();
  assert(
    columns.join(',') === SHOWN.slice().sort().join(','),
    `the select list is exactly diagnosis and mechanism (saw "${select}")`,
  );
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
  for (const field of SHOWN) {
    assert(view.includes(field), `the component renders the ${field}`);
  }
  for (const field of [...HELD_BACK, 'clinical_notes']) {
    assert(!view.includes(field), `it has no prop and no branch for ${field}`);
  }
  assert(
    /if \(!diagnosis && !mechanism\) return null/.test(view),
    'and renders nothing at all when it has neither — no empty label, no "withheld" line',
  );
  /* Tameifuna has an open hamstring injury and no injury_clinical row at all, so
     both fields are null for a real athlete today. And a row can carry one
     without the other, so each is guarded on its own rather than on the pair. */
  assert(
    /diagnosis \?[\s\S]{0,400}mechanism \?/.test(view) || /\{diagnosis &&[\s\S]{0,400}\{mechanism &&/.test(view),
    'each field is guarded separately, because a record can carry one and not the other',
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
  assert(
    !query.includes('mechanism') || query.includes('.select('),
    'mechanism arrives through the same gated view as diagnosis, not by another route',
  );
}

console.log('\nthe availability banner is still clinical-free');
{
  /* Kept, not spent. Availability is a squad fact a coach also sees; a diagnosis
     is a clinical one only this athlete and medical see. Two disclosure rules on
     one screen is exactly when to keep them in two components. */
  for (const field of [...SHOWN, ...HELD_BACK, 'clinical_notes']) {
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

console.log('\nnot wired to Today any more, and deliberately kept rather than deleted');
{
  /* THE REDESIGN REMOVED THE DIAGNOSIS BLOCK FROM TODAY, 2026-09-08, confirmed
     by Isabella. So this component and its query now have no caller, and the
     consequence is worth stating plainly rather than leaving to be noticed:
     AN ATHLETE CANNOT SEE THEIR OWN DIAGNOSIS ANYWHERE IN THE APP. Tier 2
     shipped this morning and is now built and unreachable.

     They are kept, not deleted, because nothing about them is wrong. The view,
     its age gate (migration 0093) and its one-column query are all deployed and
     correct, and the redesign's own note says clinical detail belongs on an
     injury screen that does not exist yet — the chevron the reference draws on
     the Modified row is pointing at it. Deleting this would mean rebuilding the
     careful half later: the source_table-style restraint in the select list, the
     minor gate, and the render-nothing-and-explain-nothing rule.

     So: assert they still exist, assert Today no longer calls them, and assert
     the restraint is intact so it cannot rot while it sits unused. */
  assert(/export async function fetchAthleteInjuryClinical/.test(query),
    'the query still exists, ready for the injury screen');
  assert(/export function InjuryClinical/.test(view),
    'and so does the component');
  assert(!/fetchAthleteInjuryClinical/.test(today),
    'but Today no longer calls it');
  assert(!/InjuryClinical/.test(today),
    'and no longer renders it');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
