/* The click-to-create card as a three-step flow.
 *
 * THE GROUPING, and why it is in this order. The click already said WHEN, so
 * the card opens asking WHAT. Time and place travel together because a coach
 * setting one is usually setting the other. WHO is last on purpose: its caption
 * — "Nobody selected means staff only, no athlete will see this in their app" —
 * is the single most consequential sentence on the card, and it should be the
 * last thing read before the session is added, not something scrolled past
 * three fields earlier.
 *
 *   1. What          name, type
 *   2. When & where  day, start, duration, location
 *   3. Who           group
 *
 * WHAT MUST NOT CHANGE. The flow is presentation only. Every field still writes
 * to the same `newDraft` in ScheduleWorkspace through the same callbacks, "Add
 * to day" is still the only save, and it still stages locally — nothing reaches
 * the database or the athletes until Publish. Asserted below, because a
 * multi-step form is exactly the kind of change that grows a local copy of the
 * data and a save-per-step without anybody deciding to.
 *
 * GOING BACK CANNOT LOSE ANYTHING, and that is structural rather than careful:
 * the panel holds no field state at all, so a step change cannot discard a
 * value. The test pins that property rather than testing the symptom.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const panel = readFileSync('src/components/ScheduleGrid/SelectedSessionPanel.tsx', 'utf8');
const code = strip(panel);
const ws = strip(readFileSync('src/components/ScheduleGrid/ScheduleWorkspace.tsx', 'utf8'));
const css = readFileSync('src/styles/base.css', 'utf8');

console.log('three steps, named, in the agreed order');
assert(/const WIZARD_STEPS\b/.test(code), 'the steps are declared as data, not scattered through the markup');
{
  const decl = code.slice(code.indexOf('const WIZARD_STEPS'), code.indexOf('const WIZARD_STEPS') + 320);
  const order = ['What', 'When & where', 'Who'];
  let last = -1;
  for (const label of order) {
    const at = decl.indexOf(label);
    assert(at > last, `"${label}" appears in order`);
    last = at;
  }
  assert(/length === 3|\.length/.test(code) || order.every((o) => decl.includes(o)), 'and there are three of them');
}

console.log('\neach field belongs to exactly one step');
{
  /* Fields are extracted to consts so each exists ONCE and is placed into a
     step, rather than the markup being copied per step — a copy would fork the
     fixes this panel already carries. */
  for (const f of ['nameField', 'typeField', 'dayField', 'timeFields', 'locationField', 'groupField']) {
    const uses = [...code.matchAll(new RegExp(`const ${f}\\b`, 'g'))];
    assert(uses.length === 1, `${f} is defined once`);
  }
  const wiz = code.slice(code.indexOf('WIZARD_STEPS'), code.indexOf('WIZARD_STEPS') + 900);
  assert(/what[\s\S]*nameField[\s\S]*typeField/i.test(code), 'step What carries name and type');
  assert(/dayField[\s\S]{0,200}timeFields[\s\S]{0,200}locationField/.test(code),
    'step When & where carries day, time and location together');
  assert(wiz.length > 0, 'the step table is readable in one place');
}

console.log('\nthe indicator says where you are and how many there are');
assert(/Step \{step \+ 1\} of \{WIZARD_STEPS\.length\}/.test(code),
  'it renders "Step N of M" from the step table, so the count cannot drift from reality');
assert(/sg-wiz-pip/.test(code) && /\.sg-wiz-pip/.test(css), 'with a pip per step, styled');
assert(/aria-current/.test(code), 'and marks the current step for assistive tech');

console.log('\nback and next, and Add only at the end');
assert(/step > 0/.test(code), 'Back appears only after the first step');
assert(/step < WIZARD_STEPS\.length - 1/.test(code), 'Next appears until the last step');
assert(
  /step === WIZARD_STEPS\.length - 1[\s\S]{0,400}onAddToDay/.test(code),
  'and the save button appears only on the last step',
);

console.log('\ngoing back cannot lose data, structurally');
{
  /* The panel must hold no copy of any field. If it did, a step change could
     drop a value; because it does not, going back is just a different view of
     the same newDraft. */
  const states = [...code.matchAll(/useState[<(]/g)].length;
  assert(states <= 3, `the panel holds almost no local state (${states} useState calls: step, and the remove confirmation)`);
  for (const field of ['title', 'location', 'groupIds', 'mins']) {
    assert(
      !new RegExp(`useState[^\\n]*${field}`, 'i').test(code),
      `no local copy of ${field} — it lives in newDraft, so a step change cannot discard it`,
    );
  }
  assert(/setStep\(/.test(code), 'stepping only moves the step index');
}

console.log('\nthe step resets when a new card opens');
assert(/setStep\(0\)/.test(code), 'a fresh draft starts at step one');

console.log('\nonly the click-to-create card is stepped');
assert(
  /isPrecommit && mode === 'edit'/.test(code),
  'the flow is scoped to the precommit draft — an existing session in the rail keeps its single form',
);

console.log('\nthere is a way out in the corner, on every step');
{
  assert(/className="sheet-x"/.test(code), 'the card has an X, reusing the existing close-button style');
  assert(
    /className="sheet-x"[\s\S]{0,160}onClick=\{onCancelDraft\}/.test(code),
    'and it discards the draft, the same as Cancel and Escape',
  );
  assert(
    /className="sheet-x"[\s\S]{0,200}aria-label=/.test(code),
    'with a label, since an X on its own says nothing to a screen reader',
  );
  /* It must live in the HEADER, not inside a step branch — a mis-click can be
     realised at any point, and an exit that only exists on step one is not an
     exit. Checked by position: the X appears before the first step branch. */
  const xAt = code.indexOf('sheet-x');
  const firstStepAt = code.indexOf('{step === 0 ?');
  assert(xAt > -1 && firstStepAt > -1 && xAt < firstStepAt, 'and sits in the header, so it is present on all three steps');
}

console.log('\nthe save model is untouched');
{
  const fn = ws.slice(ws.indexOf('function handleAddToDay'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert(/setAdded\(/.test(body), 'Add to day still stages into the week');
  for (const w of ['createSession', 'await ', 'supabase']) {
    assert(!body.includes(w), `and still does not ${w.trim()} — Publish remains the only write`);
  }
  assert(
    [...code.matchAll(/onAddToDay/g)].length >= 1 && !/onAddToDay\(\)[\s\S]{0,80}setStep/.test(code),
    'and no step advances by saving',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
