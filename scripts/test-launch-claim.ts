/* The launch page's claim column: one headline and three features.
 *
 * WHAT THE MEASUREMENTS SETTLED, because the brief's stated worry and the real
 * one turned out to be different things. The concern raised was that
 * 140px x 3 + 2 x 24px = 468px would not fit narrow screens. Measured on the
 * deployed page rather than estimated:
 *
 *   - `.launch-claim` is `display: none` below 1080px, so this grid never
 *     renders on a phone at all. "Narrow" here is the 1080-1150px band.
 *   - `minmax(0, 140px)` is a MAXIMUM, not a fixed width, so the tracks shrink
 *     by themselves: 119.2px at 1080 and the full 140px from 1150 up, where
 *     they then STAY — the slack at wider windows falls to the right of the
 *     grid rather than into the columns. Nothing overflows at any width the
 *     grid renders in.
 *   - The widest `nowrap` label is "This morning" at 95.4px — not
 *     "Availability" at 79.1px, which is what guessing would have said — and it
 *     clears the narrowest 119.2px column with 23.8px to spare.
 *
 * So the grid needs no media query. What DID overflow is the headline: Sora 800
 * at a fixed 48px with `max-width: 11ch` measures 406.1px against 405.5px of
 * column at 1080px. Half a pixel, at exactly the width where the claim column
 * first appears. `min(11ch, 100%)` keeps the requested 11ch everywhere there is
 * room and caps at the column where there is not, which is why the assertion
 * below is about `min(` and not about a number.
 *
 * THE GRID'S SAFETY AND THE 1080px BREAKPOINT ARE ONE FACT, NOT TWO. Every
 * number above holds because the claim column is hidden below 1080. Lowering
 * that breakpoint to show the claim on tablets makes this grid real work, so
 * both are asserted here and neither should be changed alone.
 */
import { readFileSync } from 'node:fs';

/* THESE FIVE READ TOKENS SINCE 2026-09-09, not literals. base.css was migrated
 * onto the type scale and spacing ramp that day, so `font-size: 3rem` is now
 * `font-size: var(--fs-48)` and `gap: 24px` is `gap: var(--sp-24)`. The
 * assertions were rewritten rather than loosened to accept either form: a
 * regex matching both would let a raw value creep back in beside the token.
 *
 * The guarantee is not weaker for going through a token. check-scale-tokens.ts
 * asserts every --fs-N is N/16 rem and every --sp-N is Npx, so "reads the 48px
 * step" plus "the 48px step is 48px" is the same claim as "is 48px" — enforced
 * in one place now instead of restated at every call site. */

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');

const CSS = 'src/styles/base.css';
const PAGE = 'src/app/login/page.tsx';
const css = read(CSS);
const page = read(PAGE);

/** EVERY RULE BELOW LIVES INSIDE `@media (min-width: 1080px)`, and several of
 *  the same selectors also exist outside it — `.launch-claim` is `display:
 *  none` at the top level, which a naive first-match lookup returns instead of
 *  the real rule. So the search is scoped to the wide block, and an absent
 *  selector returns '' rather than a slice of the whole file: a slice from a
 *  missing marker is how three vacuous passes have shipped in this repo. */
const WIDE_AT = css.indexOf('@media (min-width: 1080px)');
const WIDE = WIDE_AT === -1 ? '' : css.slice(WIDE_AT);
const rule = (name: string): string => {
  const i = WIDE.indexOf(`${name} {`);
  if (i === -1) return '';
  const end = WIDE.indexOf('}', i);
  return end === -1 ? '' : WIDE.slice(i, end);
};

/** Every prose assertion runs against what a VISITOR sees, which means comments
 *  are stripped before anything is matched. Without that, this file's own
 *  header — which quotes "23 of 26 submitted this morning" precisely to explain
 *  why it was removed — reads as the page still showing a club's figures, and
 *  the comment explaining that the eyebrow was deleted reads as the eyebrow. A
 *  string is only on the page if it is rendered. Whitespace is collapsed too,
 *  because JSX copy wraps across lines. */
const flat = page.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ');

const FEATURES = [
  { key: 'flags', label: 'Flags', caption: 'raised when a value crosses your threshold', stroke: '1.5' },
  { key: 'availability', label: 'Availability', caption: 'who can train, and what they can', stroke: '1.4' },
  { key: 'this-morning', label: 'This morning', caption: 'entries against each athlete', stroke: '1.4' },
];

console.log('the headline says what was asked for, in the face that was asked for');
{
  assert(/Data, finally worth reading\./.test(flat), 'the copy is "Data, finally worth reading."');
  const h = rule('.launch-claim-h');
  assert(h !== '', '.launch-claim-h exists');
  assert(/font-family: var\(--font-brand\)/.test(h), 'set in Sora, the brand face');
  assert(/font-weight: 800/.test(h), 'weight 800');
  /* 3rem, not 48px, since the 2026-09-08 rem conversion — and the assertion's
     intent is untouched. What it was written to reject is a FLUID size that
     never reaches 48 (a clamp whose upper bound the viewport never hits). 3rem
     computes to exactly 48px at the default root, so the headline is still a
     true 48px; it now also follows a reader who has raised their text size,
     which a fixed px never did. `max-width` is in `ch`, which scales with the
     font, so the overflow relationship this file measured holds at any root. */
  assert(/font-size: var\(--fs-48\)/.test(h), 'a true 48px, not a clamp that never reaches it');
  assert(/line-height: 1\.1\b/.test(h), 'line-height 1.1');
  assert(/letter-spacing: -0\.03em/.test(h), 'tracking -0.03em');
  assert(
    !/letter-spacing: -0\.035em/.test(h),
    'and NOT the wordmark\'s -0.035em — this is a headline in the brand face, not an instance of the mark',
  );
}

console.log('\nthe headline cannot overflow the column it sits in');
{
  const h = rule('.launch-claim-h');
  assert(/max-width: min\(/.test(h), 'max-width is a min() — see this file\'s header for the 406.1 vs 405.5 measurement');
  assert(/11ch/.test(h), 'still 11ch, which is what was asked for');
  assert(/100%/.test(h), 'capped at the column, so 1080px cannot overflow by the measured 0.6px');
  assert(
    !/max-width: 11ch\s*;/.test(h),
    'a bare 11ch is the thing that overflowed and must not come back',
  );
}

console.log('\nthree features, in the order given');
{
  const grid = rule('.launch-features');
  assert(grid !== '', '.launch-features exists');
  assert(/grid-template-columns: repeat\(3, minmax\(0, ?140px\)\)/.test(grid), 'repeat(3, minmax(0,140px)) exactly as specified');
  assert(/gap: var\(--sp-24\)/.test(grid), '24px gap');
  assert(/align-items: (start|flex-start)/.test(grid), 'columns top-aligned');

  const positions = FEATURES.map((f) => flat.indexOf(f.label));
  assert(positions.every((p) => p !== -1), 'all three labels are on the page');
  const [flags, availability, morning] = positions;
  assert(
    flags !== undefined && availability !== undefined && morning !== undefined
      && flags < availability && availability < morning,
    `Flags, then Availability, then This morning (saw offsets ${positions.join(', ')})`,
  );
}

console.log('\nthe captions are the copy that was already true, not new claims');
{
  /* The page's own header records why this matters: the design scene showed a
     named club's live figures ("23 of 26 submitted this morning") on a page
     nobody has signed in to, which is either invented or a tenant's data on the
     public internet. These three captions are the honest replacements already
     in the build, re-presented — so a rewrite here would be re-opening a closed
     question. */
  for (const f of FEATURES) {
    assert(flat.includes(f.caption), `${f.label}: "${f.caption}..." is carried over word for word`);
  }
  assert(!/\d+ of \d+ submitted/.test(flat), 'and no club\'s figures reappeared with the redesign');
}

console.log('\nlabels and captions are set as specified, and in the app face');
{
  const label = rule('.launch-features .k');
  const cap = rule('.launch-features .v');
  assert(/font-size: var\(--fs-16\)/.test(label) && /font-weight: 700/.test(label), 'label 16px / 700');
  assert(/white-space: nowrap/.test(label), 'label nowrap — it fits: 95.4px widest against a 119.2px narrowest column');
  assert(/margin-top: var\(--sp-8\)/.test(label), 'label 8px below its icon');
  /* THE HANDOFF SAID 13.5px AND 3px, and the scale now says 13 and 4. This is
     the one place the 2026-09-09 collapse diverges from a designer-specified
     figure rather than from a value somebody typed, so it is called out here
     instead of absorbed. 13.5 is exactly the half-pixel the collapse exists to
     remove — measured from a design file at a different scale, not chosen — and
     the caption gap moved 3px -> 4px because the ramp has no odd steps.
     Recorded in 0k; revert both to var(--fs-13-5)/3px only by reinstating those
     steps, which check-scale-tokens.ts now refuses. */
  assert(/font-size: var\(--fs-13\)/.test(cap), 'caption 13px — the handoff said 13.5, the scale says 13');
  assert(/color: var\(--muted\)/.test(cap), 'caption in --muted');
  assert(/margin-top: var\(--sp-4\)/.test(cap), 'caption 4px below its label — the handoff said 3, the ramp has no odd steps');

  const gridRules = [rule('.launch-features'), label, cap, rule('.launch-features li')].join('');
  assert(
    !/--font-brand/.test(gridRules),
    'nothing in the grid reads the brand face — Roboto throughout, per the brief',
  );
}

console.log('\nthe icons are outline, 24px, and carry the accent');
{
  for (const f of FEATURES) {
    const i = flat.indexOf(`data-feature="${f.key}"`);
    assert(i !== -1, `${f.label} has an icon marked data-feature="${f.key}"`);
    if (i === -1) continue;
    const svg = flat.slice(i, flat.indexOf('</svg>', i));
    assert(/width="24"/.test(svg) && /height="24"/.test(svg), `${f.label}: 24x24`);
    assert(/fill="none"/.test(svg), `${f.label}: outline, not filled`);
    assert(new RegExp(`strokeWidth=\\{?"?${f.stroke.replace('.', '\\.')}`).test(svg), `${f.label}: stroke-width ${f.stroke}`);
  }
  const icon = rule('.launch-features .i');
  assert(/color: var\(--accent\)/.test(icon), 'the icons take the accent colour from one rule rather than three hard-coded strokes');
}

console.log('\nthe two gaps that were specified in pixels');
{
  const claim = rule('.launch-claim');
  assert(/--claim-lead: 56px/.test(claim) || /padding: 234px/.test(claim),
    'the headline sits 56px below the wordmark, which the lockup\'s 178px bottom edge makes 234px of padding');
  const grid = rule('.launch-features');
  assert(/margin-top: var\(--sp-48\)/.test(grid), 'the grid sits 48px below the headline');
  assert(
    !/^\s*gap: 22px/m.test(claim),
    'and the old 22px flow gap is gone, or it would add itself to both of those',
  );
}

console.log('\nno eyebrow between the wordmark and the headline');
{
  /* "Headline (56px margin-top below the wordmark)" cannot be true with the
     "Staff web app" eyebrow sitting between them, so it goes. Recorded as an
     assertion because it is a copy deletion the brief implies rather than
     states, and it should fail loudly if somebody puts it back without
     revisiting the spacing. */
  const claimStart = flat.indexOf('launch-claim');
  const headline = flat.indexOf('Data, finally worth reading');
  const between = flat.slice(claimStart, headline);
  assert(!/eyebrow/.test(between), 'nothing carries the eyebrow class before the headline');
  assert(!/Staff web app/.test(flat), 'and the "Staff web app" line is gone — the page is for athletes too');
}

console.log('\nthe privacy line survived the redesign');
{
  /* The brief specifies wordmark -> headline -> grid and says nothing about
     what follows, so this keeps its place below the grid rather than being
     deleted along with the eyebrow. It is the only sentence on the public page
     that states the medical-visibility rule. */
  assert(
    /diagnosis and treatment notes stay with medical staff/i.test(flat),
    'coaching staff see availability; diagnosis stays with medical staff — still said out loud',
  );
}

console.log('\nthe grid needs no media query, and that depends on the 1080px breakpoint');
{
  assert(/@media \(min-width: 1080px\)/.test(css), 'the claim column still appears only at 1080px and up');
  assert(/\.launch-claim \{\s*display: none/.test(css), 'and is display:none below it, which is why a phone never sees this grid');

  /* If somebody adds a narrowing breakpoint for the features, the measurements
     in this file's header stop describing the built thing. Not forbidden —
     flagged, so it is a decision rather than a drift. */
  const afterGrid = css.slice(css.indexOf('.launch-features {'));
  const nextMedia = afterGrid.slice(0, afterGrid.indexOf('.launch-page {'));
  assert(
    !/@media[^{]*max-width/.test(nextMedia),
    'no max-width query narrows the features — minmax(0,140px) already shrinks them',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
