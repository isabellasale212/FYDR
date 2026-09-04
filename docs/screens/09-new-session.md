# 09. New session

## 1. Page name and URL

**New session**, at `/schedule/new`.

Creates one scheduled activity: training, gym, rehab, testing, recovery or a
meeting. Not a match. A match is a fixture, and fixtures are made on screen 11.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The form | Create a session | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The form | Create a session | None | Base | Same |
| Medic | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| S&C | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

## 3. How you get here

- The **+ Session** button on the schedule toolbar.
- A direct link carrying a date, so the form opens on the right day.

**Before those buttons were added, this screen was not linked from anywhere.**
It existed and could only be reached by typing the address.

---

## 4. What you see

One card, read top to bottom.

**Title.** What the session is called. Titles matter more than they look: the
training report groups sessions by title to work out what a typical session of
that kind looks like, so "Conditioning" every week is doing real work.

**Kind.** Training, gym, rehab, testing, recovery or meeting, chosen from a row
of buttons rather than a dropdown.

**Date and start time**, side by side.

**Length**, in minutes.

**Location.**

**Which groups are expected.** Choosing groups rather than individuals means the
expectation follows group membership as it changes.

**Create and Cancel.**

---

## 5. Every number on this page

None. This screen creates a session; it displays no calculated figures.

The length in minutes is an input, not a metric, though it later becomes half of
MET-007.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Title | Top of the form | Names the session | Stays here | Nothing until submitted | Coach and sport scientist | None | Never |
| Kind buttons | Below the title | Chooses the kind | Stays here | Nothing until submitted | Same | None | Never |
| Date and time | Middle | Sets when | Stays here | Nothing until submitted | Same | None | Never |
| Length | Middle | Sets how long | Stays here | Nothing until submitted | Same | None | Never |
| Location | Middle | Sets where | Stays here | Nothing until submitted | Same | None | Never |
| Group chips | Lower | Chooses who is expected | Stays here | Nothing until submitted | Same | None | Never |
| **Create session** | Foot | Writes the session and returns to the schedule on that date | `/schedule?date=` | **Creates one session** | Coach and sport scientist | The form is the confirmation. There is no second dialogue | Disabled while saving, and the label changes to say so |
| Cancel | Foot | Abandons the form | `/schedule` | Nothing | Same | None. Unsaved input is lost without warning | Never |

**What happens when it fails.** The form stays on screen with everything still
filled in, and a sentence appears saying what went wrong and what to do. It never
empties the form, and it never redirects on a failure. Three cases have their own
wording: no permission, an expired sign in, and a connection that did not come
back.

**Times are stored correctly.** The time typed is the club's local time. It is
converted to a universal instant before storing, using the club's timezone on
that specific date, so it survives a clock change.

---

## 7. How this page is built, in plain English

The page itself is built on the server, which supplies the club's groups, the
timezone and today's date. The form runs in the browser.

Submitting calls a single function that writes the session and, if groups were
chosen, the group expectations with it. The permission is checked again on the
server. Hiding the screen is not what prevents an unauthorised write.

Two rules are checked before anything is sent: a title is required, and a date
and time are required. Both produce a sentence in the form rather than a browser
warning.

---

## 8. States

**Loading.** The form renders immediately; there is little to fetch.

**Empty.** A club with no groups shows the form without group chips, and a
session can still be made.

**Saving.** The submit button is disabled and says so, so the form cannot be sent
twice.

**Error.** The form stays, filled in, with a sentence.

**No permission.** Currently any staff member reaches it.

**Wrong tier.** Not applicable.

**Offline.** Submitting without a connection produces the connection sentence
rather than hanging. **No write may fail silently or hang forever** is the
standing rule this screen follows.

---

## 9. Open issues

- **Every staff role can create a session.** Decision D-06.
- **Cancel discards unsaved input without warning.** Consistent with the rest of
  the app, recorded here rather than raised, because a create form is cheap to
  re-fill.
- **UNVERIFIED: whether a session can be created in the past**, and whether that
  should be allowed. Deleting a past session is refused, which suggests a view
  about past sessions that creation may not share. Files searched:
  `src/components/NewSessionForm/NewSessionForm.tsx`,
  `src/lib/queries/schedule.ts`.
