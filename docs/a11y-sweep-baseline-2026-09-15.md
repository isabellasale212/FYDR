# Accessibility sweep — baseline record, 15 September 2026

**Stopped by Isabella on 15 September before it completed, and this is not the
sweep.** The order in `docs/queue-pending.md` is conformance first, the sweep
after: the conformance pass moves colour, spacing and radius values onto
tokens, so every contrast ratio and every hit box measured here is a
measurement of a product that is about to change, and would be stale by the
time anything was fixed. The sweep runs again from the top, against a settled
product, once conformance is committed. Nothing here was fixed; nothing in
`src/` changed. What this record is for:

- **Two parts survive conformance and are not to be re-derived.** The
  colour-as-the-only-carrier findings (Class 3 below) are about labels, shapes
  and positions, not values; and the answer to why `test:a11y-floor` and
  `test:nav-hit-floor` did not already catch what the sweep was finding
  (the section after the roles) is about what the guards read, which neither
  pass changes. Both are carried into `docs/design-decisions-outstanding.md`
  as rows.
- **The measurements are a baseline, kept rather than discarded.** Class 1 and
  Class 2 below are the render as it stood at commit `272d625` for the three
  roles that finished — coach, medic, S&C — at 1440 and 390, both themes.
  They are here so the post-conformance sweep can say what conformance moved
  and what it did not, and so the rulings that are visibly independent of any
  value change (the desktop floor, the fades, `--lb-row-selected`, the
  placeholder rule, `--warn-text`) can be read now. They are **not** the
  defect list the fix pass works from.
- **The tools are kept.** `scripts/a11y-sweep.mjs` (the measurement, CDP,
  scratch sign-in) and `scripts/a11y-sweep-report.mjs` (the folding into
  this shape). Neither is chained into `prebuild`. The re-run uses them
  unchanged, from the top, as every role.

**What did not run:** the nutritionist (killed mid-run), the Ashcombe sport
scientist, the Marlow Vale (Basic) sport scientist, the four athlete accounts
and the anonymous pages. Their surfaces — the nutrition workspace as its
owner, analytics, the plan page and the denied screen on Basic, the whole
athlete app, sign-in and the guardian page — have no measurements here.

## Method

**Measured from the rendered DOM, not the stylesheet.** Headless Chrome over
CDP, signed in through the app's own `/auth/confirm` route as one account at a
time, opened every route below at 1440 and at 390 (mobile emulation), and in
each page switched the theme the way `ThemeToggle` does — `data-theme` on
`<html>`, the choice in `localStorage['fydr-theme']` — so light and dark were
both read from the same render. In the page:

- **Contrast.** For every visible element with text of its own (and every
  placeholder, through `::placeholder`): the computed `color`, with the
  element's whole opacity chain multiplied in, composited src-over onto the
  background walked up the ancestor chain — every `background-color` with its
  alpha, so a 0.07 wash over `--bg` is measured as the colour it actually
  paints, not as the token's nominal value. WCAG 2.x relative luminance and
  the AA floor: 4.5:1, or 3:1 where the text is genuinely large (≥ 24px, or
  ≥ 18.66px at weight ≥ 700), with the size and weight recorded wherever 3:1
  is applied. A real gradient or image in the chain is flagged as
  "gradient in the chain" and the solid part measured; `.app`'s rail strip —
  `linear-gradient(--surf, --surf)`, one solid colour sized to the sidebar —
  is not treated as a gradient. Anything at opacity 0 is not rendered and is
  dropped. A natively `disabled` control is listed under its own heading and
  not counted (WCAG 1.4.3 exempts an inactive component); an `aria-disabled`
  one is counted, because `BlockedButton` is still interactive.
- **Tap targets.** Every `a[href]`, `button`, `input`, `select`, `textarea`,
  `summary`, every `role=button/tab/switch/checkbox/radio/link/menuitem/option`,
  every focusable `tabindex`, and every `[aria-disabled=true]`: the border box,
  widened by a wrapping `<label>` for a radio or checkbox and by an absolutely
  positioned `::before`/`::after` (the mechanism `test-nav-hit-floor` pins),
  which a bounding rect alone would miss. Under 44px on either side is a
  defect. A link inside running text is listed separately and not counted
  (WCAG 2.5.5 and 2.5.8 exempt it).
- **Colour-only meaning.** The page lists every small painted element with no
  text, label or title of its own (dots, swatches, bars); the review of those
  against the constitution's four meanings — rank tint, flag badges, deviation
  bars, neutral status text — and of the markup that drives them was done by
  hand and is written out in Class 3.

**Single-role accounts, every one of them holding exactly one role** (checked
in `user_roles` on scratch before signing in). The three that finished: Peter
Ackland (coach), Ruth Callaghan (medic), Owen Hartnell (S&C), all at
Ashcombe, which is on the Performance plan. Planned and not run: Sana Mirza
(nutritionist) and Jane Pemberton (sport scientist) at Ashcombe; Chidi
Nkemelu (sport scientist) at Marlow Vale, on Basic, for the plan-gated
surfaces and the denied screen; Dan Okonkwo (adult athlete), Kai Mercer and
Niall Rafferty (minors, 16), James Barnes (declined data consent); and no
account at all for the sign-in, reset and guardian pages. Which screens each
finished role reached is the first table below — a redirect is recorded as
what landed, and the landing page (the denied screen, the settings hub) was
measured as that role's surface.

**What a measurement is not.** An element positioned over something other
than its ancestors (a badge floated across a card edge) is measured against
its ancestors' composited background, which is the usual approximation and
is wrong only for overlaps. Text painted by `::before`/`::after` and SVG
`<text>` are not read. The colour-only class cannot be measured by a
machine; the list it produced is the starting point of a review, not the
review.

## Roles and the screens each reached

- **coach** — 76 routes requested; 57 rendered as asked; 19 redirected: `/squad/roster` → `/squad`, `/squad/new` → `/squad`, `/compliance` → `/reports/compliance`, `/nutrition/new` → `/nutrition`, `/programmes/new` → `/programmes`, `/programmes/proposals` → `/denied?r=D-26MB`, `/reports/training` → `/reports/gps`, `/analytics` → `/denied?r=D-26MV`, `/settings/audit` → `/settings`, `/settings/imports` → `/settings`, `/settings/plan` → `/denied?r=D-26MX`, `/settings/retention` → `/settings`, `/settings/setup` → `/settings`, `/settings/subject-access` → `/denied?r=D-26MZ`, `/settings/subject-access/[id]/review` → `/denied?r=D-26N1`, `/settings/users` → `/settings`, `/settings/users/bulk-invite` → `/settings`, `/settings/users/[id]` → `/settings`, `/platform/sign-in-probes` → `/denied?r=D-26N3`.
- **medic** — 76 routes requested; 52 rendered as asked; 24 redirected: `/squad/roster` → `/squad`, `/squad/new` → `/squad`, `/schedule/new` → `/schedule`, `/schedule/planner` → `/schedule`, `/schedule/planner/new` → `/schedule`, `/schedule/planner/apply` → `/schedule`, `/schedule/fixtures/new` → `/schedule`, `/schedule/fixtures/[id]/participation` → `/denied?r=D-26N6`, `/compliance` → `/reports/compliance`, `/leaderboards/new` → `/leaderboards/manage`, `/nutrition/new` → `/nutrition`, `/reports/training` → `/reports/gps`, `/analytics` → `/denied?r=D-26NS`, `/settings/audit` → `/settings`, `/settings/groups/new` → `/settings/groups`, `/settings/imports` → `/settings`, `/settings/plan` → `/denied?r=D-26NU`, `/settings/retention` → `/settings`, `/settings/setup` → `/settings`, `/settings/thresholds/new` → `/settings/thresholds`, `/settings/users` → `/settings`, `/settings/users/bulk-invite` → `/settings`, `/settings/users/[id]` → `/settings`, `/platform/sign-in-probes` → `/denied?r=D-26NW`.
- **sc** — 76 routes requested; 51 rendered as asked; 25 redirected: `/squad/roster` → `/squad`, `/squad/new` → `/squad`, `/schedule/new` → `/schedule`, `/schedule/planner` → `/schedule`, `/schedule/planner/new` → `/schedule`, `/schedule/planner/apply` → `/schedule`, `/schedule/fixtures/new` → `/schedule`, `/schedule/fixtures/[id]/participation` → `/denied?r=D-26NZ`, `/compliance` → `/reports/compliance`, `/nutrition/new` → `/nutrition`, `/reports/training` → `/reports/gps`, `/analytics` → `/denied?r=D-26OL`, `/settings/audit` → `/settings`, `/settings/groups/new` → `/settings/groups`, `/settings/imports` → `/settings`, `/settings/plan` → `/denied?r=D-26ON`, `/settings/retention` → `/settings`, `/settings/setup` → `/settings`, `/settings/subject-access` → `/denied?r=D-26OP`, `/settings/subject-access/[id]/review` → `/denied?r=D-26OR`, `/settings/thresholds/new` → `/settings/thresholds`, `/settings/users` → `/settings`, `/settings/users/bulk-invite` → `/settings`, `/settings/users/[id]` → `/settings`, `/platform/sign-in-probes` → `/denied?r=D-26OT`.

## Why the existing guards did not catch this

Four guards in `prebuild` touch this ground. Each is a **source-level** check
— it reads `base.css`, `tokens.css` or a `.tsx` file and asserts that a rule
or an attribute is present — and none of them renders a page. That is the
whole gap in one sentence; the four below are where it lands.

**`test:a11y-floor` (`scripts/test-a11y-floor.ts`) measures neither contrast
nor size.** Its own header names what it pins: "Two floors a screen reader
depends on, checked at the source" — a rendered error is announced
(`role="alert"` / `aria-live`), and every screen has a heading. Both are
markup facts a grep can answer. Nothing in it reads a colour or a box, so it
could not have caught any defect in this report, and it was never claimed
to. Its name promises more than its scope, which is why the prompt names it.

**`test:nav-hit-floor` (`scripts/test-nav-hit-floor.ts`) pins two controls in
one shell.** It asserts that `.phone-body .back-btn::after` extends the
athlete Back button to 44px and that `.tap-floor` pads the hidden-leaderboards
gate link — the two controls three reviews had measured short — and states
its own limit: "Scoped to the athlete shell. The staff app's `.back-btn` is
the same class and still renders 29px … Widening it is a separate decision."
It reads the stylesheet for those two selectors and nothing else, so every
other control on every other surface — the 44 signatures in Class 2, from
three roles — is outside it by construction, and a `.back-btn` at 29px on 74 staff
pages is the decision it deferred rather than a regression it missed.

**`check:contrast` (`scripts/check-contrast.ts`) measures the stylesheet, on
two flat grounds, with an exemption list.** It derives the set of tokens
`base.css` paints text with and checks each hex against `--bg` and `--surf`,
and says so: a token "whose surface is a computed tint is reported as
unresolved rather than failed". Three consequences, each visible in Class 1:

1. *Composited grounds are never measured.* `--faint` clears 4.5 on both
   flat grounds in both themes (4.57 on light `--bg`, the narrowest), so it
   passes — and fails on the dashboard's washed week columns
   (`--wash-accent-soft` and `-strong` over `--bg`: 4.10 and 3.53 light,
   4.09 and 3.73 dark), on the player profile's hero wash (`--wash-accent`
   over `--bg`, 3.79 light / 3.85 dark), on the flag card's `--wash-warn`
   (4.20 light), on every `--surf2` panel in dark (3.89), on the report
   cards' domain washes (3.59–4.39). The prompt's sentence — "a tint over a
   surface is not the token's nominal value" — is exactly the case the guard
   declares out of scope.
2. *`--surf2` is not a ground it knows.* `GROUNDS = ['bg', 'surf']`. Dark
   `--surf2` (`#2b3559`) is the fill of every closed settings row, every
   KPI tile, every leaderboard chip, and `--faint` on it is 3.89:1 — the most
   repeated single failure in the product (C33, 100+ measurements
   across 8 pages as one role).
3. *`KNOWN_BELOW_AA` exempts the two tokens that fail most.* `warn-text`
   (light, 3.57 on `--surf`) is exempt with the note that it "clears the 3:1
   large-text floor and is used at heading sizes on flag callouts, but not at
   11px" — it is used at 12–13px on the nutrition workspace's column figures,
   totals delta and percentile band, the rehab-group phase line and the MFA
   banner, none of them large. `accent` (dark, 2.87 on `--bg`) is exempt with
   the note that "the 5 text uses want `--accent-text`. Fixing the call sites
   is the right change" — the call sites were never fixed: the staff phone
   tab bar's active tab (`.ph-tab[data-active] { color: var(--accent) }`) is
   the same 2.87:1 on every staff page at 390 in dark, and the flag card's
   value (`.pp-flag-value`) is 2.49 on its wash. An exemption list is a
   promise to fix later with no date on it; both entries have been "known"
   since the 9 September audit with the defect still shipping, and the
   accent entry's own text names the fix that was not made.

It also cannot see a colour that is not a token: the placeholder text on
every `.field` is the browser's own `#757575` — no `::placeholder` rule
exists except on the exercise library's search — at 4.03 light / 3.36 dark,
and no stylesheet reader can find a colour the stylesheet never states.

**`test:staff-phone-shell` §5 pins the phone floor as a class list.** The 44px
floor for staff controls below 768px (`base.css` "THE 44px FLOOR") is a
list of selectors, and the guard asserts each listed selector has
`min-height: 44px`. Anything not on the list is not floored and not tested:
`.attn-name`, `.flag-who a`, `.week-nav a`, `.tr-heat-toggle`,
`.nutr-profile-link`, `.lbw-profile-link`, `.tst-manage`, `.tr-mode-switch a`,
`.chip-static`, `.tr-scope-chip`, the checkbox in `label.tiny` — every one of
the Class 2 entries that fails **at 390**. And one listed selector pads the
wrong box: `.main table.tbl .nm` pads the cell, but on the match, testing and
training-load reports the target is the `<a>` inside `td.nm`, which stays
15px tall. The same shape again on `.btn-ghost`: `base.css:789` gives it
`min-height: 44px` and the guard sees it, but an `<a class="btn-ghost">` is
`display: inline`, where `min-height` does nothing, so "Open team allocation
→" and "Review clinical notes →" measure 37px at every width. A guard that
checks "the rule is there" cannot check "the rule reaches the element", which
is the difference between the stylesheet and the render.

**What would close the gap.** Not a longer class list or a longer exemption
list — both are the shape that failed. The measuring tool in
`scripts/a11y-sweep.mjs` reads the render; the missing piece is a fixture
run of it in `prebuild` (or a nightly) against a seeded page set as each
role, asserting zero rows in Class 1 and Class 2 above an agreed floor,
with `KNOWN_BELOW_AA` retired once its two entries are fixed. That is a
proposal for a ruling, not something this pass builds.

## Class 3 — colour as the only carrier of meaning (hand review)

The machine list at the end of this section is every small painted element
without text of its own, across the three roles that ran; the athlete app's
list is still to come. Each was read in its markup and its stylesheet rule
and judged against one question: if the hue were removed, would the meaning
survive through a word, a shape, a fill-versus-outline, a position or a
number? The constitution's four meanings — rank tint, flag badges, deviation
bars, neutral status text — stay as they are in every proposal below: the fix
for this class is always to **add** a label, a shape or a position, never to
change the colour.

### Defects

**3.1 Session type on the dashboard week strip — colour only.**
`src/app/(staff)/dashboard/page.tsx:409` renders each activity as
`<span className="dash-week-act-dot" style={{ background: PIP_COLOR[a.type] }} aria-hidden="true" />`
followed by the session's **title**, not its type. The type (training,
gym, rehab, testing, match, recovery, meeting — seven hues, `PIP_COLOR` at
line 40) is carried by the dot alone; the legend at line 361 names the hues
but the row itself has no word. A title like "Lower A" or "Speed and power"
does not say gym or testing. Surfaces: `/dashboard`, every staff role, both
widths. Proposed fix: the type word after the title in the row
(`enumLabel(a.type)` as a `.dash-week-act-type` caption, existing tokens),
or the pip replaced by the same word — the legend then becomes redundant
and can stay.

**3.2 Session type on the schedule grid blocks — colour only for sighted
readers.** `src/components/ScheduleGrid/TimeGrid.tsx:323–370`: a block's
`--tone`/`--bc` come from `TYPE_STYLE[b.type]` (`src/lib/scheduleGeometry.ts:101`)
and the block prints time, title and groups. The type is in the `aria-label`
(`${b.title}, ${enumLabel(b.type)}, …`), so a screen reader has it and a
sighted reader without hue discrimination does not. The legend row
(`TimeGrid.tsx:386`) names the hues. Same on the phone day list:
`src/components/ScheduleGrid/SchedulePhoneDay.tsx:109`
`<span className="sg-phone-row-dot" style={{ background: TYPE_STYLE[s.type].tone }} aria-hidden="true" />`
before `{s.title || enumLabel(s.type)}` — the type word appears only when
the session has no title. Surfaces: `/schedule` (the timetable's cards print the type word,
`TimetableSessionCard.tsx:163`, and are fine), every staff role, both
widths. Proposed fix: the type word in the block's row line where
`b.height >= 63` (the same threshold that admits the group line) and always
on the phone row's meta line; no colour change.

**3.3 "Not fully available" on the dashboard — modified versus out by dot
colour.** `src/components/DashboardHeadlineStats/DashboardHeadlineStats.tsx:370–381`:
the expanded Available tile lists names, each with
`<span className="dash-squad-dot" style={{ background: 'var(--warn)' }} />` for
modified and `var(--bad)` for unavailable, and nothing else on the row. The
head line gives the two counts ("2 modified, 1 out"), so the reader knows
how many of each, not which. Surfaces: `/dashboard`, every staff role.
Proposed fix: the status word as neutral status text on each row
("Modified" / "Out"), the dot kept.

**3.4 Flag severity on the dashboard attention rows — the row's left edge.**
`src/components/DashboardFlagsPanel/DashboardFlagsPanel.tsx:156–159` moves
severity "from an 8px dot to the row's own left edge" (`base.css:6405–6407`,
`border-left-color` by `data-severity`). Collapsed, the row shows name,
position, the measurement and how long unreviewed; the severity word appears
only inside the expanded detail as a pill. Surfaces: `/dashboard`, every
staff role that sees flags. Proposed fix: the severity pill (`Pill`, glyph
and word, the existing component) in `.dash-flags-meta` on the collapsed
row; the edge colour stays.

**3.5 GPS scatter bands — dot colour alone.**
`src/components/TrainingScatter/TrainingScatter.tsx:112–124`: each athlete's
dot takes `BAND_STYLE[p.band]` fill and stroke for far/near/mid/low, the
legend (line 152) names the four hues, and the dot's `aria-label` carries
name, unit and the two distances but **not the band**. Surfaces:
`/reports/gps` (Premium, sport scientist only). Proposed fix: the band word in
the `aria-label`, and one shape per band (circle, square, diamond, ring —
`border-radius`/`border-style` on the existing box, no new token); the label
beside the dot already prints the surname for the labelled set.

### Reviewed and passing, with the cue that carries the meaning

- **Leaderboard wall tints** (`LeaderboardWall.tsx`, `lib/leaderboardWallMath.ts`):
  rank tint carries `#n`; improvement carries `▲`/`▼` and the value; standard
  carries `✓` or the shortfall figure. The four meanings hold.
- **Athlete week strip** (`src/app/(athlete)/today/page.tsx:289–310`,
  `base.css:2319–2333`): training is a fill, match a border, recovery a
  half-weight fill, rest nothing; the kind is a visually-hidden word and the
  third line prints the kind where there is no MD label. Fill / border /
  nothing survive without hue.
- **Nutrition check-in strip** (`SelectedAthleteCard.tsx:310`): Y / R / N
  letters in the cells.
- **Nutrition logging strip** (`SelectedAthleteCard.tsx:184`, `base.css:8014–8024`):
  logged is a filled square, not-logged a hollow one — fill versus outline is
  a second channel; the caption under it gives the count.
- **Nutrition figures outside ±5 %** (`.nutr-col-num` in `--warn-text`): the
  totals warning sentence names the deviation and the range marker's position
  on its track carries it; the colour is the third channel (and fails
  contrast — Class 1).
- **GPS heat cells** (`reports/gps/page.tsx:860–869`): the number is printed
  in every cell; the heat is a toggleable overlay.
- **CR10 / Today RPE selection** (`base.css:3499–3508`): the selected cell
  inverts to a solid accent block with white figures — a luminance change,
  not a hue.
- **Pills** (`components/Pill`): glyph and word are required, not optional.
- **Injury stage ladder** (`StageLadder.tsx`): state words Done / Now / Next /
  Later.
- **Group swatches** (`GroupSwatch.tsx`): always beside the group's name, by
  the component's own contract.
- **Availability legend on the athlete-report picker**
  (`reports/athlete/page.tsx:137`): counts with words; the rows carry a pill.
- **Bars and markers** (`.lb-fill`, `.pick-wellness-fill`, `.pp-bench-fill`,
  `.pc-marker`, `.nutr-range-marker`, `.sg-cmp-bar`, `.sg-now-dot`, the
  sparkline and trend-chart points): length or position is the meaning.

### The machine list the review started from (coach, medic, S&C)

- `span.nutr-col-num > div > div.nutr-range-track > div.nutr-range-marker` × 384 — /nutrition; roles coach, medic, sc; beside "".
- `div.sg-grid-inner > div.sg-legend-row > span.sg-legend-item > span.sg-legend-swatch` × 182 — /schedule; roles coach, medic, sc; beside "Meeting".
- `div.card > div.sg-cmp-row > span.sg-cmp-type > span.sg-cmp-bar` × 182 — /schedule; roles coach, medic, sc; beside "Recovery".
- `div > div.nutr-logging-strip > div.nutr-logging-cell > div.nutr-logging-swatch` × 168 — /nutrition; roles coach, medic, sc; beside "S".
- `div.card.cmpl-table > div.lb-row > span.lb-track > span.lb-fill` × 150 — /leaderboards/[id]; roles coach, medic, sc; beside "".
- `a.pick-row > span.pick-wellness > span.pick-wellness-track > span.pick-wellness-fill` × 60 — /reports/athlete; roles coach, medic, sc; beside "".
- `div.lbw-controls-row > div.lbw-legend > span.lbw-legend-item > span.lbw-swatch` × 48 — /leaderboards; roles coach, medic, sc; beside "Bottom of the group".
- `div.card > svg[role=img] > g > circle` × 48 — /testing/[id]/[id]; roles coach, medic, sc; beside "".
- `div > span.pick-legend > span > i` × 36 — /reports/athlete; roles coach, medic, sc; beside "3 unavailable".
- `div.sg-grid-inner > div.sg-grid-body > div.sg-day-col > div.sg-now-dot` × 26 — /schedule; roles coach, medic, sc; beside "".
- `div > div > svg.nutr-sparkline > circle` × 24 — /nutrition; roles coach, medic, sc; beside "".
- `section.card.pp-card > div.pc-row > div.pc-track > div.pc-marker` × 20 — /squad/[id]/nutrition; roles coach, medic, sc; beside "".
- `section.card.pp-card > div.pp-bench-row > div.pp-bench-bar > div.pp-bench-fill` × 12 — /squad/[id]; roles coach, medic, sc; beside "".

## Baseline measurements — coach, medic, S&C at commit `272d625`

**Stale by design.** These are the render before conformance. Every ratio and
every box will be re-measured after it; they are kept so the re-run can say
what moved. Grouped by the element that fails — one rule, every page under it.

## Class 1 — contrast (baseline)

### C1. `span.lbw-name`

- dark: **1.09:1** (floor 4.5) — text --text on --lb-row-selected (1.09:1). Size 13px, weight 700. Sample: "Okonkwo, Dan".
- surfaces: /leaderboards (6); roles: coach, medic, sc; widths: 1440/390.
- where: src/components/LeaderboardWall/LeaderboardWall.tsx:358 (class `lbw-name`; no base.css rule sets color on it); the measured token is set inline — see src/components/LeaderboardWall/LeaderboardWall.tsx
- proposed fix: swap to `--highlight-text` (light 12.44, dark 12.44) or `--lb-standard-met` (light 6.71, dark 6.71) (currently `--text`).

### C2. `span.btn-ghost[aria-disabled]` — aria-disabled, in scope

- light: **1.9:1** (floor 4.5) — text --muted at opacity 0.4 on --bg (1.9:1). Size 13px, weight 600. Sample: "Next week ›".
- dark: **2.27:1** (floor 4.5) — text --muted at opacity 0.4 on --bg (2.27:1). Size 13px, weight 600. Sample: "Next week ›".
- surfaces: /nutrition (24); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:785 `.btn-ghost { color: var(--muted) }`; src/styles/base.css:799 `.btn-ghost:hover { color: var(--text) }`; src/styles/base.css:3433 `.subm .btn-ghost[aria-disabled='true']:hover { color: var(--muted) }`; the opacity: src/components/AddAthleteForm/AddAthleteForm.tsx:264 (class `btn-ghost`; no base.css rule sets opacity on it)
- proposed fix: the text token is not the failing factor — the element is faded to 0.4 by an opacity rule, and no text token clears the floor through it (best: --text at light 2.49, dark 3.18); report and stop — a ruling on the fade is needed (currently `--muted`).

### C3. `button.btn-ghost-pill[aria-disabled]` — aria-disabled, in scope

- light: **1.97:1** (floor 4.5) — text --muted at opacity 0.45 on --wash-accent over --bg (1.97:1). Size 13px, weight 600. Sample: "Edit".
- dark: **2.33:1** (floor 4.5) — text --muted at opacity 0.45 on --wash-accent over --bg (2.33:1). Size 13px, weight 600. Sample: "Edit".
- surfaces: /squad/[id] (4); roles: sc; widths: 1440/390.
- where: src/styles/base.css:4404 `.btn-ghost-pill { color: var(--muted) }`; src/styles/base.css:4420 `.btn-ghost-pill:hover { color: var(--text) }`; src/styles/base.css:4424 `.btn-ghost-pill.accent { color: var(--accent-text) }`; the opacity: src/styles/base.css:4429 `.btn-ghost-pill:disabled, .btn-ghost-pill[aria-disabled='true'] { opacity: var(--o-disabled) }`
- proposed fix: the text token is not the failing factor — the element is faded to 0.45 by an opacity rule, and no text token clears the floor through it (best: --text at light 2.74, dark 3.34); report and stop — a ruling on the fade is needed (currently `--muted`).

### C4. `span.week-nav > span[aria-disabled]` — aria-disabled, in scope

- light: **1.99:1** (floor 4.5) — text --faint at opacity 0.5 on --surf2 = --pending-fill (1.99:1). Size 13px, weight 400. Sample: "›".
- dark: **2.04:1** (floor 4.5) — text --faint at opacity 0.5 on --surf2 = --border = --pending-fill (2.04:1). Size 13px, weight 400. Sample: "›".
- surfaces: /reports/squad (12); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:12333 `.week-nav a, .week-nav span { color: var(--muted) }`; src/styles/base.css:12337 `.week-nav a:hover { color: var(--text) }`; src/styles/base.css:12350 `.week-nav span[data-disabled='true'] { color: var(--faint) }`; the opacity: src/styles/base.css:12351 `.week-nav span[data-disabled='true'] { opacity: 0.5 }`
- proposed fix: the text token is not the failing factor — the element is faded to 0.5 by an opacity rule, and no text token clears the floor through it (best: --text at light 3.35, dark 3.82); report and stop — a ruling on the fade is needed (currently `--faint`).

### C5. `button.squad-chip[aria-disabled]` — aria-disabled, in scope

- light: **2.18:1** (floor 4.5) — text --muted at opacity 0.45 on --surf = --elev (2.18:1). Size 12px, weight 600. Sample: "Body mass", "Readiness score".
- dark: **2.59:1** (floor 4.5) — text --muted at opacity 0.45 on --surf = --elev (2.59:1). Size 12px, weight 600. Sample: "Body mass", "Readiness score".
- surfaces: /leaderboards/new (32); roles: coach, sc; widths: 1440/390.
- where: src/styles/base.css:841 `.squad-chip { color: var(--muted) }`; src/styles/base.css:852 `.squad-chip:hover { color: var(--text) }`; src/styles/base.css:858 `.squad-chip[aria-pressed='true'], .squad-chip[aria-selected='true'], .squad-chip[aria-current='page'] { color: var(--on-accent) }`; the opacity: src/styles/base.css:872 `.squad-chip:disabled, .squad-chip[aria-disabled='true'] { opacity: var(--o-disabled) }`
- proposed fix: the text token is not the failing factor — the element is faded to 0.45 by an opacity rule, and no text token clears the floor through it (best: --text at light 2.95, dark 3.76); report and stop — a ruling on the fade is needed (currently `--muted`).

### C6. `div.tiny`

- light: **2.22:1** (floor 4.5) — text --accent2 = --domain-pitch on --surf = --elev (2.22:1). Size 13px, weight 700. Sample: "Much lighter than usual".
- surfaces: /reports/gps (24); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:736 `.tiny { color: var(--muted) }`; src/styles/base.css:10253 `.flag-notice .tiny, .flag-notice-attribution { color: var(--muted) }`; src/styles/base.css:11974 `.prog-item .tiny { color: var(--muted) }`; the measured token is set inline — see src/app/(staff)/dashboard/page.tsx, src/app/(staff)/reports/gps/page.tsx, src/app/(staff)/squad/[athleteId]/page.tsx
- proposed fix: swap to `--accent2-pill-text` (light 6.2, dark 6.58) or `--accent2-text` (light 5.35, dark 6.58) or `--text` (light 17.79, dark 12.73) or `--muted` (light 8.24, dark 7.09) (currently `--accent2`).

### C7. `span.pp-flag-value`

- dark: **2.49:1** (floor 4.5) — text --accent on --wash-warn over --bg (2.49:1). Size 14px, weight 500. Sample: "0 of 7 days".
- surfaces: /squad/[id] (18); roles: coach, medic, sc; widths: 1440/390.
- where: src/components/PlayerProfileFlags/PlayerProfileFlags.tsx:194 (class `pp-flag-value`; no base.css rule sets color on it); the measured token is set inline — see src/components/PlayerProfileFlags/PlayerProfileFlags.tsx
- proposed fix: swap to `--accent-on-wash` (light 6.62, dark 6.35) or `--accent-text` (light 6.62, dark 5.81) or `--accent-on-tint` (light 6.62, dark 5.81) or `--accent-pill-text` (light 6.62, dark 5.81) (currently `--accent`).

### C8. `span.lbw-age`

- dark: **2.86:1** (floor 4.5) — text --faint on --lb-row-selected (2.86:1). Size 11px, weight 400. Sample: "29".
- surfaces: /leaderboards (6); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:8495 `.lbw-age { color: var(--faint) }`
- proposed fix: swap to `--highlight-text` (light 12.44, dark 12.44) or `--lb-standard-met` (light 6.71, dark 6.71) (currently `--faint`).

### C9. `a.ph-tab`

- dark: **2.87:1** (floor 4.5) — text --accent on --bg (2.87:1). Size 12px, weight 700. Sample: "Dashboard", "Squad".
- surfaces: /schedule (13), /squad (9), /schedule/[id] (6), /dashboard (3), /squad/[id] (3), /squad/[id]/availability (3), /squad/[id]/gym (3), /squad/[id]/nutrition (3), /squad/[id]/wellness (3), /schedule/planner/[id] (3), /schedule/fixtures/[id] (3), /flags (2), /schedule/new (1), /schedule/planner (1), /schedule/planner/new (1), /schedule/planner/apply (1), /schedule/fixtures/new (1), /schedule/fixtures/[id]/participation (1), /programmes (1), /programmes/new (1), /programmes/exercises (1), /programmes/proposals (1), /programmes/[id] (1), /programmes/[id]/athlete/[id] (1); roles: coach, medic, sc; widths: 390.
- where: src/styles/base.css:14406 `.ph-tab { color: var(--muted) }`; src/styles/base.css:14414 `.ph-tab[data-active] { color: var(--accent) }`
- proposed fix: swap to `--accent-on-wash` (light 7.2, dark 7.3) or `--accent-text` (light 7.2, dark 6.68) or `--accent-on-tint` (light 7.2, dark 6.68) or `--accent-pill-text` (light 7.2, dark 6.68) (currently `--accent`).

### C10. `button.ph-tab.ph-more`

- dark: **2.87:1** (floor 4.5) — text --accent on --bg (2.87:1). Size 12px, weight 700. Sample: "More".
- surfaces: /settings (24), /reports/compliance (6), /nutrition (6), /reports/gps (6), /settings/groups (5), /settings/thresholds (5), /leaderboards/manage (4), /leaderboards (3), /leaderboards/[id] (3), /programmes (3), /reports (3), /reports/athlete (3), /reports/athlete/[id] (3), /reports/injuries (3), /reports/match (3), /reports/squad (3), /reports/testing (3), /reports/training-load (3), /settings/club (3), /settings/exports (3), /settings/groups/[id] (3), /settings/notifications (3), /settings/profile (3), /leaderboards/new (2), /programmes/exercises (2), /programmes/[id] (2), /programmes/[id]/athlete/[id] (2), /settings/groups/new (1), /settings/thresholds/new (1), /programmes/new (1), /programmes/proposals (1), /settings/subject-access (1), /settings/subject-access/[id]/review (1), /flags (1); roles: coach, medic, sc; widths: 390.
- where: src/styles/base.css:14406 `.ph-tab { color: var(--muted) }`; src/styles/base.css:14414 `.ph-tab[data-active] { color: var(--accent) }`
- proposed fix: swap to `--accent-on-wash` (light 7.2, dark 7.3) or `--accent-text` (light 7.2, dark 6.68) or `--accent-on-tint` (light 7.2, dark 6.68) or `--accent-pill-text` (light 7.2, dark 6.68) (currently `--accent`).

### C11. `span.lbw-chip-count`

- light: **3.11:1** (floor 4.5) — text --muted at opacity 0.65 on --bg (3.11:1). Size 11px, weight 600. Sample: "2", "1".
- dark: **3.68:1** (floor 4.5) — text --muted at opacity 0.65 on --bg (3.68:1). Size 11px, weight 600. Sample: "2", "1".
- surfaces: /leaderboards (48); roles: coach, medic, sc; widths: 1440/390.
- where: src/components/LeaderboardWall/LeaderboardWall.tsx:303 (class `lbw-chip-count`; no base.css rule sets color on it); the opacity: src/styles/base.css:8364 `.lbw-chip-count { opacity: 0.65 }`
- proposed fix: swap to `--text` (light 5.23, dark 5.92) — measured through the 0.65 fade the element carries (currently `--muted`).

### C12. `span.nutr-col-num`

- light: **3.18:1** (floor 4.5) — text --warn-text on --wash-accent-soft over --surf (3.18:1); --surf = --elev (3.57:1). Size 13.3px, weight 400. Sample: "118.4", "105.0".
- surfaces: /nutrition (96); roles: coach, medic, sc; widths: 1440/390.
- where: src/components/NutritionWorkspace/TargetsTable.tsx:69 (class `nutr-col-num`; no base.css rule sets color on it); the measured token is set inline — see src/components/NutritionWorkspace/TargetsTable.tsx
- proposed fix: swap to `--warn-pill-text` (light 7.26, dark 6.93) or `--text` (light 15.85, dark 11.54) or `--muted` (light 7.34, dark 6.42) (currently `--warn-text`).

### C13. `p.nutr-totals-warning`

- light: **3.26:1** (floor 4.5) — text --warn-text on rgb(251,242,225) (composited; no single wash over a surface reproduces it) (3.26:1). Size 12px, weight 400. Sample: "Outside ± 5 %: Energy -8%, Protein +20%, Carbs -".
- surfaces: /nutrition (12); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:10158 `.nutr-totals-warning { color: var(--warn-text) }`
- proposed fix: swap to `--warn-pill-text` (light 7.47, dark —) or `--text` (light 16.3, dark —) or `--muted` (light 7.55, dark —) or `--faint` (light 4.92, dark —) (currently `--warn-text`).

### C14. `span.pp-bench-band`

- light: **3.32:1** (floor 4.5) — text --warn-text on --band-3-wash over --surf (3.32:1). Size 12px, weight 700. Sample: "59th percentile", "40th percentile".
- surfaces: /squad/[id] (12); roles: coach, medic, sc; widths: 1440/390.
- where: src/app/(staff)/squad/[athleteId]/page.tsx:733 (class `pp-bench-band`; no base.css rule sets color on it); the measured token is set inline — see src/app/(staff)/squad/[athleteId]/page.tsx
- proposed fix: swap to `--warn-pill-text` (light 7.59, dark 6.62) or `--text` (light 16.56, dark 11.03) or `--muted` (light 7.67, dark 6.14) (currently `--warn-text`).

### C15. `p.banner > span`

- light: **3.34:1** (floor 4.5) — text --warn-text on --band-3-wash over --surf (3.34:1). Size 13px, weight 400. Sample: "Your role requires two-factor authentication. Se".
- surfaces: /settings/profile (6); roles: coach, medic, sc; widths: 1440/390.
- where: src/components/ApplyControls/ApplyControls.tsx:141 (class `banner`; no base.css rule sets color on it); the measured token is set inline — see src/components/MfaEnrollment/MfaEnrollment.tsx
- proposed fix: swap to `--warn-pill-text` (light 7.64, dark 6.62) or `--text` (light 16.68, dark 11.03) or `--muted` (light 7.73, dark 6.14) (currently `--warn-text`).

### C16. `input.field` (placeholder)

- light: **4.03:1** (floor 4.5) — text rgb(117, 117, 117) on --field (4.03:1). Size 15px, weight 400. Sample: "(placeholder) Name or position", "(placeholder) Captain's run".
- dark: **3.36:1** (floor 4.5) — text rgb(117, 117, 117) on --field = --avatar-bg (3.36:1). Size 15px, weight 400. Sample: "(placeholder) Name or position", "(placeholder) Captain's run".
- surfaces: /schedule/fixtures/[id]/participation (72), /squad (36), /programmes/exercises (24), /testing (24), /schedule/new (12), /schedule/[id] (12), /schedule/fixtures/new (12), /reports/athlete (12), /leaderboards/new (8), /settings/groups/new (8), /settings/thresholds/new (8), /programmes/new (8), /schedule/planner/new (4), /schedule/fixtures/[id] (4); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:812 `.field { color: var(--text) }`
- proposed fix: swap to `--text` (light 15.85, dark 13.22) or `--muted` (light 7.34, dark 7.36) or `--faint` (light 4.78, dark 5.03) (currently not a token).

### C17. `textarea.exlib-textarea` (placeholder)

- light: **4.03:1** (floor 4.5) — text rgb(117, 117, 117) on --field (4.03:1). Size 15px, weight 400. Sample: "(placeholder) Optional · shown to the athlete un".
- dark: **3.36:1** (floor 4.5) — text rgb(117, 117, 117) on --field = --avatar-bg (3.36:1). Size 15px, weight 400. Sample: "(placeholder) Optional · shown to the athlete un".
- surfaces: /programmes/exercises (12); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:812 `.field { color: var(--text) }`
- proposed fix: swap to `--text` (light 15.85, dark 13.22) or `--muted` (light 7.34, dark 7.36) or `--faint` (light 4.78, dark 5.03) (currently not a token).

### C18. `textarea.field` (placeholder)

- light: **4.03:1** (floor 4.5) — text rgb(117, 117, 117) on --field (4.03:1). Size 15px, weight 400. Sample: "(placeholder) How to run it — setup, equipment, ".
- dark: **3.36:1** (floor 4.5) — text rgb(117, 117, 117) on --field = --avatar-bg (3.36:1). Size 15px, weight 400. Sample: "(placeholder) How to run it — setup, equipment, ".
- surfaces: /testing (12); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:812 `.field { color: var(--text) }`
- proposed fix: swap to `--text` (light 15.85, dark 13.22) or `--muted` (light 7.34, dark 7.36) or `--faint` (light 4.78, dark 5.03) (currently not a token).

### C19. `span.rep-source`

- light: **4.37:1** (floor 4.5) — text --accent2-pill-text on rgb(178,220,251) (composited; no single wash over a surface reproduces it) (4.37:1). Size 12px, weight 700. Sample: "session RPE", "post-match sheet".
- dark: **3.39:1** (floor 4.5) — text --warn-pill-text = --lb-warn-tint-text = --warn on rgb(101,93,61) (composited; no single wash over a surface reproduces it) (3.39:1). Size 12px, weight 700. Sample: "testing".
- surfaces: /reports (18); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:10709 `.rep-source { color: var(--rep-pill-text, var(--muted)) }`
- proposed fix: swap to `--text` (light 12.53, dark 5.64) (currently `--accent2-pill-text`).

### C20. `div.dash-week-col-empty`

- light: **3.53:1** (floor 4.5) — text --faint on --wash-accent-strong over --bg (3.53:1); --wash-accent-soft over --bg (4.1:1). Size 13px, weight 400. Sample: "Nothing scheduled".
- dark: **3.73:1** (floor 4.5) — text --faint on --wash-accent-soft twice over --bg (3.73:1); --wash-accent-soft over --bg (4.09:1). Size 13px, weight 400. Sample: "Nothing scheduled".
- surfaces: /dashboard (48); roles: coach, medic; widths: 1440/390.
- where: src/styles/base.css:6888 `.dash-week-col-empty { color: var(--faint) }`
- proposed fix: swap to `--text` (light 11.67, dark 9.75) or `--muted` (light 5.41, dark 5.43) (currently `--faint`).

### C21. `p.tiny`

- light: **3.57:1** (floor 4.5) — text --warn-text on --surf = --elev (3.57:1). Size 13px, weight 400. Sample: "Phase 2, load progression , the group is Phase 1".
- surfaces: /injuries/rehab-groups (6); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:736 `.tiny { color: var(--muted) }`; src/styles/base.css:10253 `.flag-notice .tiny, .flag-notice-attribution { color: var(--muted) }`; src/styles/base.css:11974 `.prog-item .tiny { color: var(--muted) }`; the measured token is set inline — see src/app/(athlete)/my-data/page.tsx, src/app/(staff)/reports/gps/page.tsx, src/app/(staff)/squad/[athleteId]/page.tsx
- proposed fix: swap to `--warn-pill-text` (light 8.15, dark 7.65) or `--text` (light 17.79, dark 12.73) or `--muted` (light 8.24, dark 7.09) or `--faint` (light 5.37, dark 4.84) (currently `--warn-text`).

### C22. `span.nutr-totals-delta`

- light: **3.57:1** (floor 4.5) — text --warn-text on --surf = --elev (3.57:1). Size 12px, weight 400. Sample: "▲ + 20 %", "▲ + 6 %".
- surfaces: /nutrition (24); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:7627 `.nutr-totals-delta { color: var(--muted) }`; src/styles/base.css:7630 `.nutr-totals-delta.is-off { color: var(--warn-text) }`; src/styles/base.css:10167 `.nutr-totals-delta.is-over { color: var(--warn-text) }`
- proposed fix: swap to `--warn-pill-text` (light 8.15, dark 7.65) or `--text` (light 17.79, dark 12.73) or `--muted` (light 8.24, dark 7.09) or `--faint` (light 5.37, dark 4.84) (currently `--warn-text`).

### C23. `span.rep-exports`

- light: **4.04:1** (floor 4.5) — text --faint on --wash-accent-soft over --bg (4.04:1); rgb(229,219,230) (composited; no single wash over a surface reproduces it) (4.07:1); --wash-good over --bg (4.27:1); rgb(213,233,250) (composited; no single wash over a surface reproduces it) (4.39:1); +1 more grounds. Size 12px, weight 400. Sample: "CSV · PDF".
- dark: **3.59:1** (floor 4.5) — text --faint on rgb(55,60,72) (composited; no single wash over a surface reproduces it) (3.59:1); rgb(37,60,96) (composited; no single wash over a surface reproduces it) (3.61:1); rgb(34,57,96) (composited; no single wash over a surface reproduces it) (3.75:1); rgb(55,48,78) (composited; no single wash over a surface reproduces it) (4.02:1); +1 more grounds. Size 12px, weight 400. Sample: "CSV · PDF".
- surfaces: /reports (72); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:10714 `.rep-exports { color: var(--faint) }`
- proposed fix: swap to `--text` (light 13.39, dark 9.44) or `--muted` (light 6.2, dark 5.26) (currently `--faint`).

### C24. `div.v`

- light: **3.79:1** (floor 4.5) — text --faint on --wash-accent over --bg (3.79:1). Size 15px, weight 400. Sample: "—".
- dark: **3.85:1** (floor 4.5) — text --faint on --wash-accent over --bg (3.85:1). Size 15px, weight 400. Sample: "—".
- surfaces: /squad/[id] (12); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:2985 `.step .val .v[data-empty] { color: var(--faint) }`; src/styles/base.css:4219 `.target-bar .th .v { color: var(--muted) }`; src/styles/base.css:4294 `.me-row .v { color: var(--accent-text) }`
- proposed fix: swap to `--text` (light 12.5, dark 10.07) or `--muted` (light 5.79, dark 5.61) (currently `--faint`).

### C25. `div.l`

- light: **3.79:1** (floor 4.5) — text --faint on --wash-accent over --bg (3.79:1). Size 9/12px, weight 400. Sample: "wellness", "Position".
- dark: **3.85:1** (floor 4.5) — text --faint on --wash-accent over --bg (3.85:1). Size 9/12px, weight 400. Sample: "wellness", "Position".
- surfaces: /squad/[id] (80); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:4560 `.pp-wellness-mini .l { color: var(--faint) }`; src/styles/base.css:4585 `.pp-detail-cell .l { color: var(--faint) }`
- proposed fix: swap to `--text` (light 12.5, dark 10.07) or `--muted` (light 5.79, dark 5.61) (currently `--faint`).

### C26. `div.dash-stat-label`

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 11px, weight 600. Sample: "Wellness in", "Available".
- surfaces: /dashboard (10); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:6615 `.dash-stat-label { color: var(--faint) }`; src/styles/base.css:6649 `.dash-stat[data-urgent='true'] .dash-stat-label { color: var(--bad-text) }`; src/styles/base.css:6656 `.dash-stat[data-tone='good'] .dash-stat-label, .dash-stat[data-tone='good'] .dash-stat-value { color: var(--good-pill-text) }`
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C27. `div.dash-stat-foot`

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 11px, weight 400. Sample: "window closes 09:00", "injury status set by medical, other absences by ".
- surfaces: /dashboard (10); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:6724 `.dash-stat-foot { color: var(--faint) }`
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C28. `div.lbw-sel-thead > div`

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 10px, weight 600. Sample: "Test".
- surfaces: /leaderboards (6); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:8603 `.lbw-sel-thead { color: var(--faint) }`
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C29. `div.r`

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 10px, weight 600. Sample: "Result", "In group".
- surfaces: /leaderboards (18); roles: coach, medic, sc; widths: 1440/390.
- where: src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:1 (class `r`; no base.css rule sets color on it); the measured token is set inline — see src/app/(staff)/dashboard/page.tsx, src/app/(staff)/reports/athlete/[athleteId]/page.tsx, src/app/(staff)/reports/athlete/page.tsx
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C30. `p.lbw-leader-board`

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 11px, weight 600. Sample: "10m sprint", "40m sprint".
- surfaces: /leaderboards (24); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:8675 `.lbw-leader-board { color: var(--faint) }`
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C31. `span.lbw-leader-unit`

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 11px, weight 400. Sample: "Front row", "Second row".
- surfaces: /leaderboards (144); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:8687 `.lbw-leader-unit { color: var(--faint) }`
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C32. `span.set-row-label[aria-disabled]` — aria-disabled, in scope

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 14px, weight 600. Sample: "Plan", "Club details".
- surfaces: /settings (320); roles: coach, medic, sc; widths: 1440/390.
- where: src/app/(staff)/settings/page.tsx:117 (class `set-row-label`; no base.css rule sets color on it); the measured token is set inline — see src/app/(staff)/settings/page.tsx
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C33. `span.set-row-sub[aria-disabled]` — aria-disabled, in scope

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 12px, weight 400. Sample: "Sport scientist only", "Read by the sport scientist".
- surfaces: /settings (320); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:5291 `.set-row-sub { color: var(--faint) }`
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C34. `span.set-row-count[aria-disabled]` — aria-disabled, in scope

- dark: **3.89:1** (floor 4.5) — text --faint on --surf2 = --border = --pending-fill (3.89:1). Size 12px, weight 400. Sample: "—".
- surfaces: /settings (320); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:5295 `.set-row-count { color: var(--muted) }`; the measured token is set inline — see src/app/(staff)/settings/page.tsx
- proposed fix: swap to `--text` (light 16.29, dark 10.23) or `--muted` (light 7.54, dark 5.69) (currently `--faint`).

### C35. `span.pp-flag-threshold`

- light: **4.2:1** (floor 4.5) — text --faint on --wash-warn over --bg (4.2:1). Size 12px, weight 400. Sample: "against 4 of 7 days expected".
- dark: **3.91:1** (floor 4.5) — text --faint on --wash-warn over --bg (3.91:1). Size 12px, weight 400. Sample: "against 4 of 7 days expected".
- surfaces: /squad/[id] (36); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:4779 `.pp-flag-threshold { color: var(--faint) }`
- proposed fix: swap to `--text` (light 13.95, dark 10.3) or `--muted` (light 6.46, dark 5.73) (currently `--faint`).

### C36. `p.pp-flag-evidence`

- light: **4.2:1** (floor 4.5) — text --faint on --wash-warn over --bg (4.2:1). Size 12px, weight 400. Sample: "1 day against a fixed value · flagged Fri 28 Aug", "1 day against a fixed value · flagged Sat 5 Sept".
- dark: **3.91:1** (floor 4.5) — text --faint on --wash-warn over --bg (3.91:1). Size 12px, weight 400. Sample: "1 day against a fixed value · flagged Fri 28 Aug", "1 day against a fixed value · flagged Sat 5 Sept".
- surfaces: /squad/[id] (36); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:4787 `.pp-flag-evidence { color: var(--faint) }`
- proposed fix: swap to `--text` (light 13.95, dark 10.3) or `--muted` (light 6.46, dark 5.73) (currently `--faint`).

### C37. `span.pp-flag-raised`

- light: **4.2:1** (floor 4.5) — text --faint on --wash-warn over --bg (4.2:1). Size 12px, weight 400. Sample: "raised Sat 29 Aug", "raised Sun 6 Sept".
- dark: **3.91:1** (floor 4.5) — text --faint on --wash-warn over --bg (3.91:1). Size 12px, weight 400. Sample: "raised Sat 29 Aug", "raised Sun 6 Sept".
- surfaces: /squad/[id] (36); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:4799 `.pp-flag-raised { color: var(--faint) }`
- proposed fix: swap to `--text` (light 13.95, dark 10.3) or `--muted` (light 6.46, dark 5.73) (currently `--faint`).

### C38. `p.dash-stat-foot`

- dark: **3.97:1** (floor 4.5) — text --faint on rgb(34,54,84) (composited; no single wash over a surface reproduces it) (3.97:1). Size 11px, weight 400. Sample: "standards differ for forwards and backs · Fydr p".
- surfaces: /leaderboards (6); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:6724 `.dash-stat-foot { color: var(--faint) }`
- proposed fix: swap to `--text` (light —, dark 10.42) or `--muted` (light —, dark 5.8) (currently `--faint`).

### C39. `span.lbw-value-marker`

- light: **4.07:1** (floor 4.5) — text --lb-rank1 on --wash-accent twice over --surf2 (4.07:1). Size 10px, weight 500. Sample: "#1".
- dark: **4.46:1** (floor 4.5) — text --warn-pill-text = --lb-warn-tint-text = --warn on rgb(82,74,70) (composited; no single wash over a surface reproduces it) (4.46:1). Size 10px, weight 500. Sample: "#4".
- surfaces: /leaderboards (12); roles: coach, medic, sc; widths: 1440/390.
- where: src/components/LeaderboardWall/LeaderboardWall.tsx:512 (class `lbw-value-marker`; no base.css rule sets color on it)
- proposed fix: swap to `--text` (light 11.06, dark 7.4) (currently `--lb-rank1`).

### C40. `span.inj-unit`

- dark: **4.11:1** (floor 4.5) — text --faint on rgb(49,50,65) (composited; no single wash over a surface reproduces it) (4.11:1); --wash-bad over --surf (4.46:1). Size 12px, weight 400. Sample: "Scrum-half", "Hooker".
- surfaces: /reports/injuries (54); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:11550 `.inj-unit { color: var(--faint) }`
- proposed fix: swap to `--text` (light 15.32, dark 10.8) or `--muted` (light 7.09, dark 6.01) (currently `--faint`).

### C41. `span.pp-bench-meta`

- dark: **4.16:1** (floor 4.5) — text --faint on --wash-good over --surf (4.16:1); --wash-warn over --surf (4.19:1); --wash-bad over --surf (4.46:1). Size 12px, weight 400. Sample: "median 1.7 · best 1.7 · n=22", "median 38.3 · best 70.0 · n=26".
- surfaces: /squad/[id] (30); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:4742 `.pp-bench-meta { color: var(--faint) }`
- proposed fix: swap to `--text` (light 15.32, dark 10.97) or `--muted` (light 7.09, dark 6.11) (currently `--faint`).

### C42. `span.lb-gap`

- dark: **4.39:1** (floor 4.5) — text --faint on --wash-accent-soft over --surf (4.39:1). Size 13px, weight 400. Sample: "—", "−1,194".
- surfaces: /leaderboards/[id] (18); roles: coach, medic, sc; widths: 1440/390.
- where: src/styles/base.css:11909 `.lb-gap { color: var(--faint) }`
- proposed fix: swap to `--text` (light 15.88, dark 11.55) or `--muted` (light 7.36, dark 6.43) (currently `--faint`).

Distinct contrast defects: 42.

### Natively disabled controls, listed and not counted (WCAG 1.4.3 exempts an inactive component)

- `button.sg-btn-published[disabled]` — dark 3.89:1; /schedule (2).
- `button.btn-primary[disabled]` — dark 3.89:1; /nutrition (12), /schedule/planner/[id] (2).
- `button.btn-ghost[disabled]` — dark 3.89:1; /schedule/planner/[id] (24), /nutrition (20), /reports/athlete/[id] (6), /settings/thresholds/new (2).
- `button.nutr-stepper-btn[disabled]` — light 1.75:1, dark 1.91:1; /nutrition (96).
- `button.reorder-btn[disabled]` — light 1.48:1, dark 1.54:1; /settings/groups (4).

## Class 2 — tap targets under 44px (baseline)

### T1. `a.tiny` — short side 15px

- measured: 76×19px (6), 109×19px (6), 96×19px (6), 136×15px (6). Text: "Compliance ›", "Team allocation →", "Rehab groups →".
- at 390: clears 44px or absent; at 1440: /dashboard, /injuries, /reports/squad; roles: coach, medic, sc.
- where: src/styles/base.css:735 `.tiny { font-size: var(--fs-13) }`; src/styles/base.css:8150 `.injuries-board .tiny { font-size: 8pt !important }`; src/styles/base.css:14595 `.main a.tiny, .main .pp-link, .main table.tbl .nm, .main .eyebrow a, .main .tiny a { padding-block: var(--sp-12) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T2. `a.nm` — short side 15px

- measured: 84×15px (48), 95×15px (48), 79×15px (48), 56×15px (30), 80×15px (24), +51 more sizes. Text: "Dan Okonkwo", "James Barnes", "Viliami Tameifuna".
- at 390: /testing/[id]; at 1440: /squad, /reports/testing, /testing/[id]; roles: coach, medic, sc.
- where: src/styles/base.css:740 `.nm { font-size: var(--fs-13) }`; src/styles/base.css:1251 `table.tbl.lb-table .nm { font-size: var(--fs-14) }`; src/styles/base.css:4049 `.gl-then-row .nm { font-size: var(--fs-14) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T3. `a.pp-link` — short side 15px

- measured: 175×15px (18), 73×19px (6), 125×19px (4), 93×19px (2). Text: "Thresholds ›", "View full detail ›", "What this resolves to for Dan ›".
- at 390: clears 44px or absent; at 1440: /squad/[id], /squad/[id]/gym; roles: coach, medic, sc.
- where: src/styles/base.css:4388 `.pp-link { font-size: var(--fs-13) }`; src/styles/base.css:14595 `.main a.tiny, .main .pp-link, .main table.tbl .nm, .main .eyebrow a, .main .tiny a { padding-block: var(--sp-12) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T4. `p.tiny > a` — short side 15px

- measured: 101×15px (6), 133×15px (2). Text: "View full detail →", "Edit this programme →".
- at 390: clears 44px or absent; at 1440: /programmes; roles: coach, medic, sc.
- where: src/styles/base.css:735 `.tiny { font-size: var(--fs-13) }`; src/styles/base.css:8150 `.injuries-board .tiny { font-size: 8pt !important }`; src/styles/base.css:14595 `.main a.tiny, .main .pp-link, .main table.tbl .nm, .main .eyebrow a, .main .tiny a { padding-block: var(--sp-12) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T5. `td.nm > a` — short side 15px

- measured: 84×15px (48), 79×15px (48), 95×15px (48), 83×15px (28), 75×15px (24), +23 more sizes. Text: "Sione Aholelei", "Harry Ainsley", "Rob Baptiste".
- at both widths: /reports/match, /reports/training-load, /programmes/proposals; roles: coach, medic, sc.
- where: src/styles/base.css:740 `.nm { font-size: var(--fs-13) }`; src/styles/base.css:1251 `table.tbl.lb-table .nm { font-size: var(--fs-14) }`; src/styles/base.css:4049 `.gl-then-row .nm { font-size: var(--fs-14) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T6. `a.attn-name` — short side 15px

- measured: 67×15px (12), 70×15px (12), 105×15px (12), 56×15px (12), 59×15px (12), +5 more sizes. Text: "Henry Ross", "Adam Selby", "Viliami Tameifuna".
- at both widths: /reports/squad; roles: coach, medic, sc.
- where: src/styles/base.css:1077 `.attn-name { font-size: var(--fs-13) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T7. `p.flag-who > a` — short side 16px

- measured: 63×16px (84), 102×16px (84), 90×16px (84), 86×16px (84), 113×16px (72), +21 more sizes. Text: "View Henry Ross's player profile", "View Adam Selby's player profile", "View Viliami Tameifuna's player profile".
- at both widths: /flags; roles: coach, medic, sc.
- where: src/styles/base.css:3524 `.flag-who { font-size: var(--fs-14) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T8. `button.nav-signout` — short side 17px

- measured: 71×17px (456). Text: "Log out".
- at 390: clears 44px or absent; at 1440: /dashboard, /squad, /squad/[id], /squad/[id]/availability, /squad/[id]/gym, /squad/[id]/nutrition, /squad/[id]/wellness, /schedule, /schedule/new, /schedule/planner, /schedule/planner/new, /schedule/planner/[id], /schedule/planner/apply, /schedule/[id], /schedule/fixtures/new, /schedule/fixtures/[id], /schedule/fixtures/[id]/participation, /timetable, /reports/compliance, /flags, /injuries, /injuries/new, /injuries/[id], /injuries/rehab-groups, /injuries/team-allocation, /leaderboards, /leaderboards/new, /leaderboards/manage, /leaderboards/[id], /nutrition, /programmes, /programmes/exercises, /denied, /programmes/[id], /programmes/[id]/athlete/[id], /reports, /reports/athlete, /reports/athlete/[id], /reports/gps, /reports/injuries, /reports/match, /reports/squad, /reports/testing, /reports/training-load, /testing, /testing/[id], /testing/[id]/[id], /settings, /settings/club, /settings/exports, /settings/groups, /settings/groups/new, /settings/groups/[id], /settings/notifications, /settings/profile, /settings/thresholds, /settings/thresholds/new, /programmes/new, /programmes/proposals, /settings/subject-access, /settings/subject-access/[id]/review; roles: coach, medic, sc.
- where: src/styles/base.css:513 `.nav-signout { padding: 0 }`; src/styles/base.css:515 `.nav-signout { font-size: var(--fs-13) }`; src/styles/base.css:527 `.nav-signout .ic { width: 17px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T9. `button.sg-btn-published` — short side 17px (natively disabled)

- measured: 70×17px (2). Text: "Published".
- at 390: clears 44px or absent; at 1440: /schedule; roles: coach.
- where: src/styles/base.css:8860 `.sg-btn-published { font-size: var(--fs-13) }`; src/styles/base.css:14556 `.main .back-btn, .main .btn-ghost, .main .btn-primary, .main select, .main .sg-stepper-btn, .main .sg-btn-remove, .main .sg-btn-add, .main .sg-btn-publish, .main .sg-btn-published, .main .sg-btn-discard, .main .nutr-stepper-btn, .main .lbw-segmented button, .main .theme-seg-btn, .main .reorder-btn { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T10. `a.nutr-profile-link` — short side 17px

- measured: 41×17px (24). Text: "Profile ›".
- at both widths: /nutrition; roles: coach, medic, sc.
- where: src/styles/base.css:7930 `.nutr-profile-link { font-size: var(--fs-12) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T11. `label.tiny > input[type=checkbox]` — short side 19px

- measured: 78×19px (24), 50×19px (24), 76×19px (24); hit box read via label. Text: "on".
- at both widths: /schedule/planner/[id]; roles: coach.
- where: src/styles/base.css:735 `.tiny { font-size: var(--fs-13) }`; src/styles/base.css:8150 `.injuries-board .tiny { font-size: 8pt !important }`; src/styles/base.css:14595 `.main a.tiny, .main .pp-link, .main table.tbl .nm, .main .eyebrow a, .main .tiny a { padding-block: var(--sp-12) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T12. `a.lbw-profile-link` — short side 19px

- measured: 45×19px (12). Text: "Profile ›".
- at both widths: /leaderboards; roles: coach, medic, sc.
- where: src/styles/base.css:8576 `.lbw-profile-link { font-size: var(--fs-13) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T13. `a.tst-manage` — short side 19px

- measured: 96×19px (6), 358×19px (6). Text: "Manage tests →".
- at both widths: /reports/testing; roles: coach, medic, sc.
- where: src/styles/base.css:13651 `.tst-manage { font-size: var(--fs-13) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T14. `a.tr-heat-toggle[role=switch]` — short side 22px

- measured: 76×22px (24). Text: "Heat".
- at both widths: /reports/gps; roles: coach, medic, sc.
- where: src/styles/base.css:10999 `.tr-heat-toggle { font-size: var(--fs-13) }`
- proposed fix: a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule's selector list so nothing on the line moves; never into a neighbour, never overlapping another target.

### T15. `button.btn-ghost` — short side 24px

- measured: 24×32px (64), 54×32px (32), 80×32px (24), 38×44px (24). Text: "+ session", "↑", "↓".
- at both widths: /schedule/planner/[id], /reports/athlete/[id]; roles: coach, medic, sc.
- where: src/styles/base.css:788 `.btn-ghost { padding: var(--sp-10) var(--sp-16) }`; src/styles/base.css:789 `.btn-ghost { min-height: 44px }`; src/styles/base.css:790 `.btn-ghost { font-size: var(--fs-13) }`
- proposed fix: `min-width: var(--tap-min); min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T16. `span.week-nav > a` — short side 24px

- measured: 24×31px (12). Text: "Previous week".
- at both widths: /reports/squad; roles: coach, medic, sc.
- where: src/styles/base.css:12322 `.week-nav { padding: var(--sp-6) }`; src/styles/base.css:12330 `.week-nav a, .week-nav span { padding: var(--sp-6) var(--sp-10) }`; src/styles/base.css:12332 `.week-nav a, .week-nav span { font-size: var(--fs-13) }`
- proposed fix: `min-width: var(--tap-min); min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T17. `span.week-nav > span[aria-disabled]` — short side 24px — **aria-disabled, in scope**

- measured: 24×31px (12). Text: "›".
- at both widths: /reports/squad; roles: coach, medic, sc.
- where: src/styles/base.css:12322 `.week-nav { padding: var(--sp-6) }`; src/styles/base.css:12330 `.week-nav a, .week-nav span { padding: var(--sp-6) var(--sp-10) }`; src/styles/base.css:12332 `.week-nav a, .week-nav span { font-size: var(--fs-13) }`
- proposed fix: `min-width: var(--tap-min); min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T18. `button.back-btn` — short side 29px

- measured: 72×29px (370), 82×34px (80). Text: "Back".
- at 390: clears 44px or absent; at 1440: /squad, /squad/[id], /squad/[id]/availability, /squad/[id]/gym, /squad/[id]/nutrition, /squad/[id]/wellness, /schedule, /schedule/new, /schedule/planner, /schedule/planner/new, /schedule/planner/[id], /schedule/planner/apply, /schedule/[id], /schedule/fixtures/new, /schedule/fixtures/[id], /schedule/fixtures/[id]/participation, /timetable, /reports/compliance, /flags, /injuries, /injuries/new, /injuries/[id], /injuries/rehab-groups, /injuries/team-allocation, /leaderboards, /leaderboards/new, /leaderboards/manage, /leaderboards/[id], /nutrition, /programmes, /programmes/exercises, /denied, /programmes/[id], /programmes/[id]/athlete/[id], /reports, /reports/athlete, /reports/athlete/[id], /reports/gps, /reports/injuries, /reports/match, /reports/squad, /reports/testing, /reports/training-load, /testing, /testing/[id], /testing/[id]/[id], /settings, /settings/club, /settings/exports, /settings/groups, /settings/groups/new, /settings/groups/[id], /settings/notifications, /settings/profile, /settings/thresholds, /settings/thresholds/new, /programmes/new, /programmes/proposals, /settings/subject-access, /settings/subject-access/[id]/review; roles: coach, medic, sc.
- where: src/styles/base.css:11119 `.back-btn { padding: var(--sp-6) var(--sp-12) var(--sp-6) var(--sp-8) }`; src/styles/base.css:11125 `.back-btn { font-size: var(--fs-13) }`; src/styles/base.css:11148 `.back-btn svg { width: 15px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T19. `button.pp-ack-btn` — short side 29px

- measured: 109×29px (18). Text: "Acknowledge flag for Dan Okonkwo".
- at 390: clears 44px or absent; at 1440: /squad/[id]; roles: coach, medic, sc.
- where: src/styles/base.css:4803 `.pp-ack-btn { padding: var(--sp-6) var(--sp-14) }`; src/styles/base.css:4804 `.pp-ack-btn { font-size: var(--fs-13) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T20. `span.rsel-wrap > select` — short side 30px

- measured: 280×40px (36), 232×40px (12), 209×30px (12), 276×30px (6), 280×30px (6). Text: "Period for the body weight and wellness ", "Period", "Reporting period".
- at 390: clears 44px or absent; at 1440: /squad/[id], /reports/compliance, /reports/athlete/[id], /reports/gps, /reports/injuries, /reports/match, /reports/testing, /reports/training-load; roles: coach, medic, sc.
- where: src/styles/base.css:13549 `.rsel-wrap { min-width: 148px }`; src/styles/base.css:13558 `.rsel-wrap select { width: 100% }`; src/styles/base.css:13564 `.rsel-wrap select { padding: var(--sp-6) var(--sp-28) var(--sp-6) var(--sp-10) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T21. `button.sg-segment` — short side 31px

- measured: 62×31px (2), 54×31px (2). Text: "Read", "Edit".
- at 390: clears 44px or absent; at 1440: /schedule; roles: coach.
- where: src/styles/base.css:8781 `.sg-segment { padding: var(--sp-8) var(--sp-16) }`; src/styles/base.css:8783 `.sg-segment { font-size: var(--fs-13) }`; src/styles/base.css:14587 `.main .sg-viewtab, .main .squad-chip, .main .sg-segment, .main .btn-ghost-pill { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T22. `div.lbw-segmented > button[role=tab]` — short side 31px

- measured: 69×31px (6), 110×31px (6), 85×31px (6). Text: "Result", "Improvement", "Standard".
- at 390: clears 44px or absent; at 1440: /leaderboards; roles: coach, medic, sc.
- where: src/styles/base.css:8333 `.lbw-segmented { padding: var(--sp-4) }`; src/styles/base.css:8338 `.lbw-segmented button { font-size: var(--fs-13) }`; src/styles/base.css:8340 `.lbw-segmented button { padding: var(--sp-8) var(--sp-16) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T23. `button.nutr-athlete-row` — short side 31px

- measured: 1054×31px (192), 1054×41px (180). Text: "Okonkwo, DanTrending above118.4112–117 k", "Barnes, JamesOverrideTrending above105.0", "Tameifuna, ViliamiTrending above124.7114".
- at 390: clears 44px or absent; at 1440: /nutrition; roles: coach, medic, sc.
- where: src/styles/base.css:7780 `.nutr-athlete-row { width: 100% }`; src/styles/base.css:7783 `.nutr-athlete-row { padding: var(--sp-8) var(--sp-6) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T24. `a.sg-weeknav-btn` — short side 32px

- measured: 32×32px (52). Text: "Previous week", "Next week".
- at 390: clears 44px or absent; at 1440: /schedule; roles: coach, medic, sc.
- where: src/styles/base.css:8804 `.sg-weeknav-btn { width: 32px }`; src/styles/base.css:8805 `.sg-weeknav-btn { height: 32px }`; src/styles/base.css:14580 `.main .sg-weeknav-btn { min-width: 44px }`
- proposed fix: `min-width: var(--tap-min); min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T25. `button.nutr-stepper-btn` — short side 32px (natively disabled)

- measured: 32×32px (96), 32×44px (96). Text: "Decrease protein", "Increase protein", "Decrease carbohydrate".
- at both widths: /nutrition; roles: coach, medic, sc.
- where: src/styles/base.css:7529 `.nutr-stepper-btn { width: 32px }`; src/styles/base.css:7530 `.nutr-stepper-btn { min-height: 32px }`; src/styles/base.css:7535 `.nutr-stepper-btn { font-size: var(--fs-16) }`
- proposed fix: `min-width: var(--tap-min); min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T26. `a.load-row` — short side 32px

- measured: 32×152px (18), 32×171px (18), 32×190px (6). Text: "10m sprintSpeed · s · lower is better · ", "CMJ heightPower · cm · higher is better ", "40m sprintSpeed · s · lower is better · ".
- at 390: /testing; at 1440: clears 44px or absent; roles: coach, medic, sc.
- where: src/styles/base.css:1122 `.load-row { padding: var(--sp-10) var(--sp-4) }`; src/styles/base.css:1124 `.load-row { font-size: var(--fs-13) }`; src/styles/base.css:8144 `.injuries-board .load-row { padding: 4pt 0 !important }`
- proposed fix: `min-width: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T27. `button.btn-ghost-pill` — short side 33px

- measured: 56×33px (4). Text: "Edit".
- at 390: clears 44px or absent; at 1440: /squad/[id]; roles: coach, medic.
- where: src/styles/base.css:4407 `.btn-ghost-pill { padding: var(--sp-8) var(--sp-16) }`; src/styles/base.css:4408 `.btn-ghost-pill { font-size: var(--fs-13) }`; src/styles/base.css:14587 `.main .sg-viewtab, .main .squad-chip, .main .sg-segment, .main .btn-ghost-pill { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T28. `button.btn-ghost-pill[aria-disabled]` — short side 33px — **aria-disabled, in scope**

- measured: 56×33px (2). Text: "Edit".
- at 390: clears 44px or absent; at 1440: /squad/[id]; roles: sc.
- where: src/styles/base.css:4407 `.btn-ghost-pill { padding: var(--sp-8) var(--sp-16) }`; src/styles/base.css:4408 `.btn-ghost-pill { font-size: var(--fs-13) }`; src/styles/base.css:14587 `.main .sg-viewtab, .main .squad-chip, .main .sg-segment, .main .btn-ghost-pill { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T29. `button.sg-btn-add` — short side 35px

- measured: 93×35px (2). Text: "+ Session".
- at 390: clears 44px or absent; at 1440: /schedule; roles: coach.
- where: src/styles/base.css:8914 `.sg-btn-add { padding: var(--sp-10) var(--sp-18) }`; src/styles/base.css:8915 `.sg-btn-add { font-size: var(--fs-13) }`; src/styles/base.css:14556 `.main .back-btn, .main .btn-ghost, .main .btn-primary, .main select, .main .sg-stepper-btn, .main .sg-btn-remove, .main .sg-btn-add, .main .sg-btn-publish, .main .sg-btn-published, .main .sg-btn-discard, .main .nutr-stepper-btn, .main .lbw-segmented button, .main .theme-seg-btn, .main .reorder-btn { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T30. `div.tr-mode-switch > a` — short side 35px

- measured: 84×35px (24), 97×35px (24), 60×40px (24), 71×40px (24). Text: "Training", "Match day", "Day".
- at both widths: /reports/gps; roles: coach, medic, sc.
- where: src/styles/base.css:5897 `.tr-mode-switch { padding: var(--sp-4) }`; src/styles/base.css:5901 `.tr-mode-switch a { padding: var(--sp-8) var(--sp-18) }`; src/styles/base.css:5902 `.tr-mode-switch a { font-size: var(--fs-13) }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T31. `a.chip-static` — short side 35px

- measured: 127×35px (12), 94×35px (12). Text: "Viliami Tameifuna", "Adam Selby".
- at both widths: /reports/squad; roles: coach, medic, sc.
- where: src/styles/base.css:886 `.chip-static { font-size: var(--fs-12) }`; src/styles/base.css:888 `.chip-static { padding: var(--sp-8) var(--sp-14) }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T32. `button.rhead-tab[role=tab]` — short side 36px

- measured: 99×36px (18), 97×36px (12), 78×36px (12), 83×36px (6), 140×36px (6), +1 more sizes. Text: "Summary", "By athlete", "By day".
- at 390: clears 44px or absent; at 1440: /reports/compliance, /reports/injuries, /reports/testing; roles: coach, medic, sc.
- where: src/styles/base.css:13881 `.rhead-tab { padding: var(--sp-10) var(--sp-18) }`; src/styles/base.css:13884 `.rhead-tab { font-size: var(--fs-14) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T33. `button.theme-seg-btn` — short side 36px

- measured: 55×36px (48), 53×36px (48). Text: "Light", "Dark".
- at 390: clears 44px or absent; at 1440: /settings; roles: coach, medic, sc.
- where: src/styles/base.css:660 `.theme-seg-btn { font-size: var(--fs-12) }`; src/styles/base.css:663 `.theme-seg-btn { padding: 0 var(--sp-14) }`; src/styles/base.css:14556 `.main .back-btn, .main .btn-ghost, .main .btn-primary, .main select, .main .sg-stepper-btn, .main .sg-btn-remove, .main .sg-btn-add, .main .sg-btn-publish, .main .sg-btn-published, .main .sg-btn-discard, .main .nutr-stepper-btn, .main .lbw-segmented button, .main .theme-seg-btn, .main .reorder-btn { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T34. `a.btn-ghost-pill` — short side 37px

- measured: 83×37px (6), 148×37px (6), 102×37px (6), 107×37px (4), 91×37px (2). Text: "‹Squad", "View plan", "Availability history ›".
- at 390: clears 44px or absent; at 1440: /squad/[id]; roles: coach, medic, sc.
- where: src/styles/base.css:4407 `.btn-ghost-pill { padding: var(--sp-8) var(--sp-16) }`; src/styles/base.css:4408 `.btn-ghost-pill { font-size: var(--fs-13) }`; src/styles/base.css:14587 `.main .sg-viewtab, .main .squad-chip, .main .sg-segment, .main .btn-ghost-pill { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T35. `button.nutr-daytype-item` — short side 37px

- measured: 234×37px (36). Text: "Training day6.0 g/kg", "Match day7.5 g/kg", "Rest day3.5 g/kg".
- at 390: clears 44px or absent; at 1440: /nutrition; roles: coach, medic, sc.
- where: src/styles/base.css:7367 `.nutr-plan-item, .nutr-daytype-item { padding: var(--sp-10) var(--sp-12) }`; src/styles/base.css:7375 `.nutr-plan-item, .nutr-daytype-item { width: 100% }`; src/styles/base.css:7381 `.nutr-daytype-item { padding: var(--sp-10) var(--sp-12) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T36. `a.tr-scope-chip` — short side 37px

- measured: 131×37px (24), 160×37px (24), 82×37px (24), 76×37px (24), 72×37px (24), +1 more sizes. Text: "Rest of the week", "Comparable sessions", "Position".
- at both widths: /reports/gps; roles: coach, medic, sc.
- where: src/styles/base.css:6021 `.tr-scope-chip { padding: var(--sp-8) var(--sp-16) }`; src/styles/base.css:6023 `.tr-scope-chip { font-size: var(--fs-13) }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T37. `a.btn-ghost` — short side 37px

- measured: 171×37px (4), 169×37px (4). Text: "Open team allocation →", "Review clinical notes →".
- at both widths: /settings/groups, /settings/subject-access; roles: coach, medic.
- where: src/styles/base.css:788 `.btn-ghost { padding: var(--sp-10) var(--sp-16) }`; src/styles/base.css:789 `.btn-ghost { min-height: 44px }`; src/styles/base.css:790 `.btn-ghost { font-size: var(--fs-13) }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T38. `button.rhead-chip` — short side 39px

- measured: 101×39px (160), 142×39px (80), 80×39px (80), 82×39px (80). Text: "✓Whole squad", "Backs", "Forwards".
- at 390: clears 44px or absent; at 1440: /schedule, /reports/compliance, /reports/gps, /reports/injuries, /reports/match, /reports/squad, /reports/testing, /reports/training-load; roles: coach, medic, sc.
- where: src/styles/base.css:13778 `.rhead-chip { padding: var(--sp-10) var(--sp-20) }`; src/styles/base.css:13784 `.rhead-chip { font-size: var(--fs-14) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T39. `a.nav-item` — short side 40px

- measured: 235×40px (3648). Text: "Dashboard", "Squad overview", "Schedule".
- at 390: clears 44px or absent; at 1440: /dashboard, /squad, /squad/[id], /squad/[id]/availability, /squad/[id]/gym, /squad/[id]/nutrition, /squad/[id]/wellness, /schedule, /schedule/new, /schedule/planner, /schedule/planner/new, /schedule/planner/[id], /schedule/planner/apply, /schedule/[id], /schedule/fixtures/new, /schedule/fixtures/[id], /schedule/fixtures/[id]/participation, /timetable, /reports/compliance, /flags, /injuries, /injuries/new, /injuries/[id], /injuries/rehab-groups, /injuries/team-allocation, /leaderboards, /leaderboards/new, /leaderboards/manage, /leaderboards/[id], /nutrition, /programmes, /programmes/exercises, /denied, /programmes/[id], /programmes/[id]/athlete/[id], /reports, /reports/athlete, /reports/athlete/[id], /reports/gps, /reports/injuries, /reports/match, /reports/squad, /reports/testing, /reports/training-load, /testing, /testing/[id], /testing/[id]/[id], /settings, /settings/club, /settings/exports, /settings/groups, /settings/groups/new, /settings/groups/[id], /settings/notifications, /settings/profile, /settings/thresholds, /settings/thresholds/new, /programmes/new, /programmes/proposals, /settings/subject-access, /settings/subject-access/[id]/review; roles: coach, medic, sc.
- where: src/styles/base.css:425 `.nav-item { padding: var(--sp-10) var(--sp-24) var(--sp-10) var(--sp-20) }`; src/styles/base.css:426 `.nav-item { font-size: var(--fs-14) }`; src/styles/base.css:437 `.nav-item { width: 100% }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T40. `span.sg-viewtab[role=tab]` — short side 40px

- measured: 101×40px (26). Text: "Week plan".
- at 390: clears 44px or absent; at 1440: /schedule; roles: coach, medic, sc.
- where: src/styles/base.css:14110 `.rhead-tabrow .sg-viewtab { padding: var(--sp-10) var(--sp-18) }`; src/styles/base.css:14113 `.rhead-tabrow .sg-viewtab { font-size: var(--fs-14) }`; src/styles/base.css:14587 `.main .sg-viewtab, .main .squad-chip, .main .sg-segment, .main .btn-ghost-pill { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T41. `a.sg-viewtab[role=tab]` — short side 40px

- measured: 74×40px (26). Text: "Today".
- at 390: clears 44px or absent; at 1440: /schedule; roles: coach, medic, sc.
- where: src/styles/base.css:14110 `.rhead-tabrow .sg-viewtab { padding: var(--sp-10) var(--sp-18) }`; src/styles/base.css:14113 `.rhead-tabrow .sg-viewtab { font-size: var(--fs-14) }`; src/styles/base.css:14587 `.main .sg-viewtab, .main .squad-chip, .main .sg-segment, .main .btn-ghost-pill { min-height: 44px }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T42. `a.set-row-btn` — short side 41px

- measured: 102×41px (12), 65×41px (12). Text: "Import files", "Open".
- at both widths: /settings/club; roles: coach, medic, sc.
- where: src/styles/base.css:5224 `.set-row-btn { padding: var(--sp-10) var(--sp-16) }`; src/styles/base.css:5225 `.set-row-btn { font-size: var(--fs-13) }`
- proposed fix: `min-height: var(--tap-min)` on the control (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect); never into a neighbour, never overlapping another target.

### T43. `span > input[type=radio]` — short side 41px

- measured: 1114×41px (6); hit box read via label. Text: "on".
- at 390: clears 44px or absent; at 1440: /settings/thresholds/new; roles: coach.
- where: (no rule located by class; inherited from an ancestor outside the recorded path)
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

### T44. `select.exlib-cat-select` — short side 42px

- measured: 358×42px (6). Text: "Filter by category".
- at 390: clears 44px or absent; at 1440: /programmes/exercises; roles: coach, medic, sc.
- where: src/styles/base.css:12502 `.exlib-cat-select { width: 100% }`; src/styles/base.css:12503 `.exlib-cat-select { height: 100% }`; src/styles/base.css:12504 `.exlib-cat-select { padding: 0 var(--sp-16) }`
- proposed fix: `min-height: var(--tap-min)` on the control; never into a neighbour, never overlapping another target.

Distinct tap-target defects: 44.

### Links inside running text, listed and not counted (WCAG 2.5.5 and 2.5.8 exempt an inline link)

- `p.dash-flags-thresholds > a` — 4 measurements, 48–…×14px; /dashboard (4).
- `p.eyebrow > a` — 256 measurements, 51–…×13px; /squad/[id]/availability (12), /squad/[id]/gym (12), /squad/[id]/nutrition (12), /squad/[id]/wellness (12), /schedule/[id] (12), /programmes/[id]/athlete/[id] (12), /reports/athlete/[id] (12), /testing/[id]/[id] (12), /settings/groups (10), /settings/thresholds (10), /leaderboards/manage (8), /squad/[id] (6), /schedule/fixtures/[id] (6), /injuries/new (6), /injuries/[id] (6), /injuries/rehab-groups (6), /injuries/team-allocation (6), /leaderboards/[id] (6), /programmes/exercises (6), /programmes/[id] (6), /reports/athlete (6), /testing/[id] (6), /settings/club (6), /settings/exports (6), /settings/groups/[id] (6), /settings/notifications (6), /settings/profile (6), /schedule/fixtures/[id]/participation (4), /leaderboards/new (4), /programmes/new (4), /programmes/proposals (4), /schedule/new (2), /schedule/planner (2), /schedule/planner/new (2), /schedule/planner/[id] (2), /schedule/planner/apply (2), /schedule/fixtures/new (2), /settings/groups/new (2), /settings/thresholds/new (2), /settings/subject-access (2), /settings/subject-access/[id]/review (2).
- `p.cap > a` — 16 measurements, 66–…×15px; /leaderboards/manage (16).
- `a.linklike` — 16 measurements, 74–…×14px; /reports/match (16).
- `a.tiny` — 84 measurements, 8–…×15px; /reports/testing (84).
- `span > a` — 96 measurements, 208–…×15px; /settings (96).
- `p.tiny > a` — 6 measurements, 333–…×15px; /settings/club (6).

## Other findings, reported and not fixed

Things the sweep or its reading turned up that are none of the three classes.
Listed as the prompt asks; nothing here was changed.

1. **A dead selector on the athlete week strip.** `src/styles/base.css:2393`
   `.wk-day[data-kind='match'] .wk-day[data-kind='training'] .wk-day[data-kind='recovery'] .wk-day[data-kind='match'] .wn`
   is a descendant chain of four `.wk-day`s, which never nest, so the rule
   (`border-color: var(--bad); font-weight: 700` on the match day's number)
   has never applied. Its comment describes "a dot under each day's number"
   that the strip no longer draws. Either the rule wanted commas or it is
   leftover; a ruling on which, not a fix here.
2. **`KNOWN_BELOW_AA` in `scripts/check-contrast.ts:82–99` is stale on both
   entries** — see the guard section. Once the Class 1 swaps land, both
   entries should go, so the guard fails again if the fill token is ever
   used as ink.
3. **The nutrition workspace's inert "Next week ›" marker**
   (`src/app/(staff)/nutrition/page.tsx:362`) is a `<span class="btn-ghost"
   aria-disabled="true" style={{ opacity: 0.4, pointerEvents: 'none' }}>`:
   `aria-disabled` on something that is not a control and cannot be reached,
   an inline `opacity` literal (`--o-disabled` is 0.45), and `pointer-events:
   none`, which is the pattern the constitution's BlockedButton rule replaced.
   The squad report's forward week arrow does the same
   (`src/app/(staff)/reports/squad/page.tsx:156`, `<span aria-disabled="true"
   data-disabled="true">`, faded to 0.5 by `base.css:12349`). Both are exempt from Class 1 as inactive; they are
   listed because the attribute says "disabled control" about a decoration.
4. **The staff `.btn-ghost` floor does not reach `<a class="btn-ghost">`.**
   `base.css:789` gives `.btn-ghost` `min-height: 44px`, but a link is
   `display: inline`, where `min-height` has no effect — "Open team
   allocation →" and "Review clinical notes →" measure 37px at every width.
   Class 2 carries the defect; the finding is that the same class behaves
   differently on a `<button>` and an `<a>`, which is the kind of thing a
   source-level guard asserts as fixed.
5. **The `/testing` index at 390 renders each `a.load-row` 32px wide**
   (32×152 and taller) — the row's grid squeezes the link to a column. In
   Class 2 as a tap-target defect; noted here because the cause is layout,
   which the sweep may not change.
6. **The browser default placeholder colour on every `.field`** is a colour
   the stylesheet never states (`#757575`); the exercise-library search is
   the only field with a `::placeholder` rule. A conformance item as much as
   a contrast one — the inventory could not see it either, for the same
   reason `check:contrast` could not.

## Rulings the re-run will ask for, already visible

These do not depend on a value conformance will move — they are policy, a
token's value, or a rule that does not exist — so they can be read now. The
fix pass itself (one commit per class per app, before-and-after in both
themes) starts only from the post-conformance sweep's list.

1. **Does the 44px floor apply at desktop width?** The constitution says
   "44px minimum on a phone"; §0au scoped the staff floor to below 768px and
   called the desktop a pointer surface, and `test-nav-hit-floor` deferred
   the staff Back button on the same ground. The prompt says "any interactive
   element on any surface". Class 2 is split so either ruling can be
   applied: the entries that fail **at 390** are the constitution's own floor
   and need no ruling; the entries that fail **at 1440 only** (the sidebar
   rows at 40px, Log out at 17px, the Back button at 29px, the desktop
   selects at 30px, the report tabs and chips at 36–39px) are the question.
   WCAG 2.5.8 (AA) asks 24px of a pointer target; everything at 1440 in
   Class 2 except Log out (17px), the inline links (15–19px) and the two
   week arrows (24px) already clears that.
2. **The fades on blocked and faded controls.** Four failures are not a text
   token: `.squad-chip[aria-disabled]` at `--o-disabled` (0.45), the
   ineligible metric chips on the leaderboard builder — a BlockedButton, so
   in scope; `.btn-ghost-pill[aria-disabled]` at the same 0.45, the player
   profile's blocked "Edit" as the S&C sees it; and `.lbw-chip-count` at
   0.65. No text token clears 4.5:1
   through a 0.45 fade on any ground; `--text` clears it through 0.65. The
   0.45 case needs a ruling: change `--o-disabled` (a token value — a system
   decision, Isabella's), or drop the opacity on that one class and let
   `[aria-disabled]`'s own `--faint`-on-`--surf2` ink carry the state (which
   is itself 3.89:1 in dark — see C33), or leave it and record it.
3. **`--lb-row-selected` in dark.** The leaderboard wall's selected row is
   `rgb(243 247 254)` in both themes — a light tint — under `--text` at
   dark's `#e9edfa`: 1.09:1, the worst pair in the product. The passing
   text tokens are dark inks (`--highlight-text`, `--lb-standard-met`), which
   would read as a light row in a dark table. The right fix is the ground —
   a dark value for the token, or the row swapped to `--wash-accent` — and
   both are ground changes, not the text swap the rules allow. Ruling.
4. **The placeholder rule.** `.field::placeholder { color: var(--faint) }`
   is a new rule with an existing token, not a new token; it lifts every
   placeholder to 4.78 light / 5.03 dark on `--field`. The rule says swap
   one token for another; this adds a declaration where the browser's
   default was standing in. Asking rather than assuming.
5. **`--warn-text` in light.** Every one of its small-text uses fails at
   3.57 on `--surf` and 3.26–3.34 on the warn washes. `--warn-pill-text`
   (`#6b4708`, 7.26–7.47) passes everywhere it is used and is the warn
   family's own ink, so the swap is within the rules; it darkens the amber.
   Flagged because it touches the nutrition figures the constitution's
   "deviation is information" rule speaks to — the tone family does not
   change, only its ink.
6. **The `KNOWN_BELOW_AA` retirement** — after 5 and the `--accent` →
   `--accent-text` swaps, both entries come out, so the guard can fail again.
7. **A rendered check in `prebuild`.** The proposal in the guard section:
   the sweep as a fixture run, not a longer class list. Not built here.
