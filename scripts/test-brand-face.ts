/* The Fydr wordmark is Sora, and the global font swap must not reach it.
 *
 * WHY THIS EXISTS. Swapping the app to Roboto took the logo with it, because
 * the logo had never been distinguished from body text — it inherited
 * font-family from `body` like every other string in the product. That is fine
 * right up until the app face changes, at which point the brand mark silently
 * becomes whatever the UI is wearing. It is a fixed mark, not UI text.
 *
 * THREE SURFACES RENDER THE WORDMARK AS TEXT, and they do NOT all use the
 * brand face:
 *
 *   .lockup-word   sign-in splash, 386px · -0.063em · SORA
 *   .signin-word   reset / MFA,     21px · -0.03em  · SORA
 *   .brand .wm     sidebar,         50px · -0.035em · ROBOTO, deliberately
 *
 * The sidebar is chrome somebody reads past all day rather than a brand
 * moment, so it wears the app face. Its tracking is unchanged either way.
 *
 * THE TRACKING DIFFERENCES ARE DELIBERATE AND ARE NOT FLATTENED. Tighter
 * tracking at larger sizes is ordinary optical practice, and these three read
 * exactly that way: -0.063em at 386px, -0.035em at 50px, -0.03em at 21px. The
 * brief named -0.035em, which is the sidebar's — applying it to all three would
 * make the 386px lockup and the 21px sign-in word visibly wrong to fix a
 * consistency that was never a problem. Pinned here so a later "tidy-up" has to
 * argue with a test rather than a hex.
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

/** The wordmarks set in the BRAND face. */
const WORDMARKS: { sel: string; tracking: string; where: string }[] = [
  { sel: '.signin-word', tracking: '-0.03em', where: 'the reset and MFA screens, 21px' },
  { sel: '.lockup-word', tracking: '-0.063em', where: 'the sign-in splash, 386px' },
];

/** The sidebar's wordmark is deliberately NOT in the brand face: it is chrome
 *  read past all day rather than a brand moment. It keeps its own -0.035em,
 *  which is this size's optical value in either face. */
const SIDEBAR_WORDMARK = { sel: '.brand .wm', tracking: '-0.035em' };

console.log('two faces are loaded, and they are named for their jobs');
{
  const l = read(LAYOUT);
  assert(/import \{ Roboto, Sora \}|import \{ Sora, Roboto \}/.test(l), 'Roboto and Sora are both loaded through next/font/google');
  assert(/variable: '--font-sans'/.test(l), "the UI face is --font-sans");
  assert(/variable: '--font-brand'/.test(l), 'and the mark has its own --font-brand');
  const soraBlock = l.slice(l.indexOf('Sora({'), l.indexOf('});', l.indexOf('Sora({')));
  assert(/weight: \['800'\]/.test(soraBlock), 'Sora is loaded at 800 only — the mark uses one weight and nothing else should use it');
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

console.log('\neach keeps its own optical tracking');
{
  for (const { sel, tracking, where } of WORDMARKS) {
    assert(
      new RegExp(`letter-spacing: ${tracking.replace('.', '\\.')}`).test(rule(sel)),
      `${sel} keeps ${tracking} (${where})`,
    );
  }
  const values = new Set([...WORDMARKS.map((w) => w.tracking), SIDEBAR_WORDMARK.tracking]);
  assert(
    values.size === 3,
    'and the three values stay distinct — flattening them to one would break two of the three sizes',
  );
}

console.log('\nthe sidebar wordmark is the app face, on purpose');
{
  const r = rule(SIDEBAR_WORDMARK.sel);
  assert(/font-family: var\(--font-sans\)/.test(r), '.brand .wm is set in --font-sans, not the brand face');
  assert(/font-weight: 800/.test(r), 'still weight 800');
  assert(
    new RegExp(`letter-spacing: ${SIDEBAR_WORDMARK.tracking.replace('.', '\\.')}`).test(r),
    `and still ${SIDEBAR_WORDMARK.tracking} — the optical value for 50px, right in either face`,
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
