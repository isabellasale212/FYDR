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
belong to, so a coach can read the week as MD-3, MD-2, MD-1, MD. A block prints
its time, its title and — where it is tall enough for a third line (63px and
up) — **its type as a word**, ahead of its groups ("Gym · Backs + Forwards"),
since 15 September 2026 (the accessibility sweep's Class 3.2): the block's tone
carried the type alone for a sighted reader; the label for a screen reader
always had it. The phone's day list prints the type word at the head of every
titled row's meta line the same way (an untitled row already shows the type as
its title).

**Two create buttons**, one for a session and one for a fixture. Before these
existed neither creation screen was linked from anywhere.

**Apply a template.** Puts a saved week shape onto this week.

**On a phone (below 768px) the schedule is day-first, and the day only**
(PATTERN-S4 C6 / B4, 13 September 2026; the week strip removed 16 September
2026, Isabella's overnight queue 2.1 — "show the DAY only … no week view at
phone width; the week stays desktop only"): no grid at 375 and no strip. The
day's heading is a stepper — a 44px **‹** and **›** either side of "Today ·
Wednesday 16 Sept" with "MD-2 · 1 session · 80 minutes" beneath (an empty day
"Nothing scheduled") — moving a day at a time, inside the loaded week as a
state change and across its edge as a navigation to that week with the day in
the address (`?date=`); today, or the day asked for, or Monday. Beside it a
44px **+** that opens the new-session page for that day (forms stay pages) —
the day is edited as it always was on a phone, a row opening its session's
page. The group-filter chip row and the week arrows are not drawn below 768:
the title bar's dropdown is the filter. Then one row per fixture and session
at 44px or more —
"09:30 – 10:50 · Contact prep · Main pitch · 80 min · Backs and Forwards · 27
expected ›" — each a link to its page; an unpublished edit or draft made on a
desktop is listed as held, not linked, because the phone has no editor. "Nothing
on Thursday." when the day is empty; "Next · Fri 11 Sept · Captain's run ·
10:00 ›" for the first session on a later day of the week. There is no Read/Edit
control on the phone; the publish banner and the toolbar stay.
Both views are drawn from the same day columns and the same effective sessions,
so they cannot disagree.

**A week statistics panel**, summarising what the week contains. In its
per-group card a group with no session this week reads a dash and "5 athletes ·
nothing scheduled", never 0m (PATTERN-S4 C8, 13 September 2026) — a day still
reads 0m, because a day is a real container that is genuinely empty.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-007 | Session load, where a block shows one | How hard a session was for an athlete | Per session | Blank until entries are in |
| MET-011 | Attendance counts on a block | How many were present | Per session | Blank before the session happens |
| None | Expected attendees, on the preview footer of the selected session | "Publishes to Backs + Forwards · 18 of 30 athletes are expected · appears under Today on the morning of …" (PATTERN-S4 C5, 13 September 2026): the session's athletes resolved as one **distinct** set across its groups — never group sizes added, an athlete in two groups counts once — against the squad (active, not left). One athlete "is expected"; the whole squad "All 30 athletes are expected"; no group "Nobody is expected — staff only". Whether an athlete marked unavailable is still expected is undecided: today they are (the count is membership, not availability) — on the decision sheet | Per session | — |
| None | "Expects" on the selected session, and the "What the athlete sees" preview | What the athlete app will ask for after this session. For a training or match session: "RPE due from 10:30" — thirty minutes after the session's own end, the instant Today's row appears and the RPE screen first accepts a rating (`lib/rpeDue.ts`, the one rule; §0aj, 12 September 2026 — it was a fixed "due by 19:45" for every training session before). Gym "Sets to log", testing "Staff entered", rehab "Stage log", recovery and meeting "—" | Per session | — |

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
| Selecting a block, in edit mode | The grid, then the selected session panel | Moves a session to a new day or time through the panel's day, start and duration fields — **there is no drag**: PATTERN-S4 C3's drag fell with D1 on 12 September and none was built; the edit-mode caption reads "select a block to change its day or time" (corrected 15 September 2026, the pre-deploy fixes #5 — it said "drag a block to move it", a gesture that did not exist) | Stays here | Updates the session's start time and duration | Coach and sport scientist | Changes are held until published, not written on every edit | Hidden in read mode |
| Selecting a rated session, in edit mode | The grid, then the panel | Shows the session read-only: the facts, and the sentence "This session has been rated by N athletes. Ratings are tied to its date and duration, so it cannot be changed. Cancel it and create a new one if the details are wrong." — no Edit, no day, time, group, location or type fields | Stays here | Nothing | Coach and sport scientist | None | **PATTERN-S4 C4 (B6) on this grid too, 15 September 2026** (`decisions/decision-batch-2026-09-15.md` #6): the same rule and the same sentence as the session screen (`lib/ratedSession.ts`, read by both). Remove stays (a session carrying data is cancelled, not deleted, when the week is published) and so does Duplicate; a held edit from before the rule can still be dropped with Cancel changes. The count is distinct athletes with a live rating, on every grid row. Held at the database too (0133): a publish from a stale tab that moves a rated session is refused per session, with the same sentence |
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

**Words settled by PATTERN-S4 (12 September 2026):** the grid's footer and the week
statistics count **session minutes** — session length, not length × attendees; never
"contact minutes". The legend carries all seven session types, Meeting included. The
Week plan tab is `role="tab"` with `aria-selected` and `aria-current="page"`. A staged
draft's primary says what it will make — "Add session · Thu 10, 16:00, 60 min". A
removed block carries a neutral **Removed** pill beside its time as well as the
strike-through. The read-only line for a role that cannot author ("Read only. The
schedule is authored by the sport scientist and the coach.") stands in a bordered well
where Read/Edit sits for an editor. The board's headline — sessions live on create, no
publish — is a reversal of this page's held-until-publish model and is on the decision
sheet as PATTERN-S4 D1, not built.

**"Yes, remove" says what will happen.** On a committed session the confirmation
reads *"Remove this session? You can undo with Discard, until you publish."* — true,
because the ghost and Restore exist until the week is published. On a staged draft
it reads *"Remove this draft? It was never published, so there is nothing to
undo."* — a draft vanishes on removal (the same act as Discard), so the undo promise
is only made where it holds (§0aj, 12 September 2026).

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
to selection and editing without a round trip.

Five questions are asked at the same time: the week's sessions, who is in which
group, the saved templates, what a normal week looks like for this club, and the
week's fixtures.

**Times are the club's local times throughout.** A session between eleven at
night and midnight in UTC is the next morning in some timezones, and reading the
raw stored date rather than the local one puts it on the wrong day. The grid
converts properly rather than slicing the stored timestamp.

**Matchday labels are worked out from the week's real fixtures**, not typed in,
so moving a match moves every label with it.

Edits are gathered and applied rather than written on every change, so a coach
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
reload itself. Publish again when the signal is back.

**A write the publish refused undoes itself and says where** (PATTERN-S6 C6, 13
September 2026). When the server refuses one session's change — an
optimistic-lock conflict, a policy refusal, a missing season — that change stays
held (nothing is dropped): the grid draws the session where the athletes still
have it, with its accent bar, and the attempted position as a dashed ghost
reading "Did not save"; the banner names both — "Gym A did not save — This
session changed since you opened it. The athletes still have Mon 7 Sept · 07:00;
you tried 07:15 · 30 athletes affected." — one sentence per refused write, and
**Try again** is the one control (it publishes again). A refused removal returns
the block solid ("The athletes still have Wed 9 Sept · 09:30"); a refused new
session ghosts where it was tried ("The athletes have nothing at … yet").
Cancel changes on that session or Discard clears its ghost. A dropped connection
is not a refused write: the paragraph above applies and nothing is ghosted. The
ghost is the removal ghost's own dashed treatment; the words say which (no new
token). A failure part-way
through a publish that did reach the server still reloads the week so the
grid agrees with what was written. The "did the request reach the server?"
test (`isNetworkFailure`, `pending.ts`) recognises both the raw engine
strings a thrown fetch carries and the humanised sentence the session
helpers return ("That didn't save — the connection dropped or timed out…",
`saysConnectionFailed` in `writeErrors.ts`) — reopened and fixed 13
September 2026 after the test-club run found the humanised path took the
reload to Chrome's offline page.

---

## 9. Open issues

- **Every role can edit the week.** The agreed model says all staff view, coach
  edits. Decision D-06.
- **UNVERIFIED: whether a dropped connection during editing warns before losing
  unsaved changes.** Files searched:
  `src/components/ScheduleGrid/ScheduleWorkspace.tsx`.
