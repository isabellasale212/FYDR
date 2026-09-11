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
3. **The read and edit switch**, on the right, and only for the sport scientist
   and the coach. **The grid opens in edit for them.** It used to open in read,
   on the reasoning that edit should be entered deliberately rather than by
   accident — that was the whole of the 2026-09-09 schedule report: a coach
   landed on a rich, complete, entirely read-only panel with no Save and no
   Cancel, and nothing on screen said which mode they were in. Nothing was
   broken and every control worked the instant they switched, which is why it
   read as unresponsive rather than as an error.

   **Every other staff role gets no switch, and a line where it would be:**
   *Read only. The schedule is authored by the sport scientist and the coach.*
   They are not stuck in a mode — read-only is the whole screen for them — but
   an unlabelled read-only screen looks like an editable one that is ignoring
   you, which is the same confusion in a form no default can fix. The wording
   matches the week-template detail page, the same feature area and the same
   two roles.
4. **The title.**
5. **The scope subheading**, directly under the title, naming the week, the
   matchday, the fixture and the active group scope.
6. **Week plan and Today** as tabs on the left, with **week navigation** on the
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
| Read and Edit switch | Above the grid | Changes whether blocks can be moved | Stays here | Nothing by itself | Coach and sport scientist | None | Hidden for every other role, which sees `Read only. The schedule is authored by the sport scientist and the coach.` in its place. Opens on **edit** for the two roles that have it |
| Previous and next week | Above the grid | Moves a week | Stays here, week in the address | Nothing | Any staff | None | Never |
| A session block | The grid | Opens that session | `/schedule/[sessionId]` | Nothing | Any staff | None | Never |
| Dragging a block, in edit mode | The grid | Moves a session to a new day or time | Stays here | Updates the session's start time | Coach and sport scientist | Changes are held until applied, not written on every drag | Hidden in read mode |
| Add to Day | Edit mode | Places a drafted session on a day | Stays here | Creates a session | Coach and sport scientist | The draft must be completed first | Hidden in read mode |
| + Session | Two of them: the header chip row, and the edit-mode toolbar | The header chip opens the full new-session screen; the toolbar button starts a draft in the grid itself | `/schedule/new` from the chip; stays here from the toolbar | Nothing until the draft is added to a day | Coach and sport scientist | None | Both hidden for every other role (`canEdit`). The toolbar one is additionally hidden in read mode |
| + Fixture | Header chip row | Opens the new fixture screen | `/schedule/fixtures/new` | Nothing | Coach and sport scientist | None | Hidden for every other role (`canEdit`) |
| Apply template | Edit-mode toolbar | Puts a saved week shape onto this week | `/schedule/planner/apply` | Creates the sessions in the template | Coach and sport scientist | Yes, on the apply screen | Hidden for every other role (`canEdit`), and in read mode |
| Cancel changes | Selected session panel | Drops the unpublished changes on **this session only**, leaving every other pending change alone | Stays here | Nothing — it clears a local overlay | Coach and sport scientist | None. It reverts to the published state, which is itself the undo | Shown only when this session has a pending change AND is an existing published session. Not shown on a staged draft, where "Remove session" is the same act and already has a confirmation |
| Restore session | Selected session panel, when this session is removed but not yet published | Un-removes it, keeping any pending edit to it | Stays here | Nothing — it clears a local removal | Coach and sport scientist | None | Shown only while the session is pending removal, and only in edit mode |
| A ghost block | The grid, where the removed session was | Re-selects it, so Restore is reachable at any time | Stays here | Nothing | Any staff who can see the grid | None | Only while a removal is pending publish |

**There is no per-session Save, deliberately.** An edit is held the moment a
stepper moves; the commit is the week-level **Publish to athletes**, because one
session published out of a week would put a half-updated schedule on athletes'
phones and break the banner's own promise that nothing changes until you publish.
The panel says where the commit is instead — *"Held on your screen. Publish to
athletes, at the top of this page, puts it on their phones."* — because that
control is genuinely far away: measured on 2026-09-09 with the panel at y=700,
the banner sat at y=-1782.

**A removal has its own undo too.** Removing a session no longer clears the
selection, so the panel stays on it and shows a compact removed state: the
session's name and time, the line *"Removed on your screen. Athletes still see
this session until you publish."*, and **Restore session**. The sentence matters
more than the button — a coach who sees the block vanish reasonably assumes it
is gone from the squad's phones, and it is not: nothing is written until Publish.

**The removed session is drawn on the grid as a ghost**, so it stays reachable
after the coach has clicked elsewhere. Same two rows as a live block — time then
name — with no fill, the name struck through, and at 0.65 opacity. It sits below
every live block, so it never covers the session that replaced it, and clicking
it re-selects it and offers Restore.

**It counts toward nothing.** Five things read the effective session list —
MD-offset anchoring, the hour range, clash placement, fixture drawing, and the
week stats panel's contact minutes, typical-week comparison and per-group
totals. A session on its way out must reach none of them, so it stays filtered
out of that list entirely and is drawn from a separate one. Removing a 45-minute
session takes the week from 445 contact minutes to 400 and its day from 45m to
0m, which is correct.

The single exception is the grid's own **extent**, and it is presentational:
without it, removing the latest session of the week shrinks the range and the
ghost is drawn below its own floor — and the whole grid changes height on a
removal, which is worse than the removal being visible.

**Ghosts are placed among themselves**, never through the same pass as the live
blocks: one placement call over both would restagger live sessions around a
session that is leaving. Two removals at the same hour still stagger relative to
each other, so neither hides the other.

**Restoring keeps a pending edit.** A session edited and then removed comes back
with the edit intact, not at its published time: `Restore session` un-removes and
touches nothing else.

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

**Offline.** The week's pending changes — edited sessions, staged drafts,
removals and a half-filled new draft — are kept in the browser's
`sessionStorage` for this organisation and week from the moment they are made
(since 12 September 2026, §0al), restored when the page reloads, and cleared by
a successful publish or by Discard. If the connection drops at **Publish to
athletes**, nothing is written, the banner reads *"Not published: …"*, and the
grid and its pending changes stay exactly as they were; the page does not
reload itself. Publish again when the signal is back. A failure part-way
through a publish that did reach the server still reloads the week so the
grid agrees with what was written.

---

## 9. Open issues

- **Every role can edit the week.** The agreed model says all staff view, coach
  edits. Decision D-06.
- **UNVERIFIED: whether a dropped connection during editing warns before losing
  unsaved changes.** Files searched:
  `src/components/ScheduleGrid/ScheduleWorkspace.tsx`.
