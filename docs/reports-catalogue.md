# Fydr report catalogue — working copy

**Status.** Reconciled 13 September 2026 against `docs/reports-catalogue-source.md`,
Isabella's catalogue (the source of truth; not edited here — anything wrong in it is
raised on `docs/design-decisions-outstanding.md`). Same shape as the source, one row
per report. The definition sentences below are the source's exact wording where the
source confirms them; the two reports the source does not cover (compliance, injury
and availability) carry rows **drafted by the builder, pending Isabella's
confirmation**. `src/lib/reportCatalogue.ts` mirrors the sentences here verbatim and
`scripts/test-report-catalogue.ts` fails on drift.

The rules that apply to all reports are the source's ("Rules that apply to all five")
and are not repeated. **All six reports lead with one emphasised figure card**
(PATTERN-S7 C1, 13 Sept — `components/ReportFigure`: the count before the percentage,
the sample, the exclusions in a full sentence), on screen and in their PDFs. **Every report's main table sits in the one `TableShell`**
(`components/TableShell`, 13 Sept): the title, the sort order in words where the table is a
ranking ("Worst first — the athlete to chase is at the top"), the count with its
denominator, and a body that scrolls sideways on a phone rather than the page. The shell is PATTERN-S7's; the figure grammar is C2
(`lib/reportFigures.ts`); the empty-state grammar is PATTERN-S6 C8
(`lib/staffEmpty.ts`).

---

## 1. Training report — `/reports/training`

- **Definition sentence (CONFIRMED by Isabella, 13 Sept 2026):** "Session load is RPE multiplied by session minutes, summed over the period. Only sessions an athlete was expected at are counted, and a session with no rating is not counted as zero."
- **Not on the built page, raised on the sheet.** `/reports/training` as built is the per-session GPS board (MET-017/018/019/021 and the MET-026 dials; premium) — it shows no RPE × minutes load and no load by week. The confirmed sentence describes a longitudinal RPE-load report the app has as an Analytics board, not as a report. Until Isabella rules (the sheet: "the catalogue's training report is not the built GPS board"), the GPS board carries no definition card; the builder's drafted GPS sentence is withdrawn.
- **Open (answered from the code, 13 Sept):** load is derived, not stored — MET-007 (RPE × minutes) from the athlete's rating; a week template's "load 2,910" is the planned load, Σ `duration_min × planned_rpe` over the template's sessions, computed on render (`weekTotalLoad`); `sessions.planned_load` exists as a column and is written and read by nothing.

## 2. Match report — `/reports/training?mode=match`

- **Definition sentence:** ON HOLD (the source). No card on the match board until it is written.
- **Open, answered from the code (13 Sept):** the app does **not** record who played or minutes. It records attendance at a session (`session_attendance`: full / modified / absent / excused with a non-clinical reason, written by a coach from the timetable) and the week's team allocation (`team_allocations`, the published selection list). No column anywhere holds minutes played, starters, bench or substitutions; `fixtures.result` is free text. GPS `duration_s` per athlete is a proxy for time on the pitch only where a unit was worn (premium). By the source's own rule the report is therefore availability plus RPE plus GPS, and must say so rather than show blank columns.

## 3. Squad weekly report — `/reports/squad`

- **Definition sentence (CONFIRMED, 13 Sept 2026):** "The week Monday to Sunday, club local time. Each section states its own denominator."
- **Built against it (13 Sept):** the window is the calendar week Monday to Sunday in the club's timezone (the current week runs Monday to today), the pager moves a week at a time, an old `?to=` link resolves to its week (`lib/squadWeek.ts`). Until 13 Sept the window was a trailing seven days ending today, which made the sentence true only on a Sunday — raised on the sheet and fixed.
- **Automatic send:** NOT BUILT (the source). On demand only, at any point in the week; no scheduler, no outbound email, no distribution list.
- **Open (answered from the code, 13 Sept):** a shared Monday week boundary exists — `mondayOf` (`lib/queries/schedule.ts`) is the one rule for the schedule grid, the dashboard strip, the timetable, the nutrition check-in (`week_start`, checked at the database as `date_trunc('week')`, on `nutrition_checkins` and `team_allocations`) and My data. RPE has no week of its own: a rating is per session per day, and weeks enter only by aggregation (acute load, trailing seven days). The dashboard's strip draws Monday to Saturday, six days.

## 4. Athlete report — `/reports/athlete/[athleteId]`

- **Definition sentence (CONFIRMED, 13 Sept 2026):** "Everything recorded for {athlete} between {start} and {end}. Sections with no data say so rather than showing zeros." — resolved on screen and in both exports with the athlete's name and the period's dates.
- **Athlete self-export:** NOT BUILT (the source). Athletes export no report; they ask a coach or sport scientist out of band. The athlete app's "Export my data" (`/me/export`) is removed under that decision and the removal recorded in `docs/athlete/screens/12-me.md`.
- **Open:** under-18 recipients — Isabella's, tied to the DPA work.

## 5. Testing report — `/reports/testing`

- **Definition sentence (CONFIRMED, 13 Sept 2026):** "The most recent result for each test inside the period. A test with no result in the window is not shown as zero, and an athlete who has never been assigned a test does not appear for it."
- **Open (answered from the code, 13 Sept):** tests are **not** assigned. `test_definitions` is what the club measures, org-wide; `test_results` is one athlete's result for one test on one date; there is no assignment entity and no group or athlete scoping on a definition. "Never assigned" therefore cannot be told apart from "no result": the only fact is whether an athlete has a result for a test at all. On the built page the by-athlete grid shows every athlete in scope for every test (a missing result in words), and the by-test ranking lists only athletes with a result and says how many have none — which is the sense in which an athlete "does not appear for it". The clause is raised on the sheet.

---

## 6. Compliance — `/reports/compliance` *(drafted by the builder, pending Isabella's confirmation)*

**The question:** how much of the picture does the club actually have?

- **Shape:** who submitted what was expected of them, over a period. Rows are athletes; a by-day grid beneath.
- **Definition sentence (draft, builder):** "Who has submitted what was expected of them, and who has not — how much of the picture the club actually has, over the period and group chosen." **Confirm.**
- **Roles:** sport scientist, coach, medic, S&C; the nutritionist sees the nutrition domain only.
- **Figure:** submitted of expected, the count before the percentage, summed over the domains that expect anything; waived days excluded and named. Nothing expected reads "Not expected", never "0 of 0".
- **Chart:** none — the by-day grid is the picture.
- **Sort:** worst first, and the header says so.
- **Export:** CSV and PDF with the definition in the header.

## 7. Injury and availability — `/reports/injuries` *(drafted by the builder, pending Isabella's confirmation)*

**The question:** who is unavailable, for how long, and where are injuries happening?

- **Shape:** the squad's availability now, injuries over a period. Three figures, no chart.
- **Definition sentence (draft, builder):** "Who is unavailable, why in limited terms, when they are expected back, and where injuries are happening, over the period and group chosen." **Confirm.**
- **Roles:** medic (clinical columns), sport scientist, coach, S&C (status word, restriction line, expected return only). The nutritionist cannot open it.
- **Figure:** available now of the roster, the count before the percentage; days lost and new injuries beneath it; athletes with no recorded status and athletes who joined in the period named as exclusions.
- **Chart:** none — the body-area table stands in for it.
- **Sort:** by expected return, soonest first; unknown returns last and said so.
- **Export:** CSV and PDF with the definition in the header; a medical export carries the confidentiality line (PATTERN-S7 C3, on the sheet).
