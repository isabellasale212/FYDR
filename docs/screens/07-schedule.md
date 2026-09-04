# 07. Schedule

## 1. Page name and URL

**Schedule**, at `/schedule`.

The week, as a grid of days and times. What is on, when, for whom, and the place
where a week is built and rearranged.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The whole week | View, create, edit, delete. Full editing | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The whole week | View, create, edit, delete. **The schedule is the coach's** | None | Base | Same |
| Medic | Yes | The whole week | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| S&C | Yes | The whole week | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | Yes | The whole week | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

A session is a scheduled activity. It carries no medical information, so no part
of this page is withheld from any staff role. Only the ability to change it
differs.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/schedule/page.tsx:58`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Schedule, the third item in the sidebar.
- The Sessions left to run row on the dashboard's Ready for Saturday card.
- Today's timeline on the dashboard.
- Any link back from a session, a fixture or a week template.
- A direct link carrying a week, so a particular week can be sent to a colleague.

---

## 4. What you see

**The header** is the same template the five reports carry, specified in
`CHANGELOG-headers-spec.md`. Five rows, always in this order:

1. **Back**, a pill at the top left.
2. **The group chips**, Whole squad first with a tick when active.
3. **The eyebrow** naming the week, the matchday, the fixture and the active
   group scope, with the **read and edit switch** on the right. The grid opens
   in read mode; edit is entered deliberately rather than by accident, which is
   what keeps a stray drag from moving a session.
4. **The title.**
5. **Week plan and Today** as tabs on the left, with **week navigation** on the
   right. The two tabs are two routes rather than two views of one screen:
   Today is the timetable.

**The week is in the address**, so a particular week can be sent to a
colleague.

**The grid itself.** Days across, time down, with each session drawn as a block
at its real time and for its real length. Matchday labels sit on the days they
belong to, so a coach can read the week as MD-3, MD-2, MD-1, MD.

**Two create buttons**, one for a session and one for a fixture. Before these
existed neither creation screen was linked from anywhere.

**Apply a template.** Puts a saved week shape onto this week.

**A week statistics panel**, summarising what the week contains.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-007 | Session load, where a block shows one | How hard a session was for an athlete | Per session | Blank until entries are in |
| MET-011 | Attendance counts on a block | How many were present | Per session | Blank before the session happens |

Most of this page is not numbers. It is placement in time, which is the point of
it.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Back | Top left of the header | Returns to the screen you came from | Browser history | Nothing | Any staff | None | Never |
| Group chips | Second row of the header | Narrows the week to a group | Stays here, group in the address | Nothing. A cookie remembers the choice | Any staff | None | Never |
| Week plan / Today tabs | Last row of the header | Switches between the week grid and the day list | `/schedule`, `/timetable` | Nothing | Any staff | None | Never |
| Read and Edit switch | Above the grid | Changes whether blocks can be moved | Stays here | Nothing by itself | Coach and sport scientist in the target model | None | Should be hidden for view only roles. **Not built** |
| Previous and next week | Above the grid | Moves a week | Stays here, week in the address | Nothing | Any staff | None | Never |
| A session block | The grid | Opens that session | `/schedule/[sessionId]` | Nothing | Any staff | None | Never |
| Dragging a block, in edit mode | The grid | Moves a session to a new day or time | Stays here | Updates the session's start time | Coach and sport scientist | Changes are held until applied, not written on every drag | Hidden in read mode |
| Add to Day | Edit mode | Places a drafted session on a day | Stays here | Creates a session | Coach and sport scientist | The draft must be completed first | Hidden in read mode |
| + Session | Toolbar | Opens the new session screen | `/schedule/new` | Nothing | Coach and sport scientist | None | Should be hidden for view only roles. **Not built** |
| + Fixture | Toolbar | Opens the new fixture screen | `/schedule/fixtures/new` | Nothing | Coach and sport scientist | None | As above |
| Apply template | Toolbar | Puts a saved week shape onto this week | `/schedule/planner/apply` | Creates the sessions in the template | Coach and sport scientist | Yes, on the apply screen | As above |

---

## 7. How this page is built, in plain English

Built on the server, then handed to the browser, because the grid has to respond
to dragging.

Five questions are asked at the same time: the week's sessions, who is in which
group, the saved templates, what a normal week looks like for this club, and the
week's fixtures.

**Times are the club's local times throughout.** A session between eleven at
night and midnight in UTC is the next morning in some timezones, and reading the
raw stored date rather than the local one puts it on the wrong day. The grid
converts properly rather than slicing the stored timestamp.

**Matchday labels are worked out from the week's real fixtures**, not typed in,
so moving a match moves every label with it.

Edits are gathered and applied rather than written on every drag, so a coach
rearranging a week does not produce twenty separate changes.

---

## 8. States

**Loading.** Renders when ready.

**Empty week.** Draws the empty grid with the days and times, so it is clearly an
empty week rather than a failure to load.

**Filtered to nothing.** A group with no sessions shows the same empty grid, and
the header says which group scope produced it.

**Error.** Surfaces as an error.

**No permission.** Athletes are redirected. No staff role is refused.

**Wrong tier.** Not applicable.

**Offline.** Not handled. Unsaved edits are lost if the connection drops before
they are applied, which is worth stating because the edit model holds changes
before writing them.

---

## 9. Open issues

- **Every role can edit the week.** The agreed model says all staff view, coach
  edits. Decision D-06.
- **UNVERIFIED: whether a dropped connection during editing warns before losing
  unsaved changes.** Files searched:
  `src/components/ScheduleGrid/ScheduleWorkspace.tsx`.
