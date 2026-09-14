# 11. Fixture detail

## 1. Page name and URL

**Fixture**, at `/schedule/fixtures/[fixtureId]`.

One match: who, when, where, how important, and the sessions built around it.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | View, edit, and change the fixture's status. **No delete exists** | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Everything | View, edit, and change status. **No delete exists** | None | Base | Same |
| Medic | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| S&C | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

A fixture carries no medical information, so nothing here is withheld from any
staff role.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/schedule/fixtures/[fixtureId]/page.tsx:29`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A fixture block on the schedule grid.
- The **To matchday** tile on the dashboard.
- Creating a fixture, which returns to the schedule, from where it can be opened.

---

## 4. What you see

**A header** with the opponent, the date in full, the kick-off time, whether it is
home, away or neutral, and the competition.

**The fixture's details**, editable in place: opponent, date, kick-off, venue,
home or away, competition and importance.

**The post-match sheet card** (15 September 2026, migration 0127): what is
recorded against this fixture — "Nothing recorded against this fixture yet:
who was selected, who started, who came on, and minutes played." or "23
athletes selected · minutes recorded for 13 of 23." — with **Fill in the sheet
/ Edit the sheet** (coach and sport scientist) and **Match report** (every staff
role). The sheet is its own screen, `/schedule/fixtures/[fixtureId]/participation`:
one row per athlete on the roster with availability as it stood at kick-off
(read, not edited), a Selection control (Not selected · Started · Came on ·
Selected, not used) and a Minutes field (blank = not recorded; 0 is a real
value; 0 to 120). One button, **Save the sheet**, writes every row: an athlete
set back to "Not selected" is removed from the sheet, and each change is
audited (`match_participation.set` / `.remove`). Minutes on an athlete not
marked selected are refused in words. Nothing else — no positions, no events,
no score.

**Attach an existing match session** (the orphan's answer — an attach action,
never a backfill): shown to the coach and the sport scientist only while this
fixture has no match session anchored to it and the club has a match session
with no fixture. A select and one button; sets `sessions.fixture_id`, audited
as a session update. The same action sits on an unlinked match session's own
detail (`08-session-detail.md`), offering the fixtures within a week of it.

**The sessions built around it**, each shown as a card with its matchday label,
so the week reads as MD-3, MD-2, MD-1, MD. This is the point of separating
fixtures from sessions: the match is one thing, the week around it is another,
and moving the match does not destroy the week.

**The actions**: postpone, cancel, or mark as played. **There is no delete.**

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| None | The matchday labels | How many days each session sits from the match | The week | Absent when the week holds no fixture |

Matchday labels are worked out from the fixture's own date rather than stored, so
moving the match moves every label with it. They are not a metric and have no
registry entry.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Edit the fixture | Details card | Changes opponent, date, kick-off, venue, home or away, competition, importance | Stays here | Updates the fixture | Coach and sport scientist | Form submission | Should be hidden for view only roles. **Not built** |
| Postpone | Actions | Marks the fixture postponed. It stays on the schedule | Stays here | Sets the fixture's status | Coach and sport scientist | None | Hidden when already in that status |
| Cancel fixture | Actions | Marks the fixture cancelled. It stays on the schedule | Stays here | Sets the fixture's status | Coach and sport scientist | None | Hidden when already cancelled |
| Mark as played | Actions | Records that the match happened | Stays here | Sets the fixture's status | Coach and sport scientist | None | Hidden when already played |
| Fill in the sheet / Edit the sheet | Post-match sheet card | Opens the sheet | `/schedule/fixtures/[fixtureId]/participation` | Nothing | Coach and sport scientist | None | Other roles |
| Save the sheet | The sheet | Writes every row of the sheet | Stays there, with the outcome in words | `match_participation` rows (upsert, remove) and an audit row per change | Coach and sport scientist; the database refuses everyone else | None — every row is on the screen and each change is audited | Never |
| Match report | Post-match sheet card | Opens the report for this fixture | `/reports/match?fixture=` | Nothing | Any report role | None | Never |
| Attach to this fixture | Attach card | Links an unlinked match session to this fixture | Stays here, `?attach=done` | `sessions.fixture_id` and a session audit row | Coach and sport scientist | None | A match session is already anchored, or none is unlinked |
| A session card | Sessions list | Opens that session | `/schedule/[sessionId]` | Nothing | Any staff | None | Never |
| Schedule breadcrumb | Header | Back to the week | `/schedule` | Nothing | Any staff | None | Never |

**Moving a fixture's date is a bigger act than it looks.** Every matchday label
in that week is derived from it, so changing the kick-off date relabels the whole
week. This is correct behaviour and worth saying on the screen.

**Why a fixture cannot be deleted, and why that is right.** A session's delete
rule only has to reason about the session's own recorded data. A fixture's would
have to reason about every session anchored to it: deleting the match either
takes the week's training with it, or leaves a week of sessions labelled against a
match that no longer exists. No rule was ever agreed for which, so rather than
invent one, deletion was left out and the three status changes cover the real
cases (`src/components/FixtureActions/FixtureActions.tsx:20`). A fixture that
should not have existed is cancelled, not erased.

---

## 7. How this page is built, in plain English

Built on the server. The fixture, its sessions and the week's matchday labels are
fetched together.

An address that does not name a real fixture shows the standard not found page.

The edit form and the delete action run in the browser and submit to the server,
where the permission is checked again.

---

## 8. States

**Loading.** Renders when ready.

**Not found.** An address naming no fixture shows the not found page.

**No sessions attached.** The list says so. A fixture with no week built around it
is an ordinary state, not an error.

**Error.** Surfaces as an error, with the form left filled in.

**No permission.** Athletes are redirected.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **Every role can edit and delete a fixture.** Decision D-06.
- **Resolved. There is no delete, deliberately.** The question of what happens
  to a week's sessions when its match is removed was never answered, so the action
  was cut rather than guessed at
  (`src/components/FixtureActions/FixtureActions.tsx:20`). **Recorded as
  decision D-29**: confirm that cancelling is a sufficient answer for a fixture
  entered in error, or agree a deletion rule.
- **A fixture created by mistake cannot be removed.** It can only be cancelled,
  and a cancelled fixture stays on the schedule. Whether that is acceptable is
  the practical half of D-29.
