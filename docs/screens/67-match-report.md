# 67. Match report

## 1. Page name and URL

**Match report**, at `/reports/match?fixture=`.

The coach's post-match sheet on one fixture, read as a report: who was
selected, who started, who came on, and minutes played, with each athlete's
availability as it stood at kick-off. The eighth report, every club (Isabella,
`docs/decisions/decision-batch-2026-09-13.md`, "The match report, both halves
approved"; built 15 September 2026, migration 0127).

**Definition sentence (confirmed; supersedes the catalogue's draft):**
"Everything recorded against {fixture}: who was selected, who started, who came
on, and minutes played, with each athlete's availability as it stood at
kick-off. An athlete with no minutes recorded shows as not recorded, never as
zero." — resolved with the fixture as "v Harlequins, Sat 18 Jul" on screen, as
the first line of the CSV and under the PDF's title (`lib/matchReport.ts`).

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist, Coach | Yes | The sheet as a report, and the links to fill it in | Nothing here — the sheet is edited on the fixture | None | Base | `requireReport('match')`, `REPORT_VISIBILITY.match = REPORT_ACCESS` |
| Medic, S&C | Yes | The same report | Nothing | None | Base | Same; the database lets every staff role read the sheet |
| Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Not in `REPORT_ACCESS` |
| Athlete | **No** here | Their own row is theirs to read at the database (`match_participation_self_select`); no athlete screen shows it yet | Nothing | The page | n/a | Middleware, then guard |

## 3. How you get here

- **Match report** on the Reports index, under "About one athlete, session or
  test" (source: post-match sheet · CSV · PDF).
- **Match report** on a fixture's Post-match sheet card, and "Open the match
  report" on the sheet itself.

## 4. What you see

The report shell (PATTERN-S7 C1): the group filter chips (CLAUDE.md §3 — the
scope narrows the rows and the squad the figure counts over, and rides into
both exports), the eyebrow "Reports · Match", the title, the sub line (the
scope, the club, the fixture, the kick-off, the squad in scope, when the sheet
was last saved and by whom, links to the fixture and — for the coach and the
sport scientist — to fill in or edit the sheet), the definition sentence as a
card, and the **Fixture** control: fixtures that have kicked off, newest first,
each marked "· no sheet" where nothing is recorded; an upcoming fixture has no
sheet by design. Exports top right.

**The figure — Minutes recorded**: "{with minutes} of {selected}" and the
percentage; the sample "{selected} selected of {squad} in the squad · {started}
started, {came on} came on · {fixture}"; the exclusions in a sentence — "{n}
athletes in the squad were not selected and are not counted. An athlete selected
with no minutes recorded counts as selected, not as zero." or "Nobody is
excluded: every athlete in the squad was selected." With no sheet: "No sheet",
"Not recorded", and where the data enters.

**The table — Who played**: one row per athlete selected, starters first, then
who came on, then selected and not used; within a state most minutes first,
not recorded last, then by name. Athlete (linking to the profile, with position
and number), Selection (Started · Came on · Selected, not used), Minutes (the
number, or "Not recorded" — never a zero standing in for an absence; 0 is a real
value and prints as 0), Availability at kick-off (Available · Modified ·
Unavailable · No status recorded, with the restriction line the coach reads).
The caption says minutes are what the coach wrote (MET-042) and that
availability is the record as it stood at kick-off, not today. An athlete on the
sheet who has since left the club stays on the report.

**No sheet for the fixture**: the empty state names the fixture, says nothing is
recorded against it, and offers "Fill in the sheet" (coach, sport scientist) or
"Open the fixture". **No fixture has kicked off**: says so, with the schedule.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-042 | Minutes | Minutes played, as the coach wrote them on the sheet | The fixture | "Not recorded" — never 0 |
| — | Minutes recorded, {a} of {b} | Athletes selected with minutes recorded, over the athletes selected | The fixture | "No sheet" |
| — | {selected} selected of {squad} | The sheet's rows over the roster in scope | The fixture | — |
| MET-013 | Availability at kick-off | The availability row in force at `kickoff_at` | That instant | "No status recorded" |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Fixture | The header's control | Reads another fixture's sheet | `?fixture=` | Nothing | Any report role | None | No fixture has kicked off |
| Group filter chips | Header | Narrows the rows and the squad the figure counts over | Stays here; the shared cookie | Nothing | Any report role | None | Never |
| Export CSV | Header | The dialog names the file, then writes it | `/reports/match/export` | A `report.match.export` audit row with the row count | Any report role | The dialog | Never |
| Export PDF | Header | The same report on paper | `/reports/match/pdf` | A `report.match.export` audit row | Any report role | None | Never |
| Open the fixture · Fill in / Edit the sheet | The sub line, the empty state | Opens the fixture, or the sheet | `/schedule/fixtures/[id]`, `…/participation` | Nothing | The sheet: coach and sport scientist | None | Never (the sheet link: other roles) |
| An athlete's name | The table | Opens the profile | `/squad/[id]` | Nothing | Any report role | None | Never |

Opening the report writes `report.match.view` to the audit log with the fixture
and the group scope, as every report does.

## 7. How this page is built, in plain English

`lib/queries/matchParticipation.ts`: the sheet for a fixture is the roster
(athletes not deleted, not left) joined to `match_participation` rows, plus
athletes on the sheet who have since left, plus availability at kick-off —
`fetchAvailabilityAt`, the availability rows whose window holds `kickoff_at`,
latest `effective_from` per athlete, restrictions through `restrictionLine`
(D1). `scopeSheet` narrows to the group scope. `lib/matchReport.ts` holds the
sentence, the selection words and order, the figure and the minutes words, pure.
The CSV and PDF read the same query and the same words.

## 8. States

**No fixture kicked off.** Says so. **No sheet.** The figure reads "No sheet",
the empty state names the fixture and where the data enters. **Filtered to
nothing.** The scope's roster is zero; the figure says so. **Minutes not
recorded.** Words, per row and in the figure's count. **Availability unknown at
kick-off.** "No status recorded". **Wrong tier.** Not applicable: every club.
**Offline.** Not handled.

## 9. Open issues

- An athlete's own match rows on My data's sessions tab: readable at the
  database, no screen yet.
- The GPS match board (`/reports/gps?mode=match`) and this report are two
  readings of a match; a link between them when both exist is not built.
