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
 * IT ALSO GUARDS THE STYLE ATTRIBUTE, and that half was missing on the night
 * the sweep shipped. This script read base.css and nothing else, so it passed
 * green while 132 inline `fontSize` values in TSX stayed px — React renders
 * `fontSize: 17` as `font-size: 17px`, which is exactly the declaration the
 * sweep existed to remove. Two of them were on athlete screens: the name of
 * every to-do row on Today, and the body of a submitted problem report.
 *
 * SCOPED TO THE ATHLETE ROUTES, deliberately, and the boundary is the honest
 * one rather than the flattering one. The staff app holds ~130 more (48 in
 * settings/page.tsx alone); widening this today would fail the build on work
 * nobody has scheduled. Two components the athlete DOES reach sit outside the
 * scan and are named here rather than left to be discovered:
 *
 *   FlagNotice.tsx      a 10.5px domain pill. Real text, genuinely unfixed —
 *                       it renders on the flags surface, not on Today, so it
 *                       was outside what was asked for.
 *   AvatarUploadForm    20px initials centred in a hard 64x64 circle, and the
 *                       element is aria-hidden. A monogram, not text: growing
 *                       the glyph without growing the circle clips it. Same
 *                       argument as .lockup-word above.
 *
 * IT ALSO GUARDS THE CONTAINERS. Scaling type inside a fixed-height box clips
 * it, so eleven text-bearing controls moved from `height` to `min-height`. That
 * half is what makes the conversion safe, and it is easy to undo by accident —
 * a fixed `height` on a control that carries text is the regression this looks
 * for. Verified at 16, 20, 24 and 32px roots with no clipping and no horizontal
 * overflow, using a detector proven against a forced clip first.
 */
import { readFileSync, readdirSync } from 'node:fs';

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

/* THE STYLE ATTRIBUTE, athlete routes. `fontSize: 17` and `fontSize: '17px'`
   both render as px and both ignore the user's text setting; only a rem string
   follows it. */
const athleteFiles = readdirSync('src/app/(athlete)', { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => `src/app/(athlete)/${f}`);

const inline: { file: string; line: number; value: string }[] = [];
for (const file of athleteFiles) {
  /* Comments are blanked, not deleted: removing them shifts every line after
     the first comment and the reported line number stops matching the file. */
  const src = readFileSync(file, 'utf8').replace(
    /\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\//g,
    (c) => c.replace(/[^\n]/g, ' '),
  );
  for (const m of src.matchAll(/fontSize:\s*(?:'([\d.]+)px'|"([\d.]+)px"|([\d.]+))\b/g)) {
    inline.push({ file, line: src.slice(0, m.index).split('\n').length, value: (m[1] ?? m[2] ?? m[3]) + 'px' });
  }
}

if (inline.length) {
  failed = 1;
  console.error(`\nFont scaling: ${inline.length} inline font-size(s) on athlete routes use px.\n`);
  for (const i of inline) console.error(`  ${i.file}:${i.line}  fontSize: ${i.value}`);
  console.error(`
React writes \`fontSize: 17\` into the style attribute as \`font-size: 17px\`, so
it ignores the user's text-size setting exactly as a px rule in base.css does.
Use a rem string — \`fontSize: '1.0625rem'\` — which computes to the same 17px at
the default root, so nothing moves for a default user.
`);
}

if (!failed) {
  console.log(`Font scaling: ${pxSizes.length - offenders.length} allowed px font-size, ${CONTROLS.length} text controls free to grow, ${athleteFiles.length} athlete route files free of inline px, print block in pt (${(printBlock.match(/font-size:/g) ?? []).length} sizes).`);
}
process.exit(failed);
