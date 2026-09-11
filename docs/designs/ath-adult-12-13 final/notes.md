# ATH-ADULT-12-13 · FINAL: My data and history, notes

Includes the three final fixes: nutrition history mirrors the check-in form, the empty-state copy is corrected, and Tests lists only assigned tests.

## What changed, and on which token

### Pattern

**Five views, five tabs, on the built segmented track.** Sessions and Nutrition stop being cards halfway down the Wellness tab and become tabs of their own, so the one control that claims to enumerate My data now enumerates it. The control keeps the shape it has in the app: a `--surf2` track with the active segment as a white card, resized from three segments to five. All five fit the 343px content width at `--t-body-2xs`. Nothing scrolls, nothing truncates.
`track --surf2 + --r + 4px padding · segment 40px, active --surf + --shadow + --accent + --w-bold, rest --muted`

**Each tab leads with one hero card: figure, delta, plain-English line, chart.** The built hero card answers "what is the number". The pattern adds one factual line under it before any chart. Facts only. Where the data is too thin, the line says that instead.
`card --surf + --shadow · eyebrow --t-num-nano uppercase --faint · figure --font-num / --t-num-hero 48px / --accent · headline --t-card / --w-bold`

**A delta states the change and never judges it.** One arrow, a signed figure, and what it is measured against: "↓ 0.1 vs your 28-day average", "↑ 5 kg this block". Muted ink with the figure in bold. No colour ranks a trend: a lower RPE and a lower readiness do not mean the same thing. Where no comparison is honest, the slot holds a statement: "One week not answered".
`delta --font-num / --t-body-sm / --w-regular / --muted, figure --w-bold / --text · ↑ ↓ only · --on-warn-strong not used on this screen`

**One chart per tab, inside the hero card, accent and neutrals only.** Readiness a line with an end dot, gym progress four bars, RPE eleven bars with this week solid. Older values in `--blue-200`. Axes labelled in words. Nutrition and Tests carry no chart.
`line --accent 2.5px + 4px end dot · bars --blue-200, current --accent · band bounds stated in this panel, not under every chart`

**The usual range is a shaded band, only where the data supports one.** Readiness 3.3 to 4.2, RPE 5.6 to 6.8. The gym chart has no band: rising load has no range to sit in.
`band --wash-accent · never drawn from fewer points than it needs`

**History is a grouped list card with its denominator in the header.** Title left, caption right ("n = 24 of 28 days"), hairline dividers, date over detail, value right-aligned, "See all 28 days →" as the last row. The dividers are the one place this pattern uses a line for structure.
`row 44px min, divider 1px --border · value --font-num / --t-num-lead / --w-bold · see-all row --accent / --w-bold, 44px`

**A missing entry is words, never a dash and never a zero.** "Not submitted", "Not rated", "Not answered", "Not logged" sit in the value column in `--faint`. A dash reads as a low value at a glance. The line skips the day and the caption drops to 24 of 28.
`missing value --t-body-sm / --w-semi / --faint · no dash, no 0`

**An empty period says which period is empty and when the last entry was.** "Nothing in the last 28 days." / "Your last gym session was Thu 13 Aug, 29 days ago. It's still here, just before the period you've chosen." "Show this season" is a button the athlete presses. The period does not widen on its own.
`empty card --surf + --shadow · action Button secondary, full, --hit-lg`

**The state that means never is separate.** Brand-new athlete on All on record: "Nothing on record yet." No action, no fabricated zero.

**The tab bar drops the gold gym glyph.** Every icon inherits the same neutral, only the active item in `--accent`.
`24px icons, all --muted, active --accent · --highlight not used here`

### Screen-specific

**At one step up in text size the tab row wraps, it never clips.** On iOS Larger Text one step up, the labels no longer fit one row at 375px, so the track wraps to 3 + 2 at 44px a row, labels unchanged. If a shorter set is ever needed, the only safe pair is Sessions → RPE and Nutrition → Food, and both should be tested first.
`strip flex-wrap at --t-body-sm, segment flex 1 1 30%, 44px rows · never overflow-x, never ellipsis`

**Nutrition history mirrors the check-in form exactly.** Each week shows the same two questions and answer wording as the approved check-in: "Did you hit your protein target most days?" (Yes, most days / Some days / No) and "How well did you fuel around training?" (1 Very poorly to 5 Very well). A week with no answers reads "Not answered".

**Tests lists only tests assigned to the athlete.** A test type never assigned does not appear. An assigned test with no result reads "Not logged".

**The period sits on the title line.** The current window in `--accent` with a chevron, on the "My data" baseline. In the menu, "Today: one day cannot show your usual range" survives intact. The current option carries the wash and a tick.

**The date is the heading and the summary line is the hero.** "Thu 13 Aug" as h1, "Gym · Lower A · complete" as eyebrow, total volume and session RPE at 48px with their derivations, and "6 sets logged · session RPE 5.8 · 4050 kg total" kept beneath.

**One way back, full width in the footer, named for its destination.** "Back to gym history", secondary variant. The primary halo is reserved for Save correction. Session detail carries no tab bar: it is a pushed screen.

**A corrected set says what it was.** Set 1 reads 102.5 kg × 8 with "Corrected · was 100 kg × 8" in accent on the 3px dense-row bar. Closes §0v at set level.

**And the session says so in the history list.** Tue 1 Sep carries a "Corrected" pill beside its date and the same bar. One marker per session.

**Correcting from history is the logger's panel, not six buttons.** The row is the target. Tapping opens the ATH-ADULT-11 panel. The footer swaps to Save correction (primary) with Cancel ghost.

**Totals are recomputed after a correction, and the screen admits it.** 4070 kg, with "6 sets · recomputed after a correction".

## Needs new token

- `--chart-h: 84px` and `--chart-stroke: 2.5px`. First plotted series in the athlete app. 84px fits inside the hero card with four history rows still visible on a 667px phone. 2.5px matches the built readiness line. Band, series and prior values reuse `--wash-accent`, `--accent`, `--blue-200`. No new colour.
- Nothing else is new. Segmented track, hero card, list card, see-all row and tab bar are the built components resized. The correction panel is the logger's. Markers reuse `--border-accent-w` and `--pill-accent`.

## Open against code

1. Readiness is headlined out of 5 until the 0 to 100 composite's formula, weighting and window are documented. Then swap the hero to that score and restate the band in the same units.
2. "up 5 kg this block" needs dated programme blocks. Fallback: "up 5 kg since 18 Aug".
3. The usual-range band needs a defined statistic, window and minimum n. Data rule 9 applies if a value is ever judged against a band it belongs to.
4. "Your last session was Thu 13 Aug" needs a max(date) query per domain, unfiltered by the period.
5. The corrected marker needs a per-session has_revisions flag.
6. Session totals after a correction: stored or derived? If stored, recompute on revise.
7. RPE "this week" needs a week boundary, shared with the nutrition check-in's Monday week.
8. Weekly check-ins assumed two fixed questions per week. Confirm it is not per club.
9. Tests: distinguish "never assigned" from "no result". A type never assigned should not appear.
