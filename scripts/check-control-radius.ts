/* Nothing you can click may carry its own corner radius.
 *
 * WHY THIS EXISTS. Before the 6px sweep, 47 of the 58 interactive rules in
 * base.css set a RAW border-radius — 20px, 12px, 14px, 11px, 999px, fourteen
 * different values between them — and only 11 read a token. Every one of those
 * was written by somebody reasonably picking a number for the component in
 * front of them, which is exactly how it happens again. A design rule that
 * lives in 58 places is not a rule.
 *
 * So: an interactive rule reads var(--r-control) or it fails the build. The
 * value is decided once, in tokens.css, and "no pill-shaped buttons anywhere"
 * becomes something the repo enforces rather than something a review has to
 * catch.
 *
 * WHAT COUNTS AS INTERACTIVE is a selector-name heuristic, and it is
 * deliberately generous: it over-matches rather than under-matches, because a
 * false positive costs one token reference and a false negative costs the rule.
 * Genuinely round things opt out by name — a switch KNOB and its TRACK are
 * pill-shaped and circular because that is what a switch is, an avatar is a
 * circle, a legend swatch is a 4px square — and those names are listed rather
 * than inferred, so opting out is a visible decision in this file.
 *
 * Takes an optional path so its own test can run it against a planted
 * violation rather than trusting that it would have caught one.
 */
import { readFileSync } from 'node:fs';

const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Selector families that are controls: you click, tap or type into them.
 *
 *  THIS LIST UNDER-MATCHED ONCE AND PRODUCTION IS WHAT CAUGHT IT. After the
 *  6px sweep shipped, the sign-in button on fydr.app still computed to 14px:
 *  `.launch .signin-submit` overrides `.btn-primary`, and none of the words
 *  below appeared in either half of that selector. Six more like it turned up
 *  by reviewing every remaining raw radius by hand rather than adding another
 *  guess — .skip-link, .week-nav and its links, .tr-board-row-link, and two
 *  <select> rules.
 *
 *  TWO MORE WERE MISSING and the Me redesign is what found them: `.sign-out`
 *  (a raw 16px) and `.theme-seg`/`.theme-seg-btn` are controls whose class
 *  names contain none of the words below, so the guard had never looked at
 *  them. They are in the net now. Both are then exempt by name for the pill —
 *  which is the point: an exemption you can see beats a rule that never
 *  reached the rule in the first place.
 *
 *  So this is a net, not a proof. It cannot know that an element carrying
 *  .signin-submit also carries .btn-primary, because that fact lives in JSX
 *  rather than in CSS. When adding a control whose class name says nothing
 *  about being one, add the word here — and test-control-styling.ts pins the
 *  overrides already found, so they cannot quietly come back. */
export const INTERACTIVE =
  /btn|chip|pill|\btab\b|tabs|segment|toggle|\bfield\b|input|search|select|signin|submit|launch|skip-link|week-nav|row-link|sg-add|filter|action|stepper|squad-|weeknav|set-row|mode-switch|lbw-segmented|rhead-btn|exlib-cat|sign-out|theme-seg/i;

/** Shapes that are round on purpose and are not buttons, chips, pills or tabs. */
/* Round on purpose, and each name here is a decision rather than a number.
   `track` and `knob` cover switches: .tr-heat-toggle-track is a 999px pill with
   a 50% knob riding in it, which is what a switch IS — the spec bans pill
   BUTTONS, and a 6px track around a round knob would just look broken. Bars
   (.gym-progress-track, .pp-bench-bar) are the same argument. `mark` is here
   because widening INTERACTIVE with `signin` immediately caught .signin-mark,
   which is the logo on the sign-in screen — the guard over-matching and being
   told so, which is the trade this heuristic is supposed to make. */
export const SHAPED_ON_PURPOSE = /swatch|knob|track|avatar|bar\b|mark\b|sg-fixture|sg-legend|dot\b/i;

/* THE ATHLETE REDESIGN'S PILLS, approved by Isabella on 2026-09-08 as named
   exemptions rather than by changing the rule.
 *
 *  The rule above — "no pill-shaped buttons anywhere", every control at
 *  --r-control 6px — still holds for the staff app and for every athlete control
 *  not listed here. The redesign reference draws a handful of athlete controls as
 *  full pills, and the choice was between exempting those by name or repointing a
 *  token that would have moved ~58 interactive rules across both apps. Named
 *  exemptions keep the blast radius to the controls actually redrawn, and keep
 *  each one visible in this file rather than implied by a token.
 *
 *  THE CONSEQUENCE, so nobody discovers it later: the two apps now diverge. A
 *  segmented control on a staff screen is 6px and its athlete equivalent is a
 *  pill. That is intended, not drift.
 *
 *  ADD A NAME HERE ONLY WHEN THE REFERENCE ACTUALLY DRAWS A PILL, with the screen
 *  it belongs to, so a later reader can check it against the screenshots. Empty
 *  until the first pill control lands — the wellness sheet needed none, and Today
 *  needs none either. */
export const ATHLETE_PILL_EXEMPT: readonly string[] = [
  'sign-out',      // Me, screens 11-12 — the full-width Sign out button
  'theme-seg',     // Me, screens 11-12 — the Light/Dark track...
  'theme-seg-btn', // ...and the segment riding inside it
  // next: 'md-seg' — My data's segmented Wellness/Gym/Tests track (screens 03-08)
];

export type Violation = { selector: string; value: string };

export function findViolations(css: string): Violation[] {
  const out: Violation[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = stripComments(m[1] ?? '').replace(/\s+/g, ' ').trim();
    if (!INTERACTIVE.test(selector) || SHAPED_ON_PURPOSE.test(selector)) continue;
    const decl = /border-radius:\s*([^;]+);/.exec(m[2] ?? '');
    if (!decl) continue;
    const value = (decl[1] ?? '').trim();
    if (value === 'var(--r-control)') continue;
    /* A NAMED EXEMPTION BUYS ONE VALUE, NOT A FREE HAND. Being on the list
       means "this athlete control is drawn as a pill", so it may read
       --r-full and nothing else — a raw 999px, or a 16px somebody liked,
       still fails. Otherwise the list would quietly become the escape hatch
       from the rule rather than a short, checkable set of exceptions to it. */
    if (ATHLETE_PILL_EXEMPT.some((name) => selector.includes(name))) {
      if (value === 'var(--r-full)') continue;
    }
    out.push({ selector: selector.slice(0, 90), value });
  }
  return out;
}

const path = process.argv[2] ?? 'src/styles/base.css';
const violations = findViolations(readFileSync(path, 'utf8'));

if (violations.length > 0) {
  console.error(`\nControl radius: ${violations.length} interactive rule(s) in ${path} set their own corner radius.\n`);
  for (const v of violations) console.error(`  ${v.value.padEnd(18)} ${v.selector}`);
  console.error(`
Use var(--r-control). The value lives in tokens.css and is 6px; a raw number
here is a second opinion about a decision that has already been taken, and it
is how the app ended up with fourteen different radii on its buttons.

If this element is genuinely round — a switch knob, a track, an avatar, a
legend swatch — name it so, and add that name to SHAPED_ON_PURPOSE in
scripts/check-control-radius.ts so the exemption is visible rather than
inferred from a number.

If this is an athlete control the redesign reference draws as a full pill, add
its name to ATHLETE_PILL_EXEMPT in the same file and set var(--r-full). That
list is short on purpose: it is the set of controls where the two apps diverge,
and a long one means the rule has been abandoned rather than excepted.
`);
  process.exit(1);
}

console.log(`Control radius: every interactive rule in ${path} reads var(--r-control).`);
