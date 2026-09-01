# Fydr Visual Lift — source

Imported 2026-09-01 from the Claude Design project **"Design appeal discussion"**
(`claude.ai/design/p/406f2d24-80a2-407f-b3a3-2250fd6d4f08`), file
`Fydr Visual Lift.dc.html`. Vendored because the light-theme handoff in
`../light-theme-handoff.*` went missing from Downloads once already and had to be
recovered from the Trash.

## What it is

An **exploration**, not a token file: four labelled variants across two turns, each a
full 1280x900 screen mock built with inline styles.

| Variant | Theme | Ground | Screen |
|---|---|---|---|
| 1a | dark | `#202b4e` | Dashboard — dark as the hero |
| 1b | light | `#e4ebf9` | Athlete profile — light, print-safe |
| 2a | light | `#e4ebf9` | Dashboard — light theme |
| 2b | dark | `#202b4e` | Athlete profile — dark theme |

Turn 1 is captioned "visual lift · layout and type unchanged" — the lift is colour and
surface only, which is why implementing it touched no layout.

## What was implemented, and what was not

**Implemented** (commit alongside this file):

- The two grounds: light `#eaedf1` -> `#e4ebf9`, dark `#182241` -> `#202b4e`.
- The KPI strip treatment from 2a, whose own markup comment reads *"KPI strip, one
  domain colour per tile"*: a per-tile domain dot, mini proportion bars, a washed and
  red-toned tile when flags are open, and a 34px value.

**Not implemented, deliberately:**

- The mock's own palette is otherwise identical to the existing tokens — same accent,
  semantics, borders, hairlines. There was nothing else to port.
- Its sidebar is flat white; the app's carries a strip layer from `.app`'s background.
  Layout was explicitly out of scope for this turn.
- **It does not fix the three contrast failures** carried from the Aug 6 handoff. Its
  light variants still set `#0d7a96` and `#b07d0a`, which on its own darker ground
  measure 4.14:1 and 3.03:1; `--faint` `#929aa5` is 2.38:1. Those deviations stay, and
  `--faint` is still shipped failing. See `tokens.css` §3.7.

## The ground change forced a re-derivation

`#e4ebf9` is DARKER than `#eaedf1` (relative luminance 0.828 vs 0.844), so dark text on
it has less room, not more. Four tokens fell below 4.5:1 and were re-derived with hue and
saturation held: `--accent-text`, `--accent2-text`, `--accent-pill-text`,
`--accent2-pill-text`. Full figures in `tokens.css` §3.7.

## Relationship to the other handoff

`../light-theme-handoff.*` (6 Aug) states High fidelity and reserves new colours to the
designer. This project is the designer answering that: the same person's later
exploration, proposing exactly the deepened, bluer ground that §12 said was not an
implementer's call. Where the two disagree on the ground, this one is newer and wins.
The design system's own `readme.md` still documents `#eaedf1`, so it is now behind both.
