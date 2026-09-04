# 08. Session detail

## 1. Page name and URL

**Session**, at `/schedule/[sessionId]`.

One session: what it is, when, who is expected, what was recorded, and the place
where it is edited, cancelled or deleted.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | View, edit, cancel, delete | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Everything | View, edit, cancel, delete | None | Base | Same |
| Medic | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| S&C | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

## 3. How you get here

- Any block on the schedule grid.
- Today's timeline on the dashboard.
- A link from a fixture, for a session attached to it.
- A link from a report or a flag that names the session.

---

## 4. What you see

**A header** with the session's title, its kind, the day in full, the time, and
its matchday label where the week contains a fixture.

**The session's details**, editable in place: title, kind, date, start time,
length, location, and which groups are expected.

**Who is expected**, resolved from the groups attached to the session rather than
listed by hand, so changing a group's membership changes the expectation.

**What was recorded**, once the session has happened: attendance, ratings, and
GPS where the club has it.

**The actions**: cancel, reinstate, and delete.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-007 | Session load | How hard it was, per athlete, from their rating and the length | This session | Blank until an athlete submits |
| MET-011 | Attendance | How many were present, counting **full and modified** | This session | Blank before it happens |
| MET-017 | Total distance | How far each athlete travelled | This session | Blank without a GPS upload. **Premium** |
| MET-024 | Duration | How long the unit recorded for | This session | Blank without GPS. **Premium** |

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Edit the session details | Details card | Changes title, kind, date, time, length, location, groups | Stays here | Updates the session | Coach and sport scientist | Form submission | Should be hidden for view only roles. **Not built** |
| Cancel | Actions | Marks the session cancelled. It stays on the schedule, struck through, rather than vanishing | Stays here | Sets the session cancelled | Coach and sport scientist | **None. Cancelling fires straight away** | Hidden once already cancelled |
| Reinstate | Actions | Undoes a cancellation | Stays here | Clears the cancelled state | Coach and sport scientist | None | Hidden unless cancelled |
| Delete | Actions | Removes the session entirely | Back to `/schedule` | Deletes the session | Coach and sport scientist | **Yes. A typed confirmation in the page itself, not a browser pop up** | **Refused** when the session has recorded data, or is in the past |

**Why cancel and delete behave differently.** Cancelling is reversible and
recoverable, so it fires immediately. Deleting is not, so it asks. This
asymmetry is deliberate.

**Two refusals a coach will meet, and both are correct.**

- *This session has recorded data. Cancel it instead.* Deleting would take an
  athlete's submitted ratings and attendance with it
  (`src/lib/queries/schedule.ts:1294`).
- *This session is in the past. Cancel it instead of deleting it.* A week that
  happened is a record, not a plan (`src/lib/queries/schedule.ts:1297`).

Both are refusals with a reason and an alternative, which is the standard every
write on this screen follows.

**A third refusal exists and does not meet that standard.** Six tables record a
link to a session. The guard above checks only two of them, attendance and
training entries (`src/lib/queries/schedule.ts:1273`). The other four, GPS
records, injuries, test results and compliance expectations, are protected by the
database instead, which refuses the deletion outright. That refusal has no
wording of its own, so the coach is shown the generic "something went wrong"
sentence rather than being told to cancel instead. Decision D-27.

---

## 7. How this page is built, in plain English

Built on the server. The session, its groups, its attendance and its recorded
data are fetched together.

An address that does not name a real session shows the standard not found page
rather than an error.

The edit form and the action buttons run in the browser and submit to the server,
where the permission and the two delete refusals are checked again. Hiding a
button is never what prevents an action.

Matchday labels come from the week's real fixtures, computed rather than stored,
so they stay correct when a match moves.

---

## 8. States

**Loading.** Renders when ready.

**Not found.** An address naming no session shows the not found page.

**Cancelled.** The session is shown struck through with the reinstate action
available, rather than being hidden.

**Before it happens.** The recorded regions say the session has not happened yet
rather than showing zeroes.

**No GPS.** On the Base package there is no GPS region at all. On Premium with no
upload, it says so.

**Error.** Surfaces as an error, and a failed write leaves the form filled in
with a sentence saying what to do, never a silent bounce.

**No permission.** Athletes are redirected.

**Wrong tier.** The GPS region only.

**Offline.** Not handled.

---

## 9. Open issues

- **Every role can edit, cancel and delete.** The agreed model says coach edits.
  Decision D-06.
- **Resolved, and it is a real gap.** Nothing silently breaks: the database
  refuses the deletion. But the refusal is unworded, so a coach gets a generic
  error instead of "Cancel it instead". Decision D-27.
