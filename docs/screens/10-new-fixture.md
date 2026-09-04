# 10. New fixture

## 1. Page name and URL

**New fixture**, at `/schedule/fixtures/new`.

Creates a match: the opponent, the kick-off, and where it is played.

**A fixture is not a session.** This creates the match itself. What the squad does
around it, the captain's run, the gym slot, the match session on the day, are
sessions. That separation is what lets a matchday minus one week survive the match
being moved.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The form | Create a fixture | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The form | Create a fixture | None | Base | Same |
| Medic | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| S&C | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/schedule/fixtures/new/page.tsx:18`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The **+ Fixture** button on the schedule toolbar.
- A direct link carrying a date.

**The database has allowed staff to create fixtures since an early migration. Only
the screen was missing**, and before the toolbar button existed nothing linked
here.

---

## 4. What you see

One card, deliberately the same shape as the new session form, because a coach
reaching this screen has almost certainly just used that one and a match is the
other half of the same job.

**Opponent.** Who you are playing.

**Date and kick-off**, side by side.

**Home or away**, as three buttons: home, away, neutral.

**Venue.**

**Competition**, for example League or Cup.

**Importance**, as four buttons: friendly, normal, key, cup final. This weights
the match in load planning, and the guidance beneath says to leave it on normal
unless this one is treated differently.

**Create and Cancel.**

---

## 5. Every number on this page

None. This screen creates a fixture and displays no calculated figures.

The importance chosen here later affects load planning, but it is a choice, not a
metric.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Opponent | Top | Names the opposition | Stays here | Nothing until submitted | Coach and sport scientist | None | Never |
| Date and kick-off | Below | Sets when | Stays here | Nothing until submitted | Same | None | Never |
| Home or away buttons | Middle | Chooses where it is played | Stays here | Nothing until submitted | Same | None | Never |
| Venue | Middle | Names the ground | Stays here | Nothing until submitted | Same | None | Never |
| Competition | Middle | Names the competition | Stays here | Nothing until submitted | Same | None | Never |
| Importance buttons | Lower | Weights the match in planning | Stays here | Nothing until submitted | Same | None | Never |
| **Create fixture** | Foot | Writes the fixture and returns to the schedule on that date | `/schedule?date=` | **Creates one fixture**, attached to the club's current season | Coach and sport scientist | The form is the confirmation | Disabled while saving, and says so |
| Cancel | Foot | Abandons the form | `/schedule` | Nothing | Same | None | Never |

**Two rules are checked before anything is sent**: an opponent is required, and a
date and kick-off are required.

**One refusal a coach may meet.** *No current season is set up for this club.* A
fixture belongs to a season, and without one there is nothing to attach it to.

---

## 7. How this page is built, in plain English

The page is built on the server, which supplies the timezone and the default
date. The form runs in the browser.

Submitting finds the club's current season, then writes the fixture. The
permission is checked again on the server and again by the database.

The kick-off typed is the club's local time and is converted to a universal
instant using the club's timezone on that date.

---

## 8. States

**Loading.** Renders immediately.

**No current season.** Submitting produces a sentence saying so. The form stays
filled in.

**Saving.** The button is disabled and says so.

**Error.** The form stays with a sentence.

**No permission.** Currently any staff member reaches it.

**Wrong tier.** Not applicable.

**Offline.** The connection sentence rather than a hang.

---

## 9. Open issues

- **Every staff role can create a fixture.** Decision D-06.
- **A known live defect.** With a signed out session, submitting this form
  navigates to the sign in screen with no message and nothing saved. A guard was
  written for it and does not fire. **This is not fixed.** It is recorded here so
  that the presence of the guard in the code is not mistaken for a working fix.
- **UNVERIFIED: whether two fixtures can be created for the same date and
  opponent.** Files searched: `src/lib/queries/schedule.ts`,
  `supabase/migrations/0003_schedule.sql`.
