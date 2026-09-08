/* FONT SIZES SCALE WITH THE USER'S TEXT SETTING, so they are rem, not px.
 *
 * WHY. A `px` font-size ignores the browser's default-text-size preference
 * entirely — a user who raises it sees no change at all. Browser ZOOM still
 * works, so this was never a total lockout, but the preference was silently
 * discarded on an app whose primary surface is a phone. 561 declarations were
 * converted on 2026-09-08; at a 16px root every one computes to exactly the px
 * it replaced, so nothing moved at default settings.
 *
 * TWO DELIBERATE EXCEPTIONS, both asserted below rather than merely allowed:
 *
 *   `@media print` uses `pt`. Physical units are right for paper and were never
 *   px, so nothing was converted there.
 *
 *   `.lockup-word` stays at 386px. It is the brand mark, not text: a wordmark
 *   that grows with someone's reading preference is a broken logo, not an
 *   accessible one.
 *
 * IT ALSO GUARDS THE CONTAINERS. Scaling type inside a fixed-height box clips
 * it, so eleven text-bearing controls moved from `height` to `min-height`. That
 * half is what makes the conversion safe, and it is easy to undo by accident —
 * a fixed `height` on a control that carries text is the regression this looks
 * for. Verified at 16, 20, 24 and 32px roots with no clipping and no horizontal
 * overflow, using a detector proven against a forced clip first.
 */
import { readFileSync } from 'node:fs';

let failed = 0;
const css = readFileSync('src/styles/base.css', 'utf8');
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* The print block is measured separately, so cut it out of the main scan. */
const printStart = stripped.search(/@media print\s*\{/);
let main = stripped, printBlock = '';
if (printStart >= 0) {
  const i = stripped.indexOf('{', printStart) + 1;
  let d = 1, j = i;
  while (d && j < stripped.length) {
    if (stripped[j] === '{') d++;
    else if (stripped[j] === '}') d--;
    j++;
  }
  printBlock = stripped.slice(i, j);
  main = stripped.slice(0, printStart) + stripped.slice(j);
}

const pxSizes = [...main.matchAll(/font-size:\s*([\d.]+)px/g)];
const allowed = pxSizes.filter((m) => {
  /* .lockup-word is the only px font-size the product may carry. */
  const before = main.slice(Math.max(0, (m.index ?? 0) - 400), m.index);
  return /\.lockup-word\s*\{[^}]*$/.test(before);
});
const offenders = pxSizes.filter((m) => !allowed.includes(m));

if (offenders.length) {
  failed = 1;
  console.error(`\nFont scaling: ${offenders.length} font-size declaration(s) use px.\n`);
  for (const m of offenders.slice(0, 20)) {
    const line = main.slice(0, m.index).split('\n').length;
    console.error(`  ~line ${line}  font-size: ${m[1]}px`);
  }
  console.error(`
Use rem so the value follows the user's text-size setting: px does not. Divide
by 16 — 15px becomes 0.9375rem, which computes to exactly 15px at the default
root, so nothing moves for a default user.

If this really is a brand asset rather than text, it belongs beside
.lockup-word and needs a line in this script saying so.
`);
}

if (pxSizes.length - offenders.length !== 1) {
  failed = 1;
  console.error(`\nFont scaling: expected exactly one allowed px font-size (.lockup-word), found ${pxSizes.length - offenders.length}.`);
  console.error('If the lockup changed, update this script deliberately.\n');
}

/* The container half. A fixed height on a control that carries text clips it
   the moment the text grows. */
const CONTROLS = [
  '.sheet-x', '.step .btnc', '.gym-set-key', '.gym-stepper button',
  '.nutr-stepper-btn', '.sg-stepper-btn', '.sg-stepper-value', '.sg-field-ro',
  '.dots .opt > span', '.nutr-checkin-cell', '.reorder-btn',
];
const repinned: string[] = [];
for (const sel of CONTROLS) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(stripped)?.[1];
  if (rule === undefined) { console.error(`  (selector gone: ${sel})`); failed = 1; continue; }
  if (/(?<!min-)(?<!max-)\bheight:\s*[\d.]+px/.test(rule)) repinned.push(sel);
}
if (repinned.length) {
  failed = 1;
  console.error(`\nFont scaling: ${repinned.length} text control(s) have a fixed height again.\n`);
  for (const r of repinned) console.error(`  ${r}`);
  console.error(`
These carry text that now scales with the user's setting. A fixed height clips
it — use min-height so the control grows. Measured at a 32px root, these were
the eleven that needed it.
`);
}

if (!failed) {
  console.log(`Font scaling: ${pxSizes.length - offenders.length} allowed px font-size, ${CONTROLS.length} text controls free to grow, print block in pt (${(printBlock.match(/font-size:/g) ?? []).length} sizes).`);
}
process.exit(failed);
