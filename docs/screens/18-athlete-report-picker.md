# 18. Athlete report picker

## 1. Page name and URL

**Pick an athlete**, at `/reports/athlete`.

A chooser. It exists because the athlete report is about one person, and a report
that opens on nobody has to ask who first.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every athlete, grouped by positional unit | Nothing | None | Base | `requireReportAccess`, `src/lib/session.ts:120` |
| Coach | Yes | Same | Nothing | None | Base | Same |
| Medic | Yes | Same | Nothing | None | Base | Same |
| S&C | Yes | Same | Nothing | None | Base | **NOT BUILT.** Under the agreed model an S&C reaches the athlete report with the limited injury view |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This screen uses the report guard**, unlike the hub that links to it, so a
person without report access is refused here rather than at the next click.

---

## 3. How you get here

- The Athlete report card on the reports hub.
- A direct link, optionally carrying a search term or a group.

---

## 4. What you see

**A header** with a breadcrumb back to Reports.

**The group filter.**

**A search box.** Searching narrows the list by name, position or number.

**The squad, grouped by positional unit**: front row, second row, back row, half
backs, centres, back three, and a final group for anyone whose position is not
recorded, named so rather than hidden.

**Against each athlete, when their wellness was last received**, so a coach
choosing who to look at can see who has gone quiet before opening anything.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-012 | The recency figure beside a name | When this athlete last submitted a check-in | Looks back beyond the window on purpose, so "last seen" is a real date rather than a gap | Says the athlete has not submitted at all, rather than showing a blank |

**Why the recency lookback is deliberately unbounded.** A figure bounded by the
report's window would show nothing for an athlete who last submitted before it,
which reads as "no data" when the truth is "not for a while". The distinction is
the whole point of the column.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the squad | Stays here, group in the address | Nothing. A cookie remembers it | Report access | None | Never |
| Search box | Above the list | Filters by name, position or number | Stays here, term in the address | Nothing | Report access | None | Never |
| An athlete's name | The list | Opens their report | `/reports/athlete/[athleteId]` | Nothing | Report access | None | Never |
| Reports breadcrumb | Header | Back to the hub | `/reports` | Nothing | Report access | None | Never |

**Nothing on this page writes anything.**

**The search term lives in the address**, so a filtered list can be sent to a
colleague and they see the same thing.

---

## 7. How this page is built, in plain English

Built on the server.

**Search is applied after the roster is fetched, not inside the database query.**
That is deliberate: the group filter has already decided who is in scope, and
searching inside the query would risk reaching past it. Search narrows what the
filter allowed; it never widens it.

Athletes are placed into positional units by mapping their recorded position onto
six rugby units. Anyone whose position does not map is placed in a named group
rather than dropped.

---

## 8. States

**Loading.** Renders when ready.

**Empty.** A group with no athletes shows an empty list naming the group scope.

**Search with no matches.** The list empties; the group scope line still shows
what was searched within.

**No position recorded.** The athlete appears under a group that says so.

**Error.** Surfaces as an error.

**No permission.** A staff member without report access is redirected to Settings
with a reason in the address.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **The nutritionist should not reach the athlete report.** Decision D-01.
- **UNVERIFIED: whether the positional unit mapping is club configurable** or
  fixed to the six rugby units, which would matter for a club in another sport.
  Files searched: `src/lib/nutritionRules.ts`, `src/app/(staff)/reports/athlete/page.tsx`.
