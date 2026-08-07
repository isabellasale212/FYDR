# Screen: Training report

> **Layout status**: derived from a screenshot of the existing, working staff web app
> (`docs/source/training-report-screenshot.png`), not provisional and not my invention. The
> structure, the column set, the grouping, and the tinting below are transcribed from what is
> already built. Everything I could not read from the screenshot is marked as a question, not
> filled in.

Screen 37 in the inventory (`02-information-architecture.md` §5). Route `/staff/training-report`.
Sidebar item 5 in the real staff web navigation (§4.1), and the active item in the screenshot.

This screen appears nowhere in the hand-drawn navigation map. It is closest to the drawing's
`Analytics → Training` and to `Reports`, but it is a distinct destination in the built app and
is specified here as one.

---

## Purpose

**One session, every athlete, every GPS metric, on one board.** A coach or sports scientist
opens it after a training session, reads down a column, and sees who did more and who did less
than the rest of the squad, grouped by positional unit so that a prop is compared against props
and not against a winger.

Three jobs:

1. Report the external load of one session, per athlete, without the coach exporting anything.
2. Make magnitude legible at a glance through graded tint, so the outliers are found by looking
   rather than by reading 168 numbers.
3. Preserve the positional context, because a 5,000 m session means something different in the
   front row and in the back three.

This screen is deliberately **exhaustive, not exceptional**. That makes it the opposite of the
dashboard and it needs holding to:

| Screen | Question it answers |
|---|---|
| `dashboard.md` | "Who do I need to speak to this morning?" |
| `flags.md` | "What crossed a threshold?" |
| **Training report** | "What did the whole squad actually do in that session?" |
| `analytics.md` | "Is loading associated with anything over a window?" |

It is a session board, not a trend view. There is no window selector on it and there should not
be one: the date chips select a session, not a period. Trend belongs in `analytics.md` and in
the athlete profile.

---

## Roles and access

| Role | Access | Notes |
|---|---|---|
| Coach / S&C | Full | The primary user. The screenshot's account footer reads `Account · Sports s…`, which is most likely a sports science user. |
| Medical | Full | GPS output is not clinical data (`09-security-and-compliance.md`). A physio reading external load against a rehab plan is a normal use. |
| Athlete | **No access** | An athlete sees their own GPS data in `my-data.md`. A squad-wide comparative board given to athletes turns into a leaderboard nobody agreed to publish. See `leaderboards.md` on why that is a deliberate boundary and not an oversight. |
| Admin | No access by default | Direct navigation renders `noPermission`. |

**Group filter**: mandatory under `CLAUDE.md` §3. This is a multi-athlete screen and the rule
has no exceptions.

**Note against the screenshot**: no group filter chips are visible on the built screen. The
`.squad-chip` component is present but is carrying **dates** instead. Either the group filter is
elsewhere in the page furniture and out of frame, or this screen does not honour §3. If the
latter, that is a defect against a non-negotiable rule and not a design choice. O-702.

---

## Entry points

| From | Trigger | Context carried |
|---|---|---|
| Staff sidebar, item 5 | Click | Group filter. Date defaults to the most recent session with GPS data. |
| `imports.md`, after a successful commit | "View report" on the import result | The imported session's date, preselected |
| `session-detail.md` | "Training report" action on a training session | That session's date and id |
| `schedule.md` | Click a past training session, then the report affordance | Session date |
| `dashboard.md`, a GPS load card | Click | Date, group filter |
| `flags.md`, a GPS-domain flag | Click the session reference | Session date, and the flagged athlete's row scrolled into view |
| Deep link `/staff/training-report?date=2026-07-21&session=<uuid>` | Import-complete notification (`08-notifications.md`) | Date and session |

Back from an athlete row returns here, per `02-information-architecture.md` §7 rule 3.

---

## Layout

Read from the screenshot. A left sidebar at a fixed width, then a page column containing a page
head, a stat tile row, a date chip row, and one card holding the data board.

### Web, `xl` 1280 px, as built

```
┌───────────────┬──────────────────────────────────────────────────────────────────┐
│ Fydr.     [«] │  SQUAD · TRAINING · TUE 21 JUL                        .eyebrow    │
│               │  Training report                                  .page-head h1   │
│ ▦ My dashboard│                                                                   │
│ ▦ Squad over… │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ ⚑ Fixtures    │  │ SQUAD    │ │ AVG TD   │ │ TOTAL HSR│ │ FLAGGED  │  4 × .stat  │
│ ▤ Reports     │  │ 24       │ │ 5,969 m  │ │ 15.5 km  │ │ 2        │             │
│▐▤ Training rep│  │ players  │ │ ▲ 3%     │ │ session  │ │ athletes │             │
│ ≡ Leaderboard │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│ ▦ Analytics   │                                                                   │
│ ◎ Testing     │  (Tue 21 Jul) ( Mon 20 Jul ) ( Fri 10 Jul )      .squad-chip row  │
│ ◈ Nutrition   │                                                                   │
│ ◔ Schedule    │  ┌─────────────────────────────────────────────────────────────┐  │
│ ↑ Import GPS  │  │ PLAYER        TD     RUN    HSR    HIE   MAXV   %MAX        │  │
│ ⚡ Gym progra… │  ├─────────────────────────────────────────────────────────────┤  │
│ ⚙ Thresholds  │  │ 1. FRONT ROW                                                │  │
│ ✦ Flight cont…│  │ Athlete, Demo  8,380  2,278 [ 40] [114]  21.0  [ 75%]       │  │
│ ─────────────  │  │ Palmer, George 6,260  2,845 [589] [135]  30.3  [ 94%]       │  │
│ ◑ Account · S… │  │ Reid, Mason    5,090  2,474 [642] [144]  30.8  [ 89%]       │  │
│ ⤺ Sign out    │  │ Bennett, Noah  4,860  2,298 [539] [102]  28.3  [ 84%]       │  │
│               │  │ Barnes, Joseph 4,210  2,000 [386] [ 67]  28.8  [ 96%]       │  │
│               │  │ 2. SECOND ROW                                               │  │
│               │  │ Chapman, Max   7,120  3,564 [761] [ 92]  28.5  [ 80%]       │  │
│               │  │ Ross, Henry    5,280  2,405 [446] [ 80]  32.5  [ 78%]       │  │
│               │  │ Carter, Liam   4,080  2,100 [525] [148]  31.7  [ 80%]       │  │
│               │  │ 3. BACK ROW                                                 │  │
│               │  │ Fox, Lucas     6,850  3,133 [796] [119]  31.2  [ 84%]       │  │
│               │  │ Thompson, Jack 6,630  3,515 [776] [ 53]  30.6  [ 72%]       │  │
│               │  │ …                                                           │  │
│               │  └─────────────────────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────────────────────┘
```

`[ ]` marks a tinted cell. Everything numeric is right-aligned and set in DM Mono with tabular
figures, per `06-design-system.md` §5.2. `PLAYER` is left-aligned in Sora semibold. Column
headers are `.eyebrow`: 11 px, 0.12 em tracking, uppercase, `--faint`.

Measured against the design system:

| Element | Class / token |
|---|---|
| Eyebrow `SQUAD · TRAINING · TUE 21 JUL` | `.eyebrow` |
| `Training report` | `.page-head h1`, 30 px at desktop, weight 800 |
| Stat tiles | `.stat`, radius 16, four across |
| Date chips | `.squad-chip`, radius 20, one `.active` filled in `--accent` |
| Board container | `.card`, radius 18, padding 16, `--shadow` |
| Unit group header | `--accent`, 11 px, uppercase, weight 700 |
| Numeric cells | `.mono`, `font-variant-numeric: tabular-nums` |

### Narrow web and tablet, below `lg`

Seven columns do not fit. The board keeps `PLAYER` frozen and scrolls the metric columns
horizontally. Stat tiles wrap two by two. The card padding drops to 12 px. Column priority when
space is scarce, highest first: `TD`, `HSR`, `%MAX`, `HIE`, `MAXV`, `RUN`.

### Mobile

Not specified, because no staff mobile app exists and O-725 asks whether one ever will. If it
does, this screen becomes a per-athlete card list with the seven values as a two-column grid
inside each card. A seven-column table at 390 pt is not readable at any density and should not
be attempted.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `PageHead` | `06-design-system.md`, `.page-head` and `.eyebrow` | Title plus scope eyebrow. The eyebrow is three parts joined by a middle dot: population, session type, date. |
| `MetricTile` | §6.2 | The four stat tiles. `size="l"`. `AVG TD` passes `trend`. Every tile that shows an aggregate passes `footnote` with the population size, which §6.2 makes a unit-tested requirement. |
| `GroupFilter` | §6.7 | Mandatory per `CLAUDE.md` §3. See O-702. |
| `DateChipRow` | **New**, this screen | The `.squad-chip` component carrying session dates rather than groups. See below. |
| `EmptyState` | §6.16 | All empty and error states, with the correct `kind` per §11.2. |
| `HeatCell` | **New**, this screen | A tinted numeric cell. See below. |
| `SectionHeader` | Standard | Positional unit headers. Not collapsible in the screenshot; see O-711. |

### `DateChipRow`, new component

```ts
export type DateChipRowProps = {
  /** Session dates that have data, most recent first. Not a calendar range. */
  dates: Array<{ date: string; sessionId?: string; label: string; recordCount: number }>;
  selected: string;
  onSelect: (date: string) => void;
  /** Rendered when more dates exist than are shown. */
  onShowMore?: () => void;
};
```

The screenshot shows `Tue 21 Jul`, `Mon 20 Jul`, `Fri 10 Jul`. Those are **not consecutive**,
which settles what the control is: it lists the most recent dates that actually have GPS
records, not a calendar strip. A calendar strip would show Sat 18 and Sun 19. This matters,
because a date chip is a promise that data exists behind it and an empty chip is a wasted click.

How many chips, and how a coach reaches an older session, are not visible. O-709.

### `HeatCell`, new component

```ts
export type HeatCellProps = {
  value: number | null;
  metric: MetricKey;
  /** 0 to 4. Null suppresses the tint entirely. */
  band: 0 | 1 | 2 | 3 | 4 | null;
  /** Which ramp. One hue per column, never a diverging ramp. */
  ramp: 'accent' | 'pink' | 'green';
  /** Filled ramp with inverted text, as %MAX renders in the screenshot. */
  fill?: 'tint' | 'solid';
  /** Shown on hover and in the accessible label. */
  reference?: { label: string; n: number; window: string };
  onClick?: () => void;
};
```

`value: null` renders the missing glyph from `06-design-system.md` §5.4 with no tint. A missing
GPS record is not a zero, and tinting it band 0 would make an athlete who did not wear a unit
look like an athlete who stood still. This is principle 1.6 and it is the single easiest thing
to get wrong on this screen.

---

## The heat map

The tinting is the reason this screen exists rather than being a CSV. It is also the part that
will silently lie if the scale is not defined, so it is defined here in full.

### Which columns are tinted

Read from the screenshot:

| Column | Tint | Hue | Treatment |
|---|---|---|---|
| `TD` | No | n/a | Plain mono |
| `RUN` | No | n/a | Plain mono |
| `HSR` | **Yes** | Blue, `--accent` family | Tinted background, text stays `--text` |
| `HIE` | **Yes** | Pink | Tinted background, text stays `--text` |
| `MAXV` | No | n/a | Plain mono |
| `%MAX` | **Yes** | Green, dark | **Solid** fill with light green text, not a tint |

Two things follow that need a decision rather than a transcription.

1. **Why are `TD` and `RUN` not tinted when they are the two largest numbers on the row?** The
   defensible reading is that `TD` and `RUN` are volume, which a coach reads as an absolute
   figure against a session plan, while `HSR`, `HIE`, and `%MAX` are intensity, which only means
   anything relative to other people. That is a good rule and I recommend keeping it. Confirm it
   was the intent rather than an unfinished screen. O-700.
2. **`%MAX` uses a green ramp**, which `06-design-system.md` §8.4 explicitly rules out for
   sequential data in favour of a single-hue ramp from `chart.band` to `accent.solid`. Either
   the design system rule changes to permit a per-column hue, or the screen changes. They cannot
   both stand. O-701.

### The scale

**Five discrete bands, not a continuous gradient.** A continuous ramp invites a coach to read a
precision the data does not have, and five bands survive greyscale, projection, and print. The
number is always rendered inside the cell, so the tint is a second channel and never the only
one, per `06-design-system.md` §1.4.

Band assignment, per column, per render:

```
normalised = clamp(value / reference_p95, 0, 1)

band 0   normalised <  0.20     alpha 0.06
band 1   0.20 to 0.40           alpha 0.16
band 2   0.40 to 0.60           alpha 0.28
band 3   0.60 to 0.80           alpha 0.42
band 4   normalised >= 0.80     alpha 0.58
```

Applied as the column's hue at that alpha over `--surf`. In dark theme the same band indices
map to a separate alpha table, because 0.06 over `#171e36` is invisible; the dark table starts
at 0.10 and ends at 0.65. Both tables are verified to keep `--text` above 4.5:1 on every band.

**The denominator is the 95th percentile of the reference population, not its maximum.** Using
the maximum lets one athlete who ran a 900 m HSR session flatten the other twenty-three into
band 0 and band 1, which makes the board look uniform on exactly the day it should not. p95 is
clamped so a value above it simply sits in band 4.

`%MAX` is the exception: it is already a normalised percentage of the athlete's own maximum, so
it is banded against a **fixed** scale, not a population, and the bands are the ones a coach
already uses:

```
band 0   below 70%
band 1   70 to 80%
band 2   80 to 85%
band 3   85 to 90%
band 4   90% and above
```

A fixed scale is correct here because 94% of an athlete's own maximum means the same thing on
every date and in every squad. Making it population-relative would destroy the only column on
the board that is already comparable across sessions.

### The reference population and window

This is the question that decides what the colours mean, and there are two coherent answers.

| Option | Reference population | What a dark cell means | Cost |
|---|---|---|---|
| **A. Session-relative** | The athletes visible on this date, after the group filter | "He did more than the others in this session" | Colours are **not comparable between dates**. Tuesday's dark blue and Friday's dark blue are different numbers. A coach flicking between date chips will read a trend that is not there. |
| **B. Rolling squad reference** (recommended) | Every `gps_records` row for the organisation in the **last 28 days**, same session type, after the group filter | "He did more than the squad typically does" | A hard session tints uniformly dark and an easy one uniformly pale, which is correct and informative but looks less varied. |

**Recommendation: B, a rolling 28-day squad reference, same session type, computed once per
render and cached.** Twenty-eight days matches the chronic window already used throughout the
product (`02-information-architecture.md` §6, ACWR at 7:28) and it gives the colour a stable
meaning, which is the whole point of a heat map that a coach looks at every day.

The reference is stated on the screen, not hidden: the board caption reads
`Shading vs squad, last 28 days, training sessions, n = 412 records` and the same string is in
every cell's accessible label. A tint over an unnamed reference is the same failure as a
percentage over an unnamed denominator, and `squad-status.md` already refuses to do that.

Whichever is chosen, it is one rule for the whole screen. Per-column references would be
unreadable.

O-703 records that the built app's choice is unknown; the screenshot cannot distinguish A from
B on a single date.

### Small squads and sparse data

The rules that stop the tint lying, in order of application:

| Condition | Behaviour |
|---|---|
| Fewer than **5 athletes** with a non-null value in the column, in the reference population | **No tint at all in that column.** Numbers render plain, and the column header carries a footnote glyph reading "Not enough athletes to shade". This is the same minimum as the squad distribution rule in `06-design-system.md` §8.5 and it is the most important rule here. |
| Fewer than **20 records** in the 28-day reference window | Fall back to session-relative (option A) for that render, and change the caption to say so. Never compute a p95 from 6 observations and present it as a squad norm. |
| Fewer than **10 sessions** in the window | Same fallback, same caption. |
| Every value in the column is identical | No tint. A column of uniform band 4 asserts that everyone was extreme. |
| Coefficient of variation below 0.05 across the population | No tint, caption "Values too close to shade". Shading noise is worse than not shading. |
| Value is null | Missing glyph, no tint, excluded from the reference and from every stat tile denominator. |
| Value is exactly 0 with a record present | Renders `0` at band 0 with a 1 px `--border` hairline so that zero and missing are visually distinct at a glance. `06-design-system.md` §5.4. |
| Reference p95 is 0 or negative | Tinting suppressed for the column. Never divide by it. |
| Group filter reduces the population below 5 | Tint suppressed for every column, banner reads "Shading is off: fewer than 5 athletes in Forwards". |

Suppression is silent-proof: whenever the tint is off or has fallen back, the screen says so.
A board that quietly stops shading looks like a board where everyone is average.

---

## Positional grouping

The screenshot shows three headers: `1. FRONT ROW`, `2. SECOND ROW`, `3. BACK ROW`. The numeric
prefix, the uppercase, and the accent colour are all part of the header treatment.

| Rule | Detail |
|---|---|
| Source | `groups` where `group_type = 'positional'` (`04-data-model.md` §3). Not `athletes.position`, which is a free-text column and cannot be grouped reliably. |
| Order | `groups.sort_order` ascending. The number in the header is the position in that order, not a stored value. |
| Membership | `group_memberships`, resolved **as at the session date**, not as at today. The table is history-preserving for exactly this reason. A naive `removed_at is null` filter is a bug, and it is the same bug called out in `squad-status.md`. |
| Athlete in two positional groups | Appears **once**, under the group with the lowest `sort_order`, with the other groups in the row tooltip. A hooker who also covers back row appearing twice would make a 24-player squad render 26 rows and every squad-level total wrong. |
| Athlete in no positional group | Collected into a final group headed `UNASSIGNED`, rendered in `--muted` rather than `--accent`. They are still counted in the stat tiles. A silently dropped athlete is worse than an ugly header. |
| Empty group | Not rendered. A unit with nobody in it on that date is noise. |
| Group subtotals | **Not present in the screenshot.** A per-unit mean row is the obvious next request and it is not specified here because it is not built. O-710. |
| Row order within a group | Not determinable from the screenshot. `TD` descending fits the front row rows (8,380, 6,260, 5,090, 4,860, 4,210) and also fits second row and back row. Specified as `TD` descending, which is the reading that matches every visible group. O-712. |

Only three units are visible. A rugby squad usually has five to seven positional units, and the
rest are below the fold. **Do not invent the remaining unit names.** They come from the
organisation's `groups` rows, and different clubs subdivide the backs differently.

---

## Data requirements

### Column definitions and their source in `gps_records`

`04-data-model.md` §8 defines `gps_records`. Three of the seven columns on this screen have no
column in that table. That is the most consequential finding in this document.

| Column | Header | Meaning | Source | Status |
|---|---|---|---|---|
| Player | `PLAYER` | `last_name, first_name` | `athletes.last_name`, `athletes.first_name` | Exists. Sort key is `last_name || ' ' || first_name`. |
| Total distance | `TD` | Metres in the session | `gps_records.total_distance_m` | Exists. Format `distance_m`: 0 dp, comma thousands. |
| Running distance | `RUN` | Metres above a running-speed threshold and below the HSR threshold | **No column** | **Missing.** See below. |
| High speed running | `HSR` | Metres above the HSR speed threshold | `gps_records.high_speed_distance_m` | Exists. Format `distance_m`. |
| High intensity efforts | `HIE` | Count of discrete efforts above an intensity threshold | **No column** | **Missing.** See below. |
| Maximum velocity | `MAXV` | Peak speed in the session | `gps_records.max_speed_ms` | Exists, **but the screenshot displays km/h**. See below. |
| Percentage of maximum | `%MAX` | `MAXV` as a percentage of the athlete's own maximum | **Derived, source of the personal maximum undefined** | **Missing definition.** See below. |

**`RUN`.** In the screenshot `RUN` is always well below `TD` and well above `HSR`
(8,380 / 2,278 / 40 and 6,260 / 2,845 / 589), which is consistent with a middle velocity band:
distance covered while running, excluding walking and jogging, and excluding or including the
high speed band depending on the vendor. `gps_records` has `total_distance_m`,
`high_speed_distance_m`, and `sprint_distance_m` and nothing in between. Two routes: add
`running_distance_m numeric(10,1)` as an additive migration and extend the vendor column maps in
`07-integrations.md`, or read it from `gps_records.raw` at query time. The first is right if the
column is on this board every day, which it is. O-704 asks for the threshold definition, because
"running distance" is a vendor-specific band and Fydr must record which one it stored.

**`HIE`.** Values of 40 to 148 per athlete per session are efforts, not metres and not seconds.
The nearest existing columns are `accelerations`, `decelerations`, and `impacts`, and `HIE` is
none of those in isolation; it is usually a combined count over an acceleration or velocity
threshold. Add `high_intensity_efforts int`. Do not silently map it onto `accelerations`, which
is the class of judgement call `07-integrations.md` already warns about with `Dynamic Stress
Load` and `player_load`. O-705.

**`MAXV` units.** The screenshot shows 21.0, 28.3, 30.3, 30.8, 31.7, 32.5. Those are kilometres
per hour. `gps_records.max_speed_ms` stores metres per second, and
`07-integrations.md` §3.6 already converts km/h inputs on import at 0.277778. So the
storage is correct and the **display** is km/h. `06-design-system.md` §5.3 has one format key,
`max_speed_ms`, with unit `m/s`. A second key is needed:

```ts
max_speed_kmh: { decimals: 1, unit: 'km/h', padDecimalsInTables: true, thousands: false,
                 direction: 'higherIsBetter', meaningfulThreshold: 0.5 },
```

Which unit staff want on screen is a preference, not a fact, and clubs differ. O-706.

**`%MAX`.** Arithmetically consistent with `MAXV / personal_maximum`: 21.0 at 75% implies a
personal maximum of 28.0 km/h, 30.3 at 94% implies 32.2, 30.8 at 89% implies 34.6. So it is
per-athlete, not per-squad. What is undefined is where the personal maximum comes from, and the
three candidates give materially different numbers:

| Candidate | Source | Consequence |
|---|---|---|
| Rolling maximum | `max(gps_records.max_speed_ms)` over a trailing window, say 12 months | Moves as the athlete improves. A single bad GPS spike inflates the denominator for a year and depresses every subsequent `%MAX`. |
| All-time maximum | Same with no window | Same spike problem, permanently. |
| Tested maximum | `test_results` for a sprint test (`04-data-model.md` §7) | Clean and defensible, but only exists for athletes who have been tested, and it will read low because nobody hits their true maximum in a testing session. |

Recommendation: rolling 12-month maximum from `gps_records`, with a validity filter that
excludes any record failing the `max_speed_ms` range check in `07-integrations.md` §3.8
(0 to 12.5 m/s), and a fallback to the tested maximum when fewer than 5 valid GPS sessions
exist. This is a recommendation, not a decision. O-707.

### The stat tiles

| Tile | Value in the screenshot | Definition | Notes |
|---|---|---|---|
| `SQUAD` | `24` `players` | Count of distinct athletes with a `gps_records` row for the selected session, after the group filter | This is athletes **with data**, not squad size. If 26 athletes trained and 24 wore units, the tile must not say 26. When the two differ, the tile carries a footnote "24 of 26 with GPS data", because every other tile's denominator is this number. |
| `AVG TD` | `5,969 m` `▲ 3%` | `avg(total_distance_m)` across the same population | The delta's comparator is not visible. Candidates: the previous date chip, the previous session of the same type, or the 28-day mean for the same MD-n. Recommended: previous session of the same type, labelled in the tile footnote. O-708. |
| `TOTAL HSR` | `15.5 km` `session` | `sum(high_speed_distance_m)` across the population, rendered in km | Consistent with the visible rows: ten athletes shown sum to roughly 5.5 km and 24 athletes reach 15.5 km. Format `distance_km`, 2 dp per §5.3, shown here at 1 dp. Confirm precision. |
| `FLAGGED` | `2` `athletes` | Count of athletes with an open flag against this session | Rendered in `--bad`. Which flags is not visible: GPS-domain flags only, or every domain on that date. Recommended: GPS-domain flags for this session only, because a wellness flag has no place on a load board. O-713. |

Each tile passes `footnote` with its population size, which `06-design-system.md` §6.2 requires
for any aggregate.

### Field map

| Field | Source | Transformation |
|---|---|---|
| `athlete_id`, `display_name` | `athletes` | `last_name || ', ' || first_name`, exactly as the screenshot renders it |
| `unit_name`, `unit_order` | `groups` where `group_type = 'positional'`, via `group_memberships` as at `session_date` | Header label and ordering |
| `td` | `gps_records.total_distance_m` | Round at display only |
| `run` | `gps_records.running_distance_m` **(new column)** or `raw ->> '<vendor band>'` | O-704 |
| `hsr` | `gps_records.high_speed_distance_m` | Reference p95 computed separately |
| `hie` | `gps_records.high_intensity_efforts` **(new column)** | O-705 |
| `maxv` | `gps_records.max_speed_ms` | `× 3.6` for km/h at display only. Never stored converted. |
| `pct_max` | `maxv / personal_max` | Personal max per O-707. Null when no personal max exists, which renders the not-applicable glyph, never 0%. |
| `flagged` | `flags` open against `session_id` and `athlete_id` | Drives the row marker and the `FLAGGED` tile |
| `source` | `gps_records.source`, `gps_records.vendor` | Provenance chip on the row tooltip, per design principle 5 in `00-product-overview.md` |
| `reference_p95` | `gps_records` over the 28-day window, per column | Cached per render, not per cell |

### Schema additions required

Additive migrations, per `CLAUDE.md` §5. These belong with this screen.

```sql
alter table gps_records add column running_distance_m numeric(10,1);
alter table gps_records add column high_intensity_efforts int;

-- Serves the board: one org, one date, positional ordering handled client-side.
create index on gps_records (org_id, record_date, athlete_id);

-- Serves the 28-day reference percentile.
create index on gps_records (org_id, record_date) include (high_speed_distance_m, high_intensity_efforts);
```

`vendor_profiles.column_map` in `07-integrations.md` §3.4 needs both new fields adding to every
vendor profile, and the validation ranges in §3.8 need entries for both. Until that is
done, both columns are null for imported data and the screen renders missing glyphs, which is
correct behaviour and not a crash.

### Query keys

```ts
qk.trainingReport.board(orgId, date, sessionId, groupIds)
qk.trainingReport.reference(orgId, sessionType, groupIds)   // 28-day p95 set
qk.trainingReport.dates(orgId, groupIds)                    // chip row
```

`staleTime` 5 minutes on the board, 1 hour on the reference set. A completed session's data does
not change unless an import runs, and an import invalidates
`qk.trainingReport` wholesale. No polling. No realtime subscription.

---

## States

### Default

Most recent date with GPS data, all positional units expanded, rows ordered by `TD` descending
within each unit, group filter from global state, tinting on the 28-day reference.

### Loading

Twelve skeleton rows at the row height, with the unit headers rendered immediately from the
groups query, which returns first and is nearly free. Stat tiles render skeleton bars at the
number's height with their labels visible, per `06-design-system.md` §11.1. The date chip row
renders before the board, so a coach can change date while the board is still loading.

Stale data is never replaced by a skeleton: a cached board renders with a refreshing indicator.

### Empty

| Condition | `kind` | Copy |
|---|---|---|
| No GPS records for the organisation at all | `notStarted` | "No GPS data yet." Action "Import GPS", linking to `imports.md`. |
| No records on the selected date | `noData` | "No GPS data for Tue 21 Jul." Action "Go to the most recent session with data". |
| Group filter excludes everyone with data | `noResults` | "No GPS data for Forwards on Tue 21 Jul." Action "Clear filter". Always names the filter, per §11.2. |
| Records exist but every metric column is null | `noData` | "Records imported but no metrics mapped. Check the vendor profile." Action links to the vendor profile. This is a real and quiet import failure and it needs its own state. |

### Error

| Failure | Behaviour |
|---|---|
| Board query fails | Full-block error with retry. "Could not load the training report." |
| Reference query fails | **The board still renders, untinted**, with the caption "Shading unavailable". The numbers are the point; the tint is an accelerant. Never block the table on the tint. |
| Groups query fails | Board renders ungrouped in a single list ordered by `TD` descending, with a caption "Positional units unavailable". |
| Personal maximum query fails | `%MAX` renders the not-applicable glyph for every row. `MAXV` is unaffected. |
| Flags query fails | The `FLAGGED` tile renders its error state. The board is unaffected. |

### Offline

Not applicable in the same way as the mobile app. The staff web app renders the last cached
board with "Last updated 08:14" and disables the date chips for dates not in the cache.

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | As specified. |
| Medical | Identical. Rows for athletes who are unavailable carry an `AvailabilityPill` in the player cell, status only, never a diagnosis. |
| Athlete, admin | No access. |

### Filtered

An active group filter renders "Showing Forwards only" beneath the page head, every stat tile
recomputes against the filtered population and says so in its footnote, and the tint reference
recomputes against the filtered population too. If the filter drops the population below 5, the
tint switches off and says why. A board that keeps its old shading after a filter change is
asserting something false.

---

## Interactions

| Action | Result |
|---|---|
| Click a date chip | Loads that session's board. Scroll position resets, group filter and sort persist. |
| Click a player row | Navigate to `athlete-profile.md`, GPS tab, date carried. Per `02-information-architecture.md` §7 rule 2. |
| Click a `HeatCell` | Same as the row, with the metric preselected on the athlete profile. |
| Hover a `HeatCell` | Tooltip after 300 ms: value, band, the reference and its `n`, the athlete's own 28-day mean for that metric, and the provenance chip. |
| Click a column header | Sort by that column, descending first. Sorting applies **within** each positional unit, never across units, because flattening the grouping to sort is a different screen. |
| Click a unit header | Not interactive in the screenshot. O-711. |
| Change group filter | All three queries refetch, including the reference. |
| Collapse the sidebar (`«`) | Widens the page column. The board gains column width; it does not gain columns. |
| Export | Not visible in the screenshot. If added, it must run server-side as a `report_runs` job and write an `export.run` audit event, per `09-security-and-compliance.md` §8.5. O-714. |

**Not available on this screen**: editing a value. GPS records are imported, and a correction is
a re-import that supersedes the batch (`imports.md`, revert and supersede). An editable cell on
a load board destroys the provenance guarantee in `CLAUDE.md` rule 6.

---

## Validation rules

| Rule | Behaviour |
|---|---|
| A tint is never rendered without its reference being stated | The board caption names the population, the window, and `n`. Enforced by `HeatCell` requiring `reference` whenever `band` is not null. |
| Missing is never tinted and never zero | Null renders the missing glyph, is excluded from every denominator, and is excluded from the reference set. |
| A percentage is never rendered without its denominator | `%MAX` tooltips always state the personal maximum used and where it came from. |
| Group membership resolves as at the session date | Not as at today. |
| An athlete appears exactly once | Enforced in the query by taking the lowest `sort_order` positional group per athlete. A count of rendered rows must equal the `SQUAD` tile. |
| Units are converted at display only | `max_speed_ms` is stored in m/s. Never write km/h to the database and never compare a stored value against a displayed one. |
| The reference never spans vendors without saying so | `07-integrations.md` warns that `player_load` is not comparable across vendors. `high_speed_distance_m` has the same hazard when two vendors use different velocity thresholds. If the reference window contains more than one `vendor`, the caption says so and the tint is still rendered, because distance bands are closer to comparable than load is. Flag thresholds are stricter; see `thresholds.md`. |
| Suppressed shading is announced | Every suppression path in §small squads writes a visible caption. |
| A future date never renders | The date chips only offer dates with records, so this cannot arise through the UI. A deep link to a future date renders the `noData` empty state. |

---

## Edge cases

| Case | Handling |
|---|---|
| **Two training sessions on one date.** | The eyebrow and the chips are date-based in the screenshot, which cannot express this. Either the chips carry session names, or the board sums the day. Summing changes what `MAXV` means, because the maximum of two sessions is not the session maximum. Specified as: chips select a **session**, and a date with two sessions renders two chips labelled with the session name. O-715. |
| **An athlete wore a unit for part of the session.** | `gps_records.duration_s` is well below the session duration. The row renders normally with a duration warning glyph in the player cell and the tooltip states the recorded duration. It is **excluded from the reference set**, because a 20-minute record drags the squad p95 down. |
| **An athlete has two records for one session**, two units or a re-import that was not superseded. | The board renders one row and a duplicate warning. It does not sum them. `imports.md` owns duplicate resolution and this screen must not paper over it. |
| **Squad of 8**, an academy group or a filtered unit. | Below the 5-athlete floor for a filtered column, tinting is off. The numbers are still useful. |
| **A brand new club with one session ever.** | Reference window has 1 session, so the fallback to session-relative applies and the caption says "Shading vs this session only". |
| **The personal maximum was set by a bad record.** | A spurious 14 m/s spike makes every subsequent `%MAX` read about 60% and the column looks alarming for a year. Mitigated by the validity filter, and by a "recalculate personal maxima" action in `thresholds.md` territory. This is the most likely cause of a support ticket on this screen. |
| **Positional groups do not exist in the organisation.** | Every athlete lands in `UNASSIGNED`, which renders as one ungrouped list. The board is still correct. A prompt links to `groups.md`: "Create positional groups to group this report". |
| **An athlete left the club mid-window.** | Their historic rows still render on historic dates, because the data is a fact about that session. They are excluded from today's board. |
| **A vendor exports HSR in yards.** | Handled at import by `07-integrations.md` unit detection, not here. If it slips through, the p95 is wrong and every tint is wrong, which is why the validation ranges in `07-integrations.md` §3.8 are load-bearing for this screen and not only for the import screen. |
| **All 24 athletes have identical `%MAX` of 100%.** | Almost certainly a personal-maximum computation that is reading the session's own maximum. Guard: if more than 80% of the population reads exactly 100%, suppress the column and render "Personal maxima look wrong". A silently self-referential percentage is the worst failure available on this screen because it looks plausible. |
| **Dark theme.** | Separate alpha table. The pink and green ramps both need re-verifying against `#171e36`; the dark green solid fill with green text in the screenshot is the one treatment most likely to fail contrast. |

---

## Performance notes

| Concern | Approach |
|---|---|
| Board size | 24 to 45 athletes by 7 columns. Trivial. No virtualisation, no windowing. If a squad exceeds 120, revisit. |
| The reference query is the expensive one | A p95 over 28 days of `gps_records` for the organisation. At 40 athletes and 5 sessions a week that is roughly 800 rows, which `percentile_cont` handles in single-digit milliseconds with the covering index above. It is cached for an hour and shared across all date chips, so flicking between dates does not recompute it. |
| Tint computation | Client-side over the fetched set. Band assignment is arithmetic on 168 numbers. Memoise per column so a sort does not recompute bands. |
| Payload | 24 rows by 7 metrics plus grouping, about 12 KB uncompressed. |
| Date chips | One query, distinct dates with a record count, capped at the chip limit plus one to decide whether "more" is needed. |
| Budget | Well inside the 150 ms p95 server budget in `05-architecture.md` §11. This screen is not a performance risk; the correctness of the reference is the risk. |
| Measurement | Spans `trainingReport.board.query` and `trainingReport.reference.query`. Alert if the reference exceeds 200 ms, which would mean the index is not being used. |

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Table semantics | A real `<table>` with `<th scope="col">` on every metric header and `<th scope="row">` on the player name. Positional units are `<tbody>` elements with a caption row, not styled divs. |
| Colour is never the only channel | Every tinted cell renders its number. The number is the primary channel and the tint is redundant. This is the condition `06-design-system.md` §1.4 requires and this screen meets it. |
| Cell label | `{player}, {metric}: {value} {unit}. Band {n} of 5, {reference}.` Example: "Reid Mason, high speed running: 642 metres. Band 5 of 5, versus squad last 28 days, n equals 412." |
| Untinted cell label | Value and unit only. No band phrase, so a screen reader user can tell which columns are shaded. |
| Missing cell label | "No data", never "zero". |
| Suppressed shading | Announced once per column via the header footnote, not repeated per cell. |
| Contrast | Every band in both themes keeps `--text` at 4.5:1 or better. **The `%MAX` solid dark green fill with green text in the screenshot needs verifying and is the most likely existing failure**, because a light green on a dark green is a narrow band to land 4.5:1 in. If it fails, the fix is to lighten the text rather than to lighten the fill, which would collapse the ramp. |
| Colour vision deficiency | Blue for `HSR` and pink for `HIE` are separable under deuteranope and protanope simulation; green for `%MAX` against pink is the weaker pair. They are never adjacent columns in the screenshot, which helps, and the numbers make it moot. Verified by a greyscale snapshot test of the full board. |
| Focus, keyboard | Arrow keys move between cells, `Home` and `End` move to row edges, `Enter` drills into the athlete. Focus ring 2 pt at 2 pt offset, visible on a tinted cell in both themes. |
| Dynamic type | At 150% the board scrolls horizontally with the player column frozen. At 200% it offers a per-athlete card list, the same alternative `06-design-system.md` §8.6 requires for charts. |
| Sort announcement | "Sorted by high speed running, descending, within positional unit." |
| Print | One portrait A4 up to 30 athletes. Bands survive greyscale by fill proportion because there are five of them and not a continuous ramp. This is a reason to keep the bands discrete. |

---

## Open questions

- **O-700**: Why are `TD` and `RUN` untinted while `HSR`, `HIE`, and `%MAX` are tinted? I have
  read it as volume versus intensity and recommend keeping that rule. If it was simply
  unfinished, say so, because "tint everything" is a materially worse board and I would argue
  against it.
- **O-701**: `%MAX` uses a green ramp and `HIE` uses pink. `06-design-system.md` §8.4 says
  sequential data uses a single-hue ramp from `chart.band` to `accent.solid` and no other. The
  built app already breaks that rule. Either the rule changes to allow one hue per metric family,
  or the screen changes. I recommend changing the rule, because per-column hue genuinely helps
  when three shaded columns sit side by side, but that is a design system amendment and it needs
  your decision, not mine.
- **O-702**: The group filter is not visible on this screen. `CLAUDE.md` §3 makes it mandatory on
  every multi-athlete screen. Is it out of frame, or is it missing? If missing, it is a defect
  against a non-negotiable rule.
- **O-703**: Is the shading computed against **this session's** athletes or against a **rolling
  squad reference**? The screenshot cannot distinguish them. I recommend a 28-day squad
  reference so that colour means the same thing on every date. This is the single most important
  question on this screen: it decides whether the board can be compared across dates at all.
- **O-704**: What is `RUN`? It needs a definition, a velocity threshold, and a home. I have
  specified a new `running_distance_m` column. Confirm the threshold, because "running distance"
  is vendor-specific and Fydr must record which band it stored.
- **O-705**: What is `HIE` counting, and above what threshold? Accelerations only, accelerations
  plus decelerations, velocity-band entries, or a vendor's own composite? A new
  `high_intensity_efforts` column is specified. It must not be silently mapped onto
  `accelerations`.
- **O-706**: `MAXV` displays in km/h and stores in m/s. Is km/h the club's preference, is it
  per-organisation, or is it hard-coded? A second format key is needed either way.
- **O-707**: Where does the personal maximum behind `%MAX` come from? Rolling 12-month GPS
  maximum, all-time GPS maximum, or a tested sprint maximum from `test_results`? I recommend
  rolling 12 months with a validity filter and a tested fallback. Each option produces different
  numbers on the same session, and coaches will act on them.
- **O-708**: What is the `AVG TD` delta compared against? Previous date chip, previous session of
  the same type, or the 28-day mean for the same MD-n? A `+3%` with no stated comparator is the
  kind of number that gets quoted in a meeting and cannot be defended.
- **O-709**: How many date chips, and how does a coach reach an older session? Three are visible
  and they are not consecutive, so they are dates with data. There is no visible "more" control
  and no date picker.
- **O-710**: Should each positional unit have a subtotal or mean row? Not present in the
  screenshot, and it is the first thing a forwards coach will ask for. It is also the point at
  which the small-population rules start to bite, because a front row of three is below the
  shading floor.
- **O-711**: Are the positional unit headers interactive? Collapsing them is useful at 45
  athletes and pointless at 24. Not determinable from the screenshot.
- **O-712**: Confirm the default row order within a unit. `TD` descending fits every visible
  group, but squad number and alphabetical both also fit a coincidence at ten rows.
- **O-713**: What does `FLAGGED` count? GPS-domain flags against this session, or every open flag
  on that date across all domains? I recommend the former, because a wellness flag on a load
  board sends a coach to the wrong screen.
- **O-714**: Is there an export on this screen? None is visible. Coaches will want the board as a
  PDF for a Monday meeting, and if it exists it must be audited per
  `09-security-and-compliance.md` §8.5.
- **O-715**: How are two training sessions on one day handled? The date chips cannot express it
  as drawn. I have specified session-level chips. Summing a day changes what `MAXV` means and
  should not be the answer.

---

## Related documents

- The real navigation this screen sits in → `02-information-architecture.md` §4.1
- Where the data comes from → `imports.md`, `07-integrations.md`
- The table it is built on → `04-data-model.md` §8
- Tint, ramps, and the second-channel rule → `06-design-system.md` §8.4, §1.4
- Minimum populations for any shaded or aggregated statistic → `06-design-system.md` §8.5
- Per-athlete detail behind a row → `athlete-profile.md`
- Why GPS may no longer be a Phase 3 concern → `10-roadmap.md`
- The flags counted in the fourth tile → `flags.md`, `thresholds.md`
