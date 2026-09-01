# Handoff: Fydr light theme — colour and surface treatment

## Overview

This bundle is the **colour and theme layer only** from the reworked Fydr light screens. No
layout, no component structure, no measurements. Everything here answers one question: what
colour is a given thing, and why.

Apply it to whatever layout already exists in the target codebase. Nothing in this package
should change where an element sits.

## About the design files

The values below were taken from a working HTML design reference. They are **not production
code** — `theme-light.css` is a token file to adapt to the codebase's existing theming
mechanism (CSS custom properties, Tailwind config, SwiftUI `Color` extensions, styled-system
theme object, whatever is already in use). Do not introduce a new theming approach to
accommodate it.

## Fidelity

**High fidelity.** Every hex value and alpha is final and was measured off the reference, not
approximated. Use them exactly.

## Baseline

This is a light theme for an athlete performance product used by coaching staff. It reads as an
instrument panel, not a consumer app: a near-neutral grey-blue page, flat white cards, one blue
accent, three semantic colours, and colour-coded data. It derives from the Fydr design system —
where this package diverges from that system, it says so explicitly under Deviations.

---

## 1. Surfaces

| Role | Value | Where |
|---|---|---|
| `--bg` | `#eaedf1` | App background behind all cards |
| `--surface` | `#ffffff` | Every card, panel, sidebar |
| `--surface-sunken` | `#dfe3e9` | The desk behind the app frame; also any inset well |
| `--chip-dark` | `#1a2340` | Avatar/initials chip fill |
| `--chip-dark-fg` | `#6f9bff` | Initials on that chip |

Cards are **flat white**. No card gradients, no glass, no frosted panels.

### Page washes

Two very soft radial washes on the app background, and nothing else:

```css
background:
  radial-gradient(900px 480px at 88% -12%, rgba(51,182,255,0.30), transparent 64%),
  radial-gradient(700px 400px at -6% 108%, rgba(31,111,234,0.20), transparent 58%);
```

Cyan top-right, blue bottom-left. They sit behind cards, never on them, and must not receive
pointer events.

## 2. Text

| Role | Value | Use |
|---|---|---|
| `--text` | `#13161c` | Headings, names, values, primary labels |
| `--text-secondary` | `#5b636e` | Descriptive prose, sub-labels, inactive nav |
| `--faint` | `#929aa5` | Field labels, captions, denominators, empty markers |

Three levels, no more. An em dash for a missing value takes `--faint`, never `--text`.

## 3. Borders and hairlines

| Role | Value | Use |
|---|---|---|
| `--border` | `rgba(16,18,23,0.085)` | Card outline, sidebar edge, control outline |
| `--divider` | `rgba(16,18,23,0.05)` | Divisions *inside* a card |
| `--track` | `rgba(16,18,23,0.10)` | Unfilled bar/ring track |
| `--tick` | `rgba(16,18,23,0.22)` | Reference marker on a track (e.g. the median tick) |

Borders are always 1px. Structure comes from hairlines and tint, not from weight.

## 4. Accent

| Role | Value | Use |
|---|---|---|
| `--accent` | `#1f6fea` | Primary action, links, selected state, primary dial arc |
| `--accent-2` | `#33b6ff` | Second stop of the logo dot only; also the "pitch" domain colour |
| `--accent-rgb` | `31,111,234` | For composing alphas |

Accent tints, in ascending strength:

```css
--wash-accent-soft:  rgba(31,111,234,0.07);  /* passive tint */
--wash-accent:       rgba(31,111,234,0.12);  /* card header band */
--wash-accent-strong:rgba(31,111,234,0.16);  /* selected nav item */
--border-accent:     rgba(31,111,234,0.50);  /* selected outline */
--border-accent-soft:rgba(31,111,234,0.42);  /* accent-outlined control */
--ring-accent:       0 0 0 3px rgba(31,111,234,0.16); /* focus/plot ring */
```

The only gradient permitted anywhere in the theme is the 22px logo dot:

```css
background: linear-gradient(150deg, #1f6fea, #33b6ff);
```

## 5. Semantic colours

**The rule that catches people out: a semantic colour is never used as text.** `#f6ab2f` on white
fails contrast at small sizes. Every tone is a *pair* — a tinted fill plus its own darkened
foreground. For coloured text on white, use the `on-*-strong` value.

| Tone | Base | Text on white (`on-*-strong`) | Pill fill | Pill text (`on-*`) |
|---|---|---|---|---|
| Good / wellness | `#4fd6ff` | `#0d7a96` | `rgba(79,214,255,0.22)` | `#0d5f75` |
| Warn / due | `#f6ab2f` | `#b07d0a` | `rgba(246,171,47,0.28)` | `#6b4708` |
| Bad / flagged | `#f15a4a` | `#8a2418` | `rgba(241,90,74,0.24)` | `#7a1f14` |

Card-level washes and borders for the same tones:

```css
--wash-good: rgba(79,214,255,0.13);   --border-good: rgba(79,214,255,0.50);
--wash-warn: rgba(246,171,47,0.16);   --border-warn: rgba(246,171,47,0.60);
--wash-bad:  rgba(241,90,74,0.13);    --border-bad:  rgba(241,90,74,0.55);
```

Flag severity is fixed: **high is red `#f15a4a`, medium is amber `#f6ab2f`**. Do not remap these
to any other pair, and do not let a theme switch alter them — a flag means the same thing in
every theme.

### Urgency

A card that needs to feel more urgent takes a **coloured 1px border plus its wash**. It never
takes a heavier shadow, a larger radius, or a scale transform.

## 6. Domain colour-coding

Used to distinguish where a number came from. One dot, bar segment, or tint per domain.

| Domain | Value |
|---|---|
| Gym / strength | `#f5c518` |
| Pitch / GPS | `#33b6ff` |
| Testing | `#4fd6ff` |
| Recovery | `#8a94b8` |
| Medical | `#f15a4a` |

`#f5c518` is also the one coloured icon in the product (the gym glyph). Every other icon
inherits `currentColor` from its parent.

## 7. Percentile band washes

Rows in a benchmark list carry their band as a full-width row tint, so the list colour-codes top
to bottom. Bar fill uses the base tone; the row uses the wash.

| Band | Row wash | Bar fill | Label colour |
|---|---|---|---|
| 0–19th | `rgba(241,90,74,0.13)` | `#f15a4a` | `#8a2418` |
| 20–39th | `rgba(241,90,74,0.07)` | `#f15a4a` | `#8a2418` |
| 40–59th | `rgba(246,171,47,0.11)` | `#f6ab2f` | `#b07d0a` |
| 60–100th | `rgba(79,214,255,0.14)` | `#33b6ff` | `#0d7a96` |

**Suppress shading below five subjects with data**, and when suppressed say so and state that the
numbers themselves are unchanged. Small samples make shading lie.

## 8. Elevation and shape

**One shadow for the entire theme.** There is no elevation scale.

```css
--shadow: 0 1px 3px rgba(16,18,23,0.08);
```

Radii, for surface identity only (not layout):

```css
--r-band:  7px;   /* a heat/band cell */
--r-ctrl: 12px;   /* button, input, small control */
--r-card: 18px;   /* every card */
--r-pill: 20px;   /* pill, chip, tag */
--r-round: 50%;   /* dot, avatar, dial */
```

## 9. States

- **Hover** — border to `rgba(31,111,234,0.40)`, text to `--text`. Ghost controls brighten only;
  they never darken, lift, or scale.
- **Selected** — `--wash-accent-strong` fill, `--border-accent` outline. Plotted elements add
  `--ring-accent`. Nothing translates on press.
- **Disabled** — 45% opacity, plus `cursor: not-allowed` and a caption saying why when the option
  is genuinely unavailable.
- **Gated (paid tier)** — 62% opacity plus a badge. Never hidden.

Transitions are `150ms` on `border-color, color, background` only.

## 10. Transparency and blur

Two places only:

```css
--sticky-bar: rgba(234,237,241,0.85);  backdrop-filter: blur(14px);
--tab-bar:    rgba(255,255,255,0.94);  backdrop-filter: blur(14px);
```

Nowhere else.

## 11. Type colour roles

Type family is out of scope here, but colour-by-role is not:

- Headings and values — `--text`, weight 700–800
- Body and descriptive prose — `--text-secondary`, weight 400
- Captions, denominators, field labels, uppercase eyebrows — `--faint`
- Status words — the matching `on-*-strong` value, never the base tone

## 12. Do not

- Do not add a second or third shadow level.
- Do not add gradients to cards, headers, or buttons (logo dot excepted).
- Do not add texture, pattern, photography, or illustration. The only permitted hatch is an
  explicit placeholder for a chart that has no real render yet, and it must be labelled as one.
- Do not use a semantic base colour as text on white.
- Do not recolour flag severity away from red/amber.
- Do not introduce colours not listed in this file. If something needs a new colour, that is a
  design decision, not an implementation one.

## Deviations from the stock Fydr design system

Flagged so the developer knows these are intentional choices in this theme, not errors:

1. **Page washes are stronger** — cyan 0.30 / blue 0.20, against the system's 0.10 / 0.06.
2. **Row-level percentile washes** (section 7) are new. The system shades in one place only.
3. **Split-panel tints** — a two-up panel may tint each half to its own tone (e.g. amber for a
   metric still building its baseline, cyan for one that is healthy).
4. **The monospace family was removed** at the client's request, so numbers set in the sans face.
   This breaks the system's number/language split and costs column alignment on figures read
   vertically. Colour is unaffected; noting it because it will look off beside any Fydr surface
   built to spec.

## Files in this bundle

| File | What it is |
|---|---|
| `README.md` | This document |
| `theme-light.css` | Every token above as CSS custom properties, ready to adapt |
| `theme.json` | The same tokens, machine-readable, for a Tailwind/JS theme config |

No HTML or layout files are included — by request, this handoff is colour and theme only.
