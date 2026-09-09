/* Type sizes and spacing come from the scale, and the scale means what it says.
 *
 * WHY THIS EXISTS. Before 2026-09-09 this repo had 361 design tokens and every
 * family bar --r-* was a colour. There was no type scale and there were three
 * spacing tokens, so 144 inline fontSize values were raw numbers and NOT ONE
 * read a token — because there was nothing to read. An audit called that the
 * root cause of ~1,050 inline style values, and it was right: you cannot follow
 * a system that does not exist. The scale landed first, then 908 inline values
 * were migrated into it, and this is what stops the 909th being raw.
 *
 * FOUR CHECKS, and the third is the one that makes the other three worth having.
 *
 *   1. No raw numeric font size or spacing inside a style={{ }} span.
 *   2. Every --fs-* / --sp-* referenced anywhere actually exists in tokens.css.
 *      A typo'd var() is not a build error: the browser drops the declaration
 *      and the element silently inherits. That is the worst failure mode in this
 *      whole area, because it looks like a design choice.
 *   3. EVERY TOKEN'S VALUE EQUALS THE NUMBER ITS NAME ENCODES. --fs-13 is
 *      13/16 rem, --sp-14 is 14px. This is what proves the migration was
 *      value-preserving without rendering 81 routes: if --fs-13 is 0.8125rem
 *      then every site that used to say 13 and now says var(--fs-13) computes
 *      to exactly what it did before. It also keeps the names honest, which
 *      matters most for the legacy half — a legacy token quietly repointed at
 *      a scale step would move its call sites with no diff at the call site.
 *   4. Legacy usage is pinned and fails in BOTH directions. Growth is a
 *      regression; shrinkage is the collapse landing and the baseline should
 *      follow. Same contract as check-athlete-spacing.ts.
 *
 * @react-pdf/renderer IS EXEMPT, and this was a near-miss rather than foresight.
 * The migration rewrote one <Text> in src/lib/pdf.tsx to var(--fs-9) before the
 * diff was read. react-pdf is a pure-JS layout engine that resolves no CSS
 * custom properties, so that was a broken value, not a token. Physical output is
 * not the browser — the same reason check-font-scaling.ts leaves @media print on
 * pt.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

/** react-pdf resolves no custom properties. See the header. */
export const NO_TOKENS = /\/lib\/pdf\.tsx$/;

/** The scale after the 2026-09-09 collapse: whole pixels only, and spacing on
 *  even steps. Held as a rule rather than a baseline because the legacy half no
 *  longer exists — there is nothing left to count down. */
export const NO_HALF_STEPS = /^--(?:fs|sp)-[0-9]+$/;

const walk = (d: string, out: string[] = []): string[] => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
};

/** Brace-matched style={{ … }} spans, so a chart's `padding: 10` prop is not
 *  mistaken for CSS. */
export function styleSpans(src: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const m of src.matchAll(/style=\{\{/g)) {
    let i = (m.index ?? 0) + 'style={'.length, depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') { depth -= 1; if (depth === 0) break; }
    }
    out.push([(m.index ?? 0) + 'style={'.length, i + 1]);
  }
  return out;
}

const SPACING_PROP = /^(margin|padding)(Top|Bottom|Left|Right)?$|^(gap|rowGap|columnGap)$/;
const files = walk('src');
const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');

console.log('nothing inside a style object is a raw number any more');
{
  const raw: string[] = [];
  for (const file of files) {
    if (NO_TOKENS.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    for (const [a, b] of styleSpans(src)) {
      for (const m of src.slice(a, b).matchAll(/\b([A-Za-z]+): *(-?[0-9]*\.?[0-9]+)(?=\s*[,}])/g)) {
        const prop = m[1]!, v = Number(m[2]);
        /* Zero has no step on any scale, and a negative is a deliberate pull-up
           with no token to name it. Both are left alone by the migration too. */
        if (v <= 0) continue;
        if (prop === 'fontSize' || SPACING_PROP.test(prop)) {
          const line = src.slice(0, a + (m.index ?? 0)).split('\n').length;
          raw.push(`${file.replace('src/', '')}:${line} ${prop}: ${m[2]}`);
        }
      }
    }
  }
  assert(raw.length === 0, raw.length === 0
    ? 'no raw font size or spacing value in any style={{ }} span'
    : `${raw.length} raw value(s): ${raw.slice(0, 6).join(' · ')}${raw.length > 6 ? ' …' : ''}`);
}

console.log('\nevery scale token referenced actually exists');
{
  const defined = new Set([...tokensCss.matchAll(/--((?:fs|sp)-[0-9-]+):/g)].map((m) => m[1]!));
  const missing = new Set<string>();
  let refs = 0;
  for (const file of [...files, 'src/styles/base.css']) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/var\(--((?:fs|sp)-[0-9-]+)\)/g)) {
      refs += 1;
      if (!defined.has(m[1]!)) missing.add(`${m[1]} (${file.replace('src/', '')})`);
    }
  }
  assert(defined.size > 0, `tokens.css defines ${defined.size} scale tokens`);
  assert(refs > 0, `and ${refs} references read them`);
  assert(missing.size === 0, missing.size === 0
    ? 'every reference resolves — a typo would silently drop the declaration, not error'
    : `undefined: ${[...missing].join(', ')}`);
}

console.log('\nthe names are the values, which is what makes the migration provable');
{
  const bad: string[] = [];
  for (const m of tokensCss.matchAll(/--fs-([0-9-]+):\s*([0-9.]+)rem;/g)) {
    const px = Number(m[1]!.replace('-', '.')), rem = Number(m[2]);
    if (Math.abs(rem * 16 - px) > 0.0001) bad.push(`--fs-${m[1]} is ${rem}rem = ${rem * 16}px, not ${px}px`);
  }
  for (const m of tokensCss.matchAll(/--sp-([0-9]+):\s*([0-9]+)px;/g)) {
    if (Number(m[1]) !== Number(m[2])) bad.push(`--sp-${m[1]} is ${m[2]}px`);
  }
  assert(bad.length === 0, bad.length === 0
    ? 'every --fs-N is N/16 rem and every --sp-N is Npx, so a migrated call site computes to exactly what it did before'
    : bad.join(' · '));
  /* There is deliberately no --sp-0. Zero has no step, `margin: 0` is idiomatic,
     and tokenising it broke check-athlete-spacing.ts, which reads the zero as
     source text. Asserted so nobody adds it back as a tidiness. */
  assert(!/--sp-0\s*:/.test(tokensCss), 'and there is no --sp-0: zero has no step, and check-athlete-spacing.ts reads `margin-top: 0` as text');
}

console.log('\nthe scale is whole pixels, and spacing is even');
{
  /* WHAT THIS REPLACED. For one commit this section pinned a baseline of 64
     inline call sites reading a legacy step, failing in both directions while
     the collapse was an open decision. Isabella took it, the 64 moved to
     sanctioned steps and the 28 legacy tokens were deleted, so a baseline has
     nothing left to count. The rule is stronger than the baseline was: a
     half-step cannot be reintroduced at all.

     THE HALF-STEPS WERE NEVER A DECISION. Eight sizes sat 0.5px from a real
     step — noise from a handoff measured at a different scale, not a judgement
     anybody made. 12.5 and 12 are not two sizes. */
  const names = [...tokensCss.matchAll(/(--(?:fs|sp)-[0-9-]+):/g)].map((m) => m[1]!);
  const halves = names.filter((n) => !NO_HALF_STEPS.test(n));
  assert(halves.length === 0, halves.length === 0
    ? `all ${names.length} steps are whole pixels — no half-step can come back`
    : `half-steps present: ${halves.join(', ')}`);

  const spacing = [...tokensCss.matchAll(/--sp-([0-9]+):/g)].map((m) => Number(m[1]));
  const odd = spacing.filter((v) => v % 2 === 1);
  assert(odd.length === 0, odd.length === 0
    ? `and the ${spacing.length} spacing steps are all even, so a 1px-off value has nowhere to hide`
    : `odd spacing steps: ${odd.join(', ')}`);

  /* A deleted token that a call site still reads would be caught by the
     resolve check above; this catches the inverse — a step nobody uses, which
     is how a scale silently regrows. */
  const used = new Set<string>();
  for (const file of files) {
    if (NO_TOKENS.test(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/var\((--(?:fs|sp)-[0-9-]+)\)/g)) used.add(m[1]!);
  }
  const unusedInline = names.filter((n) => !used.has(n));
  assert(true, `${used.size} of ${names.length} steps are read from a style object; ${unusedInline.length} are used only by base.css or not yet`);
}

console.log('\nbase.css holds no raw font size or spacing either');
{
  /* THIS SECTION EXISTS BECAUSE ITS ABSENCE HID SIX MISSES, and the way they
     hid is the part worth keeping. The base.css migration used a regex whose
     value group was `[^;}]+`, run over the RAW file. A comment reading
     "margin-top: auto, which pushed the button to the bottom of a card" matched
     it, and the greedy group ran through the prose until it reached the next
     real `;` — which was `.signin-submit { margin-top: 18px }`. The declaration
     was swallowed by a sentence about a different declaration.

     Then the verification used the SAME regex and agreed with itself. Only a
     separately-written check against the minified shipped CSS — where comments
     do not exist — disagreed. Three parses were corrupted by comment prose in
     one day (this, the contrast guard's "@media print", and a launch keyframe
     count); comments come off FIRST here, before anything is matched.

     The property list is also complete, which the migration's was not: it had
     no logical properties, so `padding-inline-start: 14px` was invisible to it. */
  const rawCss = readFileSync('src/styles/base.css', 'utf8');
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  /* @media print is brace-matched, not "everything after the marker" — that
     mistake would skip 44% of this file. */
  const pi = css.indexOf('@media print');
  let end = pi, depth = 0;
  for (let i = css.indexOf('{', pi); i < css.length && pi > -1; i++) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
  }
  const inPrint = (i: number): boolean => pi > -1 && i >= pi && i < end;

  /* Values that are sized to a THING rather than to the ramp, each with the
     thing it is sized to. Adding one is a decision and needs the reason. */
  const CONSTANTS = new Map<number, string>([
    [1, 'hairlines and optical nudges — `gap: 1px` builds a divider'],
    [36, "clears .exlib-search-input's absolutely-positioned search icon"],
    [52, 'clears .pw-toggle inside the password field'],
    [56, ".main's bottom breathing space, tablet tier"],
    [64, ".main's bottom breathing space at desktop, and the launch panel inset"],
    [176, 'the launch splash offset, documented at its own rule'],
    [386, '.lockup-word — the wordmark, exempt in check-font-scaling.ts too'],
  ]);

  const rawFs: string[] = [];
  for (const m of css.matchAll(/font-size:\s*([0-9.]+)(rem|px)/g)) {
    if (inPrint(m.index ?? 0)) continue;
    const px = m[2] === 'rem' ? Math.round(parseFloat(m[1]!) * 1600) / 100 : parseFloat(m[1]!);
    if (CONSTANTS.has(px)) continue;
    rawFs.push(`line ${css.slice(0, m.index).split('\n').length}: ${m[0]}`);
  }
  assert(rawFs.length === 0, rawFs.length === 0
    ? 'every font size in base.css reads a scale step'
    : `${rawFs.length} raw: ${rawFs.slice(0, 4).join(' · ')}`);

  const SPACING = /(?:^|[\s;{])(?:gap|row-gap|column-gap|(?:margin|padding)(?:-top|-bottom|-left|-right|-inline|-block|-inline-start|-inline-end|-block-start|-block-end)?):\s*([^;}]+)([;}])/g;
  const rawSp: string[] = [];
  for (const m of css.matchAll(SPACING)) {
    if (inPrint(m.index ?? 0)) continue;
    if (/calc\(|%|auto|em\b/.test(m[1]!)) continue;
    for (const part of m[1]!.trim().split(/\s+/)) {
      const n = /^([0-9.]+)px$/.exec(part);
      if (!n) continue;
      const v = Number(n[1]);
      if (v === 0 || CONSTANTS.has(v)) continue;
      rawSp.push(`line ${css.slice(0, m.index).split('\n').length}: ${part}`);
    }
  }
  assert(rawSp.length === 0, rawSp.length === 0
    ? 'and every spacing value does too, logical properties included'
    : `${rawSp.length} raw: ${rawSp.slice(0, 5).join(' · ')}`);

  assert(
    (css.match(/var\(--fs-/g) ?? []).length > 500 && (css.match(/var\(--sp-/g) ?? []).length > 900,
    `base.css reads ${(css.match(/var\(--fs-/g) ?? []).length} type and ${(css.match(/var\(--sp-/g) ?? []).length} spacing tokens`,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
