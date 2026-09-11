/* The wellness sheet, rebuilt from the redesign screenshots (13 and 14).
 *
 * THREE CHANGES, and one of them reaches a screen the changelog does not
 * mention, which is why that one is asserted hardest:
 *
 *   1. Scale order becomes Sleep quality, Soreness, Fatigue, Mood, Stress.
 *   2. The sleep row loses its box and becomes a plain flex row.
 *   3. "not answered" WAS amber, and this file pinned it. ATH-ADULT-03 A6
 *      (Isabella, 2026-09-11) reversed that: an untouched form is a starting
 *      state, not a fault, so the state reads "Not answered" in neutral
 *      --muted and the footer count is what says how far there is to go.
 *      The assertion below now pins the reversal, for the same reason it
 *      pinned the original — so neither can quietly come back.
 *
 * WELLNESS_SCALES IS SHARED WITH A STAFF SCREEN. EntryCorrectionPanel, the
 * coach's correction form, maps the same constant, so reordering it reorders
 * that panel too. That is deliberate rather than collateral: a coach correcting
 * an entry should see the fields in the order the player answered them, and two
 * separate orders is how they drift apart. It is called out here because the
 * changelog asked only for the athlete sheet.
 *
 * AND THE CORNER SPECS ARE PINNED HERE, for the whole redesign rather than this
 * screen. Isabella's instruction was to keep the existing corner specs and add
 * one pill token, so the four existing radii are asserted at their current
 * values. Every later screen in this redesign will be tempted to nudge one of
 * them; this fails the build if it does.
 */
import { readFileSync } from 'node:fs';
import { WELLNESS_SCALES, SCALE_COPY } from '@/lib/validation/wellness';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const css = readFileSync('src/styles/base.css', 'utf8');
const form = strip(readFileSync('src/components/CheckInForm/CheckInForm.tsx', 'utf8'));
const page = strip(readFileSync('src/app/(athlete)/check-in/page.tsx', 'utf8'));
const scaleInput = strip(readFileSync('src/components/ScaleInput/ScaleInput.tsx', 'utf8'));

console.log('the corner specs Isabella asked to keep, pinned for the whole redesign');
{
  const RADII: ReadonlyArray<readonly [string, string]> = [
    ['--r-card', '18px'], ['--r-tab', '14px'], ['--r-field', '12px'], ['--r-control', '6px'],
  ];
  for (const [name, value] of RADII) {
    assert(new RegExp(`${name}:\\s*${value}\\s*;`).test(tokens), `${name} is still ${value}`);
  }
  /* NO PILL TOKEN IS ASSERTED HERE, and the reason belongs in the file rather
     than in a conversation. `--r-pill` already exists at 20px and is read by
     three BAR rules (.gym-progress-track, .gym-progress-fill, .pp-bench-bar);
     tokens.css records that repointing it was tried once and was wrong. And
     check:control-radius, which runs in prebuild, enforces "no pill-shaped
     buttons anywhere" — every control is --r-control at 6px.

     This sheet does not need a pill anyway: its 1-to-5 keys and its submit
     button are rounded rectangles in the reference, and the close button is a
     circle already exempt as round-on-purpose. The pill question belongs to the
     screens that actually draw one — My data's segmented track, Me's Sign out
     and theme toggle, the gym logger's badges and set keys — and is Isabella's
     to settle there, since exempting them reverses a guarded rule for the
     athlete app and would leave the staff app square. */
  assert(/--r-pill:\s*20px\s*;/.test(tokens), 'and the existing --r-pill stays 20px, since three bar rules read it');
}

console.log('\nthe scale order matches the reference');
{
  assert(
    WELLNESS_SCALES.join(',') === 'sleep_quality,soreness,fatigue,mood,stress',
    `Sleep quality, Soreness, Fatigue, Mood, Stress (saw ${WELLNESS_SCALES.join(', ')})`,
  );
  /* NOTHING LOST IN THE REORDER. A reorder that dropped a scale would still
     satisfy the assertion above if the remaining four happened to be in order,
     so all five are checked present with both end labels — the labels are the
     reason the scales are readable at all, since "5 = no soreness" is
     counter-intuitive. */
  assert(WELLNESS_SCALES.length === 5, 'still five scales');
  for (const s of WELLNESS_SCALES) {
    const c = SCALE_COPY[s];
    assert(!!c && !!c.label && !!c.low && !!c.high && c.words.length === 5,
      `${s} keeps its label, both ends and five words`);
  }
  assert(SCALE_COPY.soreness.high === 'No soreness', 'and soreness still reads 5 = No soreness');
}

console.log('\nthe sleep row is a plain row, not a boxed panel');
{
  const rule = /\.sleep-panel\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(rule !== '', 'the .sleep-panel rule still exists');
  assert(!/background:/.test(rule), 'no background');
  assert(!/border:/.test(rule), 'no border');
  assert(!/border-radius:/.test(rule), 'and no radius, since there is no box to round');
  assert(/display:\s*flex/.test(rule), 'still a flex row, label left and stepper right');
}

console.log('\nthe "last night" reference chip is gone, and gone from its caller too');
{
  assert(!/sleep-ref/.test(form), 'CheckInForm no longer renders the chip');
  assert(/lastNightSleepHours/.test(form), 'and takes the prop again');
  assert(/lastNightSleepHours/.test(page), 'and the page passes it again');
  assert(!/\.sleep-ref\s*\{/.test(css), 'and the CSS rule is removed rather than orphaned');
}

console.log('\n"Not answered" is neutral, on both themes (ATH-ADULT-03 A6 reversed the amber)');
{
  assert(/Not answered/.test(scaleInput), 'the copy is still there');
  const rule = /\.sc-v\.un\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/--muted/.test(rule) && !/--warn-text/.test(rule), 'and coloured from --muted, not --warn-text and not a hardcoded hex');
  /* BOTH THEMES, checked against the pattern this file actually uses. An
     earlier version of this assertion looked for a bare `:root {` and failed on
     correct code: tokens.css never writes one. It declares the palette three
     ways — `:root[data-theme='light']` for an explicit choice,
     `:root[data-theme='dark']` for the other, and `:root:not([data-theme])` for
     the system default — which is stricter than a bare root plus a media query,
     because the toggle then wins in both directions rather than only one. */
  assert(/--muted:/.test(tokens), '--muted is a real token');
  for (const sel of [":root\\[data-theme='light'\\]", ":root\\[data-theme='dark'\\]", ':root:not\\(\\[data-theme\\]\\)']) {
    const block = new RegExp(sel + '[^{]*\\{[\\s\\S]*?\\n\\}').exec(tokens)?.[0] ?? '';
    assert(block.includes('--muted'), `defined under ${sel.replace(/\\/g,'')}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
