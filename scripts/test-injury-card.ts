/* The injury card on the player profile — CHANGELOG-injury-card-spec.md.
 *
 * WHAT THIS FILE IS FOR. The card's whole risk is one direction: clinical detail
 * reaching a role that may not see it. Two independent things have to hold, and
 * this asserts the first while supabase/tests/390 asserts the second:
 *
 *   1. The component cannot render clinical content unless it was given it, and
 *      the page only asks for it when the viewer is a medic. (Here.)
 *   2. The database refuses it to everyone else regardless of what any component
 *      does. (390_injury_card_clinical_isolation_test.sql.)
 *
 * The second is the one that matters; the first is what stops a bug becoming a
 * disclosure before the second catches it.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const card = readFileSync('src/components/InjuryCard/InjuryCard.tsx', 'utf8');
const cardCode = strip(card);
const page = readFileSync('src/app/(staff)/squad/[athleteId]/page.tsx', 'utf8');
const pageCode = strip(page);

console.log('the clinical block is reachable only when clinical data was passed in');
/* Every clinical field must sit inside the `clinical ? ... : ...` branch. The
   cheap way to assert that is that each field name appears only after the
   conditional opens and before its else. */
const open = cardCode.indexOf('{clinical ? (');
const elseAt = cardCode.indexOf(') : (', open);
assert(open > -1 && elseAt > open, 'the card branches on `clinical` being non-null');
for (const field of ['diagnosis', 'mechanism', 'severity', 'tissue_type', 'imaging', 'referral', 'treatment_plan', 'clinical_notes']) {
  const uses = [...cardCode.matchAll(new RegExp(`clinical\\.${field}`, 'g'))].map((m) => m.index ?? -1);
  assert(uses.length > 0 && uses.every((i) => i > open && i < elseAt), `clinical.${field} is only read inside that branch`);
}

console.log('\nthe limited view stops where the spec says it stops');
const limited = cardCode.slice(elseAt);
for (const forbidden of ['diagnosis', 'mechanism', 'severity', 'tissue_type', 'imaging', 'referral', 'treatment_plan', 'clinical_notes']) {
  assert(!limited.includes(forbidden), `the non-medic branch never mentions ${forbidden}`);
}
assert(/restrictions/.test(limited), 'it does render restrictions');
assert(/expected_return/.test(limited), 'and expected return');

console.log('\nnothing is disabled rather than absent — a greyed field implies something to unlock');
assert(!/disabled/.test(cardCode), 'the card renders no disabled control at all');
assert(!/aria-disabled/.test(cardCode), 'nor an aria-disabled one');

console.log('\nthe page does not fetch clinical detail for a non-medic');
assert(
  /viewerIsClinical && activeInjury \? await fetchInjuryClinical/.test(pageCode),
  'fetchInjuryClinical is called only when the viewer is clinical',
);
assert(
  /viewerIsClinical = hasAnyRole\(claims\.roles, CLINICAL_ONLY\)/.test(pageCode),
  'and "clinical" means CLINICAL_ONLY, the medic-only set',
);

console.log('\nthe badge keeps clinical stage names for every role');
assert(!/Unavailable/.test(cardCode), 'no availability remap: "Unavailable" appears nowhere');
assert(!/Modified/.test(cardCode), 'nor "Modified"');
assert(
  /STATUS_TONE/.test(cardCode) && /enumLabel\(active\.status\)/.test(cardCode),
  'the badge renders the status enum directly, so there is one vocabulary and no second status to drift',
);

console.log('\nreferral is text, never a link');
const referralLine = cardCode.slice(cardCode.indexOf('clinical.imaging || clinical.referral'), cardCode.indexOf('clinical.imaging || clinical.referral') + 320);
assert(!/<Link|href=/.test(referralLine), 'the imaging/referral line contains no link');
assert(!/Report on file/.test(card), 'and the phrase "Report on file" is not used: there is no document to open');

console.log('\nthe header button is medic-only and absent otherwise');
assert(/canEditClinical && active \? \(/.test(cardCode), 'the button renders only for a medic with an active injury');
assert(/Add clinical detail/.test(card) && /'Edit'/.test(card), 'and switches label on whether clinical detail exists');

console.log('\ncard position: after the S&C history log, before Flags');
const sc = pageCode.indexOf('pp-sc-title');
const inj = pageCode.indexOf('<InjuryCard');
const flags = pageCode.indexOf('<PlayerProfileFlags');
assert(sc > -1 && inj > sc, 'the injury card comes after the S&C history log');
assert(flags > inj, 'and before Flags');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
