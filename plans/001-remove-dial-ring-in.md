# 001 — Stop the profile dials redrawing on every page load

- **Status**: TODO
- **Commit**: fea25a6
- **Severity**: HIGH
- **Category**: Purpose & frequency / Easing & duration
- **Estimated scope**: 1 file, ~8 lines removed

## DECISION REQUIRED BEFORE EXECUTING

This removes a visible animation, and `CLAUDE.md` §0 freezes the design: *"Do not
change visual design, layout, spacing, colour, typography or component structure
unless the user explicitly asks."* **Isabella must approve this plan's target
before an executor runs it.** The alternative target is recorded at the bottom
under "If the draw is kept". Do not pick between them yourself.

## Problem

`.dial-arc` animates unconditionally on mount. There is no `[data-animate]`
attribute, no `data-mounted` gate, no prop — every `<Dial>` that renders a value
draws its ring from empty over 900ms, every single time the component mounts.

```css
/* src/styles/base.css:140 — current */
@keyframes ring-in {
  from {
    stroke-dashoffset: 251;
  }
}
.dial-arc {
  animation: ring-in 0.9s cubic-bezier(0.22, 0.8, 0.36, 1);
}
```

The class is attached in the shared component, so every caller inherits it:

```tsx
/* src/components/Dial/Dial.tsx:63 — current (excerpt) */
{pct !== null ? (
  <circle
    cx="50" cy="50" r="40" fill="none"
    stroke={tone} strokeWidth="9" strokeLinecap="round"
    strokeDasharray={CIRCUMFERENCE}
    className="dial-arc"
    style={{ strokeDashoffset: offset }}
  />
) : null}
```

Three things make this the highest-leverage motion finding in the repo:

1. **Frequency.** `<Dial>` renders **3 times** on
   `src/app/(staff)/squad/[athleteId]/page.tsx` (Athleticism, ACWR, Wellness
   rating) and **4 times** on `src/app/(staff)/reports/training/page.tsx`. A
   coach opening athlete profiles through a squad works through this dozens of
   times a day. The audit rule for that frequency band is "remove or drastically
   reduce" — an entrance animation earns its place on first sight, not on the
   fortieth.
2. **Duration.** 900ms against a 300ms ceiling for UI animation. It is still
   drawing well after the coach has read the number in the middle of it.
3. **Cost.** `stroke-dashoffset` is SVG geometry, so it repaints rather than
   compositing — and up to 7 of them run simultaneously on the training report.

It is also the only animation in the product outside the sign-in launch
sequence, which makes it stylistically orphaned: `src/styles/base.css:737`
records the house position that interaction should be "a crisp change of fill",
and this is a 900ms decorative draw.

## Target

Both the rule and its now-unused keyframe are deleted, and a tombstone comment
takes their place — this file's established habit for recording a removal so it
does not get reinstated by someone who assumes it was an oversight.

```css
/* target — replaces src/styles/base.css:140-147 in full */
/* NO RING-IN ANIMATION. `.dial-arc` used to draw itself from empty over 900ms
   (`@keyframes ring-in`, cubic-bezier(0.22, 0.8, 0.36, 1)) on every mount. It
   was ungated, so it replayed on every visit: three dials on the player profile
   and four on the training report, for a coach who opens those screens dozens
   of times a day. 900ms is also three times the 300ms this app allows any UI
   animation, and stroke-dashoffset repaints rather than composites, so seven of
   them ran together on the training report. An entrance animation earns its
   place on first sight, not on the fortieth. Removed 2026-09-09; base.css:737
   is the house position it was the last exception to. */
```

`.dial-arc` keeps its `className` in `Dial.tsx` — it is a stable hook and
removing it is a markup change, not a motion one. It simply has no rule.

## Repo conventions to follow

- **This stylesheet documents removals in place.** See the `.athlete-tabbar`
  `backdrop-filter` removal and the reset-rule tombstones — a deleted decision
  gets a comment saying what went and why, not a silent gap. Match that voice:
  plain sentences, the measurement that justified it, the date.
- **Motion tokens live in `src/styles/tokens.css`** (`--t-state`, `--t-press`).
  This plan adds no token; it removes the only curve that was never one.
- Do not reformat, re-indent or reorder anything around the deletion.

## Steps

1. In `src/styles/base.css`, delete lines 140-147 in full — both the
   `@keyframes ring-in { ... }` block and the `.dial-arc { ... }` rule.
2. In their place, insert the tombstone comment from **Target** verbatim.
3. Confirm nothing else references the keyframe or the rule:
   `grep -n "ring-in" src/styles/base.css` must return **no matches**.
   `grep -rn "dial-arc" src/` must return exactly one match,
   `src/components/Dial/Dial.tsx:73`.

## Boundaries

- Do **NOT** edit `src/components/Dial/Dial.tsx`. The `className` stays.
- Do **NOT** touch the sign-in launch sequence (`base.css` ~9531-9900, every
  `.launch*` / `.lockup*` / `lk-*` rule and keyframe). That motion is a rare,
  first-run moment and is deliberately exempt.
- Do **NOT** remove or weaken the `prefers-reduced-motion` block at
  `src/styles/base.css:162`.
- Do **NOT** add a dependency, a token, or a new animation.
- Do **NOT** also apply plan `002` — separate finding, separate diff.
- If lines 140-147 do not contain exactly the code quoted under **Problem**,
  the file has drifted since commit `fea25a6`. **STOP and report**; do not
  search for the rule elsewhere and improvise.

## Verification

- **Mechanical**:
  - `npx tsc --noEmit` — no output.
  - `npm run prebuild` — exits 0. (It runs `check:surface-tokens`,
    `check:control-radius`, `check:athlete-spacing`, `check:font-scaling` and
    ~22 test suites. None of them assert on this rule, so a failure here means
    something else was touched.)
  - `grep -c "ring-in" src/styles/base.css` returns `0`.
- **Feel check**: run the dev server, sign in as a staff user with
  `sport_scientist` or `coach`, and open
  `/squad/<athleteId>` then `/reports/training`.
  - The three (then four) rings are **already at their final offset on first
    paint**. Nothing sweeps.
  - Navigate away and back. Still no sweep — this is the regression that
    matters, because the bug was that it replayed.
  - The rings still show the right proportions: a full ring for a high value, a
    part ring for a mid value, and **no arc at all** where the value is null
    (`Dial` renders the track only in that case — do not "fix" that).
  - In DevTools → Rendering, tick **Emulate CSS prefers-reduced-motion**. Nothing
    should change, because there is no longer any animation to reduce.
- **Done when**: `grep "ring-in" src/styles/base.css` is empty, the tombstone
  comment is present, `Dial.tsx` is unchanged in `git diff`, `npm run prebuild`
  exits 0, and the dials paint at their final value with no sweep on a repeat
  visit.

## If the draw is kept (the alternative target — do not execute without approval)

If Isabella wants the entrance retained, the animation must be both **gated to
first mount** and **cut to the UI budget**. That is a larger change because the
gate does not exist today: `Dial` would take an `animateOnMount?: boolean`
defaulting to `false`, set a `data-animate` attribute like `FydrLockup` already
does (`src/components/FydrLockup/FydrLockup.tsx:38`), and the CSS would become
`.dial-arc[data-animate] { animation: ring-in 0.28s var(--ease-out); }` with
`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` added to `src/styles/tokens.css`.
Each caller then opts in explicitly. This touches component markup and a token,
so it is a different plan, not a variant of this one.
