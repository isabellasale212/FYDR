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

## 3. How you get here

- The Testing card on the reports hub.

---

## 4. What you see

**A header** with the group filter and two download buttons.

**A table**, one row per athlete, one column per test the club has defined.

**A median row**, showing the squad's middle for each test. The median rather than
the average, because one outlying result should not move the line everyone is read
against.

**Where no test has been defined**, the screen says so and offers a way to define
one, rather than showing an empty table with no explanation.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-028 | Each cell | One athlete's result for one test | The most recent, or the period | Blank. An athlete who has not done a test has no result, which is not a zero |
| MET-029 | Where a best is marked | The athlete's best ever for that test | All time | Blank |
| None | Median | The squad's middle value for a test | Across whoever has a result | Absent when too few have results |

**Which direction is better is a property of the test**, not of this screen. For a
sprint the lowest time wins; for a lift the highest weight does. The test's own
definition records which.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the squad | Stays here | Nothing. A cookie remembers it | Report access | None | Never |
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
