# ADR-009: The brand accent is #17489b, and dark has its own fill

## Status

**ACCEPTED.** 11 September 2026, Isabella's decision. The first token-value
change made under the rule in `CLAUDE.md` §0.01 ("Changing a token's value is a
system decision, not a pattern change"): recorded with the date next to every
changed value in `src/styles/tokens.css`, built as its own commit, with a full
contrast sweep in both themes pinned by `scripts/test-brand-accent.ts` in
prebuild. Updates `docs/06-design-system.md` §2.2 and
`docs/Fydr_-_Design_System_Reference.md` in the same commit.

---

## Context

`--accent` was `#1f6fea` in both themes, single-valued in the shared base block
of `tokens.css`, with a family of tuned inks around it (`--accent-text`
`#0064dc`, `--accent-pill-text` and `--accent-on-tint` `#0050c4`,
`--accent-on-wash` `#0056bf` in light; `#8fb4ff` / `#699bff` / `#8fb4ff` /
`#9dbcff` in dark), a border "a step lighter" (`#3c85f7`), and every wash, ring
and border alpha composed from `--accent-rgb`. Two values outside the family
carried the same hex by value rather than by reference: `--focus` and
`--wk-match-border` in light. Outside `tokens.css` the hex lived in
`lib/pdf.tsx` (`PDF_COLOR.accent`) and, at 25% over white, as the lockup's trace
(`--lk-trace #c7dbfa` in `base.css`). The icon tile, apple icon, Open Graph
image and manifest carry `#202b4e` navy and white, never the accent.

Isabella's decision: the brand accent becomes **`#17489b`**, whole app, athlete
and staff.

**What the measurement found before deciding the dark half.** `#17489b` is a
navy (luminance 0.072 against `#1f6fea`'s 0.176). In light it is better as a
fill (white on it 8.62:1, was 4.65) and clears AA as ink on every light ground —
8.46 on `--surf`, 7.20 on `--bg`, 6.91 on the athlete ground `--phone-bg`, 5.83
on its own 22% pill fill — which the old accent never did. In dark it measures
**1.73:1 against `--surf` `#1d2643`**, 1.61 against `--bg`, 1.97 against
`--phone-bg`: a primary button that disappears into its card. The old accent
sat at 3.20 / 2.98 / 3.66 there.

## Decision

1. **Light `--accent` is `#17489b`.** `--accent-rgb` `23 72 155`. The four light
   accent inks — `--accent-text`, `--accent-pill-text`, `--accent-on-tint`,
   `--accent-on-wash` — **collapse to the accent itself**: the fill clears AA as
   ink everywhere, and keeping the tuned brighter blues (hue ~213°) beside a
   navy button would read as two blues. `--accent-border` is `#1c59bf` (same hue
   and saturation, one lightness step up, the ratio `#3c85f7` had to `#1f6fea`).
   `--focus` and `--wk-match-border` (light) are the accent. The print block
   takes the light values.
2. **Dark gets its own fill: `--accent #2a6ddf`**, `--accent-rgb` `42 109 223`,
   `--accent-border` `#4d86e5`, declared in **both** dark blocks (the explicit
   `[data-theme='dark']` choice and the `prefers-color-scheme` default). It is
   the new brand's own hue (217.8°) and saturation (.74) at the lightness that
   keeps `--on-accent` white at **4.83:1** and the fill 3.08:1 off `--surf`,
   3.53 off the athlete ground (2.87 off `--bg`, as the old fill's 2.98 was — a
   labelled solid button, not a boundary-only control). Because `--accent-rgb`
   moves with it, every dark wash, ring and border alpha follows. The dark inks
   are unchanged **except `--accent-pill-text`**, which was `#699bff` at 4.34:1 on
   its own pill fill before this change and is now `#8fb4ff` (5.71).
3. **Dark `--bad-text` is `#ff7460`** (was `#f15a4a`, 4.47:1 on `--surf`, found
   during ATH-ADULT-03). 5.61 on `--surf`, 5.22 on `--bg`, 6.42 on the athlete
   ground, 4.51 on `--surf2`, 5.17 on the 0.08 bad wash. Its `check-contrast`
   exemption is removed; the `--accent`-as-ink exemption is narrowed to dark.
4. **Unchanged, on purpose:** `--accent2`, `--chart-load` (decoupled from the
   accent since 0f4b574), `--group-blue`, `--tab-active` / `--avatar-text` /
   `--toast-link` `#6f9bff`, `--phone-bg`, `--bg`, and the icon tiles.
5. **Also fixed while splitting the dark blocks:** the `prefers-color-scheme`
   dark block had never declared `--phone-bg` or `--accent-on-wash`, so an
   OS-dark athlete with no stored theme choice got the light `#dbe7fb` shell
   ground under dark text. Both are now declared, and the guard asserts the two
   dark blocks define the same tokens with the same values.

## Consequences

- Every primary action, selected key, link, focus ring and accent tint in both
  apps changes colour in one commit. Light reads navy; dark reads a blue one
  step from the old one. Screenshots before and after are in the handover.
- `--accent` is now the one brand token that is **theme-split**. `06-design-
  system.md` §2.2 said "not theme-split" of the whole brand row; it now records
  the exception. A future brand change must set both fills and re-run the sweep.
- The light accent inks being one value means a link, a pill label and a button
  are the same navy. That is the decision, not a shortcut; if a lighter link
  blue is ever wanted again it is a new value under this same rule.
- `docs/06-design-system.md`'s source audit tables (2026-09-06) keep their old
  accent rows as dated history; the live sweep is the guard.
- `docs/14-sports-science-brief.md`'s categorical chart palette still lists
  `#1f6fea` as slot 1. It is a chart palette, and chart hues were deliberately
  decoupled from the accent; left for the sports-science pass to decide.

## Alternatives considered

- **One accent for both themes.** Rejected by measurement: `#17489b` at 1.73:1
  off dark `--surf`, and any same-hue value light enough to separate from the
  dark card (≥ 3:1) lands where white text still passes only up to luminance
  0.183 — i.e. at the old fill's lightness. Dark needs its own value.
- **Keep the tuned light inks.** They pass (`#0064dc` 5.35 on `--surf`, 4.55 on
  `--bg`) but are a brighter, more saturated blue than the new fill; two blues
  in one theme for no contrast reason.
- **Old saturation (.83) for the dark fill** (`#1f6aea`, white 4.87, surf 3.05):
  visually the old accent again. The new hue/saturation at `#2a6ddf` reads as
  the same brand as the light navy.
- **Dark `--bad-text` at the minimal shift `#f4665a`** (4.89 surf, 4.55 bg):
  clears cards but only 3.93 on `--surf2`; `#ff7460` already existed in the
  file as `--bad-pill-text` and clears every dark ground.
