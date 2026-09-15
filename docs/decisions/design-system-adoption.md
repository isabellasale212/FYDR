# Adopting the Claude Design system into the code

**Decided by Isabella, 14 September 2026. This reverses two standing rules and
does so deliberately.**

## What changes

The product adopts **System A**, the design system built in Claude Design:
`docs/design-system/tokens/colors.css`, `typography.css`, `spacing.css`,
`shape.css`, `motion.css`.

Until now the code ran **System B**, its own `src/styles/tokens.css`, and the
day-one rule was that nothing from Claude Design's kit was imported. That rule
is withdrawn. Isabella designed System A and wants the product to look like it.

**The design freeze of 13 September is lifted for this work only.** This is a
deliberate restyle. Everything else it protected still holds: no layout changes,
no copy changes, no data changes, no changes to what a role can see.

## Three things of System B's that survive

1. **`--hit-lg: 56px` and `--hit-md: 52px`.** Approved 13 September for the gym
   logger. System A has only `--touch-min: 44px`. These are added to System A,
   not dropped.
2. **The existing dark theme's colours.** System B's dark is richer than System
   A's and carries Isabella's 11 September decision (`--accent: #2a6ddf` in
   dark). Dark keeps its current colours. System A's rule that brand and
   semantic colours are never theme-split is therefore NOT adopted.
3. **`--r-full: 999px`**, where something is a lozenge rather than a circle or a
   rectangle. System A has 50% and 8px with nothing between.

## The shape of the change

**Layer one, colours and shadows.** Token values swap to System A. Pure white
cards, the new two-layer shadow, the deeper `--accent2` (`#1793c9`, replacing
the bright `#33b6ff`), see-through borders on ink 23,40,80.

**Layer two, corners.** System A has ONE radius: 8px. System B has eight. Cards
go 18 to 8, pills 20 to 8. **This is the largest visible change in the product.**
Isabella committed to it without a render, deliberately.

**Layer three, type and spacing.** System B has no type, spacing or motion
tokens at all: every size, weight, gap and padding is a raw number. System A has
all of them. Roughly 1,500 places in the code are repointed. Invisible
individually; it is the layer that stops the system rotting.

## The risk that was named and accepted

Nothing is deployed, so a bad outcome costs a night of builder time and is
reverted, not a broken product.

**The one thing that can genuinely break is dark mode.** System A's light theme
carries around eighty colour tokens; its dark block covers eleven. Pill fills,
heat ramps, washes and the blue ramp have no dark values. Every new colour token
must either get a dark value or carry a written reason why it is theme-neutral.
Without that, a screen nobody looked at renders white on white.

---

## Correction, 14 September 2026: the premise above was wrong about the code

This document said the code had no type, spacing or motion tokens and that every
size was a raw number. **That is false.** The code had `--fs-*` (16 rem steps)
and `--sp-*` (15 px steps), read in roughly 1,700 places. The advisory chat
checked for System A's names (`--font-*`, `--t-page`, `--gap-card`) and, finding
none, concluded there were none. It never checked the names the code actually
used. The error is recorded here rather than quietly edited out, because layer
three was scoped against it.

## Ruling: two vocabularies, one mechanism

**The code's `--fs-*` and `--sp-*` stay as the working scale. The 1,700 reads are
NOT renamed.**

**Where a System A role name maps to exactly the same value as a code step, the
System A name is pointed at the code step.** New work writes the role name; old
work keeps resolving. You get System A's vocabulary without the rewrite.

**Why not the full rename.** It changes nothing on screen, not one pixel, and it
cannot be done mechanically: one old label maps to several role names depending
on context (`--fs-13` is a table number in one place and body text in another).
That is days of manual judgement for no visible result, at a moment when the club
run and the region move are the work on the path to a paying club.

**Why it might be revisited.** A role name says what a thing is FOR.
`--t-num-cell` is self-documenting; `--fs-13` is not. If the codebase outlives
this decision by a year or two, the rename becomes worth doing. It is a tidy-up,
not a blocker.

## Two smaller rulings, same day

- **`--pad-card` takes System A's 18px**, replacing the code's 16px on every
  card. Visible, and wanted: the whole point of the adoption is that the product
  replicates the system. Render the six screens before committing it.
- **`--sidebar-w` stays at the built 236px**, not System A's 214px. That is
  layout, layout was out of scope for the whole adoption, and changing a sidebar
  width moves every page's content column. Recorded as a deliberate divergence,
  not a miss.
- The nine eyebrows at `0.11em` go to `--t-eyebrow-tracking` (`0.12em`). A tenth
  of a pixel per letter.

## The guard gap layer three exposed, and closed

A comment added to `tokens.css` contained the literal characters `--fs-*/--sp-*`.
A star followed by a slash ends a CSS comment, so the rest of the file parsed as
junk and every page showed a CSS parse error for six commits. **Prebuild stayed
green throughout: all ~200 guards read the stylesheet as TEXT and not one parsed
it as CSS.** `next build` would have refused those commits, so nothing broken
could have shipped, but the guard suite was blind to a whole class of failure.
`check:css-parses` (postcss, both files) now runs second in prebuild.

Do not deploy anything between `d6fb005` and `075d5ce`.

## Reversal, 16 September 2026 (Isabella): one thing moves

System A's motion file says "almost nothing moves" — one transition for state
changes, one keyframe for the dials. **Isabella reversed that for one case,
deliberately: the loading skeleton's shimmer.** Five routes stream with a
`loading.tsx` whose blocks shimmer — a static grey block reads as broken, a
moving one reads as loading — over `--dur-ring`, in `--surf2` and `--surf`,
on `--r`. `prefers-reduced-motion` stops it like every other animation.
Recorded here with the date and the name so that nobody later removes the
shimmer as a violation of the rule it reverses. **Amended 15 September
(`decisions/skeleton-gate.md`): which routes carry a skeleton is no longer
gated on the measurement. All five keep theirs, held invisible for the
first 200ms and shown for at least 300ms once shown, so a fast render
never shows one at all.** The same night adds the
keyboard focus ring (`--ring-focus`, 3px of the accent at a higher alpha than
`--ring-select`, 2px offset, `:focus-visible` only) — an addition, not a
reversal: nothing defined it before.

**Dark's focus ring is a deliberate divergence (Isabella, 16 September 2026).**
The instruction was 3px of the accent; the dark accent (`#2a6ddf`) cannot clear
the 3:1 non-text floor on a dark ground at any alpha (2.87:1 on `--bg` at full
strength), so the instruction was wrong for dark. Dark's `--ring-focus` is the
theme's own `--focus` cyan (`#33b6ff`, 6.1:1 on `--bg`), approved as such.

