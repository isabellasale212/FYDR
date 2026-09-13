# 21. Squad weekly report

## 1. Page name and URL

**Squad weekly**, at `/reports/squad`.

The squad's week on one page: who has trained how much, how that compares with
their own normal, and who is carrying something.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Nothing. Exports only | The eight clinical fields, which are not on this page anyway | Base | `requireReportAccess`, `src/lib/session.ts:120` |
| Coach | Yes | Everything | Nothing. Exports only | Same | Base | Same |
| Medic | Yes | Everything | Nothing. Exports only | Same | Base | Same |
| S&C | Yes | Everything | Nothing | Same | Base | **NOT BUILT** |
| Nutritionist | Yes | The page **without** the availability and severity columns | Nothing | Availability status, severity, open injury count | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/reports/squad/page.tsx:33`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Squad weekly card on the reports hub.

---

## 4. What you see

**The definition sentence sits above the numbers** (PATTERN-S7 C1, 13 September
2026; `docs/reports-catalogue.md`): "The squad's week on one page: who has trained
how much, how that compares with their own normal, and who is carrying something."
— a `--surf` card under the scope line; it prints with the page and is the first
line of the CSV and the line under the PDF's title.

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

**One row per athlete**, with:

- **Acute**, this week's work
- **Chronic**, a typical week's work for them
- **ACWR**, the ratio of the two
- **Vs baseline**, how this week sits against their own norm
- **Below their own norm**, marking athletes who have done noticeably less than
  usual, which is as much a signal as doing more
- **Open**, how many injuries are open
- **Severity**, in the limited form

**The ratio is coloured against a band**, and the colouring is shared with the
PDF so a number is never green on screen and amber on paper.

---

**Empty states follow the one grammar** (PATTERN-S6 C8, 13 September 2026): an
all-clear on the attention list reads "No open flag on any of the 30 athletes in
the squad. Nothing is missing."; the load table with nobody in the filter reads
the filter grammar (`lib/staffEmpty.ts`, "the filter is what is empty", clear the
filter), and with nobody computable "No ratio computable yet — every athlete in
the squad is still building the 28-day baseline. Nothing is missing."

**Every figure carries its denominator, an exclusions sentence, and words for a
missing value** (PATTERN-S7 C2, 13 September 2026; `lib/reportFigures.ts`). Under
each of the four tiles: "24 of 30 submitted · 2 waived", "over 27 of 30 athletes
with an entry", "3 not fully available", "across 30 athletes"; under the four:
"Nobody is excluded." or the waivers and, when it applies, the squad floor (C8 —
the readiness median is not shown below five athletes with an entry: "Not
shown"; with none, "No entries"). A missing value is words: "Not expected", "No
data" (a load row), "No athletes" — never a dash. The Needing attention list is
ranked worst first.

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-008 | Acute | Work done in the last seven days | 7 days | Withheld with the ratio |
| MET-009 | Chronic | What a normal week looks like for this athlete | 28 days, expressed per week | Withheld with the ratio |
| MET-010 | ACWR | This week against a typical week | 7 over 28 days | **Withheld entirely below 21 days with data.** A blank here means not enough history, not a ratio of zero |
| None | Vs baseline | How this week compares with the athlete's own norm | The week | Blank without a norm |
| MET-013 | Severity and Open | Availability in the limited form, and how many injuries are open | Now | Unknown where no record exists |
| None | Sessions logged / completed (gym) | Per athlete, gym sessions this week. **Logged** means the session has at least one live set (`gym_set_logs_current`) — a session opened and abandoned is not logged, since the log row is written the moment the screen opens (§0u, decided 10 September 2026, built 12 September). **Completed** is the log's status. One shared count with the athlete report (`lib/gymSessionCounts.ts`) | The week | 0 |

**The band shown around the ratio is a display convention, not the alert rule.**
The rule that actually raises a flag lives in the club's own thresholds table and
may be different. Any conversation about "the ACWR cutoff" should read that table
rather than this colouring.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Back | Top left of the header | Returns to the screen you came from | Browser history | Nothing | Any staff who can reach the page | None | Never |
| Group chips | Second row of the header | Narrows every number on the screen to a group | Stays here, group in the address | Nothing. A cookie remembers the choice | Same | None | Never |
| Week navigation | Header | Moves a week | Stays here, week in the address | Nothing | Report access | None | Never |
| An athlete's name | A row | Opens that athlete | `/squad/[athleteId]` | Nothing | Report access | None | Never |
| Download spreadsheet | Header | Downloads the report | A server route | Records that the report was viewed | Report access | None | Never |
| Download PDF | Header | Downloads the report | A server route | As above | Report access | None | Never |

**Nothing on this page changes any data.**

---

## 7. How this page is built, in plain English

Built on the server, one query per region, run together.

The ratio and its colouring come from shared code used by both this screen and its
PDF, so the two cannot disagree.

---

## 8. States

**Loading.** Renders when ready.

**Empty.** A group with nobody shows an empty table naming the group scope.

**Ratio withheld.** Athletes without 21 days of data show a blank ratio with the
reason, not a zero.

**Error.** Surfaces as an error.

**No permission.** Redirected to Settings with a reason.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **The nutritionist should not see the availability and severity columns.**
  Decision D-01.
- **A planned ACWR column was not built alongside the rest**
  (`src/lib/queries/squadWeeklyReport.ts:37`). **UNVERIFIED which column that
  refers to**, since a ratio is displayed. Worth reading that comment against the
  screen before sign-off.
