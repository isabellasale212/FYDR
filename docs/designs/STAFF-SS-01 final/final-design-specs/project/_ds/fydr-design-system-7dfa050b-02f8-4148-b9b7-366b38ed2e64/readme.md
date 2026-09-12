# Fydr Design System

Fydr is an athlete performance management platform sold to sports teams, aimed at small and
mid-tier semi-professional clubs. The worked example throughout is a rugby union club —
Ashfield RFC, 26 athletes.

The product exists because most clubs already collect this data and it sits in five places that
do not talk to each other: wellness in Google Forms, gym programmes in a shared spreadsheet, GPS
exports in the vendor's own folder, injury status in the physio's notebook, and nutrition tracked
nowhere. **The join across those domains is the product**, and that shapes the design system as
much as it shapes the roadmap: almost every screen is a table of numbers that came from somewhere
else, so this system is unusually strict about numerals, denominators and provenance.

## Surfaces

| Surface | Who uses it | Where it lives |
|---|---|---|
| **Staff web app** | Coaches, S&C, medical, admin | `ui_kits/staff_web/` |
| **Athlete mobile app** | Athletes | `ui_kits/athlete_app/` |
| Staff mobile | Staff on a phone — the web app's nine destinations collapsed into five tabs | Prototyped, not yet a kit |
| Marketing site | Prospective clubs | Prototyped, not yet a kit |

## Sources

This system was ported from the mounted codebase **`Fydr App Prototype Designs/`** (the working
prototype project), whose own material derives from the client's supplied files, not from
screenshots alone:

- **`source/design-system-tokens.css`** — the client's own `globals.css`, including base64
  webfonts. This is the ground truth for colour, type and the light/dark split. Every value in
  `tokens/` is transcribed from it; the fonts themselves load from the Google CDN, since Sora and
  DM Mono are both genuine Google families.
- **`source/design-screenshots-full.png`** (2854×1536) — a capture of the *real, built* staff
  training report. That screen is a recreation; everything else in the product was designed here.
- **`source/group-page.pdf`** — a capture of the client's built group page.
- **A specification repository** (`fydr-docs`) covering product overview, information
  architecture, the design system, and per-screen specs. Not included here; if you have it,
  `docs/02-information-architecture.md` and `docs/06-design-system.md` are the two to read.
- **`design_handoff_fydr/`** — eight deep-dive implementation specs written against the
  prototypes in this project: player profile, settings, gym programme, training report,
  dashboard, athlete app, leaderboard, schedule, nutrition.

The logo is a supplied lockup: the **Fydr** wordmark with a GPS trace running beneath it into a
ringed accent dot. Two files, both opaque — see Brand below.

---

## Content fundamentals

Fydr's copy has a distinct voice, and it is the least copyable part of the system, so it comes
first.

**It states what a number means, not what a screen contains.** The intro on the nutrition screen
is "A plan is a set of rules per kilogram of body mass" — that tells a coach how to read
everything below it. "This page shows nutrition plans" would tell them nothing. Every screen
intro works this way.

**It names the athlete and the reason together.** Never "3 flags raised". Always:

> Nash, Elliot — soreness 1 of 5, third consecutive morning below his baseline

**It shows its evidence.** Every flag carries the actual dates and values that triggered it:

> Soreness 2 or below for three consecutive days
> Mon 3, Tue 4, Wed 5 Aug · 2, 2, 1 · baseline 4

The rule is the headline; the evidence is what lets a coach act without opening another screen.
**Never shorten an evidence line.**

**It states its denominator, always.** `n = 412 records`. `23 of 26 submitted`. `2 athletes
excluded for fewer than 10 sessions`. `mean over 2 logged days`. A Fydr number never appears
without the sample behind it.

**It admits what it does not know.** "Association is not cause, and the window is always stated."
"Read it as a place to look, not a finding." "Body mass is self-reported at the morning weigh-in."
The product is careful not to overclaim, and the copy is where that care lives.

**It says when nothing is wrong.** "Nobody flagged and nothing outstanding for this one." "A
typical MD-1." "You're up to date." An empty card reads as a failed load; a confirmed all-clear
reads as information.

### Mechanics

- **Second person for athletes, third for staff.** The athlete app says "Your morning takes 45
  seconds"; the staff app says "Reid is the only selection question".
- **Sentence case everywhere** except the uppercase eyebrow and column headers. Never Title Case
  on a button or a card title.
- **Middot separators** in metadata: `Pitch 1 · 45 min · Tom Ellery`. Semicolons when the items
  themselves contain middots.
- **Real jargon, spelled out once.** MD-1, HSR, HIE, ACWR, CMJ, IMTP, RPE, p95 are all used
  unexpanded in labels, because the users know them — but a caption always says what the number
  is: "Acute to chronic ratio above 1.5", "High intensity efforts above squad p95".
- **En dashes for ranges** (`104–110 kg`), minus signs for negatives (`−2.4%`), and `▲ ▼` for
  direction.
- **No emoji. Anywhere.** Not in the product, not in the marketing site.
- **No exclamation marks**, no "Oops", no "Great job". The athlete app has no streaks, no praise
  and no score to game — deliberately, because gamifying a wellness form corrupts the data.
- **Buttons are verbs**: Publish to athletes, Acknowledge, Log weigh-in, Raise a flag, Assign.
  Never Submit, OK or Continue on its own.

### Tone

Matter-of-fact and slightly dry, like a good analyst talking to a coach they respect. It never
sells inside the product. The one place it is allowed a little rhetoric is the marketing site —
"The wellness form, the gym sheet and the GPS folder, joined up" — and even there the claim is
concrete.

---

## Visual foundations

### Colour

A cool blue page (`#e1e9f6`) with white cards, one blue accent, and three semantic colours.
That is the whole palette. It reads as an instrument panel rather than a consumer app, which is
correct for something a coach opens at 07:00 to find bad news.

**There is no neutral grey in the system.** Every surface, line and secondary text colour sits on
the same blue line as `--accent`: the page is `#e1e9f6`, wells `#e9effb`, fields `#e7eefb`, and
`--muted` / `--faint` are blue-greys (`#556074` / `#667287`) rather than true greys. Lines and
tints build from `23,40,80`, never `16,18,23`, and the shadow is blue-black to match. Five named
neutrals — `--line-strong`, `--line-dashed`, `--track-off`, `--tick`, `--scrim` — exist so no
component reaches for a raw `rgba()` again.

**Cards stay pure white.** They are the one true neutral in the palette, and the tinted page is
what makes them read as lifted. Do not tint a card to add emphasis — that is what the card states
are for.

Surfaces, text and borders are **theme-split**. Brand and semantic colours are **not** — an amber
"due" state means the same thing in either theme.

**The semantic hues are not reserved for flags.** Amber and red carry ordinary magnitude too: a
temperature-style reading on a dial, a band on a heat scale, a large-but-fine number. This is a
deliberate call rather than an oversight — the alternative was keeping those two hues exclusively
for "needs a coach", which would have meant every dial reading blue and the status living only in
the words beneath it. The cost is real and worth stating: a coach cannot infer urgency from colour
alone, so **the label under a value must always say what the colour means** ("Above normal", "Well
above", "In range"). Colour ranks the number; the words judge it.

**The accent is the deep blue `#17489b`.** It was previously the brighter `#1f6fea`; that value is
now off the ramp entirely, so anything still holding it is stale.

`--accent2` moved with it, from `#33b6ff` to **`#1793c9`**. It is the accent's cyan partner and only
ever appears as a stroke or a tone on white — sparklines, in-range dials, low-severity flags — where
the old value measured 2.2:1 and read as a different colour family beside the deep accent. It stays
obviously cyan so "below normal" still reads apart from "normal".

`--good` (`#4fd6ff`) deliberately stays bright: it is only ever a pill **fill** under dark
`--on-good` text, where brightness is correct. Do not align it to `--accent2`.

The warm three — `--warn`, `--bad`, `--highlight` — sit near-opposite the deep blue on the wheel and
needed no adjustment.

**The blue ramp.** Ten steps on one hue line, `--blue-50` through `--blue-900`, anchored on the two
blues already in the system: `--blue-500` *is* `--accent` (`#17489b`) and `--blue-900` *is*
`--brand-navy` (`#182241`). The whole line was re-derived downward when the accent deepened, so the
accent still sits at 500 with four lighter steps above and four darker below. The ramp exists so
that emphasis, primary buttons and hover fills come from one line instead of being invented per
component.

| | | | | |
|---|---|---|---|---|
| 50 `#eff3fb` | 100 `#d9e3f3` | 200 `#b3c6e6` | 300 `#7d9ed8` | 400 `#3465bd` |
| 500 `#17489b` | 600 `#16407f` | 700 `#153769` | 800 `#172e54` | 900 `#182241` |

Text on the ramp: `--text` on 50–300, **full-opacity white** on 400–900. From `--blue-400` down,
alpha-muted labels (`rgba(255,255,255,0.75)` and below) measure under 4.5:1 and fail at 11–12px;
`rgba(255,255,255,0.92)` is the floor for meta text on any dark step.

**The rule that catches people out:** a semantic colour is never used as text. `--warn` (`#f6ab2f`)
on white fails contrast at 11px, so every tone pairs a tinted fill with its own darkened
foreground — `--pill-warn` with `--on-warn`. For warn-coloured text on a white background, use
`--on-warn-strong` (`#b07d0a`).

Dials take their tone from the **status** of the value — `--warn` above normal, `--bad` well above,
`--accent2` in range — so a row of three reads at a glance. Pair every dial with a worded status
beneath it, per the note above.

The heat ramp is **five light tints carrying one dark ink** (`#0f3557`). It previously ran pale cyan
into brand navy with the ink flipping to white on the top two bands, and that dark end was the
hardest thing in the product to read: a value in white on navy, inside a table of dark-on-light
numbers, breaks the scan.

Holding every band light means lightness can no longer separate them, so **hue does that work** —
the ramp walks from cyan toward the deep accent while staying pale throughout. The percentage bands
(`--heat-pct-*`) follow the same principle in a narrower cyan range with their own ink.

Row washes sit at 0.12–0.16 alpha, strong enough to read as a state at a glance while `--text`
still clears 4.5:1 on top. All four semantic tones have one (`--wash-accent`, `--wash-bad`,
`--wash-warn`, `--wash-good`).

Heat shading appears in exactly one place, the training report, as a five-band ramp — and it is
**suppressed below five athletes with data**, because small samples make shading lie. When
suppressed, a banner says so *and* says the numbers themselves are unchanged.

### Type

Two families, and one rule that is the most load-bearing in the system:

- **Roboto** — 400/500/600/700/800, `--font-core`. Everything the product shows: names, labels,
  headings, prose, and **every number** — distances, ratios, percentages, dates, times, filenames,
  sample sizes, captions. Numerals sit at 500 for stats and dial centres, 400 for table cells.
- **Roboto Mono** — 400/500, `--font-mono`, reserved for code: token names, code samples, keys.
  Never a product value.

Roboto is requested as the **variable** face, because weight 800 is used throughout the display
scale and static Roboto jumps 700 → 900.

Because one proportional family sets both the names and the numbers, `font-variant-numeric:
tabular-nums` is doing all of the column alignment on its own — it is required on anything a coach
compares down a column, not a nicety. Use `--font-num` (aliased to `--font-core`) rather than
`--font-core` directly when the text is a value, so numerals stay findable if the numeral family
ever changes again.

**The one exception is the wordmark.** `--font-brand` is Sora 800 and exists solely for the
set-type `Fydr.` / `F.` marks — a brandmark, not UI type. Never use it for anything else. A
deprecated `--font-sora` alias still resolves, but it now points at Roboto; don't reach for it.

Headings are tight and heavy — 800 weight at negative tracking, from a 30px page title
(`-0.03em`) to a 58px marketing hero (`-0.035em`). Body text is small: 13–14px, with prose capped
at 68ch and `text-wrap: pretty`.

### Space and shape

A 4px grid with the half-steps the product actually uses. Gaps are named for their job —
`--gap-card: 14px`, `--gap-tile: 12px`, `--gap-chip: 6px` — because "the gap between cards" is a
decision, not a number.

**One radius: 8px.** `--r` cuts every element in the product — cards, buttons, badges, cells,
controls alike. Two exceptions, both deliberate: `--r-round` for anything that reads as circular
(8px on a 9px status dot renders a square), and `--r-sheet` for bottom sheets. The old twelve-step
names (`--r-card`, `--r-pill`, …) survive as aliases that all resolve to `--r`; prefer `--r` in new
work.

Accept the consequence: **shape no longer signals element type.** A pill and a card cut identically,
and a `5 high` badge is a rounded rectangle rather than a lozenge. Fill and border now carry that
distinction alone, which is why the card treatments below matter more than they used to.

**One shadow for the whole product**, now two-layer:
`0 1px 2px rgba(16,18,23,0.06), 0 6px 16px -6px rgba(16,18,23,0.12)` — a tight contact shadow plus
a wide, negative-spread ambient one. This is a replacement value, **not** a scale. There is still
no elevation scale: a card that needs to feel more urgent earns it with a tinted border, never a
heavier shadow. This is the second-most-common thing to get wrong.

### Card treatments

Three states, all sharing `--shadow`:

| State | Fill | Border | Use |
|---|---|---|---|
| Default | `--surf` | `--border` | everything |
| Emphasised | `--blue-100` | `--blue-200` | the card to reach first — **one per screen** |
| Selected | `--surf` | `--accent` + `--ring-select` | actively selected — **one at a time** |

Emphasised and Selected are not interchangeable and must never both land on the same card.

A card that reads as a **semantic state** takes its fill and border from the same tone family, with
that family's own foreground: `--pill-bad` / `--bad` / `--on-bad` for urgent, and the same shape for
warn and good. Never mix families — a blue fill with teal text is wrong — and never alpha-mute text
on a tint.

This tinted border **replaces the 3px left bar as the card-level urgency device.**
`--border-accent-w: 3px` is retained for **dense list rows**, where a full tinted fill is too heavy:
cards get the tinted fill, rows keep the bar.

Where a card carries both a ring and the shadow, **the ring is listed first** —
`box-shadow: var(--ring-select), var(--shadow)`. `box-shadow` paints in order, so reversed, the
ambient shadow renders over the ring and it reads muddy.

### Buttons

**Primary** is `--accent` solid — the deep blue — carrying a soft accent halo (`--ring-action`),
hovering to `--blue-600` with the halo widening to `--ring-action-hover`. The halo is what marks it as *the*
action on the page, so **exactly one per view** — using it twice defeats it. **Secondary** is the
accent outline beside it, hovering to a `--blue-50` fill. **Tertiary** is the same in ghost form.
Active darkens the fill and tightens the halo back to resting; nothing translates or scales.
Disabled is 45% opacity with the halo dropped.

Copy is always a **verb in sentence case**: Publish to athletes, Acknowledge, Log weigh-in. Never
Submit, OK or Continue alone.

### Backgrounds

No photography, no illustration, no pattern, no texture, **and no gradient**. The page is one flat
colour and cards are flat white; the tint in `--bg` is what lifts a card off the page, so nothing
else is needed. A gradient behind a screen of numbers is decoration the data has to compete with.

`--page-wash` still exists, set to `none`, so markup written as
`background: var(--page-wash), var(--bg)` keeps resolving. It should not be given a value again.

Chart areas that have no real render yet use an explicit hatch —
`repeating-linear-gradient(135deg, #f3f5f8 0 10px, #eaedf1 10px 20px)` — labelled as a
placeholder. That is a deliberate honesty device: it never pretends to be a chart.

### Motion

Almost nothing moves.

- **150ms** on `border-color, color, background` for hover and active states.
- **One keyframe**, `ring-in`, animating a dial's `stroke-dashoffset` from 251 over 900ms
  `cubic-bezier(0.22, 0.8, 0.36, 1)`, once on mount.
- **Nothing else.** No page transitions, no card entrances, no skeleton shimmer, no bounce.
- Everything sits under `@media (prefers-reduced-motion: reduce)` with `animation: none
  !important; transition: none !important`.

### States

- **Hover** — border to `rgba(var(--accent-rgb), 0.4)` and text to `--text`. Ghost controls
  brighten; they never darken or lift.
- **Active/selected** — a tinted background (`--wash-accent`), an accent border, and for a card or
  plotted element the `--ring-select` ring, listed before the ambient shadow. Nothing scales or
  translates on press.
- **Disabled** — 45% opacity, and for a genuinely unavailable option `cursor: not-allowed` plus a
  caption explaining why (the leaderboard's Habits family under the Improvement lens).
- **Gated** — 62% opacity plus a Premium badge. Never hidden: a club should be able to see what
  it is not buying.

### Transparency and blur

Used in exactly two places. Sticky bars take `rgba(234,237,241,0.85)` with `blur(14px)`; the
mobile tab bar takes `rgba(255,255,255,0.94)` with the same blur. Nowhere else — no frosted cards,
no glass panels.

### Layout

- Staff web: a 214px sticky sidebar, a sticky group-filter bar, content at `30px 40px 80px`.
- **The group filter is global.** It re-filters every athlete list, recomputes every stat,
  rewrites every caption's denominator, and can suppress heat shading. It is not a view filter.
- **Tables scroll, they never compress.** Every wide board is `overflow-x: auto` around a
  min-width inner grid, with the first column sticky and carrying a background that matches its
  row wash.
- Both columns of any two-column grid use `minmax(0, 1fr)`, never bare `1fr` — mono content sets
  a minimum width and overflows otherwise. This caused a real bug where buttons were pushed
  off-screen.
- Mobile: 44px minimum hit target, 36px bottom padding to clear the home indicator.

---

## Iconography

**Phosphor Icons, from CDN** — `tokens/icons.css` loads the regular and fill weights, so any file
linking `styles.css` has them. Usage is a glyph, never an inline SVG:

```html
<i class="ph-fill ph-users"></i>
<i class="ph ph-clock"></i>
```

Size with `font-size` and colour with `color`, like any text. Colour inherits, so an icon picks up
its nav item's active state for free.

**Two weights, and the split is meaningful.** `ph-fill` at 20px in the staff sidebar, where a
stroked glyph goes weedy beside a 15px semibold label in a dense list. `ph` (regular) at 24px in the
athlete tab bar and everywhere else.

The mapping the navigation uses: `layout` dashboard · `users` squad · `clock` schedule and Today ·
`briefcase` reports · `fork-knife` nutrition · `barbell` gym · `chart-bar` leaderboard and My data ·
`flag` flags · `export` GPS exports · `gear` settings · `sign-out` log out · `user` Me.

**One coloured icon**: the gym glyph takes `--highlight` gold, in both the sidebar and the tab bar,
because highlight means gym throughout the product. Everything else inherits.

Arrows and chevrons stay HTML entities rather than glyphs: `&rsaquo;` for a row chevron,
`&lsaquo; &rsaquo;` for pagination, `&#171;` for sidebar collapse, `▲ ▼` for direction, `✓` for a
tick, `×` for remove, `–` and `—` for absent values. No emoji, anywhere.

> **SUBSTITUTION — FLAGGED.** No icon files were supplied with this brand. The navigation
> screenshots show a set whose shapes match Phosphor almost exactly (the barbell, fork-and-knife,
> briefcase, two-person squad glyph and gear are all Phosphor forms), so Phosphor is used rather
> than hand-drawing approximations of someone else's set. Earlier versions of this system carried
> hand-authored 14×14 SVGs, which were placeholders and read as such. **If the real set exists,
> drop the files into `assets/` and repoint `tokens/icons.css`.**

### Assets

`assets/` holds the supplied logo lockup, and nothing else — the sources contain no illustration
and no imagery of any kind. **Do not draw or redraw either.**

| File | Use |
|---|---|
| `assets/logo.png` | Dark ink on white. The default: marketing, docs, light surfaces. |
| `assets/logo-on-dark.png` | Pale lockup on `--brand-navy` (`#182241`). |

Both are opaque PNGs, so each sits on its own ground — never over a photo, a tinted card or a
wash. The lockup is wide (roughly 2:1); where the space is narrower than about 120px, set the
wordmark in type instead — see `guidelines/brand-wordmark.card.html`. In-product headers and the
64px collapsed rail use the set-type `Fydr.` and `F.` marks, not the lockup. Those set-type marks
stay in **Sora 800** (`--font-brand`) even though the rest of the product is Roboto.

#### Logo construction

Every number below was measured off `assets/logo.png` (1118 × 574) by pixel scan, not estimated.
The lockup occupies **x 65–1065, y 75–511 — 1001 × 437**. To reproduce it at another size, scale
everything by one factor; the ratios in the last column are against the **cap height (282)**, which
is the most reliable anchor.

**Wordmark.** Sora 800, tracking `-0.035em`. Baseline sits at **y 357**.

| Measure | px | ÷ cap |
|---|---|---|
| Cap height (`F` top 76 → baseline 357) | 282 | 1.000 |
| x-height (`r` top 142 → baseline) | 215 | 0.762 |
| Descender depth (`y` tail to 442) | 85 | 0.301 |
| Stem width (`F`, `d`, `r` verticals) | 70 | 0.248 |
| `F` crossbar thickness | 58 | 0.206 |
| Wordmark extent | x 105–903 | — |

**Trace.** One stroke of constant width, three flat runs joined by two straight ramps. It is *not*
a curve or a sine — the flats are dead level and the ramps are constant-slope with small fillets at
the corners. Offsets are signed from the baseline, positive = downward.

| Measure | px | ÷ cap |
|---|---|---|
| Stroke width | 22 | 0.078 |
| Upper flat, centreline | +67.5 (y 424.5) | 0.239 |
| Trough flat, centreline | +143 (y 500) | 0.507 |
| Trough drop below upper flat | 75.5 | 0.268 |
| Left end (starts 40px left of the wordmark) | x 65 | — |
| Upper flat runs | x 65 → 248 | — |
| Descent ramp, slope **1 : 1.5** (≈56°) | x 248 → 303 | — |
| Trough flat runs | x 303 → 450 (147 long) | — |
| Ascent ramp, slope **1 : 1.5** | x 450 → 503 | — |
| Upper flat resumes | x 503 → 850 | — |
| Rise ramp, slope **1 : 2** (≈27°) | x 850 → ring | — |
| Meets the ring at | x ≈ 918, lower-left (≈8 o'clock) | — |

The trough exists for one reason: it clears the `y` descender. The descender bottoms out at y 442
and occupies x 310–420; the trough's top edge is y 490, so there is **48px of clearance** and the
trace never touches the letterform. If you reset the wordmark at a different weight or tracking,
re-derive the trough from the descender rather than copying x 303–450.

**Dot.** Concentric: a solid disc, a gap, then a hairline-proportioned ring. Centre is at
**(987, 362)** — i.e. 5px *below* the baseline, not on it.

| Measure | px | ÷ cap |
|---|---|---|
| Inner disc | ⌀ 59 (r 29.5) | 0.209 |
| Disc edge → ring inner edge | 35.5 | 0.126 |
| Ring stroke | 12.5 | 0.044 |
| Ring, inner / outer radius | 65 / 77.5 | 0.230 / 0.275 |
| Ring outer | ⌀ 155 | 0.550 |
| Centre, right of wordmark left edge | 882 | 3.128 |
| Wordmark right edge → ring outer edge | 7 | 0.025 |

The lockup artwork is unaffected by the move to Roboto — it is fixed artwork, not set type.

Colours: wordmark `#12161c`; disc `--accent` (`#1f6fea`, sampled `#1f70ea`); trace and ring in a
pale accent tint at roughly 25% over white.

See `guidelines/brand-logo-construction.card.html` and `guidelines/brand-logo-dot.card.html` for
the dimensioned diagrams.

---

## Data rules

These are product rules, not styling, and they are what makes a Fydr screen trustworthy. Breaking
one produces something that looks right and is wrong.

1. **A missing entry is never zero.** It renders as an em dash in `--faint`, leaves every mean,
   and reduces the stated denominator. Rendering 0% for an unsubmitted wellness entry reads as
   "felt terrible" rather than "did not answer".
2. **Every aggregate states its denominator.** No mean without its n.
3. **Readiness is computed on write** and never edited. It exists only where an entry was
   submitted, so it must agree with the compliance dot beside it.
4. **Shading is suppressed below five athletes with data**, and the notice says the numbers are
   unchanged.
5. **Submitted entries are immutable.** A correction creates a revision.
6. **Medical detail is gated.** Coaching staff see availability status and a restriction line
   only. Diagnosis and treatment notes are visible to medical staff and the athlete concerned,
   and to nobody else. Enforced server side; stated in the UI.
7. **Overrides never rewrite the parent.** A per-athlete gym or nutrition adjustment lives on the
   assignment, and carries a note explaining itself.
8. **Leaderboards are opt-in** on the athlete side. Staff see everything.
9. **A reference excludes the thing it scores.** A session is never compared against a mean it is
   part of.
10. **Generated prose must follow the numbers.** Only name a driver when one axis is genuinely
    outside its band *and* clear of the next by a real margin.
11. **Never render an unplayed session as measured data.** Same integrity rule as (1).

---

## Plan tiers

Two tiers, switched by a flip toggle in Settings.

**Basic** — gym programme, nutrition, schedule and fixtures, wellness, reports (gym, wellness,
testing, nutrition), analytics as bar charts, settings and exports.

**Premium** — everything in Basic, plus GPS exports, the training report, analytics heatmaps, and
the Apple Health connection.

Gated destinations stay in the sidebar at 62% opacity with a Premium badge, and selecting one
shows a gate screen naming what the feature needs. Nothing is hidden.

---

## Index

| Path | What it is |
|---|---|
| `styles.css` | The entry point. Nothing but `@import` lines. |
| `thumbnail.html` | The system's homepage tile — the logo lockup on brand navy, with the semantic swatch strip. |
| `assets/` | The supplied logo lockup, light and on-navy. |
| `templates/staff-web-app/` | Starting template: the staff web shell, wired to the four staff screens. |
| `templates/athlete-app/` | Starting template: the athlete app in the phone frame. |
| `tokens/fonts.css` | Sora and DM Mono, from the Google CDN. Both are the client's real families, not substitutes. |
| `tokens/colors.css` | Surfaces, text, semantic tones, pill pairings, heat ramps, washes. |
| `tokens/typography.css` | Both families, the weight set, and the full size scale. |
| `tokens/spacing.css` | The 4px grid, named gap and padding jobs, shell dimensions. |
| `tokens/shape.css` | The one radius, the one shadow, rings, blur values. |
| `tokens/motion.css` | Durations, the `ring-in` keyframe, the reduced-motion stop. |
| `tokens/base.css` | Body reset, selection colour, link colours, the `.num` helper. |
| `guidelines/*.card.html` | 29 foundation specimen cards — Colors, Type, Spacing, Brand. |
| `components/core/` | Button, Chip, Pill, Card, Avatar, Eyebrow |
| `components/data/` | StatBar, Dial, MeterBar, RangeBar, Sparkline, DomainDot, TableShell (+ TableGroup, TableRow) |
| `components/controls/` | SegmentedControl, Toggle, Stepper, ScaleSelector |
| `components/patterns/` | PageHeader, ReadCard, FlagCard, Banner, EmptyState |
| `components/navigation/` | SidebarNav, TabBar |
| `ui_kits/staff_web/` | Shell, Dashboard, Training report, Settings, the Premium gate |
| `ui_kits/athlete_app/` | Phone frame, Today, the wellness sheet, My data |
| `design_handoff_fydr/` | Nine deep-dive screen specs, for implementation in a real codebase |
| `source/` | The client's original tokens CSS and screen captures — `design-system-tokens.css`, `design-screenshots-full.png`, `training-report-screenshot.png`, `group-page.png`, `ds-half-1/2.png` |
| `SKILL.md` | Makes this folder usable as an Agent Skill in Claude Code |
| `brand-prompt.md` | Portable paste-in prompt — short and full versions, for a Claude window with no design system attached |

Every component has a sibling `.d.ts` (props contract) and `.prompt.md` (what and when, with a
usage example). Read the `.prompt.md` before using a component — several carry a rule that is not
obvious from the props, and those rules are where the system's character lives.

### Intentional additions

Everything in `components/` recurs across the built screens, so nothing here is invented. Two
entries are groupings rather than single primitives, and are called out for honesty:

- **`TableShell`** exports `TableShell`, `TableGroup` and `TableRow` together, because a Fydr
  board is the three of them sharing one `columns` string. Splitting them into three directories
  would hide that dependency.
- **`Eyebrow`** is a two-line component. It exists as a primitive because the uppercase scope line
  appears on every screen and in most card headers, and standardising its tracking matters more
  than its size suggests.
