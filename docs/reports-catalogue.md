# Fydr report catalogue — working copy

**Status.** Reconciled 13 September 2026 against `docs/reports-catalogue-source.md`,
Isabella's catalogue (the source of truth; not edited here — anything wrong in it is
raised on `docs/design-decisions-outstanding.md`), including its 13 September
addendum. Same shape as the source, one row per report — **seven** since the
addendum: the training report is two (the GPS report, premium; the Training load
report, every club). Every definition sentence below is the source's exact wording,
confirmed; the builder's two drafts for compliance and injury and availability are
superseded by the addendum's confirmed sentences. `src/lib/reportCatalogue.ts`
mirrors the sentences here verbatim and `scripts/test-report-catalogue.ts` fails on
drift.

The rules that apply to all reports are the source's ("Rules that apply to all five")
and are not repeated. **All seven reports lead with one emphasised figure card**
(PATTERN-S7 C1, 13 Sept — `components/ReportFigure`: the count before the percentage,
the sample, the exclusions in a full sentence), on screen and in their PDFs. **Every report's main table sits in the one `TableShell`**
(`components/TableShell`, 13 Sept): the title, the sort order in words where the table is a
ranking ("Worst first — the athlete to chase is at the top"), the count with its
denominator, and a body that scrolls sideways on a phone rather than the page. The shell is PATTERN-S7's; the figure grammar is C2
(`lib/reportFigures.ts`); the empty-state grammar is PATTERN-S6 C8
(`lib/staffEmpty.ts`).

---

## 1. GPS report — `/reports/gps` *(was "Training report" at `/reports/training`; premium)*

- **Definition sentence (CONFIRMED, the addendum, 13 Sept 2026):** "Per-session GPS totals for each athlete, from the files imported for that session. An athlete with no GPS file for a session shows as no record, never as zero."
- **The split (the addendum), built 13 Sept:** the per-session GPS board is the **GPS report**, premium, at `/reports/gps` (the match board at `?mode=match`); the RPE × minutes report the source's original row described is the **Training load report**, row 8 below, every club, the seventh, at `/reports/training-load`. Neither keeps the name "Training report", because that name was the ambiguity: `/reports/training` is a permanent redirect to `/reports/gps` carrying the query, for old links. The report key is `gps` (audit rows before 13 Sept say `training`); the exports are `gps-report-<date>.csv` / `.pdf`.
- **Open (answered from the code, 13 Sept):** load is derived, not stored — MET-007 (RPE × minutes) from the athlete's rating; a week template's "load 2,910" is the planned load, Σ `duration_min × planned_rpe` over the template's sessions, computed on render (`weekTotalLoad`); `sessions.planned_load` exists as a column and is written and read by nothing.

## 2. Match report — `/reports/match`

- **Definition sentence (CONFIRMED by Isabella, `docs/decisions/decision-batch-2026-09-13.md` "The match report, both halves approved", 14 Sept 2026; supersedes the source's draft now that participation is captured):** "Everything recorded against {fixture}: who was selected, who started, who came on, and minutes played, with each athlete's availability as it stood at kick-off. An athlete with no minutes recorded shows as not recorded, never as zero." — resolved on screen and in both exports with the fixture as "v {opponent}, {date}".
- **Built against it (15 Sept):** the eighth report, every club, at `/reports/match?fixture=` (`docs/screens/67-match-report.md`), reading the coach's post-match sheet on the fixture (`match_participation`, migration 0127): one row per athlete selected — started, came on, minutes (null is "not recorded", never 0; 0 is a real value). Availability at kick-off is not stored: the report reads the availability row in force at `kickoff_at`. The figure is minutes recorded of the athletes selected, with the selection over the squad and the not-selected count as the exclusions. The GPS match board stays where it was, `/reports/gps?mode=match`, premium, under the GPS sentence.
- **Answered from the code (13 Sept, now closed):** the app did **not** record who played or minutes — it recorded attendance at a session (`session_attendance`) and the week's team allocation. The sheet is the answer: the smallest thing that makes the report real, and the thing a coach will actually fill in on a Sunday. Nothing else — no positions, no events, no score.

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

## 6. Compliance — `/reports/compliance`

**The question:** how much of the picture does the club actually have?

- **Shape:** who submitted what was expected of them, over a period. Rows are athletes; a by-day grid beneath.
- **Definition sentence (CONFIRMED, the addendum, 13 Sept 2026):** "The share of expected entries that were submitted, over the period. An entry counts as expected only where the schedule or the club's settings asked for one, so a day nobody was asked about is not counted against anybody."
- **The rule that comes with it (the addendum):** compliance spans wellness, RPE and nutrition, and RPE can be switched off, so one club's denominator is not another's — **the report must state which entry types it counted.** Built with the RPE club setting.
- **Roles:** sport scientist, coach, medic, S&C; the nutritionist sees the nutrition domain only.
- **Figure:** submitted of expected, the count before the percentage, summed over the domains that expect anything; waived days excluded and named. Nothing expected reads "Not expected", never "0 of 0".
- **Chart:** none — the by-day grid is the picture.
- **Sort:** worst first, and the header says so.
- **Export:** CSV and PDF with the definition in the header.

## 7. Injury and availability — `/reports/injuries`

**The question:** who is unavailable, for how long, and where are injuries happening?

- **Shape:** the squad's availability now, injuries over a period. Three figures, no chart.
- **Definition sentence (CONFIRMED, the addendum, 13 Sept 2026; corrected by Isabella's ruling of 14 Sept, decision batch #5):** "Every injury open at any point in the period, with each athlete's availability as it stands today. Diagnosis, mechanism and severity appear only in the medic's copy; clinical notes are in no export." The source catalogue's line still reads "diagnosis, mechanism and clinical notes" — it predates the ruling.
- **The medic's copy (built 14 Sept 2026):** three columns after Expected return — Diagnosis, Mechanism, Severity — read from `injury_clinical` through the medic-only policy for the open injuries in the Current list. Clinical notes stay out of every export: free text a physio types, which can carry a third party's name, a guess, or something about a player's family, and an export is the thing that leaves the club. The coach's copy is unchanged (eight columns, no clinical field).
- **Roles:** medic (clinical columns), sport scientist, coach, S&C (status word, restriction line, expected return only). The nutritionist cannot open it.
- **Figure:** available now of the roster, the count before the percentage; days lost and new injuries beneath it; athletes with no recorded status and athletes who joined in the period named as exclusions.
- **Chart:** none — the body-area table stands in for it.
- **Sort:** by expected return, soonest first; unknown returns last and said so.
- **Export:** CSV and PDF with the definition in the header; a medical export carries the confidentiality line (PATTERN-S7 C3, on the sheet).

## 8. Training load report — `/reports/training-load` *(the seventh, every club; built 13 Sept 2026)*

**The question:** how much training load has each athlete carried?

- **Definition sentence (CONFIRMED, the addendum, 13 Sept 2026):** "Session load is RPE multiplied by session minutes, summed over the period. Only sessions an athlete was expected at are counted, and a session with no rating is not counted as zero."
- **Off state (CONFIRMED), since RPE is a club setting:** "This club does not collect session RPE, so there is no load to report. A sport scientist can switch it on in Settings." — setting-driven absence keeps the destination (`docs/decisions/absence-rule.md`): the page, the CSV and the PDF all keep their address and carry the sentence, with a link to Settings › Club; the hub card says so too.
- **Built against it:** "expected at" is a `compliance_expectations` row, domain `training_rpe`, not waived — the same rows the compliance report counts, so the two reports agree about who was asked; the load is `training_entries.session_load` (MET-007) read through the current-revision view, so a coach's correction is what is summed; an athlete with nothing rated reads "No ratings", never 0, and an unrated session is left out of every sum (a rating of 0, rest, is a real load of 0 and is counted). Screen: `docs/screens/23-training-load-report.md`; query: `src/lib/queries/trainingLoadReport.ts`.
- **Roles:** sport scientist, coach, medic, S&C (`REPORT_ACCESS`); the nutritionist cannot open it.
- **Figure:** sessions rated of expected — the denominator every sum rests on — the count before the percentage, with the squad's summed load in the sample; the unrated sessions as the exclusions.
- **Chart:** none — the ranked table is the picture.
- **Sort:** highest load first; athletes with no rating last, and the header says so.
- **Period:** week, month (default), season, year, all; `day` refused with its reason; `?to=` walks the window (the compliance report's anchor rule).
- **Export:** CSV and PDF with the definition in the header, "No ratings" as words.
