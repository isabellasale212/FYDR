# 02. Squad overview

## 1. Page name and URL

**Squad overview**, at `/squad`.

The roster. Every athlete in the club, or in the chosen group, with their
availability, and a way through to each one.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The full roster with availability and restrictions | Nothing on this page. Changes happen on an athlete's own page | None | Base | Route guard `src/lib/session.ts:69`, then coach or medical at `src/app/(staff)/squad/page.tsx:26` |
| Coach | Yes | Same | Nothing | None | Base | Same |
| Medic | Yes | Same | Nothing | None | Base | Same |
| S&C | Yes | Same | Nothing | None | Base | Same |
| Nutritionist | Yes | The roster **without** the Availability and Restrictions columns | Nothing | Availability status, restriction text, reason | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then page guard, then database |

A page open to a role whose group filter excludes everyone still renders, with an
empty table and a line explaining why.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/squad/page.tsx:19`; a **coach or medical** check at `src/app/(staff)/squad/page.tsx:26`, which renders a named refusal rather than redirecting. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Squad overview, the second item in the sidebar.
- The three availability rows on the dashboard's Ready for Saturday card.
- The Full squad link at the foot of the dashboard's Available tile when
  expanded.
- `/squad/roster`, an older address that redirects here.
- Any breadcrumb reading Squad overview from an athlete's own page.

---

## 4. What you see

**The top bar** holds the page title and the group filter. The filter is the same
one as everywhere else and remembers itself between screens.

**A line beneath the title** says how many athletes are in view and which group
scope produced that number, so a short list never looks like a missing list.

**A search box**, which filters the table as you type. It searches within what is
already on screen rather than asking the database again, so it is instant and it
cannot widen the group filter.

**The roster table**, one row per athlete, with four columns:

- **Athlete**, the name, which is the link through to them. Squad number sits
  with the name.
- **Position**.
- **Availability**, shown as a coloured pill: available, modified, unavailable,
  or unknown for an athlete with no record at all.
- **Restrictions**, the specific limits recorded against a modified athlete, in
  the words whoever set them used.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-013 | The Availability column | Whether this athlete can train and play | Right now | An athlete with no availability record shows as **unknown**, which is a real state and not the same as available |

The count of athletes in the header line is a plain count of the rows in view,
not a metric.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Top bar | Narrows the roster, and every other screen after it | Stays here | Nothing. A cookie remembers the choice | Any staff | None | Never |
| Search the squad | Above the table | Filters the rows already loaded, as you type | Stays here | Nothing | Any staff | None | Never |
| An athlete's name | Table row | Opens that athlete | `/squad/[athleteId]` | Nothing | Any staff | None | Never |

**Nothing on this page writes anything.**

---

## 7. How this page is built, in plain English

Two questions are asked of the database at the same time: the club's groups, for
the filter, and the roster itself.

The roster query returns each athlete with their **current** availability, which
means the record with no end date. An athlete may have a history of availability
records; only the one in force is read here.

The table itself runs in the browser, because the search box has to respond as
you type. The rows it searches are the rows the server already sent, so search
never reaches past the group filter. That is deliberate: a coach filtered to
Forwards should not be able to find a back by typing their name.

---

## 8. States

**Loading.** The page renders when the roster is ready.

**Empty.** A group with no athletes shows an empty table with a line saying which
group scope produced it, so the reader can tell an empty group from a broken
page.

**Search with no matches.** The table empties but the header line still shows the
unfiltered count, so it is clear the search and not the filter caused it.

**Error.** Surfaces as an error rather than an empty roster.

**No permission.** An athlete is redirected before the page is built.

**Wrong tier.** Not applicable. This page is on every package.

**Offline.** Not handled.

---

## 9. Open issues

- **The nutritionist restriction is not built.** Availability and Restrictions
  are injury derived and must be hidden from a nutritionist. Decision D-01.
- **Resolved, not an issue.** The roster excludes athletes who have been
  soft deleted and those whose status is `left_club`
  (`src/lib/queries/squad.ts:96`). Recorded here so nobody re-checks it.
- **There is no way to add an athlete from this page**, or from anywhere else.
  Decision D-16.
