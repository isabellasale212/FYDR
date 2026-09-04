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

## 3. How you get here

- The Squad weekly card on the reports hub.

---

## 4. What you see

**A header** with the week, the group filter and two download buttons.

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

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-008 | Acute | Work done in the last seven days | 7 days | Withheld with the ratio |
| MET-009 | Chronic | What a normal week looks like for this athlete | 28 days, expressed per week | Withheld with the ratio |
| MET-010 | ACWR | This week against a typical week | 7 over 28 days | **Withheld entirely below 21 days with data.** A blank here means not enough history, not a ratio of zero |
| None | Vs baseline | How this week compares with the athlete's own norm | The week | Blank without a norm |
| MET-013 | Severity and Open | Availability in the limited form, and how many injuries are open | Now | Unknown where no record exists |

**The band shown around the ratio is a display convention, not the alert rule.**
The rule that actually raises a flag lives in the club's own thresholds table and
may be different. Any conversation about "the ACWR cutoff" should read that table
rather than this colouring.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the squad | Stays here | Nothing. A cookie remembers it | Report access | None | Never |
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
