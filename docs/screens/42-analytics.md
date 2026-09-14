# 42. Analytics

## 1. Page name and URL

**Analytics**, at `/analytics`.

Four fixed panels of bars — **Training load**, **Wellness**, **Gym volume**,
**Acute to chronic** — one athlete against the squad's spread, or against the
club's zone where one is set; or two athletes side by side. **Premium package
only, and sport scientist only.** PATTERN-S7 C6, built 14 September 2026 from
`docs/designs/PATTERN-S7-final /` (artboards 9–11); it replaced the four
day-only boards with their metric dropdowns, and the builder at
`/analytics/build` (D2: it stayed until C6 replaced it).

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The four panels | The athlete, the comparison, the window, the group filter | None | **Premium** | Route guard (`refuse`, logged), then the package check in `src/app/(staff)/analytics/page.tsx` |
| Coach, Medic, S&C, Nutritionist | **No** — the denied screen | Nothing | Nothing | The whole page | **Premium** | `ANALYTICS = ['sport_scientist']` (D-02, confirmed 2026-09-05) |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This is the only whole destination that disappears from the sidebar on the Base
package** (`src/components/Sidebar/Sidebar.tsx`). The address refuses too.

## 3. How you get here

- Analytics, the eighth sidebar item, on Premium only.

## 4. What you see

The header: the group scope and the club as the eyebrow; the **Athlete** select,
the **Compared with** select (only while comparing), the **Window** select (14
days · 6 weeks · 12 weeks · 26 weeks, default 12 weeks) and **Compare two** as a
pressed chip. Then **Compare against**: the global group filter and "n = 29 ·
whole squad" — the population every ground is computed from (CLAUDE.md §3; the
filter is one selection that persists across screens, not a second screen-local
one).

**Four panels, two by two** (one column below 1100px), each a card:

- **The title** and, right, who is drawn ("Okonkwo", "Okonkwo and Aholelei").
- **The definition line**, one sentence under the title and never a tooltip:
  what the bar measures with its registry ID, the window in dates, the grain
  and how a week is collapsed, and the ground with its n — "Session load — RPE
  × minutes (MET-007), summed across every session logged · last 84 days, Tue
  23 Jun to Mon 14 Sept · one bar per week, the week summed · ground: the
  squad's mean ± 1 SD per week, n = 28 athletes with data in whole squad."
- **The figure**: the latest bar's value and its period, printed, with "full
  detail in the athlete report" — so no value on this screen is on hover alone.
- **The plot**: zero-based bars in `--accent`, one per period; the ground
  behind them — the squad's mean ± 1 SD per period as two dashed `--tick`
  edges (absent for a period with fewer than five athletes with data, the one
  squad floor, `lib/smallSample.ts`), or the club's zone as a `--track` fill
  with dashed edges; a 2px dashed stub on the baseline where the period has
  nothing. In a comparison both series are the same accent and each is named
  at the end of its own bars, at the height of its last value — no second hue,
  no key to hold in the head.
- **The period labels** (first, middle, last) and **the axis line in words**:
  "Axis 0 to 5,000 AU · one bar per week · hover or tap a bar for its value".
- **A visually-hidden table** of every bar's value and the band, for readers
  without a pointer.

**The readout.** Hovering a bar shows a chip with its period and value
("Mon 6 Jul to Sun 12 Jul · 665 AU"; in a comparison both names and values);
leaving hides it. Tapping a bar shows the same chip and it stays until the
reader taps the bar again or anywhere else in the plot. Nothing else moves: no
crosshair, no animation, no reflow. A period with nothing reads its measure's
own words — "Not submitted" (wellness), "No session logged" (load), "No gym
session" (volume), "Not enough days on record" (ratio) — never a zero.

**The grain.** One bar per day up to a fortnight (the 14-day window), one bar
per week beyond it. A week bar is summed for a volume measure, meaned for a
scored one, and for the ratio it is the value standing at the end of the week —
`docs/metrics.md`'s preamble records the rule; the definition line says which.

**The club's zone.** Drawn only when the club has set a fixed rule on the
panel's measure (an active, club-wide *below* or *above* threshold on
`wellness.readiness_score` or `load.acwr`; a rule read against a personal
baseline or a z-score is not a line on a shared axis and draws nothing). Named
and dated in the definition line — "ground: the club's zone, 0 to 1.30 · Acute
chronic ratio high · set by Mark Iremonger, Sun 13 Sept" — and where a zone is
drawn the squad band is not. No default 1.5 line, ever. Training load and gym
volume have no threshold metric and always show the band.

**Suppression.** Below three bars with a value the panel is withheld and says
why — "Not drawn: Dan Okonkwo has 2 weeks with a value in the last 84 days,
out of 13 — fewer than 3. Nothing here is estimated from less." — with one
44px action: **Widen the window** while a wider one exists, otherwise **Open
{name}'s report**.

**No export.** The caption under the panels says so: a question worth keeping
leaves as a report — the athlete report, the squad weekly or the training load
report carry a definition, a row count, a print layout and an audit row.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-007 | Training load, AU | Session load, RPE × minutes, summed over the period | The window, by day or week | A dashed stub: "No session logged" |
| MET-002 | Wellness | Readiness 0–100, the strict version; a day missing any answer has no value | The window, meaned per week | "Not submitted" |
| MET-041 | Gym volume, kg | Tonnage, load × reps across working sets, summed over the period | The window, by day or week | "No gym session" |
| MET-010 | Acute to chronic | The last 7 days of load over the last 28, as it stood at the end of the period | The window | "Not enough days on record" (21 of 28 days needed) |
| — | The squad's mean ± 1 SD | Across the athletes in scope with a value in that period | Per period | Absent below five athletes with data |
| — | n = {k} athletes with data | Athletes in scope with any value in the window | The window | "ground: none — {k} athletes with data, fewer than 5" |
| — | The club's zone | The fixed threshold(s) on the panel's measure | Now | Absent: no default |

**Readiness here is MET-002, the strict version**, as on every analytics
surface (D1 "out of 5" declined; ATH-ADULT-12 D5). The athlete's own screens
show MET-001.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Athlete | Header | Draws that athlete | `?a=` | Nothing | Sport scientist | None | Never |
| Compare two | Header | Adds a second athlete, named at the end of their bars | `?compare=1` | Nothing | Sport scientist | None | Never |
| Compared with | Header | Chooses the second athlete | `?b=` | Nothing | Sport scientist | None | Not comparing |
| Window | Header | 14 days · 6 weeks · 12 weeks · 26 weeks; the grain follows | `?w=` | Nothing | Sport scientist | None | Never |
| Group filter chips | Compare against | Narrows the population every ground is computed from | Stays here; the shared cookie | Nothing | Sport scientist | None | Never |
| A bar (hover / tap) | The plot | Shows the readout; a tap pins it | Stays here | Nothing | Sport scientist | None | Never |
| Widen the window / Open {name}'s report | A withheld panel | The one action | `?w=` wider, or `/reports/athlete/[id]` | Nothing | Sport scientist | None | The panel is drawn |
| full detail in the athlete report | The figure line | Opens the report | `/reports/athlete/[id]` | Nothing | Sport scientist | None | No value in the window |

**There is no export and no builder.**

## 7. How this page is built, in plain English

Built on the server; the plot is a client component (`AnalyticsPanel`) that
holds only the readout. Every panel reads the whole scope once through
`fetchPerAthleteDaily` (`src/lib/queries/analytics.ts`) — one daily value per
athlete per day, the same collapse, ACWR trailing ratio and `in_data`
denominator every analytics read has used — and `src/lib/analyticsPanels.ts`
buckets those maps into bars, the squad band, the zone, the axis and the words.
Weeks run Monday to Sunday, clipped to the window at both ends so a bar never
counts a day outside it. ACWR still fetches its 28-day run-up so the first bar
is real.

## 8. States

**Base package.** The destination is absent from the sidebar and the address
refuses. **Not the sport scientist.** The denied screen, logged. **Nobody in
scope.** Says so. **A withheld panel.** Its reason and one action (§4).
**Session RPE off for this club** (`organisations.collects_rpe`, migration
0118): Training load and Acute to chronic keep their cards and say "This club
does not collect session RPE, so … has nothing to show. A sport scientist can
switch it on in Settings › Club."; Wellness and Gym volume draw. **Ground
withheld.** Under five athletes with data in a period the band's edges are
absent for that period, and under five in the window the definition line says
"ground: none — {k} athletes with data, fewer than 5". **Offline.** Not handled.

## 9. Open issues

- The Training load panel measures session load (MET-007), the same load the
  ratio rests on; the previous boards charted GPS distance under that title.
  GPS distance stays on the GPS report. Recorded on the sheet for a decision.
- A group-scoped threshold (`applies_to_group_id`) is not drawn as a zone; only
  club-wide fixed rules are. If a club wants group zones, the rule in
  `zoneFor` widens to "the rule scoped to the current group filter".
