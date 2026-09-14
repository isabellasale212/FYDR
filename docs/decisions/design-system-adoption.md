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
