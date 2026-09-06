/* Click-to-create on the Schedule grid: the draft card sits on the calendar.
 *
 * WHAT CHANGED, AND WHAT DID NOT. Clicking an empty slot already created a
 * draft at that day and time — TimeGrid converts the click's Y into an hour
 * snapped to 15 minutes, and startDraft was already documented as "a coach who
 * wants a session at 14:30 on Thursday points at 14:30 on Thursday". The only
 * thing missing was WHERE the editor appeared: in the rail below the grid, so
 * the eye left the calendar. The card now renders over the grid at the slot.
 *
 * ONE FORM, NOT TWO. The card is the SAME SelectedSessionPanel, relocated —
 * asserted below, because a second copy of those fields would fork two fixes
 * that component already carries: the functional-setState fix for two edits
 * batched into one commit dropping the first, and finding 11's fix for fields
 * going read-only the moment "Add to day" was pressed.
 *
 * THE SAVE MODEL IS UNCHANGED, chosen deliberately (option (a)). "Add to day"
 * stages the session locally; nothing reaches the database or the athletes
 * until "Publish to athletes". Asserted here so a future edit cannot quietly
 * turn the card into a direct write and change what Publish means.
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
const wsCode = strip(ws);
const grid = readFileSync('src/components/ScheduleGrid/TimeGrid.tsx', 'utf8');
const gridCode = strip(grid);
const css = readFileSync('src/styles/base.css', 'utf8');

console.log('the card is anchored to the slot that was clicked');
assert(/overlay/.test(gridCode), 'TimeGrid accepts an overlay');
assert(
  /overlay\s*&&\s*overlay\.date === day\.date/.test(gridCode),
  'and renders it inside the matching day column, not floating over the whole page',
);
assert(/top: overlay\.top/.test(gridCode), 'positioned at the offset the workspace computed');
assert(
  /\(newDraft\.start - h0\) \* PXH/.test(wsCode),
  'the workspace does that arithmetic — TimeGrid stays pure layout, as its header requires',
);

console.log('\nit is the same form, relocated, not a second copy');
{
  const uses = [...wsCode.matchAll(/<SelectedSessionPanel/g)];
  assert(uses.length === 1, 'SelectedSessionPanel is rendered from exactly one place');
  assert(/const panelNode = \(/.test(wsCode), 'held in one node and placed in one of two containers');
  assert(
    /draftOverlay \? null : panelNode/.test(wsCode),
    'so the rail does not also show it while the card is up',
  );
}

console.log('\nthe card only exists for a new draft, and only for an editor');
assert(
  /canEdit && sel === '__new' && newDraft/.test(wsCode),
  "the overlay is built only when a '__new' draft is open and the viewer may edit",
);

console.log('\nsaving still stages locally — nothing reaches the athletes');
{
  const fn = wsCode.slice(wsCode.indexOf('function handleAddToDay'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert(/setAdded\(/.test(body), 'Add to day stages the session into the week');
  for (const write of ['createSession', 'updateSession', 'deleteSession', 'await ']) {
    assert(!body.includes(write), `and does not ${write.trim()} — publishing is still a separate, explicit act`);
  }
}

console.log('\nit closes the ways a card should close');
assert(/key === 'Escape'/.test(wsCode), 'Escape closes it');
assert(/handleCancelDraft/.test(wsCode), 'Cancel discards the draft');
{
  /* Outside-click must NOT bin typed work. The draft is untouched only when
     every field is still at its startDraft default. */
  assert(/draftUntouched/.test(wsCode), 'an outside click is judged against whether anything was typed');
}

console.log('\nthe card has its own styles, reusing the panel card visually');
assert(/\.sg-draft-pop/.test(css), 'base.css defines .sg-draft-pop');
assert(/@media[^{]*max-width[^{]*\{[\s\S]*?\.sg-draft-pop/.test(css),
  'with a narrow-screen rule, so it becomes a sheet rather than a floating card on a phone');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
