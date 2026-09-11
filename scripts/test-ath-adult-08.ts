/* ATH-ADULT-08 — the weekly nutrition check-in after submit, and its
 * correction. Built 2026-09-12 from the "After submit states" board, A items
 * only; the record is docs/overnight-records-2026-09-12.md.
 *
 *   A1/A2 Already answered: the emphasised card, heading --fs-28, the fact
 *         "You answered Yes." at --fs-20 (the spec's words, not the board's —
 *         D1), "Sent {date} at {time}." beneath, the existing sentence
 *   A3    the exits are two 44px buttons in the footer: "Back to Today"
 *         primary, "Correct this answer" secondary beneath it
 *   A4    the correction banner names the real week
 *   A5    the correction's action is "Save correction"
 *   A6    "Keep the original" leaves the correction without saving
 *   A7    the original answer keeps a "Your answer" tag once another is chosen
 *   A8    the week as the subhead on the after-submit branches
 *   A9    the close button says "Close the check-in"
 * Not built (C1–C3): once-only, the spent state, the "Correction saved" state
 * and the caption that asserts once — nothing enforces once today.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/&rsquo;/g, '’');
const read = (p: string): string => readFileSync(p, 'utf8');
const page = strip(read('src/app/(athlete)/nutrition-check-in/page.tsx'));
const form = strip(read('src/components/NutritionCheckinForm/NutritionCheckinForm.tsx'));
const css = strip(read('src/styles/base.css'));

console.log('A1–A3, A8, A9. the answered state');
{
  const branch = page.slice(page.indexOf(') : existing ? ('), page.indexOf(') : (', page.indexOf(') : existing ? (') + 10));
  assert(/className="after-card"/.test(branch) && /<h2 className="after-heading">Already answered<\/h2>/.test(branch), '"Already answered" as the emphasised card\'s heading');
  assert(/className="after-fact"/.test(branch) && /You answered/.test(branch) && /answerLabel/.test(branch), 'the fact "You answered Yes." — the spec\'s words');
  assert(/'Yes'/.test(page) && /'Roughly'/.test(page) && /'No'/.test(page) && !/most days/.test(page) && !/Some days/.test(page), 'Yes / Roughly / No, never the board\'s "Yes, most days / Some days" (D1)');
  assert(/Sent \{formatDate/.test(branch) || /Sent /.test(branch), '"Sent {date} at {time}." beneath the fact');
  assert(/This is the one entry you can change yourself\. A correction creates a new revision and the original is kept\./.test(branch.replace(/\s+/g, ' ')), 'the existing sentence about correction');
  assert(!/linklike/.test(branch) && !/Change this answer/.test(branch), 'no text links, and "Change this answer" is gone');
  const footer = /<div className="subm subm-stack">[\s\S]*?<\/div>\s*<\/>/.exec(branch)?.[0] ?? '';
  assert(/<Link href="\/today" className="btn-primary"[\s\S]*?Back to Today/.test(footer), '"Back to Today" is the primary');
  assert(/className="btn-ghost"[\s\S]*?Correct this answer/.test(footer) && /correct=1/.test(footer), '"Correct this answer" is the secondary beneath it, linking to the correction');
  assert(footer.indexOf('Back to Today') < footer.indexOf('Correct this answer'), 'leaving first, correcting second');
  assert(!/You can correct this once/.test(page), 'no "once" caption — nothing enforces once today (C1/C3)');
  assert(/<p className="s num">\{weekLabel\}<\/p>/.test(page), 'the week is the subhead ("Mon 31 Aug to Sun 6 Sept")');
  assert(/aria-label="Close the check-in"/.test(page) && !/aria-label="Close"/.test(page), 'the close button says "Close the check-in"');
}

console.log('\nA4–A7. the correction');
{
  const banner = /correction \? \(\s*<div className="banner"[\s\S]*?<\/div>\s*\) : null\}/.exec(form)?.[0] ?? '';
  assert(/Correcting your answer for \{formatDate\(weekStart, timezone\)\} to \{formatDate\(weekEnd, timezone\)\}\./.test(banner.replace(/\s+/g, ' ')), 'the banner names the real week, not "this week"');
  assert(/This creates a new revision; the original is kept, not overwritten\./.test(banner.replace(/\s+/g, ' ')), 'and keeps the revision sentence exactly');
  assert(/correction \? 'Save correction' : 'Done'/.test(form) || /pending \? 'Saving…' : correction \? 'Save correction' : 'Done'/.test(form), 'the action is "Save correction" in correction mode, "Done" otherwise');
  assert(/Keep the original/.test(form) && /className="btn-ghost"/.test(form) && /href=\{`\/nutrition-check-in\?week=\$\{weekStart\}`\}/.test(form), '"Keep the original" is a secondary Link back to the answered state, saving nothing');
  assert(/correction && correction\.initialAnswer === a\.value && answer !== a\.value/.test(form) && /Your answer/.test(form) && /pill pill-neutral/.test(form), 'the original answer keeps a "Your answer" tag once a different one is chosen');
  assert(/nut-answer-tag/.test(css) && /\.nut-answer\s*\{[^}]*justify-content:\s*center/.test(css), 'the tag has a rule and the row stays centred');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/04-weekly-nutrition-check-in.md');
  assert(/Correct this answer/.test(spec) && /Save correction/.test(spec) && /Keep the original/.test(spec) && /Already answered/.test(spec), '04-weekly-nutrition-check-in.md describes the answered state, its two buttons and the correction\'s controls');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
