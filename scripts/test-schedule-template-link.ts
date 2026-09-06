/* The Week-templates link on the Schedule header.
 *
 * WHAT WAS WRONG. A coach could not find any way to create a week template.
 * Not a role check — SESSION_EDIT is ['sport_scientist','coach'], the coach is
 * in it, /schedule/planner renders "+ New template" for them and
 * /schedule/planner/new admits them. The page was simply unreachable:
 *
 *   - it is in no sidebar row (the nav has one Schedule row, /schedule);
 *   - the only link to it from /schedule read "Save this week as a template",
 *     which is a different action — seed a template FROM this week — and not
 *     what somebody looking to create one from scratch is scanning for;
 *   - and that link sits in the toolbar, which only renders in Edit mode,
 *     behind a Read/Edit toggle that defaults to Read. In the state you land
 *     in, there was no template control on screen at all.
 *
 * The fix goes in the chiprow that already exists for exactly this class of
 * problem — the row whose own comment records that /schedule/new "could only be
 * reached by typing it". That row renders outside the mode check, so it is
 * there in Read as well as Edit.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const ws = readFileSync('src/components/ScheduleGrid/ScheduleWorkspace.tsx', 'utf8');
const code = strip(ws);
const planner = readFileSync('src/app/(staff)/schedule/planner/page.tsx', 'utf8');

console.log('the link exists and points at the templates list');
assert(/href="\/schedule\/planner"/.test(code), 'ScheduleWorkspace links to /schedule/planner');
assert(/Week templates/.test(code), 'and the link reads "Week templates"');

console.log('\nit is reachable in READ mode, which is where you land');
{
  /* The toolbar is inside `mode === 'edit' ? (...) : null`. The whole point of
     this change is that the link is NOT in there — a control you can only see
     after finding a toggle is the bug, not the fix. */
  const toolbarAt = code.indexOf("mode === 'edit' ? (");
  const linkAt = code.indexOf('href="/schedule/planner"');
  assert(toolbarAt > -1, 'the edit-only toolbar is still present');
  assert(linkAt > -1 && linkAt < toolbarAt, 'and the Week templates link sits BEFORE it, outside the mode check');
}

console.log('\nit sits with the other routes that were unreachable');
{
  const rowAt = code.indexOf('className="chiprow"');
  const bannerAt = code.indexOf('sg-banner');
  const linkAt = code.indexOf('href="/schedule/planner"');
  assert(rowAt > -1 && linkAt > rowAt && linkAt < bannerAt,
    'the link is in the chiprow that already carries + Session and + Fixture');
}

console.log('\nthe destination still gates CREATION on SESSION_EDIT');
{
  /* The link is navigation, not permission. Making the list reachable must not
     change who may create a template — that stays SESSION_EDIT, decided by
     G-33, and whether a medic should see scheduling surfaces at all is the
     separate access pass, not this change. */
  assert(/SESSION_EDIT/.test(planner), 'the planner page still resolves SESSION_EDIT from lib/access.ts');
  assert(/canWrite\s*\?/.test(strip(planner)), 'and still renders + New template conditionally');
}

console.log('\nthe existing "save this week" route is untouched');
assert(/saveTemplateHref/.test(code), 'Save this week as a template is still passed in');
assert(
  code.indexOf('saveTemplateHref') > -1 && code.lastIndexOf('saveTemplateHref') > code.indexOf("mode === 'edit' ? ("),
  'and still lives in the edit toolbar — seeding from the current week is a different action',
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
