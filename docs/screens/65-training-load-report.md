# 65. Training load report

## 1. Page name and URL

**Training load report**, at `/reports/training-load`. **The seventh report**
(Isabella's catalogue addendum, 13 September 2026, `docs/reports-catalogue.md`
row 8): the RPE × minutes report the catalogue's original training row described
and which had never been built. Available to **every club** — session RPE times
session minutes is the only load measure the base tier has, GPS being premium
(`docs/decisions/decision-batch-2026-09-13.md`). Built 13 September 2026.

How much training load each athlete has carried over a period, from their own
session ratings.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Nothing. Exports only | None | Base | `requireReport('trainingLoad')`, `src/lib/session.ts`; `REPORT_VISIBILITY.trainingLoad = REPORT_ACCESS` |
| Coach | Yes | Everything | Nothing. Exports only | None | Base | Same |
| Medic | Yes | Everything | Nothing | None | Base | Same |
| S&C | Yes | Everything | Nothing | None | Base | Same |
| Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same grid: the card on the hub is closed with its reason, the address refuses |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** `requireReport('trainingLoad')` on the page,
the CSV route and the PDF route (`scripts/test-report-visibility.ts` walks the
directory and asserts it). Above it the middleware; beneath it row level security
on `compliance_expectations`, `training_entries_current` and `athletes`.

---

## 3. How you get here

- The **Training load** card on the reports hub, in "About the squad over a
  period", tinted to the pitch domain beside the GPS report's card. Every club
  sees it; when the club has session RPE switched off the card's line reads
  "Session RPE is off for this club, so there is no load to report — the report
  says so, and who can switch it on." and still links here
  (`docs/decisions/absence-rule.md`: a setting-driven absence keeps its
  destination).

---

## 4. What you see

**The definition sentence sits above the numbers** (PATTERN-S7 C1; the addendum,
confirmed): "Session load is RPE multiplied by session minutes, summed over the
period. Only sessions an athlete was expected at are counted, and a session with
no rating is not counted as zero." — a `--surf` card under the scope line; it
prints with the page, is the first line of the CSV and the line under the PDF's
title (`lib/reportCatalogue.ts`, `REPORT_DEFINITIONS.trainingLoad`).

**The header** is the shared report header: Back, the group chips, "Reports ·
Training load" with the exports (the export dialog naming the file and its rows,
Export PDF), the title, the scope line ("Whole squad · Ashcombe Rugby Club · Last
28 days · Mon 17 Aug to Sun 13 Sept · 30 athletes"), then the period control with
the window walked both ways ("‹ Previous 28 days", "Next 28 days ›") and the
narrow-window note under it where it applies.

**One emphasised figure leads** (`ReportFigure`, `lib/reportFigureCards.ts`
`trainingLoadFigure`): "Sessions rated of expected" — the count before the
percentage ("412 of 480", "86%"), because a load has no percentage of its own and
this is the denominator every sum beneath rests on; the sample ("30 athletes · last
28 days · squad load 48,310 AU"); the exclusions in a full sentence: "68 expected
sessions with no rating are not counted as zero — they are left out of every sum."
or "Nothing is excluded — every expected session was rated." A club with no
ratings reads "squad load No ratings", never 0.

**The table, in the one TableShell**: "Load by athlete", the sort in words
("Highest load first — the athlete carrying the most is at the top; athletes with
no rating are last"), the count with its denominator ("24 of 30 athletes with a
rating"). Above the rows, the squad mean per athlete when five or more have a
rating (PATTERN-S7 C8); below five, the floor note instead. Columns: Athlete
(linking to the profile) · Rated of expected ("6 of 8", or "Not expected") ·
Total load (AU) ("No ratings" in words for an athlete with nothing rated, "Not
expected" for one expected at nothing) · Per rated session · Heaviest session. On
a phone the rows are cards (`tbl-cards`) and the body scrolls sideways, never the
page. Under the table, the unit: "Load is in arbitrary units (AU): the CR-10
rating, 0 rest to 10 maximal, multiplied by the session's minutes (MET-007). A
rating of 0 is a real value and counts as a load of 0; a session with no rating is
left out of every sum. Ratings corrected by a coach are counted as corrected."

**What "expected at" means here.** A `compliance_expectations` row, domain
`training_rpe`, for that athlete and that session, inside the window, not waived
— the same rows the compliance report counts, so the two reports agree about who
was asked. A rating with no session, or for a session the athlete was not
expected at, is real data (My data shows it; the ACWR sums it) but is not this
report's. The load is `training_entries.session_load` (MET-007) read through the
current-revision view, so a coach's correction is what is summed.

---

## 5. Every number on this page

| Metric ID | Label on screen | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-007 | Total load (AU) | Σ (RPE × minutes) over the athlete's rated expected sessions | The period | "No ratings" (nothing rated), "Not expected" (expected at nothing) — never 0 |
| MET-007 | Per rated session | Total load ÷ sessions rated | The period | "—" |
| MET-007 | Heaviest session | The single largest session load | The period | "—" |
| None | Rated of expected | Sessions with a rating, of sessions expected | The period | "Not expected" |
| None | Sessions rated of expected (the figure) | The squad's sum of the above, with its percentage | The period | "Nothing expected" · "Not expected" |
| None | Squad load | Σ total load over athletes with a rating | The period | "No ratings" |
| None | Squad mean | Squad load ÷ athletes with a rating | The period | Absent below five athletes with a rating; the floor note says so |

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group chips | Header | Scope every number | Stays, `?groups=` | The shared filter cookie | Any role that can open the page | None | Never |
| Period select | Header, right | Changes the window length | Stays, `?period=` | The sticky period cookie when picked | Same | None | `day` is offered disabled with its reason |
| ‹ Previous · Next › | Beside the period | Walks the window by its own length | Stays, `?to=` | Nothing | Same | None | Next, past real today; both, for season/year/all |
| Jump to today instead | Under the scope line | Ends the window on real today | Stays, `?to=` | Nothing | Same | None | Unless the report opened on the most recent day with data |
| Export CSV | Header | Names the file and its rows, then downloads | `/reports/training-load/export` | An audit row (`trainingLoad`, export) | Same | The dialog | Never |
| Export PDF | Header | Downloads the PDF | `/reports/training-load/pdf` | An audit row | Same | None | Never |
| An athlete's name | The table | Opens the profile | `/squad/[id]` | Nothing | Same | None | Never |
| Open Settings › Club | The off state | Opens the setting | `/settings/club#rpe` | Nothing | Any role (the switch itself is the sport scientist's) | None | Unless session RPE is off |

Every open — the page, the CSV, the PDF, the off state — writes an audit row: a
report is a data disclosure.

---

## 7. How this page is built, in plain English

`src/app/(staff)/reports/training-load/page.tsx`, its colocated `period.ts`
(week, month by default, season, year, all; `day` refused with its reason; the
day anchor `?to=` and the window `?period=` orthogonal, the compliance report's
rule, anchored to the most recent day with an expectation when no `?to=` is
given), `export/route.ts` and `pdf/route.tsx`, all three reading
`src/lib/queries/trainingLoadReport.ts`. The query reads the required RPE
expectations and the current training entries for the athletes in scope, both
paged past PostgREST's ceiling, keeps only the entries whose (athlete, session)
is in the expected set, and sums; it never converts an absent rating to 0.

---

## 8. States

**Session RPE is off for this club** (`organisations.collects_rpe`, Settings ›
Club, migration 0118). The destination stays: the header and the definition
sentence, then an empty state headed "Session RPE is off for this club" carrying
the addendum's confirmed off state — "This club does not collect session RPE, so
there is no load to report. A sport scientist can switch it on in Settings." —
and a link to Settings › Club. Nothing is queried. The CSV is its caption and the
same sentence, no rows; the PDF is the header and the sentence. The hub card says
so before the click.

**Nobody in the filter.** The figure reads "Nobody in this filter"; the empty
state names the scope.

**No session expected a rating in the period.** The figure reads "Nothing
expected"; the empty state says so with the count and the window, and that
nothing is missing — a session enters here the day it is published with a
rating expected.

**Nothing rated.** The table stands, every load column reads "No ratings", the
figure's exclusions name the unrated sessions.

**Fewer than five athletes with a rating.** No squad mean; the floor note says
so; the rows are unchanged.

**Loading.** Renders when ready. **Offline.** Not handled.

---

## 9. Open issues

- The compliance report and this one read the same expectation rows; a session
  published without "requires RPE" is in neither. Whether a club that has RPE on
  but a session type that never expects one wants that session's rating counted
  here if an athlete rates it anyway — today it is not, by the definition.
