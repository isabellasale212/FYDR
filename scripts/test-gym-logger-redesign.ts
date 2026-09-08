/* The gym session logger, rebuilt from the redesign reference (screens 09/10).
 *
 * MOST OF WHAT THE CHANGELOG CALLS NEW HERE ALREADY EXISTED, and checking that
 * before rebuilding it is the point of this file's first section. The amber is
 * the whole list: the progress fill was already --gym rather than the accent,
 * completed set keys already rendered a checkmark in a gym-tinted box with
 * gym-on-tint ink, the active exercise card already carried a gym-tinted head,
 * the part-done badge was already pill-warn, and the weight row already
 * relabelled itself to "Your weight" with an amber "recommended 142 kg"
 * sub-line the moment an athlete moved off the prescription. Those are asserted
 * as REGRESSION guards, not as new work.
 *
 * THREE THINGS ACTUALLY CHANGE, and one of them is a functional collision:
 *
 *   1. The header loses its Close/timer utility line.
 *   2. Exercises past the next one collapse into a "1 more - Nordic curl" row.
 *   3. The floating "Finish early" bar goes.
 *
 * (3) IS THE ONE TO BE CAREFUL WITH. That bar holds the only control that
 * completes a session — `completeMutation`. Delete it as drawn and an athlete
 * can start a session and never finish one; every session they open stays open
 * for ever, and `alreadyComplete` never becomes true for any of them. So the
 * bar stops FLOATING, which is what the changelog actually objects to, and the
 * same button is rendered inline at the end of the list. Asserted below,
 * because "the reference does not draw it" is a reason to move a control, never
 * a reason to leave a workflow with no exit.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const src = strip(readFileSync('src/components/GymSessionLogger/GymSessionLogger.tsx', 'utf8'));
const css = readFileSync('src/styles/base.css', 'utf8');
/* Escape the whole selector. The first version wrote `\\${sel}` and left the
   brackets raw, so `.gym-set-key[data-logged]` compiled to a character class
   and matched nothing — four rules that ARE correct were reported missing. A
   test apparatus that cannot find what it is looking for reports absence
   exactly like a real absence does. */
const rule = (sel: string): string => {
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('the amber was already built — these are regression guards, not new work');
{
  assert(/background:\s*var\(--gym\)/.test(rule('.gym-progress-fill')),
    'the progress fill is the gym gold, not the accent every other bar uses');
  const logged = rule(".gym-set-key[data-logged]");
  assert(/--gym-rgb/.test(logged), 'a logged set key is gym-tinted');
  assert(/--gym-on-tint/.test(logged),
    'and its ink is --gym-on-tint — the gold itself reads about 1.9:1 on its own tint');
  assert(/'\\u2713'/.test(src) || /\u2713/.test(src), 'a logged set draws a checkmark, not its number');
  assert(/--gym-tint/.test(rule(".gym-ex-card[data-active] .gym-ex-head")),
    'the live exercise carries the gym tint');
  assert(/pill-warn/.test(src), 'and the part-done badge is the amber pill');
  assert(/overridden \? 'Your weight' : 'Recommended'/.test(src),
    'the weight row already relabels to "Your weight" when the athlete moves off the prescription');
  assert(/recommended <span className="num">\{rec\}<\/span> kg/.test(src),
    'with the coach\'s number kept on screen as the sub-line');
  assert(/--warn-pill-text/.test(rule('.gym-weight-label .n[data-warn]')), 'in amber');
}

console.log('\nthe header loses its utility line');
{
  assert(!/gym-head-row/.test(src), 'no Close/timer row');
  assert(!/gym-close/.test(src), 'no Close link — the athlete tab bar is on this screen and is the way out');
  assert(!/gym-clock/.test(src), 'no running clock');
  /* Dropping the clock must drop what fed it, or the component keeps a
     setInterval running once a second to update nothing. */
  /* THE CLOCK IS BACK, on the progress row rather than on a utility line of
     its own — so the reference's simplified header survives and the fact does
     too. The eyebrow's "55 MIN" is what the session is MEANT to take; an
     athlete forty minutes in cannot get that from the plan. */
  assert(/setInterval/.test(src), 'the elapsed clock ticks again');
  assert(/elapsed\(startedAt, now\)/.test(src), 'and is rendered from the session start');
  assert(!/gym-head-row|gym-close/.test(src),
    'without bringing back the Close/timer line the reference removed');
  /* THE CSS HAS TO GO TOO, and this assertion exists because it did not.
     The first pass removed the markup, this file asserted the markup was gone,
     it passed — and .gym-head-row, .gym-close and .gym-clock shipped to
     production as three rules styling nothing, found by grepping the deployed
     stylesheet rather than by any test here. Asserting a class is unused in the
     component says nothing about whether its rule is still in the bundle. */
  for (const dead of ['.gym-head-row', '.gym-close', '.gym-clock']) {
    assert(!new RegExp(`\\${dead}\\s*\\{`).test(css), `${dead} is gone from the stylesheet, not just the markup`);
  }
  assert(/gym-head-eyebrow/.test(src) && /gym-head-title/.test(src),
    'leaving one eyebrow line and the title');
}

console.log('\nexercises past the next one collapse into one row');
{
  assert(/gym-more/.test(src), 'the disclosure row exists');
  assert(/more\b.*Nordic|moreLabel|hiddenExercises|collapsed/.test(src),
    'it names what it is hiding rather than just counting');
  assert(/useState/.test(src) && /showAllExercises|expanded/.test(src),
    'and it opens — a disclosure that cannot be opened is a truncation');
}

console.log('\nthe finish control survives the floating bar');
{
  assert(!/gym-footer/.test(src), 'the floating bar is gone, as drawn');
  /* THE ASSERTION THAT MATTERS. Not "a button exists" — the specific mutation
     that marks the session complete must still be reachable from this screen. */
  assert(/completeMutation\.mutate\(\)/.test(src),
    'but completeMutation is still wired to something an athlete can press');
  assert(/Finish session/.test(src), 'and reads "Finish session" once every set is logged');
  assert(/Finish early/.test(src), 'and still offers finishing early, which is a real thing athletes do');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
