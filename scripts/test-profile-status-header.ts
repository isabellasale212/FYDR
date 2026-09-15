/* STAFF-SS-02-05 C1 / B1 — the status header (2026-09-13). The board's
 * rule 1: "Every profile opens with the same status header. Name, position,
 * group, availability status and restrictions, in the dashboard's words and
 * tones. It is the one emphasised card on the screen and absorbs the
 * development-plan bar and the bio row." B1 maps --blue-100/200 onto the
 * wash family as ATH-ADULT-04 did. The coach's bio strip has no Weight (C9).
 *
 * The sentences are pure (lib/profileHeader.ts) and exercised with rows;
 * the page, the component and the CSS are read from source. */
import { readFileSync } from 'node:fs';
import { headerOwnerLine, headerRestrictionLine, headerSubLine, planLine } from '@/lib/profileHeader';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const css = strip(read('src/styles/base.css'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};
const tz = 'Europe/London';

console.log('1. the sub line: position · jersey · groups');
{
  /* Groups only since 16 Sept 2026 (Isabella's overnight queue, 3.1): the
     position and the jersey are in the detail row beneath, and the line
     restated them. */
  assert(headerSubLine({ position: 'Flanker', squadNumber: 7, groupNames: ['Forwards', 'Rehab'] }) === 'Forwards, Rehab', '"Forwards, Rehab" — the groups, not the position and jersey the detail row already shows');
  assert(headerSubLine({ position: null, squadNumber: null, groupNames: [] }) === 'No group', 'nothing recorded is said, not blank');
  assert(headerSubLine({ position: 'Hooker', squadNumber: 2, groupNames: [] }) === 'No group', 'a missing group is said');
}

console.log('\n2. the restriction line: what a coach acts on, and the expected return');
{
  assert(headerRestrictionLine({ status: 'modified', restrictions: ['no contact', 'no collision drills'], reason: 'injury', note: null, expectedReturn: '2026-09-21' }, tz) === 'No contact · No collision drills. Expected return to full training Mon 21 Sept.', 'restrictions, then the expected return when the injury has one');
  assert(headerRestrictionLine({ status: 'modified', restrictions: ['no contact'], reason: 'injury', note: 'Reviewed daily. Contact decision Thursday morning.', expectedReturn: '2026-09-21' }, tz) === 'No contact. Reviewed daily. Contact decision Thursday morning. Expected return to full training Mon 21 Sept.', 'the coach-visible note travels with the restrictions — it was written for this line');
  assert(headerRestrictionLine({ status: 'unavailable', restrictions: [], reason: 'academic', note: 'Exams this week, back Monday 24th', expectedReturn: null }, tz) === 'Academic — Exams this week, back Monday 24th', 'an absence: the category and the coach-visible note');
  assert(headerRestrictionLine({ status: 'unknown', restrictions: [], reason: null, note: null, expectedReturn: null }, tz) === 'No restriction recorded. Not counted as available and not counted as out.', '"Not recorded" says what it means for the counts');
  assert(headerRestrictionLine({ status: 'available', restrictions: [], reason: null, note: null, expectedReturn: null }, tz) === null, 'available draws no line');
  assert(headerRestrictionLine({ status: 'modified', restrictions: [], reason: null, note: null, expectedReturn: null }, tz) === 'No reason recorded', 'modified with nothing recorded is said');
}

console.log('\n3. the owner line');
{
  assert(headerOwnerLine({ status: 'modified', injuryLinked: true, setByName: 'Ruth Callaghan', setOn: '2026-09-11' }, tz) === 'Set by medical staff · Ruth Callaghan · Fri 11 Sept', '"Set by medical staff · Ruth Callaghan · Fri 11 Sept"');
  assert(headerOwnerLine({ status: 'unavailable', injuryLinked: false, setByName: 'Peter Ackland', setOn: '2026-09-11' }, tz) === 'Set by coaching staff · Peter Ackland · Fri 11 Sept', 'a non-injury row names the coaching staff');
  assert(headerOwnerLine({ status: 'unknown', injuryLinked: false, setByName: null, setOn: null }, tz) === 'Set by medical staff · nothing recorded', 'nothing recorded, the board\'s words');
  assert(headerOwnerLine({ status: 'available', injuryLinked: false, setByName: null, setOn: '2026-09-01' }, tz) === 'Set by coaching staff · Tue 1 Sept', 'a setter with no name on record still dates the row');
}

console.log('\n4. the plan line absorbed into the header');
{
  assert(planLine({ name: 'In-Season max', weekNow: 2, weekTotal: 4, endsOn: '2026-09-29' }, tz) === 'Development plan · In-Season max · week 2 of 4 · ends Tue 29 Sept', '"Development plan · In-Season max · week 2 of 4 · ends Tue 29 Sept"');
  assert(planLine({ name: 'Pre-season', weekNow: 6, weekTotal: null, endsOn: null }, tz) === 'Development plan · Pre-season · week 6', 'an open-ended plan');
  assert(planLine(null, tz) === 'Development plan · none assigned', 'none assigned is said');
}

console.log('\n5. the page and the component');
{
  const page = strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'));
  assert(!/className="pp-banner"/.test(page), 'the separate development-plan bar is gone');
  assert(/<section className="card pp-card pp-hero" aria-labelledby="pp-name">/.test(page), 'the header is the one emphasised card');
  assert(/subLine=\{headerSubLine\(/.test(page) && /restrictionLine=\{headerRestrictionLine\(/.test(page) && /ownerLine=\{headerOwnerLine\(/.test(page) && /planLine=\{planLine\(/.test(page), 'the four lines come from the pure rules');
  assert(/planHref=\{programme \? `\/programmes\/\$\{programme\.programmeId\}` : null\}/.test(page) && /planLabel=\{canAuthorProgramme \? 'Change plan' : 'View plan'\}/.test(page), 'the plan link keeps its two labels');
  const bio = strip(read('src/components/PlayerProfileBio/PlayerProfileBio.tsx'));
  assert(/subLine: string;/.test(bio) && /restrictionLine: string \| null;/.test(bio) && /ownerLine: string;/.test(bio) && /planLine: string;/.test(bio), 'the component takes the lines as strings');
  assert(/className="pp-hero-sub"/.test(bio) && /className="pp-hero-rest"/.test(bio) && /className="pp-hero-owner"/.test(bio) && /className="num pp-hero-plan"/.test(bio), 'and draws them in their places');
  assert(/<div className="l">Weight<\/div>/.test(bio) && /weightDisplay !== null \?/.test(bio), 'the coach\'s strip still has no Weight (C9)');
}

console.log('\n6. the treatment: the wash family, B1\'s mapping');
{
  const hero = rule('.pp-hero');
  assert(/background:\s*var\(--wash-accent\)/.test(hero) && /border(-color)?:\s*(1px solid )?var\(--border-accent-soft\)/.test(hero), '--blue-100 → --wash-accent, --blue-200 → --border-accent-soft');
  assert(/box-shadow:\s*var\(--shadow\)/.test(hero), 'with the one shadow');
  assert(/text-transform:\s*uppercase/.test(rule('.pp-hero-owner')) && /letter-spacing/.test(rule('.pp-hero-owner')), 'the owner line is the eyebrow treatment (B3\'s nearest token)');
  assert(!/\.pp-banner\s*\{/.test(css), 'the banner\'s rules are retired');
  assert(/border-top:\s*1px solid var\(--border-accent-soft\)/.test(rule('.pp-hero .pp-detail-row')) || /border-top:\s*1px solid var\(--border-accent-soft\)/.test(rule('.pp-hero-plan-row')), 'the bio row sits under a hairline in the card\'s own border colour');
}

console.log('\n7. the spec');
{
  const spec = read('docs/screens/03-athlete-profile.md');
  assert(/status header/.test(spec) && /Set by medical staff/.test(spec) && /Development plan · /.test(spec), '03-athlete-profile.md §4 describes the status header');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
