/* A typed character never reaches a screen reader, and never names a control.
 *
 * WHAT THE AUDIT CLAIMED AND WHAT MEASURING FOUND. A sweep on 2026-09-09
 * reported "two icon systems" — 66 typed glyphs plus 22 files of inline SVG and
 * no icon library — and 18 distinct stroke widths, framed as the kind of drift
 * --r-control fixed. Neither half held up:
 *
 *   THE STROKE WIDTHS were compared as raw strokeWidth across FOUR different
 *   viewBoxes (14, 16, 20, 24), which is meaningless: 1.4 in a 24 box rendered
 *   at 24px and 1.5 in a 14 box rendered at 14px are the same 1.5px line. In
 *   apparent pixels the set is 1.4 / 1.5 / 1.59 / 1.82 / 2.4, with FIVE of ten
 *   at exactly 1.5 and two more within 0.1px of it. The two real outliers are
 *   both deliberate and both documented in the code: Today's 2.4 is a checkmark
 *   inside a completion badge rather than an interface icon, and the sidebar's
 *   1.82 is its one stroked glyph in an otherwise FILLED set — "the design's are
 *   filled, which is what gives the rail its weight at 17px".
 *
 *   THE GLYPHS are mostly correct already: 37 of 45 carry aria-hidden, because
 *   they are decorative marks beside real text rather than icons standing in for
 *   an icon system. The craft-floor ban is about the latter.
 *
 * SO THIS GUARD IS NOT "REPLACE GLYPHS WITH SVG". It pins the three things that
 * were genuinely wrong, each of which is invisible on screen and audible to
 * somebody using a screen reader:
 *
 *   1. A control whose only content is a glyph must carry an aria-label.
 *      NewMealForm's remove button had `title="Remove item"` and a bare ×, and
 *      accessible-name computation puts CONTENT above title — so it announced as
 *      "times, button". A title is a tooltip, not a name.
 *   2. A decorative glyph must be aria-hidden, or it is read out as a character:
 *      "check mark", "warning sign", "rightwards arrow" in the middle of a
 *      sentence that already says what it means.
 *   3. One class draws one glyph. `.sheet-x` rendered ✕ in eight athlete places
 *      and × in one staff place — the same affordance, two characters.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

/** Marks used as UI. `×` is excluded: it is a real multiplication sign in this
 *  product ("3 × 10", "1.42×"), so it is checked only in the control-name rule
 *  below where its meaning is unambiguous. */
const DECORATIVE = /[⚠✓✗✕→←↑↓●○◆★☆•✔✖⌄⌃]/u;

const walk = (d: string, out: string[] = []): string[] => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
};
/* Comments discuss glyphs constantly in this repo; three parses were corrupted
   by comment prose in one day, so they come off first. */
const strip = (s: string): string => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/.*$/gm, ' ');

const files = walk('src');

console.log('a control whose only content is a glyph has a real name');
{
  const unnamed: string[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/<(button|a)\b([\s\S]{0,400}?)>([\s\S]{0,40}?)<\/\1>/g)) {
      const attrs = m[2]!, inner = m[3]!.trim();
      /* Only when the entire content is the mark — text beside it is a name. */
      const bare = inner.replace(/<span[^>]*>|<\/span>/g, '').trim();
      if (!(DECORATIVE.test(bare) || bare === '×') || bare.length > 3) continue;
      if (/aria-label=|aria-labelledby=/.test(attrs)) continue;
      unnamed.push(`${f.replace('src/', '')} <${m[1]}> "${bare}"${/title=/.test(attrs) ? ' (has title — a tooltip is not a name)' : ''}`);
    }
  }
  assert(unnamed.length === 0, unnamed.length === 0
    ? 'no control is named by a typed character'
    : unnamed.join(' · '));
}

console.log('\na decorative glyph is hidden from assistive tech');
{
  const exposed: string[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/<(span|b|i|em|div|p)([^>]*)>([^<]{0,60}?)<\/\1>/g)) {
      if (!DECORATIVE.test(m[3]!)) continue;
      if (/aria-hidden=/.test(m[2]!)) continue;
      exposed.push(`${f.replace('src/', '')} <${m[1]}> "${m[3]!.trim().slice(0, 26)}"`);
    }
  }
  assert(exposed.length === 0, exposed.length === 0
    ? 'every decorative mark carries aria-hidden'
    : `${exposed.length} exposed: ${exposed.slice(0, 6).join(' · ')}`);
}

console.log('\none class draws one glyph');
{
  const byClass = new Map<string, Set<string>>();
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/className="([a-z-]*sheet-x[a-z-]*)"[\s\S]{0,220}?>([\s\S]{0,60}?)<\/(?:Link|button|a)>/g)) {
      const marks = [...(m[2]!.match(/[✕×✗✖]/gu) ?? [])];
      if (!marks.length) continue;
      const set = byClass.get(m[1]!) ?? new Set<string>();
      for (const g of marks) set.add(g);
      byClass.set(m[1]!, set);
    }
  }
  const split = [...byClass].filter(([, s]) => s.size > 1);
  assert(byClass.size > 0, `.sheet-x found in ${byClass.size} class form(s)`);
  assert(split.length === 0, split.length === 0
    ? 'every close affordance is drawn with the same character'
    : split.map(([c, s]) => `.${c} uses ${[...s].join(' and ')}`).join(' · '));
}

console.log('\na class whose whole job is a mark is always hidden');
{
  /* WHY THIS IS BY CLASS AND NOT BY CHARACTER. Fourteen `.note-glyph` elements
     existed and the character rule above saw only six of them, because EIGHT
     contained the letter "i" and two an exclamation mark — an info glyph and a
     warning glyph that are ordinary characters. Adding `i` and `!` to the mark
     set would flag every sentence in the app.
     
     A class named for being a glyph is decorative whatever it holds, and each of
     the fourteen is paired with a .note-text sibling carrying the actual
     message. Before this they were announced as "letter i" ahead of every note. */
  const MARK_CLASSES = ['note-glyph', 'dash-clean-check', 'g g-'];
  const exposed: string[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const cls of MARK_CLASSES) {
      const re = new RegExp(`className="${cls.replace(/[- ]/g, '[- ]')}[a-z-]*"([^>]*)>`, 'g');
      for (const m of src.matchAll(re)) {
        if (/aria-hidden=/.test(m[0])) continue;
        exposed.push(`${f.replace('src/', '')} .${cls.trim()}`);
      }
    }
  }
  assert(exposed.length === 0, exposed.length === 0
    ? `every mark-class element is hidden (${MARK_CLASSES.join(', ')})`
    : `${exposed.length} exposed: ${[...new Set(exposed)].slice(0, 6).join(' · ')}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
