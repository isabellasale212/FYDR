/* ATH-ADULT-06 — RPE already rated, and Session not found. Built 2026-09-12
 * from the "After submit states" board, A items only; the record is
 * docs/overnight-records-2026-09-12.md.
 *
 *   A1 Already rated: heading "Already rated" (--fs-28), the fact "You rated
 *      this session 5 of 10 at 11:36." at --fs-20 --text, the board's two
 *      recourse sentences beneath
 *   A2 one emphasised card (.after-card, 04's)
 *   A3 the exit is a footer button, "Back to Today" — no text link
 *   A4 Session not found: the outcome at heading size, the verbatim body,
 *      the exit in the footer, the title "Rate a session", HTTP 200
 *   A5 the close button says what it closes
 * Kept: the h1 "Rate {session name}" (02's decision RPE 3); the session
 * block under the head (the board's subhead would duplicate it — C1).
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/&rsquo;/g, '’').replace(/&mdash;/g, '—');
const read = (p: string): string => readFileSync(p, 'utf8');
const page = strip(read('src/app/(athlete)/rpe/[sessionId]/page.tsx'));

console.log('A4. session not found');
{
  const branch = page.slice(page.indexOf('if (!session) {'), page.indexOf('const entryDate = dateInTz'));
  assert(/<h1 className="t">Rate a session<\/h1>/.test(branch), 'the title stays "Rate a session" — neutral, promising no control');
  assert(/className="after-card"/.test(branch) && /<h2 className="after-heading">This session isn’t there<\/h2>/.test(branch), 'the outcome is the emphasised card\'s heading');
  assert(/It may have been cancelled or is not one of yours\. Nothing is lost, there is nothing to rate\./.test(branch.replace(/\s+/g, ' ')), 'the body is verbatim, with the comma the prompt fixes');
  assert(!/className="empty"/.test(branch), 'no longer the dashed empty panel');
  assert(/<div className="subm">[\s\S]*?<Link href="\/today" className="btn-primary"[\s\S]*?Back to Today[\s\S]*?<\/div>/.test(branch), 'the way out is a full-width primary "Back to Today" in the footer');
  assert(!/notFound\(\)|status: 404/.test(branch), 'still HTTP 200 — never reveals which case applies');
}

console.log('\nA1–A3. already rated');
{
  const branch = page.slice(page.indexOf('{existing ? ('), page.indexOf(') : closed ? ('));
  assert(/className="after-card"/.test(branch) && /<h2 className="after-heading">Already rated<\/h2>/.test(branch), '"Already rated" as the emphasised card\'s heading');
  assert(/className="after-fact num"/.test(branch) && /You rated this session \{existing\.rpe\} of 10/.test(branch) && /` at \$\{new Intl\.DateTimeFormat/.test(branch), 'the fact: "You rated this session N of 10 at HH:MM."');
  assert(/You can’t change a rating yourself\. Tell your coach and they can correct it for you\./.test(branch.replace(/\s+/g, ' ')), 'the board\'s recourse sentence');
  assert(/The original stays visible in My data, marked Corrected\./.test(branch), 'and what happens to the original');
  assert(!/A submitted rating can’t be edited, by you or by anyone/.test(branch), 'the 40-word paragraph is gone');
  assert(!/<Link href="\/today">Back to today<\/Link>/.test(branch) && !/linklike/.test(branch), 'no text link');
  assert(/<div className="subm">[\s\S]*?<Link href="\/today" className="btn-primary"[\s\S]*?Back to Today/.test(branch), 'the exit is the footer button');
  assert(!/g-good/.test(branch), 'no ✓ glyph — the heading carries the fact');
}

console.log('\nA5 and what is kept');
{
  assert((page.match(/aria-label="Close the session rating"/g) ?? []).length === 2 && !/aria-label="Close"/.test(page), 'both close buttons say "Close the session rating"');
  assert(/<h1 className="t">\{rpeRowName\(session\.title\)\}<\/h1>/.test(page), 'the h1 is still "Rate {session name}" (02, RPE 3)');
  assert(/className="sess"/.test(page), 'the session block under the head is kept (the board\'s subhead would duplicate it — C1)');
  assert(/This session can no longer be rated\./.test(page) && /Not quite yet\./.test(page), 'the closed and not-yet-due banners are untouched');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/03-session-rating.md');
  assert(/Already rated/.test(spec) && /Back to\s+Today/.test(spec) && /This session\s+isn.t there/.test(spec), '03-session-rating.md describes both after-submit states and their footer button');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
