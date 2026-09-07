/* The week-template builder's header: a miniature week, not a load chart.
 *
 * WHAT REPLACED WHAT. The top of the builder showed WeekLoadChart — planned
 * load per position, as bars, with a "Total planned load" caption. It answered
 * a sports-science question. The question a coach actually has while building a
 * template is "what does this week look like", and a bar chart of RPE x minutes
 * does not answer it. The header is now a small grid: one column per position,
 * each session drawn as a block at its real start time, in the same colours the
 * real schedule uses.
 *
 * WHAT IT IS NOT. Not editable, and asserted as such below — it is a preview of
 * what applying this template will produce. All editing stays in the per-day
 * cards underneath, which is also where Delete lives.
 *
 * THE AXIS IS MD-RELATIVE, NOT MONDAY-TO-SUNDAY, and that is a property of the
 * data rather than a choice made here. A week template is anchored to the
 * fixture (`anchor: 'fixture'`, `covers` in MD offsets, mdOffset -14..+7); it
 * carries no weekday at all. Weekdays only exist once the template is applied
 * against a real fixture, on the Apply screen. Labelling these columns Monday
 * to Sunday would mean inventing a match day and would print the wrong day name
 * for every midweek fixture.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const builder = readFileSync('src/components/WeekTemplateBuilder/WeekTemplateBuilder.tsx', 'utf8');
const bCode = strip(builder);
const preview = readFileSync('src/components/WeekTemplatePreview/WeekTemplatePreview.tsx', 'utf8');
const pCode = strip(preview);
const css = readFileSync('src/styles/base.css', 'utf8');

console.log('the load chart is gone from the builder');
assert(!/WeekLoadChart/.test(bCode), 'WeekLoadChart is no longer imported or rendered there');
assert(!/Total planned load/.test(bCode), 'and its "Total planned load" caption went with it');
assert(/<WeekTemplatePreview/.test(bCode), 'the preview takes its place');

console.log('\nit draws a miniature of the real schedule');
assert(/computeHourRange/.test(pCode), 'the live grid\'s range helper still sets the outer bound');
assert(
  /Math\.min\(\.\.\.all\.map/.test(pCode) && /Math\.max\(\.\.\.all\.map/.test(pCode),
  'but the window tightens to the sessions\' own span — a thumbnail should not draw an empty evening',
);
assert(/TYPE_STYLE/.test(pCode), 'and blocks use the same type colours, so it reads as the same object');
assert(/clockLabel|startTime/.test(pCode), 'times are shown');
assert(/top:/.test(pCode) && /height:/.test(pCode), 'blocks are positioned and sized rather than listed');
assert(/mdLabel/.test(pCode), 'each column is labelled by its position');

console.log('\none column per position in the template');
assert(/days\.map\(/.test(pCode), 'it renders a column per day handed to it');
assert(
  /positions/.test(bCode.slice(bCode.indexOf('<WeekTemplatePreview'), bCode.indexOf('<WeekTemplatePreview') + 200)),
  'and the builder hands it the same positions the cards below are built from',
);

console.log('\nit is a preview, not a second editor');
for (const interactive of ['onClick', 'onChange', 'onInput', '<button', '<input', '<select']) {
  assert(!pCode.includes(interactive), `no ${interactive} anywhere in it`);
}

console.log('\nit says something useful when there is nothing to show');
assert(/length === 0/.test(pCode), 'an empty template renders a message rather than an empty box');

console.log('\nthe axis is MD-relative, and the file says why');
assert(
  /anchor|fixture|MD/.test(preview),
  'the component records that a template has no weekday, so a reader does not "fix" it to Mon-Sun',
);

console.log('\nremoving a session still works — the other half of this change');
{
  /* Delete already existed and must survive the header swap. Asserted here
     because the request assumed it was missing, and a regression would make
     that true. */
  assert(/function removeSession/.test(bCode), 'removeSession is still defined');
  assert(/onClick=\{\(\) => removeSession\(/.test(bCode), 'and still wired to a control');
  const rowAt = bCode.indexOf('day.sessions.map(');
  const del = bCode.indexOf('removeSession(day.mdOffset', rowAt);
  assert(del > rowAt, 'on every session row in the day cards');
}

console.log('\nthe preview has its own styles');
assert(/\.wtp-grid/.test(css), 'base.css defines the preview grid');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
