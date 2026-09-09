/* The sign-in sequence may not hide a form that a keyboard can still reach.
 *
 * WHAT WAS MEASURED, on production, 2026-09-09. `/login` hard-codes
 * `data-animate=""`, so the launch sequence replays on every visit. Scrubbing
 * the real animation timeline with the Web Animations API:
 *
 *     t          email row   password   submit    forgot
 *     0-2000ms   invisible   invisible  invisible invisible
 *     2400ms     visible     visible    invisible invisible
 *     2730ms     visible     visible    visible   visible
 *
 * At 1000ms, checkVisibility() was false for FIVE of the six tabbable controls
 * on the page and every one reported focusable: true. Focus lands on an email
 * field nobody can see; the only visible control is the skip link, so a keyboard
 * user tabs out of it into a void. WCAG 2.4.7 Focus Visible.
 *
 * THE MECHANISM, because the fix follows from it. The keyframes set only a
 * `from` (opacity 0, translateY 16px) and run with `animation-fill-mode: both`
 * and delays up to 2590ms. Backwards fill means the `from` state applies for the
 * WHOLE delay — opacity 0 does not remove anything from the tab order or the
 * accessibility tree, so the controls are live the entire time.
 *
 * AND prefers-reduced-motion DID NOT SAVE ANYONE HERE, which was the surprise.
 * base.css's global block is a good one — it keeps colour and opacity while
 * dropping transform — but it overrides `animation-duration` only. The DELAY
 * survived, and with backwards fill a 0.001ms animation delayed by 2.4s is still
 * a form hidden for 2.4s. The one population that had explicitly asked for less
 * motion got the identical wait.
 *
 * Three assertions, one per half of the fix, each pinned so it cannot silently
 * come back.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');

const LOGIN = 'src/app/login/page.tsx';
const CSS = 'src/styles/base.css';
const login = read(LOGIN);
const css = read(CSS);

console.log('the sequence is not hard-coded on, so a repeat visit is not a repeat wait');
{
  assert(
    !/<main[^>]*\bdata-animate=""/.test(login),
    'login/page.tsx does not hard-code data-animate on the shell',
  );
  assert(
    /sessionStorage/.test(login),
    'a first-visit gate reads sessionStorage, so the sequence plays once per session',
  );
  /* THE DEFAULT MATTERS MORE THAN THE GATE. Rendering WITHOUT the attribute and
     adding it on first visit means the failure mode — script blocked, JS off,
     the gate throwing — is "no animation, form visible immediately". The old
     shape failed the other way, to a hidden form, which is the bug itself. */
  assert(
    /dangerouslySetInnerHTML/.test(login),
    'and it is a synchronous inline script, the same no-flash technique layout.tsx uses for the theme',
  );
  assert(
    /try\s*\{[\s\S]{0,400}catch/.test(login),
    'wrapped in try/catch: sessionStorage throws in some privacy modes, and a throw here must not cost anyone the form',
  );
}

console.log('\nnothing invisible is left in the tab order');
{
  for (const name of ['launch-step', 'launch-panel']) {
    const frames = new RegExp(`@keyframes ${name}\\s*\\{[\\s\\S]*?\\n\\s*\\}\\s*\\n`).exec(css)?.[0] ?? '';
    assert(frames.length > 0, `@keyframes ${name} is present`);
    assert(
      /visibility:\s*hidden/.test(frames),
      `${name} starts visibility: hidden, so its controls are out of the tab order until they can be seen`,
    );
  }
  /* opacity alone was the bug. If a later edit drops the visibility line back
     out, this is what says so. */
  assert(
    (css.match(/@keyframes launch-(step|panel)[\s\S]{0,600}?visibility:\s*hidden/g) ?? []).length === 2,
    'both launch keyframes carry it, not just one',
  );
}

console.log('\nreduced motion removes the wait as well as the movement');
{
  const block = /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';
  assert(block.length > 0, 'the global reduced-motion block is present');
  assert(
    /animation-duration:\s*0\.001ms\s*!important/.test(block),
    'it still collapses duration, which is what it always did well',
  );
  assert(
    /animation-delay:\s*0(ms|s)?\s*!important/.test(block),
    'AND it now collapses delay — a 0.001ms animation delayed 2.4s with backwards fill is still a 2.4s wait',
  );
  assert(
    /transition-property:/.test(block),
    'and the property allowlist survives, so colour and opacity feedback is kept rather than killed',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
