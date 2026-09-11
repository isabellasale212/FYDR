/* The 44px floor applies to navigation as well as to actions — §0w.
 *
 * WHAT WAS MEASURED. On the running athlete app the shared BackButton rendered
 * 29px tall on every screen that shows it, and the hidden-leaderboards gate's
 * "Show them again" link — the ONLY control on that screen — hit-tested at
 * 15px: an inline link's hit box is its content area, and 13px Roboto's is
 * 15px, not the 18.85px line box and not the 34px the review recorded. Three
 * separate reviews flagged both against §8's floor, which the stylesheet
 * states without a navigation exception (`.sheet-x`: "the circle is what you
 * see, the hit box is what you hit"; ScaleInput: 44 "is §8's floor").
 *
 * WHAT THE FIX IS, AND IS NOT. The design is frozen (CLAUDE.md §0), so neither
 * control may change in size, colour or placement. The hit box grows; the
 * visible box does not:
 *   - `.phone-body .back-btn::after` is an invisible 44px-tall box anchored to
 *     the button's top edge. Anchored to the top, not centred, because the
 *     button is the first child of `.phone-body`, a scroll container with no
 *     top padding — anything extended ABOVE it is clipped at scroll-top and
 *     hits nothing. Below it are 38px of shell spacing, so the extra 15px
 *     overlap nothing.
 *   - `.tap-floor` on the gate link is vertical padding on an INLINE element,
 *     which changes no line box and paints nothing (the link has no background
 *     or border) but is part of its border box, so it is hit-testable.
 *
 * Scoped to the athlete shell. The staff app's `.back-btn` is the same class
 * and still renders 29px; §8 is the athlete specification's floor and the staff
 * surface is a pointer surface. Widening it is a separate decision.
 *
 * WHAT THIS PINS. That the extension is there, that it reaches 44 from the
 * tokens it is built from, and that nothing in the fix touches a declaration
 * that would change what an athlete SEES — so a later tidy-up cannot remove
 * the hit box "because it draws nothing", and cannot grow the visible button
 * "to make the test pass".
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
const css = strip(readFileSync('src/styles/base.css', 'utf8'));
const tokens = strip(readFileSync('src/styles/tokens.css', 'utf8'));

/** The declarations of the FIRST rule whose selector list is exactly `sel`. */
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};
const px = (token: string): number => {
  const m = new RegExp(`${token}\\s*:\\s*([\\d.]+)px`).exec(tokens);
  return m ? Number(m[1]) : NaN;
};
const FLOOR = 44;

console.log('1. the athlete Back button hits 44px tall without drawing any larger');
{
  const host = rule('.phone-body .back-btn');
  const hit = rule('.phone-body .back-btn::after');
  assert(/position:\s*relative/.test(host), '.phone-body .back-btn positions its own hit box');
  assert(/content:\s*''/.test(hit) && /position:\s*absolute/.test(hit), 'and carries an absolutely positioned ::after');
  assert(/height:\s*44px/.test(hit), `the hit box is ${FLOOR}px tall`);
  assert(/top:\s*0/.test(hit) && /left:\s*0/.test(hit) && /right:\s*0/.test(hit),
    'anchored to the top edge and the full button width (extending upward is clipped by the scroll container)');
  assert(!/bottom:\s*0/.test(hit), 'and not stretched to the bottom, which would make it the button height rather than 44');
  assert(!/background|border|box-shadow|color/.test(hit), 'it paints nothing');
  assert(/pointer-events|cursor/.test(hit) === false || !/pointer-events:\s*none/.test(hit),
    'and it takes the tap (no pointer-events: none)');

  /* The VISIBLE box is the frozen one. Its size comes from .back-btn alone. */
  const visible = rule('.back-btn');
  assert(/padding:\s*var\(--sp-6\)\s+var\(--sp-12\)\s+var\(--sp-6\)\s+var\(--sp-8\)/.test(visible),
    '.back-btn keeps its signed-off padding (6 / 12 / 6 / 8)');
  assert(/font-size:\s*var\(--fs-13\)/.test(visible), 'and its 13px label');
  for (const prop of ['padding', 'min-height', 'height', 'font-size', 'border', 'margin-top']) {
    assert(!new RegExp(`(^|[;\\s])${prop}\\s*:`).test(host), `the athlete override sets no ${prop} — nothing visible changes`);
  }
}

console.log('\n2. the hidden-leaderboards gate link — the only control on that screen — hits 44px');
{
  const gate = readFileSync('src/components/HideLeaderboardsToggle/LeaderboardVisibilityGate.tsx', 'utf8');
  assert(/<Link href="\/me\/leaderboards" className="tap-floor">Show them again<\/Link>/.test(gate),
    '"Show them again" carries .tap-floor');

  const tap = rule('.tap-floor');
  const pad = /padding-block:\s*var\((--sp-\d+)\)/.exec(tap)?.[1] ?? '';
  assert(pad !== '', '.tap-floor is vertical padding from the spacing scale');
  /* The hit box of an inline element is its CONTENT AREA plus padding — not
     the line box. 13px Roboto's content area measures 15px on the running app
     (getClientRects on the link: height 15, against an 18.85px line). The
     padding is on an inline element, so it adds to the hit box and to nothing
     else. */
  const content = 15;
  const reach = pad ? content + 2 * px(pad) : 0;
  assert(reach >= FLOOR, `${content}px content area + 2 × ${pad || '(nothing)'} (${pad ? px(pad) : 0}px) = ${reach}px ≥ ${FLOOR}`);
  /* The smallest step on the scale that reaches, so nobody later "rounds it
     down" to the next token and lands under the floor again. */
  const scale = [...tokens.matchAll(/--sp-(\d+)\s*:\s*(\d+)px/g)].map((m) => Number(m[2])).sort((a, b) => a - b);
  const below = pad ? scale.filter((v) => v < px(pad)).at(-1) ?? 0 : 0;
  assert(pad !== '' && content + 2 * below < FLOOR,
    `and the step below (${below}px) would not: ${content + 2 * below}px`);
  for (const prop of ['display', 'background', 'border', 'margin', 'padding-inline', 'line-height', 'font']) {
    assert(!new RegExp(`(^|[;\\s])${prop}`).test(tap), `.tap-floor sets no ${prop} — the line box and the paint are unchanged`);
  }
}

console.log('\n3. the staff Back button is the same class and is deliberately NOT widened here');
{
  assert(!/\.back-btn::after/.test(css.replace(/\.phone-body \.back-btn::after/g, '')),
    'no unscoped .back-btn::after — the staff surface keeps its 29px until that is decided');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
