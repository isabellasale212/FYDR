/* The Fydr wordmark is Sora, and the global font swap must not reach it.
 *
 * WHY THIS EXISTS. Swapping the app to Roboto took the logo with it, because
 * the logo had never been distinguished from body text — it inherited
 * font-family from `body` like every other string in the product. That is fine
 * right up until the app face changes, at which point the brand mark silently
 * becomes whatever the UI is wearing. It is a fixed mark, not UI text.
 *
 * THREE SURFACES RENDER THE WORDMARK AS TEXT, and all three are now identical:
 *
 *   .lockup-word   sign-in splash, 386px · Sora 800 · -0.035em
 *   .signin-word   reset / MFA,     21px · Sora 800 · -0.035em
 *   .brand .wm     sidebar,         50px · Sora 800 · -0.035em
 *
 * THIS FILE ARGUED THE OPPOSITE FIRST, and the argument is worth keeping because
 * it is the one a later tidy-up will make again. The three carried -0.063em,
 * -0.03em and -0.035em, which is ordinary optical practice: tighter tracking at
 * larger sizes. Unifying them means the 386px splash mark now sets looser than
 * the design canvas draws it.
 *
 * The decision, on 2026-09-07, is that a wordmark is a fixed mark rather than
 * type being set — one face, one weight, one tracking, wherever it appears —
 * and that a mark split across two faces and three trackings is the worse
 * outcome. So the assertions below pin SAMENESS, where they used to pin
 * distinctness. Changing that back is a design decision, not a cleanup.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');
const CSS = 'src/styles/base.css';
const LAYOUT = 'src/app/layout.tsx';
const css = read(CSS);
const rule = (name: string): string => {
  const i = css.indexOf(`${name} {`);
  return i === -1 ? '' : css.slice(i, css.indexOf('}', i));
};

/** Every surface the wordmark appears on. All three, identically. */
const TRACKING = '-0.035em';
const WORDMARKS: { sel: string; where: string }[] = [
  { sel: '.brand .wm', where: 'the sidebar, 50px' },
  { sel: '.signin-word', where: 'the reset and MFA screens, 21px' },
  { sel: '.lockup-word', where: 'the sign-in splash, 386px' },
];

console.log('two faces are loaded, and they are named for their jobs');
{
  const l = read(LAYOUT);
  assert(/import \{ Roboto, Sora \}|import \{ Sora, Roboto \}/.test(l), 'Roboto and Sora are both loaded through next/font/google');
  assert(/variable: '--font-sans'/.test(l), "the UI face is --font-sans");
  assert(/variable: '--font-brand'/.test(l), 'and the mark has its own --font-brand');
  const soraBlock = l.slice(l.indexOf('Sora({'), l.indexOf('});', l.indexOf('Sora({')));
  assert(/weight: \['800'\]/.test(soraBlock), 'Sora is loaded at 800 only — every brand-face element uses that one weight');
  assert(
    /className=\{`\$\{roboto\.variable\} \$\{sora\.variable\}`\}|className=\{[^}]*sora\.variable/.test(l),
    'and both variables reach the document',
  );
}

console.log('\nevery wordmark surface is set in the brand face');
{
  for (const { sel, where } of WORDMARKS) {
    const r = rule(sel);
    assert(r !== '', `${sel} exists (${where})`);
    assert(/font-family: var\(--font-brand\)/.test(r), `${sel} is set in --font-brand`);
    assert(!/var\(--font-sans\)/.test(r), `${sel} does NOT read the UI face`);
    assert(/font-weight: 800/.test(r), `${sel} is weight 800`);
  }
}

console.log('\nall three carry the same tracking, which is the point');
{
  for (const { sel, where } of WORDMARKS) {
    assert(
      new RegExp(`letter-spacing: ${TRACKING.replace('.', '\\.')}`).test(rule(sel)),
      `${sel} is ${TRACKING} (${where})`,
    );
  }
  const values = new Set(
    WORDMARKS.map((w) => (/letter-spacing: (-?[\d.]+em)/.exec(rule(w.sel)) ?? [])[1]),
  );
  assert(
    values.size === 1 && values.has(TRACKING),
    `one tracking across every instance (saw ${[...values].join(', ')})`,
  );
}

console.log('\nthe brand face is used by ONE thing that is not the mark, deliberately');
{
  /* Added 2026-09-07 with the launch page rewrite, and recorded here because
     this file previously said the brand face meant "this is the logo" and
     nothing else. It no longer does: the sign-in claim is set in Sora 800 by
     explicit instruction.

     THE DISTINCTION THAT KEEPS THAT HONEST is tracking. The mark is -0.035em
     wherever it appears; the headline is -0.03em, which is what was asked for
     and is also what stops it reading as a fourth instance of the wordmark. If
     somebody later unifies these two numbers "for consistency", the headline
     becomes the mark, which is the thing the three wordmark surfaces were
     unified to prevent. */
  const h = rule('.launch-claim-h');
  assert(h !== '', '.launch-claim-h exists');
  assert(/font-family: var\(--font-brand\)/.test(h), 'the launch headline is set in the brand face, by instruction');
  assert(/font-weight: 800/.test(h), 'at the one weight Sora is loaded at');
  assert(
    /letter-spacing: -0\.03em/.test(h) && !/letter-spacing: -0\.035em/.test(h),
    'but at -0.03em, NOT the mark\'s -0.035em — a headline in the brand face is not an instance of the mark',
  );
  const marks = WORDMARKS.map((w) => rule(w.sel));
  assert(
    marks.every((r) => /letter-spacing: -0\.035em/.test(r)),
    'and the three marks keep their own tracking, unaffected by it',
  );
}

console.log('\nthe app face still applies to everything that is not the mark');
{
  assert(/font-family: var\(--font-sans\)/.test(css), 'body and UI text read --font-sans');
  const brandRules = WORDMARKS.map((w) => rule(w.sel)).join('');
  assert(!/--font-sans/.test(brandRules), 'and no wordmark rule reads it');
  /* The guard that matters for next time: a future global swap edits the value
     behind --font-sans, and cannot reach --font-brand by doing so. */
  assert(
    read(LAYOUT).indexOf("variable: '--font-brand'") !== read(LAYOUT).indexOf("variable: '--font-sans'"),
    'the two variables are genuinely separate declarations, not one aliased to the other',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
