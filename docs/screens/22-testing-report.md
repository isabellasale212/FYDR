# 22. Testing report

## 1. Page name and URL

**Testing report**, at `/reports/testing`.

Test results across the squad: where each athlete sits, and what the squad's
middle looks like.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Nothing. Exports only | None | Base | `requireReportAccess`, `src/lib/session.ts:120` |
| Coach | Yes | Everything | Nothing. Exports only | None | Base | Same |
| Medic | Yes | Everything | Nothing | None | Base | Same |
| S&C | Yes | Everything | Nothing | None | Base | **NOT BUILT** |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/reports/testing/page.tsx:33`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Testing card on the reports hub.

---

## 4. What you see

**The definition sentence sits above the numbers** (PATTERN-S7 C1, 13 September
2026, reconciled to Isabella's catalogue the same day; `docs/reports-catalogue.md`):
"The most recent result for each test inside the period. A test with no result in the
window is not shown as zero, and an athlete who has never been assigned a test does not
appear for it." — a `--surf` card under the scope line; it prints with the page and is
the first line of the CSV and the line under the PDF's title. Nothing in the app
assigns a test (the sheet): the by-athlete grid shows every athlete in scope for every
test, and the by-test ranking lists only athletes with a result and says how many have
none.

**The header is one template shared by all five reports** (and specified in
`CHANGELOG-headers-spec.md`). Five rows, always in this order:

1. **Back**, a pill at the top left, to the screen you came from.
2. **The group chips**, Whole squad first with a tick when it is active, then
   the club's own groups. The filter sits above everything now rather than over
   the table, which is the truth: it scopes every number on the screen.
3. **The eyebrow**, where the screen has one, on the left with the **actions**
   on the right.
4. **The title**.
5. **The scope subheading**, directly under the title: who this report covers,
   over what window, and how many athletes. It sits **below** the title rather
   than above it, which is a deliberate change from the canvas: a qualifier
   read before the thing it qualifies is just a string of words.
6. **The tabs** on the left with the **period control** on the right, so the
   control that scopes every tab rides the tab row rather than a row of its own.

**The gap from the header to whatever the screen puts first is 20px on every
one of the six**, set once on the header rather than on each screen's first
block, so they are equal by construction rather than by six numbers agreeing.

**A table**, one row per athlete, one column per test the club has defined.

**A median row**, showing the squad's middle for each test. The median rather than
the average, because one outlying result should not move the line everyone is read
against.

**Where no test has been defined**, the screen says so and offers a way to define
one, rather than showing an empty table with no explanation.

---

**Empty states follow the one grammar** (PATTERN-S6 C8, 13 September 2026;
`lib/staffEmpty.ts`). A test with no result in the window names the most recent
one on record for the scope — "Nothing in the last 28 days. The squad's last test
result was Sat 2 May, 134 days ago. It is still on record, just before the period
chosen. A test result appears here once a member of staff enters one." — with
one action, "Show this season" / "Show all on record", that widens the period
and keeps the test and the filter; with none on record at all, "No test result
on record for the squad. Nothing is missing…". A filter with no athletes reads
the filter grammar on both tabs — "No test result for Leadership. None of the 0
athletes in Leadership is on the roster. Nothing is missing — the filter is what
is empty." — never the nothing-on-record sentence, which would send a coach
looking for a data-entry problem the club does not have; its one action, "Show
the whole squad", clears the filter — the cookie as well as the URL, the way the
chip row's "Clear filter" does (§0ak) — and keeps the period and the test. A
club with no test defined reads "No test defined for the club yet. Nothing is
missing — no test has been defined…" with "Define a test". Never "never".

**Every figure carries its denominator, an exclusions sentence, and words for a
missing value** (PATTERN-S7 C2, 13 September 2026; `lib/reportFigures.ts`). Under
the by-test median, Q1 and Q3: "22 of 30 athletes have a result for this test in
this window; 8 have none and are not ranked." (or "Every one of the 30 athletes
… — nobody is excluded."), with the squad floor (C8) when fewer than five have
data — the three figures then read "Not shown" and the ranking stays; the
longitudinal medians are under the same floor ("n = 3 · fewer than five · Not
shown"). A by-athlete cell with no result in the window reads "No result"; with
no results at all the three figures read "No results" — never a dash.

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-028 | Each cell | One athlete's result for one test | The most recent, or the period | Blank. An athlete who has not done a test has no result, which is not a zero |
| MET-029 | Where a best is marked | **The best attempt on that test date**, not a lifetime best. See D-40 | Per test date | Blank |
| None | Median | The squad's middle value for a test | Across whoever has a result | Absent when too few have results |

**Which direction is better is a property of the test**, not of this screen. For a
sprint the lowest time wins; for a lift the highest weight does. The test's own
definition records which.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Back | Top left of the header | Returns to the screen you came from | Browser history | Nothing | Any staff who can reach the page | None | Never |
| Group chips | Second row of the header | Narrows every number on the screen to a group | Stays here, group in the address | Nothing. A cookie remembers the choice | Same | None | Never |
| An athlete's name | A row | Opens that athlete | `/squad/[athleteId]` | Nothing | Report access | None | Never |
| A result | A cell | Opens that athlete's history for the test | `/testing/[testDefId]/[athleteId]` | Nothing | Report access | None | Blank cells are not links |
| Define a test | Empty state | Opens the testing section to create one | `/testing` | Nothing | Report access | None | Shown only when no test exists |
| Download spreadsheet and PDF | Header | Download the report | Server routes | Record that the report was viewed | Report access | None | Never |

---

## 7. How this page is built, in plain English

Built on the server.

Only results that have not been deleted are read, and a corrected result never
appears alongside the correction that replaced it.

---

## 8. States

**Loading.** Renders when ready.

**No tests defined.** The screen says so and points at defining one. This is the
expected state for a new club, not an error.

**Tests defined but no results.** The table renders with empty cells rather than
collapsing, so it is clear the tests exist and nobody has done them.

**Error.** Surfaces as an error.

**No permission.** Redirected to Settings with a reason.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **The nutritionist should not reach this report.** Decision D-01.
- **UNVERIFIED: how few results are too few for a median**, and whether the
  screen says so or simply omits the row. Files searched:
  `src/app/(staff)/reports/testing/page.tsx`, `src/lib/queries/testing.ts`. This
  matters because a median of two people is not a median.
