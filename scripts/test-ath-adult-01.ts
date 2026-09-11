/* ATH-ADULT-01, Sign in — the phone layout from the approved review board,
 * built from the tokens the app already has.
 *
 * WHAT THE BOARD IS BUILT ON, AND WHY THIS FILE MAPS RATHER THAN COPIES. The
 * Claude Design bundle in docs/designs/ath-adult-01-final/ carries its own
 * design system — a different accent, one 8px radius, a 30/19/13.5/11.5px type
 * scale, a 0.9s --dur-ring. None of that is in src/styles/tokens.css, and
 * CLAUDE.md §0.01 says a change must be composed from what the system has. So
 * every value here is the app's nearest step, recorded in the proposal record
 * Isabella approved on 2026-09-11 (A1–A10 built; B1–B9 substituted; C1 queued
 * as its own commit; C2 declined; C3 deferred). The one place the record and
 * the code differ is named in the assertion that pins it.
 *
 * PHONE ONLY. The desktop frame deletes the launch claim column, which is built
 * and waiting on two of Isabella's calls (to-do item 1). So the whole build
 * lives in one `@media (max-width: 1079px)` block and the desktop breakpoint
 * keeps every rule it had, plus one HOLD rule that gives the new aria-disabled
 * lock the look `:disabled` used to give it. Nothing else at ≥1080 moves.
 *
 * Each assertion names the review finding or board note it serves: F1 "45
 * seconds", F2 no lockout warning (C1, separate), F3 "Forgot" 15px, F4 no
 * ellipsis, F5 email never remembered (declined), F6 systems vocabulary.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = strip(read('src/styles/base.css'));
const page = strip(read('src/app/login/page.tsx'));
const form = strip(read('src/components/LoginForm/LoginForm.tsx'));
const pw = strip(read('src/components/PasswordField/PasswordField.tsx'));

/** The 01 block: the max-width query that carries the marker comment's rules.
 *  Found by its first rule rather than by a comment, since comments are stripped. */
const block = (() => {
  const i = /\.launch \{\s*--launch-x/.exec(css)?.index ?? -1;
  if (i < 0) return '';
  const start = css.lastIndexOf('@media (max-width: 1079px)', i);
  let depth = 0, j = start;
  for (; j < css.length; j++) {
    if (css[j] === '{') depth += 1;
    else if (css[j] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return css.slice(start, j + 1);
})();
const rule = (sel: string, src = block): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(src)?.[1] ?? '';
};
const desktop = (() => {
  const start = css.indexOf('@media (min-width: 1080px)');
  let depth = 0, j = start;
  for (; j < css.length; j++) {
    if (css[j] === '{') depth += 1;
    else if (css[j] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return css.slice(start, j + 1);
})();

console.log('1. copy — F1, F4, F6');
{
  assert(!/45\s*seconds/.test(page), 'F1: "Your morning entry takes 45 seconds" is gone from the sign-in page');
  assert(/Use the email address your club invited you on\./.test(page), 'and the line the review called the best on the screen survives');
  assert(/>For athletes and club staff</.test(page), 'F6: the eyebrow reads "For athletes and club staff" (the class uppercases it)');
  assert(!/>Athlete and staff</.test(page), 'and "Athlete and staff" is gone');
  assert(/'Signing in…'/.test(form), 'F4: the pending label carries the ellipsis the product uses elsewhere');
  assert(!/'Signing in'\s*:/.test(form), 'and the bare "Signing in" is gone');
}

console.log('\n2. the form — attributes and the lock');
{
  assert(/autoComplete="username"/.test(form) && /autoComplete="current-password"/.test(form), 'autocomplete username / current-password — password managers keep working (protected)');
  assert(/enterKeyHint="next"/.test(form), 'email: enterkeyhint next');
  assert(/enterKeyHint="go"/.test(form) && /enterKeyHint/.test(pw), 'password: enterkeyhint go, passed through PasswordField');
  assert(/aria-disabled=\{locked \|\| undefined\}/.test(form), 'the locked control is aria-disabled, not disabled — announced with its label, still focusable');
  assert(/className=\{locked \? 'btn-ghost signin-submit' : 'btn-primary signin-submit'\}/.test(form), 'and wears the kit secondary (.btn-ghost) while locked');
  assert(/disabled=\{busy\}/.test(form), 'disabled is reserved for the pending moment');
  assert(/onClick=\{\(event\) => \{\s*if \(locked\) event\.preventDefault\(\);/.test(form), 'blocked at the control');
  assert(/if \(locked\) return;/.test(form), 'and at the form, so Enter does nothing while the countdown runs');
  assert(/Locked · \$\{formatCountdown\(secondsRemaining\)\}/.test(form), 'the countdown label is unchanged (the board\'s m:ss is not adopted; ours says the unit)');
  assert(/aria-label="Show password"/.test(pw) && /aria-pressed=\{visible\}/.test(pw), 'B8: the labelled icon reveal stays — PasswordField is shared');
}

console.log('\n3. the phone block exists and is the only place the build lives');
{
  assert(block.length > 0, 'a @media (max-width: 1079px) block carries --launch-x');
  assert((css.match(/--launch-x:/g) ?? []).length === 1 && block.includes('--launch-x:'), 'and --launch-x is set nowhere else, so the desktop never inherits the phone inset');
  const base = rule('.launch-page', css.slice(0, css.indexOf('@media (max-width: 1079px)', css.indexOf('.launch-page {'))));
  assert(/padding:\s*176px var\(--sp-28\) var\(--sp-40\)/.test(base), 'the base .launch-page padding is untouched (176 / 28 / 40)');
  assert(/var\(--launch-x, 30px\)/.test(rule('from', css.slice(css.indexOf('@keyframes launch-lift {')))), 'the splash keyframe lands on --launch-x with 30px as its fallback, so nothing outside the block moves');
}

console.log('\n4. A10 rhythm and A5 fill, from the spacing scale');
{
  const l = rule('.launch');
  assert(/--launch-x:\s*var\(--sp-24\)/.test(l), 'page inset 24 (--sp-24), lockup and text on one edge');
  const p = rule('.launch-page');
  assert(/padding:\s*calc\(160px \+ var\(--sp-4\)\) var\(--launch-x\) var\(--sp-24\)/.test(p), 'eyebrow 4px under the lockup\'s rest (92 + 68 = 160), sides --launch-x, bottom --sp-24');
  assert(/gap:\s*var\(--sp-20\)/.test(p), 'sub → form 20 (--sp-20)');
  assert(/min-height:\s*100dvh/.test(p) && /grid-template-rows:\s*auto auto 1fr/.test(p), 'the page fills the viewport and the third row takes the slack');
  assert(/align-self:\s*end/.test(rule('.launch .launch-foot')), 'so the disclosure line pins to the bottom edge');
  assert(/gap:\s*0/.test(rule('.launch .launch-head')), 'the head block has no flow gap — every space is stated as a margin');
  assert(/margin:\s*0/.test(rule('.launch .launch-head .eyebrow')) && /color:\s*var\(--faint\)/.test(rule('.launch .launch-head .eyebrow')), 'eyebrow tight under the wordmark, in --faint');
  assert(/margin-top:\s*var\(--sp-32\)/.test(rule('.launch .launch-head .launch-title')), 'wordmark group → heading 32 (--sp-32)');
  assert(/margin-top:\s*var\(--sp-8\)/.test(rule('.launch .launch-head .launch-sub')) && /font-size:\s*var\(--fs-14\)/.test(rule('.launch .launch-head .launch-sub')), 'heading → sub 8 (--sp-8), sub at --fs-14');
  assert(/margin-top:\s*0/.test(rule('.launch .signin-fields')), 'the form block carries no margin of its own');
  assert(/margin-top:\s*var\(--sp-14\)/.test(rule('.launch .signin-submit')), 'fields → button 14 (--sp-14), the same gap as between fields');
  assert(/background:\s*var\(--surf\)/.test(rule('.launch .field')), 'A5: phone fields are --surf on --bg');
  assert(/box-shadow:\s*var\(--ring-accent\)/.test(rule('.launch .field:focus')), 'A8: a focused field adds --ring-accent (the outline stays — the app never suppresses one)');
  assert(!/outline:\s*none/.test(block), 'no outline is removed anywhere in the block');
}

console.log('\n5. A3 the recovery link, A7 the banner, B4 the disclosure');
{
  const a = rule('.launch .signin-forgot a');
  assert(/min-height:\s*44px/.test(a) && /display:\s*inline-flex/.test(a) && /padding:\s*0 var\(--sp-12\)/.test(a), 'F3: "Forgot your password?" is a 44px target');
  const e = rule('.launch .form-error');
  for (const t of ['--wash-bad', '--border-bad', '--r-tab', '--pad-card', '--text']) assert(e.includes(`var(${t})`), `A7: the refusal is the banner shape — ${t}`);
  const dot = rule('.launch .form-error::before');
  assert(/border-radius:\s*var\(--r-full\)/.test(dot) && /background:\s*var\(--bad\)/.test(dot) && /width:\s*var\(--sp-8\)/.test(dot), 'with the tone in a round dot, not in the type');
  const f = rule('.launch .launch-foot');
  assert(/font-size:\s*var\(--fs-12\)/.test(f) && /text-align:\s*start/.test(f), 'B4: the disclosure is --fs-12 (no 11.5 step), left-aligned as drawn');
}

console.log('\n6. the block is composed from the system');
{
  const body = block.slice(block.indexOf('{') + 1); // past the @media prelude's own 1079px
  const literals = [...body.matchAll(/:\s*[^;{}]*?(\d+(?:\.\d+)?px)/g)].map((m) => m[1] ?? '');
  const allowed = new Set(['1px', '44px', '160px']);
  const stray = literals.filter((v) => !allowed.has(v));
  assert(stray.length === 0, stray.length === 0
    ? 'no raw px in the block beyond 1px borders, the 44px floor and the lockup\'s 160px rest'
    : `raw px in the block: ${[...new Set(stray)].join(', ')}`);
  assert(!/--t-page|--t-subhead|--dur-ring|--ring-action|--line-strong|--pill-accent|var\(--r\)|--gap-card/.test(block), 'no Claude Design token name leaked into the stylesheet');
  assert(!/@keyframes|animation:/.test(block), 'B6: no spinner, no new motion — the label carries the pending state');
}

console.log('\n7. desktop is held');
{
  assert(desktop.includes(".launch .signin-submit[aria-disabled='true']"), 'the ≥1080 block carries the hold rule for the lock');
  const hold = rule(".launch .signin-submit[aria-disabled='true']", desktop);
  assert(/background:\s*var\(--surf2\)/.test(hold) && /color:\s*var\(--on-accent\)/.test(hold), 'which reproduces what .btn-primary:disabled drew there, until collision 1 is settled');
  assert(!desktop.includes('--launch-x'), 'and nothing else from the phone build reaches it');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
