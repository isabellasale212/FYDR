/* Apply and Edit, per template, on the week-templates list.
 *
 * WHAT WAS THERE. The whole card was one <Link> to the builder, so the list
 * offered exactly one verb — edit — and never named it. Applying, which is the
 * thing a template exists for, was reachable only by going to Schedule, finding
 * "Apply a template", and picking the name back out of a <select>. The list
 * knew which template you meant and threw that away.
 *
 * WHY THE CARD CANNOT STAY A LINK. Two buttons inside an anchor is invalid
 * HTML — the browser recovers by hoisting them out of it, which is a layout the
 * source does not describe and neither does the parser's. So the wrapper
 * becomes a div and the card's title carries the Edit link. Asserted here
 * because the failure is silent: it renders, roughly, until it doesn't.
 *
 * ARCHIVED TEMPLATES GET NO APPLY. The apply screen filters them out of its own
 * picker (`usableTemplates`), so an Apply button on an archived row would land
 * on a page whose select cannot select it — a dead end that looks like a bug in
 * the apply screen rather than in this list.
 *
 * SAVE RETURNS TO THE SCHEDULE, which is the queue's wording. It is a real
 * change of behaviour, not a redirect tidy-up: Save used to refresh in place,
 * so the builder was somewhere you stayed. Editing a template is now a round
 * trip that ends where the work is.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const flat = (s: string): string => strip(s).replace(/\s+/g, ' ');

const LIST = 'src/app/(staff)/schedule/planner/page.tsx';
const BUILDER = 'src/components/WeekTemplateBuilder/WeekTemplateBuilder.tsx';

console.log('the list offers both verbs, per template');
{
  const p = flat(read(LIST));
  assert(/>\s*Apply\s*</.test(p), 'there is an Apply control');
  assert(/>\s*Edit\s*</.test(p), 'and a separate Edit control');
  assert(
    /\/schedule\/planner\/apply\?template=\$\{t\.id\}/.test(p),
    'Apply carries the template it is next to, rather than dropping the user on an empty picker',
  );
  assert(
    /href=\{`\/schedule\/planner\/\$\{t\.id\}`\}/.test(p),
    'Edit opens that same template in the builder',
  );
}

console.log('\nthe card stops being one big anchor');
{
  const p = flat(read(LIST));
  assert(
    !/<Link[^>]*className="card"/.test(p),
    'no Link carries className="card" — buttons inside an anchor is invalid HTML the browser silently reflows',
  );
  assert(/<div key=\{t\.id\} className="card"/.test(p), 'the card is a div now');
}

console.log('\nan archived template offers Edit but not Apply');
{
  const p = flat(read(LIST));
  assert(/t\.archived/.test(p), 'the row knows whether it is archived');
  const applyIdx = p.indexOf('/schedule/planner/apply?template=');
  const guardIdx = p.lastIndexOf('t.archived', applyIdx);
  assert(
    guardIdx !== -1 && applyIdx - guardIdx < 220,
    'and the archived check guards the Apply control specifically, not the whole row',
  );
  assert(
    /archived/i.test(read('src/app/(staff)/schedule/planner/apply/page.tsx')),
    'which matches the apply screen, that filters archived templates out of its own picker',
  );
}

console.log('\nsaving an edit returns to the schedule');
{
  const b = strip(read(BUILDER));
  const fn = b.slice(b.indexOf('const saveMutation'));
  const body = fn.slice(0, fn.indexOf('});'));
  assert(/onSuccess/.test(body), 'the save has a success path');
  assert(/router\.push\('\/schedule'\)/.test(body), "which pushes to '/schedule'");
  assert(
    !/router\.refresh\(\)/.test(body),
    'and no longer refreshes in place, which would race the navigation for no benefit',
  );
}

console.log('\nnothing else about the builder moved');
{
  const b = read(BUILDER);
  assert(/Save changes/.test(b), 'the button still says Save changes');
  assert(/duplicateMutation|duplicate/i.test(b), 'duplicate still exists');
  assert(/Unsaved changes/.test(b), 'and the unsaved-changes marker is untouched');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
