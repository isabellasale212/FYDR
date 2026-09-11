# Fydr — design system reference

**Generated 2026-09-10 from the source of truth**, not from a specification.
Token values updated 2026-09-11 for the brand accent decision (`--accent`
`#17489b` light / `#2a6ddf` dark, and the tokens that follow it — see
`docs/decisions/adr-009-brand-accent.md`); the computed component values below
were read before that change and still show the old blue where a component
resolves the accent.
Token values are read from `src/styles/tokens.css`; component values are
**computed styles read from the running application**, so they are what a
browser actually resolved rather than what the stylesheet asks for.

Every value below is exact. Where a token differs between themes both are given;
where a single value is shown, it is the same in both.

**Count: 171 tokens, and this document names all 171.** By section — Staff role
colours 6 (the `--domain-*` set, listed under a heading that explains why they
are not role colours), Colour 110, Group / avatar palette 10, Radius 9, Spacing
scale 15, Type scale 16, Motion 3, Elevation 2. `src/styles/tokens.css` declares
171 distinct custom properties; CLAUDE.md's "171-token system" is the same
number. `--font-sans` and `--font-brand` are set in `layout.tsx`, not
`tokens.css`, and are not in the 171. Reconciled 2026-09-11 after a builder
handover noted the sections were never totalled — nothing was missing from
either side, the count had just never been written down.

---

## Fonts

Declared in `src/app/layout.tsx` via `next/font/google`, exposed as CSS
variables, and applied through them — no font-family string is written anywhere
else.

| | Family | Weights | CSS variable | Used for |
|---|---|---|---|---|
| Body | **Roboto** | 400, 500, 600, 700, 800 | `--font-sans` | Everything |
| Brand | **Sora** | 800 | `--font-brand` | The wordmark alone |

**Roboto's figures are tabular by default** — measured, not assumed: "111" and
"888" both render 33.73px, delta 0. The `font-variant-numeric: tabular-nums`
requests in the stylesheet are kept anyway, so the next family swap cannot
silently break every numeric column.

**Weight 500 is real.** Sora shipped no 500 and `font-weight: 500` against it was
synthesised by the browser; Roboto ships Medium, so those weights stopped being
faked when the families changed.

---

## Staff role colours

**There are none, and this is a deliberate answer rather than a gap.** No token
in `tokens.css` is named for `coach`, `medic`, `sport_scientist`,
`strength_conditioning` or `nutritionist`, and nothing renders a role in a
role-specific colour.

What exists instead is a **domain** palette — colour carries the kind of work,
not the person doing it, so the same session reads the same colour to every role:

| Token | Value |
|---|---|
| `--domain-gym` | `var(--gym)` |
| `--domain-pitch` | `var(--accent2)` |
| `--domain-testing` | `var(--good)` |
| `--domain-recovery` | `#8a94b8` |
| `--domain-recovery-rgb` | `138 148 184` |
| `--domain-medical` | `var(--bad)` |

The ten-name **group palette** below is the nearest thing to a per-person
colour: a coach picks one per squad group, and an athlete's avatar can carry one.

---

## Colour

110 tokens.

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#17489b` | `#2a6ddf` |
| `--accent-border` | `#1c59bf` | `#4d86e5` |
| `--accent-on-tint` | `#17489b` | `#8fb4ff` |
| `--accent-on-wash` | `#17489b` | `#9dbcff` |
| `--accent-pill-text` | `#17489b` | `#8fb4ff` |
| `--accent-rgb` | `23 72 155` | `42 109 223` |
| `--accent-text` | `#17489b` | `#8fb4ff` |
| `--accent2` | `#33b6ff` | _same_ |
| `--accent2-pill-text` | `#0063a5` | `#33b6ff` |
| `--accent2-rgb` | `51 182 255` | _same_ |
| `--accent2-text` | `#006eb0` | `#33b6ff` |
| `--avatar-bg` | `#1a2340` | _same_ |
| `--avatar-text` | `#6f9bff` | _same_ |
| `--avatar-text-fg` | `#2a68c6` | `#6f9bff` |
| `--bad` | `#f15a4a` | _same_ |
| `--bad-on-tint` | `#7a1f14` | `#ffb3a8` |
| `--bad-pill-text` | `#7a1f14` | `#ff7460` |
| `--bad-rgb` | `241 90 74` | _same_ |
| `--bad-text` | `#8a2418` | `#ff7460` |
| `--band-1-wash` | `rgb(var(--bad-rgb) / 0.13)` | `rgb(var(--bad-rgb) / 0.08)` |
| `--band-2-wash` | `rgb(var(--bad-rgb) / 0.07)` | `rgb(var(--bad-rgb) / 0.045)` |
| `--band-3-wash` | `rgb(var(--warn-rgb) / 0.11)` | `rgb(var(--warn-rgb) / 0.08)` |
| `--band-4-wash` | `rgb(var(--good-rgb) / 0.14)` | `rgb(var(--good-rgb) / 0.07)` |
| `--barfill` | `rgba(16, 18, 23, 0.155)` | `rgba(255, 255, 255, 0.19)` |
| `--bg` | `#e4ebf9` | `#202b4e` |
| `--blur` | `14px` | _same_ |
| `--border` | `#d4dff5` | `#2b3559` |
| `--border-accent` | `rgb(var(--accent-rgb) / 0.5)` | `rgb(var(--accent-rgb) / 0.62)` |
| `--border-accent-soft` | `rgb(var(--accent-rgb) / 0.42)` | `rgb(var(--accent-rgb) / 0.52)` |
| `--border-bad` | `rgb(var(--bad-rgb) / 0.55)` | `rgb(var(--bad-rgb) / 0.6)` |
| `--border-good` | `rgb(var(--good-rgb) / 0.5)` | `rgb(var(--good-rgb) / 0.55)` |
| `--border-hover` | `rgb(var(--accent-rgb) / 0.4)` | `rgb(var(--accent-rgb) / 0.52)` |
| `--border-strong` | `rgba(16, 18, 23, 0.52)` | `#657199` |
| `--border-warn` | `rgb(var(--warn-rgb) / 0.6)` | `rgb(var(--warn-rgb) / 0.62)` |
| `--chart-gym` | `#ebae4c` | _same_ |
| `--chart-gym-rgb` | `235 174 76` | _same_ |
| `--chart-load` | `#5b9bf0` | _same_ |
| `--chart-load-rgb` | `91 155 240` | _same_ |
| `--chart-wellness` | `#5bc7de` | _same_ |
| `--chart-wellness-rgb` | `91 199 222` | _same_ |
| `--cmp-b` | `#8b5cf6` | _same_ |
| `--cmp-b-rgb` | `139 92 246` | _same_ |
| `--elev` | `#fcfdfe` | `#1d2643` |
| `--faint` | `#626a76` | `#8492bd` |
| `--field` | `#ebf0fa` | `#1a2340` |
| `--focus` | `#17489b` | `#33b6ff` |
| `--gap-body` | `28px` | _same_ |
| `--gap-grid` | `12px` | _same_ |
| `--gap-stack` | `14px` | _same_ |
| `--good` | `#4fd6ff` | _same_ |
| `--good-pill-text` | `#0d5f75` | `#4fd6ff` |
| `--good-rgb` | `79 214 255` | _same_ |
| `--good-text` | `#0d5f75` | `#8ceaff` |
| `--gym` | `#f5c518` | _same_ |
| `--gym-on-tint` | `#6b4708` | `#ffdda6` |
| `--gym-rgb` | `245 197 24` | _same_ |
| `--gym-tint` | `#fef8e4` | `#48432f` |
| `--hair` | `rgba(16, 18, 23, 0.05)` | `rgba(255, 255, 255, 0.055)` |
| `--highlight` | `#f5c518` | _same_ |
| `--highlight-fg` | `#876600` | `#f5c518` |
| `--highlight-pill-text` | `#7f6000` | `#f5c518` |
| `--highlight-rgb` | `245 197 24` | _same_ |
| `--highlight-text` | `#3a2e00` | _same_ |
| `--ink-rgb` | `16 18 23` | _same_ |
| `--knob-fill` | `#ffffff` | _same_ |
| `--lb-bad-tint-text` | `#ab4035` | `#f5887d` |
| `--lb-rank-neutral` | `#4a5160` | `#a3adc9` |
| `--lb-rank1` | `#705a05` | `#e8c766` |
| `--lb-row-selected` | `rgb(243 247 254)` | _same_ |
| `--lb-standard-met` | `#0d5f75` | _same_ |
| `--lb-standard-met-rgb` | `79 214 255` | _same_ |
| `--lb-tint-alpha` | `0.14` | `0.24` |
| `--lb-warn-tint-text` | `#8a601a` | `#f6ab2f` |
| `--muted` | `#484e57` | `#a6b3d2` |
| `--node-empty-border` | `#313c60` | _same_ |
| `--o-disabled` | `0.45` | _same_ |
| `--o-gated` | `0.62` | _same_ |
| `--on-accent` | `#ffffff` | _same_ |
| `--on-bright-tint` | `var(--text)` | `#101219` |
| `--on-group` | `#ffffff` | `#101219` |
| `--pad-card` | `16px` | _same_ |
| `--pad-field` | `12px 14px` | _same_ |
| `--phone-bg` | `#dbe7fb` | `#141b33` |
| `--pill-fill-alpha` | `0.22` | _same_ |
| `--pill-fill-alpha-bad` | `0.24` | _same_ |
| `--pill-fill-alpha-warn` | `0.28` | _same_ |
| `--skeleton` | `#eeeeef` | `#33394e` |
| `--surf` | `#fcfdfe` | `#1d2643` |
| `--surf-sunken` | `#d7e1f6` | `#121a33` |
| `--surf2` | `#eff3fb` | `#2b3559` |
| `--tab-active` | `#6f9bff` | _same_ |
| `--tab-inactive` | `#4a5578` | `#949ec9` |
| `--text` | `#13161c` | `#e9edfa` |
| `--tick` | `rgba(16, 18, 23, 0.22)` | `rgba(255, 255, 255, 0.26)` |
| `--toast-bg` | `#13161c` | _same_ |
| `--toast-link` | `#6f9bff` | _same_ |
| `--toast-text` | `#ffffff` | _same_ |
| `--track` | `rgba(16, 18, 23, 0.1)` | `rgba(255, 255, 255, 0.12)` |
| `--warn` | `#f6ab2f` | _same_ |
| `--warn-pill-text` | `#6b4708` | `#f6ab2f` |
| `--warn-rgb` | `246 171 47` | _same_ |
| `--warn-text` | `#b07d0a` | `#ffdda6` |
| `--wash-accent` | `rgb(var(--accent-rgb) / 0.12)` | `rgb(var(--accent-rgb) / 0.16)` |
| `--wash-accent-soft` | `rgb(var(--accent-rgb) / 0.07)` | `rgb(var(--accent-rgb) / 0.1)` |
| `--wash-accent-strong` | `rgb(var(--accent-rgb) / 0.16)` | `rgb(var(--accent-rgb) / 0.22)` |
| `--wash-bad` | `rgb(var(--bad-rgb) / 0.13)` | `rgb(var(--bad-rgb) / 0.08)` |
| `--wash-good` | `rgb(var(--good-rgb) / 0.13)` | `rgb(var(--good-rgb) / 0.07)` |
| `--wash-warn` | `rgb(var(--warn-rgb) / 0.16)` | `rgb(var(--warn-rgb) / 0.08)` |
| `--wk-fill` | `rgba(31, 111, 234, 0.09)` | `rgba(79, 214, 255, 0.12)` |
| `--wk-match-border` | `#17489b` | `#4fd6ff` |

## Group / avatar palette

10 tokens.

| Token | Light | Dark |
|---|---|---|
| `--group-blue` | `#2563eb` | `#5aa8ff` |
| `--group-cyan` | `#0891b2` | `#4fc3e8` |
| `--group-green` | `#059669` | `#22ab60` |
| `--group-indigo` | `#4f46e5` | `#8c8cf5` |
| `--group-magenta` | `#c2258f` | `#f08cc8` |
| `--group-olive` | `#78960f` | `#b4c64a` |
| `--group-plum` | `#86339e` | `#c08fd2` |
| `--group-purple` | `#9333ea` | `#ee9fe6` |
| `--group-slate` | `#64748b` | `#6e7f91` |
| `--group-steel` | `#3d7f99` | `#7fb4c8` |

## Radius

9 tokens.

| Token | Light | Dark |
|---|---|---|
| `--r-band` | `7px` | _same_ |
| `--r-card` | `18px` | _same_ |
| `--r-control` | `6px` | _same_ |
| `--r-field` | `12px` | _same_ |
| `--r-full` | `999px` | _same_ |
| `--r-pill` | `20px` | _same_ |
| `--r-stat` | `16px` | _same_ |
| `--r-tab` | `14px` | _same_ |
| `--r-toggle` | `9px` | _same_ |

## Spacing scale

15 tokens.

| Token | Light | Dark |
|---|---|---|
| `--sp-10` | `10px` | _same_ |
| `--sp-12` | `12px` | _same_ |
| `--sp-14` | `14px` | _same_ |
| `--sp-16` | `16px` | _same_ |
| `--sp-18` | `18px` | _same_ |
| `--sp-2` | `2px` | _same_ |
| `--sp-20` | `20px` | _same_ |
| `--sp-24` | `24px` | _same_ |
| `--sp-28` | `28px` | _same_ |
| `--sp-32` | `32px` | _same_ |
| `--sp-4` | `4px` | _same_ |
| `--sp-40` | `40px` | _same_ |
| `--sp-48` | `48px` | _same_ |
| `--sp-6` | `6px` | _same_ |
| `--sp-8` | `8px` | _same_ |

## Type scale

16 tokens.

| Token | Light | Dark |
|---|---|---|
| `--fs-10` | `0.625rem` | _same_ |
| `--fs-11` | `0.6875rem` | _same_ |
| `--fs-12` | `0.75rem` | _same_ |
| `--fs-13` | `0.8125rem` | _same_ |
| `--fs-14` | `0.875rem` | _same_ |
| `--fs-15` | `0.9375rem` | _same_ |
| `--fs-16` | `1rem` | _same_ |
| `--fs-18` | `1.125rem` | _same_ |
| `--fs-20` | `1.25rem` | _same_ |
| `--fs-22` | `1.375rem` | _same_ |
| `--fs-24` | `1.5rem` | _same_ |
| `--fs-28` | `1.75rem` | _same_ |
| `--fs-32` | `2rem` | _same_ |
| `--fs-38` | `2.375rem` | _same_ |
| `--fs-48` | `3rem` | _same_ |
| `--fs-9` | `0.5625rem` | _same_ |

## Motion

3 tokens.

| Token | Light | Dark |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | _same_ |
| `--t-press` | `0.08s ease` | _same_ |
| `--t-state` | `0.15s ease` | _same_ |

## Elevation

2 tokens.

| Token | Light | Dark |
|---|---|---|
| `--ring-accent` | `0 0 0 3px rgb(var(--accent-rgb) / 0.16)` | `0 0 0 3px rgb(var(--accent-rgb) / 0.34)` |
| `--shadow` | `0 1px 3px rgba(16, 18, 23, 0.08)` | `0 1px 2px rgba(0, 0, 0, 0.4)` |

---

## Components, as the browser computes them

Read from the running app on 2026-09-10 at 1280px wide, light theme. The
`sampled from` column names the page the element was taken from, because a
class can be styled differently in context and these are the real instances the
walkthrough flows press.

### `.btn-ghost`

_a, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `600` |
| line-height | `18.85px` |
| color | `rgb(72, 78, 87)` |
| border-radius | `6px` |
| border-width | `1px` |
| border-color | `rgb(212, 223, 245)` |
| padding-top | `10px` |
| padding-right | `16px` |
| padding-bottom | `10px` |
| padding-left | `16px` |
| min-height | `44px` |
| transition | `border-color 0.15s, color 0.15s` |

### `.btn-primary`

_button, sampled from `/squad/new`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `700` |
| color | `rgb(255, 255, 255)` |
| background | `rgb(31, 111, 234)` |
| border-radius | `6px` |
| padding-top | `14px` |
| padding-right | `20px` |
| padding-bottom | `14px` |
| padding-left | `20px` |
| min-height | `44px` |
| transition | `background 0.08s, border-color 0.08s` |

### `.cap`

_p, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `400` |
| line-height | `19.5px` |
| color | `rgb(72, 78, 87)` |
| transition | `all` |

### `.card`

_div, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `400` |
| line-height | `21.75px` |
| color | `rgb(19, 22, 28)` |
| background | `rgb(252, 253, 254)` |
| border-radius | `18px` |
| border-width | `1px` |
| border-color | `rgb(212, 223, 245) rgb(212, 223, 245) rgb(212, 223, 245) rgb(79, 214, 255)` |
| padding-top | `16px` |
| padding-right | `16px` |
| padding-bottom | `16px` |
| padding-left | `16px` |
| box-shadow | `rgba(16, 18, 23, 0.08) 0px 1px 3px 0px` |
| transition | `all` |

### `.card-title`

_p, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `700` |
| line-height | `21.75px` |
| color | `rgb(19, 22, 28)` |
| transition | `all` |

### `.chiprow`

_div, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `400` |
| line-height | `21.75px` |
| color | `rgb(19, 22, 28)` |
| transition | `all` |

### `.eyebrow`

_p, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `11px` |
| font-weight | `600` |
| line-height | `15.95px` |
| color | `rgb(72, 78, 87)` |
| transition | `all` |

### `.field`

_input, sampled from `/squad/new`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `400` |
| color | `rgb(19, 22, 28)` |
| background | `rgb(235, 240, 250)` |
| border-radius | `6px` |
| border-width | `1px` |
| border-color | `rgba(16, 18, 23, 0.52)` |
| padding-top | `12px` |
| padding-right | `14px` |
| padding-bottom | `12px` |
| padding-left | `14px` |
| min-height | `44px` |
| transition | `border-color 0.15s` |

### `.hair`

_div, sampled from `/settings/users`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `400` |
| line-height | `21.75px` |
| color | `rgb(19, 22, 28)` |
| background | `rgba(16, 18, 23, 0.05)` |
| transition | `all` |

### `.import-sub`

_p, sampled from `/settings`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `400` |
| line-height | `18.85px` |
| color | `rgb(72, 78, 87)` |
| transition | `all` |

### `.nav-label`

_span, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `14px` |
| font-weight | `600` |
| line-height | `20.3px` |
| color | `rgb(72, 78, 87)` |
| min-height | `auto` |
| transition | `all` |

### `.nm`

_a, sampled from `/squad`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `700` |
| line-height | `18.85px` |
| color | `rgb(19, 22, 28)` |
| transition | `all` |

### `.num`

_span, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `400` |
| line-height | `18.85px` |
| color | `rgb(19, 22, 28)` |
| min-height | `auto` |
| transition | `all` |

### `.pill`

_span, sampled from `/settings`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `11px` |
| font-weight | `700` |
| line-height | `17.6px` |
| color | `rgb(107, 71, 8)` |
| background | `color(srgb 0.981647 0.902118 0.768784)` |
| border-radius | `6px` |
| padding-top | `4px` |
| padding-right | `10px` |
| padding-bottom | `4px` |
| padding-left | `8px` |
| min-height | `auto` |
| transition | `all` |

### `.rhead-actions`

_div, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `400` |
| line-height | `21.75px` |
| color | `rgb(19, 22, 28)` |
| min-height | `auto` |
| transition | `all` |

### `.set-row-btn`

_a, sampled from `/settings`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `700` |
| line-height | `18.85px` |
| color | `rgb(13, 95, 117)` |
| background | `rgba(79, 214, 255, 0.2)` |
| border-radius | `6px` |
| border-width | `1px` |
| padding-top | `10px` |
| padding-right | `16px` |
| padding-bottom | `10px` |
| padding-left | `16px` |
| min-height | `auto` |
| transition | `all` |

### `.sg-banner`

_div, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `400` |
| line-height | `21.75px` |
| color | `rgb(19, 22, 28)` |
| background | `rgb(252, 253, 254)` |
| border-radius | `18px` |
| border-width | `1px` |
| border-color | `rgb(212, 223, 245) rgb(212, 223, 245) rgb(212, 223, 245) rgb(79, 214, 255)` |
| padding-top | `16px` |
| padding-right | `16px` |
| padding-bottom | `16px` |
| padding-left | `16px` |
| box-shadow | `rgba(16, 18, 23, 0.08) 0px 1px 3px 0px` |
| transition | `all` |

### `.sg-banner-title`

_div, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `700` |
| line-height | `18.85px` |
| color | `rgb(19, 22, 28)` |
| transition | `all` |

### `.sg-block`

_button, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13.3333px` |
| font-weight | `400` |
| color | `rgb(19, 22, 28)` |
| background | `rgb(252, 253, 254)` |
| border-radius | `10px` |
| border-width | `1px` |
| border-color | `rgba(31, 111, 234, 0.22) rgba(31, 111, 234, 0.22) rgba(31, 111, 234, 0.22) rgb(31, 111, 234)` |
| padding-top | `8px` |
| padding-right | `10px` |
| padding-bottom | `8px` |
| padding-left | `10px` |
| transition | `border-color 0.15s, box-shadow 0.15s` |

### `.sg-segment`

_button, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `700` |
| color | `rgb(72, 78, 87)` |
| border-radius | `6px` |
| padding-top | `8px` |
| padding-right | `16px` |
| padding-bottom | `8px` |
| padding-left | `16px` |
| min-height | `auto` |
| transition | `background 0.15s, color 0.15s, box-shadow 0.15s` |

### `.sg-toolbar`

_div, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `15px` |
| font-weight | `400` |
| line-height | `21.75px` |
| color | `rgb(19, 22, 28)` |
| background | `rgb(252, 253, 254)` |
| border-radius | `18px` |
| border-width | `1px` |
| border-color | `rgb(212, 223, 245)` |
| padding-top | `14px` |
| padding-right | `18px` |
| padding-bottom | `14px` |
| padding-left | `18px` |
| box-shadow | `rgba(16, 18, 23, 0.08) 0px 1px 3px 0px` |
| transition | `all` |

### `.sg-viewtab`

_span, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `14px` |
| font-weight | `700` |
| line-height | `20.3px` |
| color | `rgb(31, 111, 234)` |
| background | `rgb(255, 255, 255)` |
| border-radius | `20px` |
| padding-top | `10px` |
| padding-right | `18px` |
| padding-bottom | `10px` |
| padding-left | `18px` |
| min-height | `auto` |
| transition | `all` |

### `.squad-chip`

_a, sampled from `/schedule`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `12px` |
| font-weight | `600` |
| line-height | `17.4px` |
| color | `rgb(0, 100, 220)` |
| border-radius | `6px` |
| border-width | `1px` |
| border-color | `rgb(60, 133, 247)` |
| padding-top | `8px` |
| padding-right | `14px` |
| padding-bottom | `8px` |
| padding-left | `14px` |
| min-height | `44px` |
| transition | `border-color 0.15s, color 0.15s, background 0.15s` |

### `.tiny`

_p, sampled from `/squad/new`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `400` |
| line-height | `18.85px` |
| color | `rgb(72, 78, 87)` |
| transition | `all` |

### `label.label`

_label, sampled from `/squad/new`_

| Property | Computed |
|---|---|
| font-family | `Roboto …` |
| font-size | `13px` |
| font-weight | `600` |
| line-height | `18.85px` |
| color | `rgb(72, 78, 87)` |
| transition | `all` |

---

## Components that could not be computed

These render only in a state the capture could not hold: a pending change, a
validation error, an active filter, or the athlete app. Their **authored** rules
are given instead, and are marked as authored rather than computed so the
difference is never mistaken.

### `.btn-ghost-pill` — authored

```css
.btn-ghost-pill { background: none; color: var(--muted); border: 1px solid var(--border); border-radius: var(--r-control); padding: var(--sp-8) var(--sp-16); font-size: var(--fs-13); font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: var(--sp-8); white-space: nowrap; transition: border-color var(--t-state), color var(--t-state), background var(--t-state); }
```

### `.md-seg` — authored

```css
.md-seg { flex: 1 1 0; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: var(--sp-10) var(--sp-14); border-radius: var(--r-full); font-size: var(--fs-14); font-weight: 600; color: var(--muted); text-decoration: none; white-space: nowrap; transition: background var(--t-state), color var(--t-state); }
```

### `.linklike` — authored

```css
.linklike { background: none; border: none; padding: 0; font-family: inherit; font-size: inherit; font-weight: 600; color: var(--accent-text); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
```

### `.form-error` — authored

```css
.form-error { border-radius: var(--r-field); background: rgb(var(--bad-rgb) / var(--pill-fill-alpha-bad)); color: var(--bad-pill-text); border-inline-start: 2px solid rgb(var(--bad-rgb)); padding: var(--sp-10) var(--sp-12); font-size: var(--fs-13); font-weight: 600; margin-bottom: var(--sp-14); }
```

### `.sg-btn-publish` — authored

```css
.sg-btn-publish { background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-control); padding: var(--sp-10) var(--sp-20); font-size: var(--fs-13); font-weight: 700; font-family: inherit; cursor: pointer; transition: background var(--t-press); }
```

### `.sg-btn-discard` — authored

```css
.sg-btn-discard { background: none; border: 1px solid var(--border); border-radius: var(--r-control); padding: var(--sp-10) var(--sp-16); font-size: var(--fs-13); font-weight: 600; font-family: inherit; color: var(--muted); cursor: pointer; transition: border-color var(--t-state), color var(--t-state); }
```

---

## How to regenerate

Token values come from `src/styles/tokens.css`. Computed values need the app
running and a signed-in staff session; the capture reads them over the DevTools
protocol from a real Chrome, the same mechanism `scripts/capture-walkthroughs.mjs`
uses. Nothing here is transcribed by hand.
