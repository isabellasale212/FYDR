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
 * C1–C3 (2026-09-12, decision sheet group (c)): once-only — migration 0107
 * refuses a second correction (630_nutrition_checkin_correct_once_test.sql);
 * the page reads the chain (`prior`) and shows the spent state before the
 * form is offered; a saved correction stays on the page ("Correction
 * saved"); the caption "You can correct this once after you submit." is
 * shown now that it is true; My data marks the week Corrected.
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
  assert(branch.length > 0, 'the answered branch is where it was');
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
  assert(/<p className="cap subm-caption">You can correct this once after you submit\.<\/p>/.test(branch), 'the caption "You can correct this once after you submit." above the buttons (C3) — true since 0107');
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

console.log('\nC1. once — the migration, the read, and the spent state before the form');
{
  const mig = read('supabase/migrations/0107_nutrition_checkin_correct_once.sql');
  assert(/if v_original\.revision_of is not null then\s*raise exception 'entry_already_corrected'/.test(mig), '0107: revising a revision raises entry_already_corrected');
  const q = strip(read('src/lib/queries/nutrition.ts'));
  assert(/prior: \{ answer: NutritionAnswer; submitted_at: string \| null \} \| null;/.test(q) && /revision_of/.test(q), 'fetchCheckinForWeek reads revision_of and the prior answer');
  assert(/entry_already_corrected/.test(q) && /You have used your one correction for this check-in\./.test(q), 'reviseCheckin says why when the correction is spent (the concurrent-tab case)');
  assert(!/or the window has closed/.test(q), 'the old "or the window has closed" guess is gone');
  assert(/const spent = !!existing\?\.prior;/.test(page) && /const correcting = params\.correct === '1' && !!existing && !spent;/.test(page), 'the page refuses the correction before the form is offered: ?correct=1 on a spent week shows the spent state');
  const spentBranch = page.slice(page.indexOf(': existing && spent ? ('), page.indexOf(') : existing ? ('));
  assert(/<h2 className="after-heading">\s*Already answered/.test(spentBranch) && /pill pill-neutral[^>]*>\s*Corrected/.test(spentBranch), 'the spent state: "Already answered" with the Corrected pill beside it');
  assert(/Corrected \{correctedAt\}\. Originally \{priorLabel\}\./.test(spentBranch.replace(/\s+/g, ' ')), '"Corrected {date} at {time}. Originally Yes."');
  assert(/You have used your one correction for this check-in, so it can’t be changed again\./.test(spentBranch.replace(/\s+/g, ' ')), '"You have used your one correction for this check-in, so it can’t be changed again."');
  assert(/If it still looks wrong, tell your coach\. Both versions stay visible in My data\./.test(spentBranch.replace(/\s+/g, ' ')), 'the coach as the remaining route');
  assert(/Back to Today/.test(spentBranch) && !/Correct this answer/.test(spentBranch), 'one exit: Back to Today — no correction offered');
}

console.log('\nC2. a saved correction stays on the page');
{
  assert(/router\.push\(`\/nutrition-check-in\?week=\$\{weekStart\}&saved=1`\)/.test(form) && !/my-data\?tab=nutrition/.test(form), 'Save correction returns to this page with ?saved=1, not to My data');
  assert(/const justSaved = spent && params\.saved === '1';/.test(page), 'the saved state is the spent state read back with ?saved=1 — the server re-reads the chain, nothing is trusted from the URL');
  const saved = page.slice(page.indexOf(': existing && justSaved ? ('), page.indexOf(': existing && spent ? ('));
  assert(/<h2 className="after-heading">Correction saved<\/h2>/.test(saved), '"Correction saved" as the heading');
  assert(/You answered/.test(saved) && /answerLabel/.test(saved), 'the new answer as the fact');
  assert(/Saved \{correctedAt\}\. Your original answer, \{priorLabel\}, is kept\./.test(saved.replace(/\s+/g, ' ')), '"Saved {date} at {time}. Your original answer, Yes, is kept."');
  assert(/My data shows the week marked Corrected, with both versions\./.test(saved) && /This answer can’t be changed again\./.test(saved), 'where both versions live, and that it cannot change again');
  assert(/Back to Today/.test(saved) && !/Correct this answer/.test(saved), 'one exit: Back to Today');
  assert(/This is your one correction — you can’t change it again after you save\./.test(form.replace(/\s+/g, ' ')), 'the correction footer says it is the one correction');
}

console.log('\nMy data marks the week (the saved state promises it)');
{
  const md = strip(read('src/app/(athlete)/my-data/page.tsx'));
  const rows = md.slice(md.indexOf('Weekly nutrition check-ins, most recent first'), md.indexOf('<ListCapNote shown={shown.length} more={checkins.length > shown.length} noun="weeks" />'));
  assert(/c\.prior \? \(\s*<>\s*<span className="pill pill-neutral"[^>]*>\s*Corrected/.test(rows), 'a corrected week carries the Corrected pill');
  assert(/was \{ANSWER_LABEL\[c\.prior\.answer\]/.test(rows), 'and says what it was');
  assert(/c\.prior \? [\s\S]{0,120}: \(\s*<Link href=\{`\/nutrition-check-in\?week=\$\{c\.week_start\}&correct=1`\}>/.test(rows) || /\{c\.prior \? null : \(/.test(rows) || /!c\.prior \?/.test(rows), 'the Correct link is not offered on a corrected week');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/04-weekly-nutrition-check-in.md');
  assert(/Correct this answer/.test(spec) && /Save correction/.test(spec) && /Keep the original/.test(spec) && /Already answered/.test(spec), '04-weekly-nutrition-check-in.md describes the answered state, its two buttons and the correction\'s controls');
  assert(/Correction saved/.test(spec) && /entry_already_corrected/.test(spec) && !/Not limited to once today/.test(spec), 'and the once rule, the saved state and the spent state');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
