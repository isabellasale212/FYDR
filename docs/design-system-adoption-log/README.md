# System A adoption — the layer-three repointing log

One file per area, written by the repointing script as it ran on 15 September
2026 (`scratchpad/l3-repoint.py`, not kept in the repo): every raw value it
moved onto a token, by file and line, with the token; and every raw value it
left as a literal, with the reason. A value with no exact token was left unless
the nearest was one pixel away on the spacing grid (the inventory's own
definition of imperceptible). Ten such moves were made in the style objects,
every one 1px — and every one was put back after the six-screen render: a
pixel on a row margin repeats on every row and compounds (10px down a five-row
list on the GPS report). They are marked REVERTED in the Note column and stay
literals. So nothing was moved to fit a token, and no token was invented to
keep a stray number.

| File | Area |
|---|---|
| `layer-three-weights-base.md`, `-weights-tsx.md` | font-weight → `--w-*` (374 + 72) |
| `layer-three-sizes-base.md`, `layer-three-type-tsx.md` | font sizes (base.css had none raw; 8 inline) |
| `layer-three-tracking-base.md` | letter-spacing → the three tracking tokens (59; 60 left) |
| `layer-three-line-height-base.md` | line-height → `--lh-*` (35; 70 left) |
| `layer-three-motion-base.md` | durations → `--dur` (2; the launch sequence's 15 left) |
| `layer-three-spacing.md`, `-spacing-inner.md`, `-tsx-spacing.md`, `-tsx-spacing-numeric.md` | padding, margin, gap, offsets → `--s-*` / `--sp-24…48` (20 + 13 + 143 + 18; 84 left) |
| `layer-three-hit-targets.md` | 44px → `--tap-min` (80) |

The inventory (`docs/conformance-inventory-2026-09-15.md`, regenerated with
`scripts/conformance-inventory.ts --md`) counted 1,502 literals before layer
three and 749 after. What remains is, by family: border widths (269 — System
A's `--border-w` / `--border-accent-w` are in `shape.css` and were not on the
night's list), fixed box dimensions (310 — no System A token for an icon or a
column width), the colours the inventory flagged before (41, the brand marks
and the launch sequence), shadows the token does not match (11), and the
spacing left above (101, including negatives and calc()).
