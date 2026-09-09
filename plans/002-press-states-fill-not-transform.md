# 002 — Make the last four press states a fill, not a shrink

- **Status**: DONE — executed and reviewed 2026-09-09 (see plans/README.md for the verdict)
- **Commit**: fea25a6
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, 4 rules edited + 4 transitions retargeted

## Problem

This app has already decided what a press looks like, in writing:

```
/* src/styles/base.css:737 */
Colour and border, never transform. `transform: scale(0.97)` on `:active` was
the one soft, springy gesture left in the app — it is the shape of interaction
this design is explicitly not: the press should be a crisp change of fill at
--t-press (80ms), not the button shrinking.
```

**18 `:active` rules follow that. 4 still shrink.** They are the leftovers the
2026-09-08 press-states sweep did not reach, because that sweep targeted
controls with *no* `:active` state at all and these four already had one:

```css
/* src/styles/base.css:666 — current */
.toggle:active {
  transform: scale(0.97);
}

/* src/styles/base.css:2668 — current */
.step .btnc:active {
  transform: scale(0.97);
}

/* src/styles/base.css:7495 — current */
.sg-btn-publish:active {
  transform: scale(0.97);
}

/* src/styles/base.css:8204 — current */
.sg-stepper-btn:active {
  transform: scale(0.94);
}
```

`.sg-stepper-btn` is at `0.94` where the others are `0.97`, so the four are not
even consistent with each other.

**THE TRANSITIONS MUST BE RETARGETED IN THE SAME EDIT, OR THE PRESS GOES
INSTANT.** Three of the four base rules transition `transform` and nothing
else — remove the transform and the declaration is dead, so the new fill would
snap with no 80ms ramp:

```css
/* src/styles/base.css:2652 — current (excerpt) */
.step .btnc { background: var(--surf); transition: transform var(--t-press); }
/* src/styles/base.css:7483 — current (excerpt) */
.sg-btn-publish { background: var(--accent); transition: transform var(--t-press); }
/* src/styles/base.css:8189 — current (excerpt) */
.sg-stepper-btn { background: var(--surf); transition: transform var(--t-press); }
/* src/styles/base.css:595 — current (excerpt) */
.toggle { background: var(--elev); transition: border-color var(--t-state), color var(--t-state); }
```

`.toggle` is the opposite case: it transitions `border-color` and `color` but
**not** `background`, so a fill added there would also be instant.

**AND ALL FOUR NEED THE FILL ADDED, NOT JUST THE TRANSFORM REMOVED.** None of
these four has any `:hover` rule (`grep -c "\.step \.btnc:hover"` → 0,
`.sg-stepper-btn:hover` → 0, `.sg-btn-publish:hover` → 0), and `.toggle:hover`
moves only `border-color` and `color`. Deleting the transform on its own leaves
them with **no press feedback whatsoever on touch**, which is exactly the "feels
dead" failure the press-states block at `src/styles/base.css:11960` exists to
fix. Removal and replacement are one change.

## Target

Four rules, each a fill, each ramped at `--t-press` (80ms).

```css
/* target — src/styles/base.css:666 */
.toggle:active {
  background: var(--surf2);
}

/* target — src/styles/base.css:2668 */
.step .btnc:not(:disabled):active {
  background: var(--surf2);
}

/* target — src/styles/base.css:7495 */
.sg-btn-publish:not(:disabled):active {
  background: var(--accent-border);
}

/* target — src/styles/base.css:8204 */
.sg-stepper-btn:not(:disabled):active {
  background: var(--surf2);
}
```

And the four base transitions:

```css
/* target — src/styles/base.css:595, .toggle: ADD background, keep the rest */
transition: background var(--t-press), border-color var(--t-state), color var(--t-state);

/* target — src/styles/base.css:2652, .step .btnc */
transition: background var(--t-press);

/* target — src/styles/base.css:7483, .sg-btn-publish */
transition: background var(--t-press);

/* target — src/styles/base.css:8189, .sg-stepper-btn */
transition: background var(--t-press);
```

Why these exact values, none of them invented:

- `var(--surf2)` is the house "one step deeper than the resting surface" press
  fill. `--surf` and `--elev` are **the same colour** in every theme
  (`#fcfdfe` light, `#1d2643` dark), so `--surf2` is the next real step for all
  three of `.toggle`, `.step .btnc` and `.sg-stepper-btn`.
- `var(--accent-border)` is what a filled accent button already uses on press:
  `.btn-primary:active { background: var(--accent-border); }`
  (`src/styles/base.css:758`). `.sg-btn-publish` is `background: var(--accent)`,
  the same shape of control, so it takes the same press.
- `:not(:disabled)` on three of them matches the house idiom — each of those has
  a `:disabled` rule immediately after it (`base.css:7498`, `:8207`), and the
  press-states block guards every equivalent control the same way.
  `.toggle` has no `:disabled` rule, so it takes no guard.

## Repo conventions to follow

- **The press-states block at `src/styles/base.css:11960` is the exemplar**, and
  two of its rules are the direct analogues of these controls:
  ```css
  /* src/styles/base.css:12002-12003 */
  .gym-stepper button:not(:disabled):active { background: var(--surf2); }
  .nutr-stepper-btn:not(:disabled):active { background: var(--surf2); }
  ```
  `.sg-stepper-btn` and `.step .btnc` are the same kind of control and take the
  same value.
- That block's own note states the rule this plan completes: *"a control whose
  hover only moves border or ink gains a fill on press; a control whose hover
  already fills gets a deeper one."*
- **Rules stay beside their base rule** for these four — they already do, and
  this plan edits them in place. Do **not** move them into the collected press
  block at the end of the file; that block exists for the seventeen rules added
  at once, and its comment says so.
- Motion durations come from tokens: `--t-press` (80ms) for press,
  `--t-state` (150ms) for hover. Never a literal ms value.

## Steps

1. `src/styles/base.css:666-668` — replace the `.toggle:active` body's
   `transform: scale(0.97);` with `background: var(--surf2);`.
2. `src/styles/base.css:609` — in the `.toggle` base rule, change
   `transition: border-color var(--t-state), color var(--t-state);` to
   `transition: background var(--t-press), border-color var(--t-state), color var(--t-state);`.
3. `src/styles/base.css:2668-2670` — change the selector to
   `.step .btnc:not(:disabled):active` and its body to `background: var(--surf2);`.
4. `src/styles/base.css:2665` — change `transition: transform var(--t-press);`
   to `transition: background var(--t-press);`.
5. `src/styles/base.css:7495-7497` — change the selector to
   `.sg-btn-publish:not(:disabled):active` and its body to
   `background: var(--accent-border);`.
6. `src/styles/base.css:7493` — change `transition: transform var(--t-press);`
   to `transition: background var(--t-press);`.
7. `src/styles/base.css:8204-8206` — change the selector to
   `.sg-stepper-btn:not(:disabled):active` and its body to
   `background: var(--surf2);`.
8. `src/styles/base.css:8202` — change `transition: transform var(--t-press);`
   to `transition: background var(--t-press);`.
9. Confirm the sweep is complete with the check below. A plain
   `grep -c "transform: scale"` is **not** a valid check here — it counts the two
   occurrences that live inside comments (`base.css:752` and `:11971`, both of
   which quote the rule while explaining it) and would read as a failure when the
   code is correct. Strip comments first:

   ```bash
   perl -0777 -ne 's{/\*.*?\*/}{}gs;
     my $a=0; while(/([^{}]*:active[^{}]*)\{([^{}]*)\}/gs){ $a++ if $2=~/transform\s*:/ }
     my @s=(/transform\s*:\s*scale\([^)]*\)/g);
     print "active-with-transform: $a\nscale-total: ".scalar(@s)."\n"' src/styles/base.css
   ```

   **Before your edit** it prints `active-with-transform: 4` and `scale-total: 6`.
   **After your edit** it must print `active-with-transform: 0` and
   `scale-total: 2`. The two survivors are both the brand lockup and are out of
   scope: `transform: scale(var(--lk-scale, 0.3))` at `base.css:10864` and
   `transform: scale(0)` in `@keyframes lk-pop` at `:10920`.

## Boundaries

- Do **NOT** touch the sign-in launch sequence or the brand lockup — every
  `.launch*`, `.lockup*` and `lk-*` rule and keyframe keeps its transforms.
  Those are a rare first-run moment, not press feedback.
- Do **NOT** change `--t-press` (80ms). It is below the 100-160ms the general
  animation rubric suggests for press feedback, and that is a recorded, deliberate
  choice at `src/styles/base.css:737`. Leave it.
- Do **NOT** remove `min-height` from any of these controls.
  `scripts/check-font-scaling.ts` asserts that `.step .btnc`, `.sg-stepper-btn`
  and nine others carry no fixed `height`, because their text scales.
- Do **NOT** move these rules into the collected press-states block.
- Do **NOT** add a `:hover` rule to any of the four. Press parity is the scope;
  inventing hover states is a design change nobody asked for.
- Do **NOT** also apply plan `001`.
- If any quoted line does not match the file, it has drifted since commit
  `fea25a6`. **STOP and report.**

## Verification

- **Mechanical**:
  - `npx tsc --noEmit` — no output.
  - `npm run prebuild` — exits 0.
  - The comment-stripped check in step 9 prints `active-with-transform: 0` and
    `scale-total: 2`.
- **Feel check**: run the dev server. Every one of these needs a **real touch
  device or DevTools device emulation with touch**, because the failure mode is
  touch-only — on a mouse, `:hover` masks a missing `:active`.
  - `.sg-btn-publish` and `.sg-stepper-btn`: sign in as a `coach`, open
    `/schedule`, click a session. Press and hold a stepper arrow, and press and
    hold **Publish to athletes** (with an edit pending so it is visible). Each
    should **darken and stay darkened while held**, then return. Nothing should
    change size.
  - `.step .btnc`: the athlete wellness sheet's numeric steppers.
  - `.toggle`: press and hold — it should gain a fill, on top of the border and
    ink change its hover already does, so a desktop press still reads as "more
    than hover".
  - In DevTools → Animations, set playback speed to 10% and press one. Confirm a
    **fill ramping over 80ms** and no scale at any point in the sequence.
  - In DevTools → Rendering, tick **Emulate CSS prefers-reduced-motion** and
    press each one again. The fill must **still be there** — the global block at
    `src/styles/base.css:162` deliberately keeps `background` in its
    `transition-property` allow-list, so press feedback survives reduced motion.
    If feedback disappears, something broke that block.
- **Done when**: all four press as a fill with no size change, the fill ramps at
  80ms, feedback survives reduced motion, `npm run prebuild` exits 0, and the
  step-9 check prints `active-with-transform: 0` / `scale-total: 2`.
