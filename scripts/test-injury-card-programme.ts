/* The injury card's programme status line and its route to the real screen.
 *
 * WHAT THIS IS FOR. The card told a medic an athlete was injured and stopped
 * there. Everything built this week — the S&C's proposal, the medic's sign-off,
 * the timeline — lives on /injuries/[injuryId], and nothing on the profile said
 * so or pointed at it. A medic looking at the profile could not tell whether a
 * programme had been proposed, was running, or did not exist.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. The card stays a summary. No stage control,
 * no timeline, no sign-off button — those stay on the dedicated screen, and the
 * assertions below pin that, because "just one more control" is exactly how a
 * summary becomes a second, worse copy of the record it summarises.
 *
 * THE EMPTY CASE IS A STATE, not an absence. "No rehab programme yet" is
 * information a medic acts on; rendering nothing would be indistinguishable from
 * a card that had not loaded.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const card = readFileSync('src/components/InjuryCard/InjuryCard.tsx', 'utf8');
const cardCode = strip(card);
const page = readFileSync('src/app/(staff)/squad/[athleteId]/page.tsx', 'utf8');
const pageCode = strip(page);
const q = readFileSync('src/lib/queries/injuryTimeline.ts', 'utf8');
const qCode = strip(q);

console.log('the three states are all expressed');
assert(/'proposed'/.test(qCode) && /'active'/.test(qCode), 'the query distinguishes proposed from active');
assert(/kind: 'none'/.test(qCode), "and has an explicit 'none' state rather than returning null");
assert(/No rehab programme yet/.test(card), 'the card says so plainly when there is none');
assert(/awaiting your sign-off/.test(card), 'a proposal names what the medic has to do');
assert(/week \{|week \$\{|Week /.test(card), 'an active programme reports how far through it is');

console.log('\nweek N of M is derived, and degrades when it cannot be');
{
  const fn = qCode.slice(qCode.indexOf('export async function fetchInjuryProgrammeStatus'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(body.length > 0, 'fetchInjuryProgrammeStatus exists');
  assert(/duration_weeks/.test(body), 'it reads the programme duration');
  assert(/starts_on/.test(body), 'and the assignment start');
  assert(
    /duration_weeks \?\? null/.test(body) && /week =\s*[\s\S]*null/.test(body),
    'and both are nullable, so a programme with no duration shows a name without inventing a week count',
  );
}

console.log('\nthe route to the real screen');
/* JSX escapes the ampersand, so match either form rather than the one I happened to write. */
assert(/Manage injury (&|&amp;) programme/.test(card), 'the action is named for what it leads to');
assert(/\/injuries\/\$\{active\.id\}/.test(cardCode), 'and links to that injury record');

console.log('\nmedic only, matching the rest of the card');
assert(
  /canEditClinical && active/.test(cardCode),
  'the programme section renders only for a clinical viewer with an active injury',
);
assert(
  /programmeStatus/.test(pageCode) && /viewerIsClinical/.test(pageCode),
  'and the page only fetches it for that viewer, so a coach never asks for it',
);

console.log('\nthe card stays a summary');
for (const forbidden of ['onAddToDay', 'signOffProposal', 'requestProposalChanges', 'InjuryTimeline', 'setStep']) {
  assert(!cardCode.includes(forbidden), `no ${forbidden} on the card — that work stays on the injury record screen`);
}
assert(!/<button/.test(cardCode), 'the card has no buttons at all; its only affordances are links');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
