# 16. Timetable

## 1. Page name and URL

**Timetable**, at `/timetable`.

One day, in order, as a list. The schedule grid answers "what does the week look
like". This answers "what is happening today, and when".

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The day's sessions | Nothing. A reading screen | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The day's sessions | Nothing | None | Base | Same |
| Medic | Yes | The day's sessions | Nothing | None | Base | Same |
| S&C | Yes | The day's sessions | Nothing | None | Base | Same |
| Nutritionist | Yes | The day's sessions | Nothing | None | Base | Same |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

Nothing on this page is withheld from anyone. A timetable is a timetable.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/timetable/page.tsx:26`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A direct link. **This screen is not in the sidebar**, and it is not linked from
  the schedule either.

**That is an open issue, not a design decision.** A screen nobody can navigate to
is a screen nobody uses. See section 9.

---

## 4. What you see

**A header** with the day and the group filter.

**The day's sessions in time order**, each as a card with its time, title, kind,
matchday label and location.

A day with nothing on it says so.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-011 | Attendance on a card, where shown | How many were present | That session | Blank before the session happens |

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the day to a group | Stays here | Nothing. A cookie remembers it | Any staff | None | Never |
| A session card | The list | Opens that session | `/schedule/[sessionId]` | Nothing | Any staff | None | Never |

**Nothing on this page writes anything.**

---

## 7. How this page is built, in plain English

Built on the server. It reads one day's sessions and the week's matchday labels.

Times are the club's local times. The day boundary is the club's local midnight,
not a universal one, which matters for any club not on the same clock as the
server.

---

## 8. States

**Loading.** Renders when ready.

**Empty.** A day with nothing scheduled says so, and names the group scope that
produced it so an empty day is distinguishable from an over-narrow filter.

**Error.** Surfaces as an error.

**No permission.** Athletes are redirected.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **Nothing links to this screen.** It is not in the sidebar and not reachable
  from the schedule. Either it should be linked, or it should be retired in favour
  of the schedule grid's day view. **Decision D-31.**
- **It overlaps the schedule grid.** Both show a day's sessions. Whether both
  should exist is the product half of the same question.
