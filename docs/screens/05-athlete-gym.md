# 05. Athlete gym

## 1. Page name and URL

**Gym**, at `/squad/[athleteId]/gym`.

One athlete's gym work: the programme they are on, what has been tailored for
them, and what they have actually logged.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | View only here. Programmes are edited in the programme section | None | Base | `src/lib/athleteDomain.server.ts:89` then `:93` |
| Coach | Yes | Everything | View only | None | Base | Same |
| Medic | Yes | Everything | View only | None | Base | Same |
| S&C | Yes | Everything. **This is the S&C's own screen** | View only here | None | Base | Same |
| Nutritionist | **No** | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing here. Athletes see their own programme in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

A refused role sees a named refusal headed Gym, saying it is not part of their
role, rather than a blank page.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `loadAthleteDomainContext()` at `src/app/(staff)/squad/[athleteId]/gym/page.tsx:150`; a shared coach-or-medical check at `src/lib/athleteDomain.server.ts:93`, refused at `src/app/(staff)/squad/[athleteId]/gym/page.tsx:151`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Gym chip on the athlete's profile.
- From a programme, following a link to how one athlete is getting on with it.

---

## 4. What you see

**A header** naming the athlete, with breadcrumbs back to the squad and to the
athlete.

**A period selector** offering week, month, season, year and all, with any period
the data cannot cover shown disabled and its reason given.

**The programme they are on.** The athlete's current assignment, shown first
because it is the thing a coach came to see. Where several assignments exist, the
active one is shown, and the most recently started active one wins.

**Tailoring for this athlete.** Where the programme has been adjusted for this
person, the adjustment is named. Five kinds of adjustment exist: exempt from an
exercise, a substitute exercise, a change of volume, a cap on load, and a note.

**Prescribed weights.** Where an exercise is written as a percentage rather than a
fixed weight, the real kilogram figure for **this** athlete is shown, worked out
from their own best lift, with the date of the test it came from.

**Recent gym sessions.** What the athlete has actually logged, most recent first,
within the chosen period. The list is capped and says so when there is more.

**Positional context**, placing the athlete against others in the same positional
unit.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-030 | The kilogram figure beside an exercise | What this athlete should lift, worked out from their own best | Current | **Marked unresolvable**, not guessed, when the exercise names no test or the athlete has no result for it |
| MET-029 | The best lift behind that figure, with its date | **The most recent flagged attempt**, not the highest ever. See D-40 | Most recent test date | Blank, and the prescribed weight becomes unresolvable |
| MET-007 | Session load, where shown | How hard a session was, rating times minutes | Per session | Blank if either rating or duration is missing |

**The date matters and is shown on purpose.** A weight derived from a six month
old test is not wrong, but a coach should be able to see that is what it is.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Period selector | Below the header | Changes the window for the session list | Stays here, period in the address | Nothing | Any staff who can reach the page | None | A period the data cannot express is disabled with its reason |
| The programme name | Programme card | Opens that programme as this athlete sees it | `/programmes/[id]/athlete/[athleteId]` | Nothing | Same | None | Hidden when no programme is assigned |
| Squad and athlete breadcrumbs | Header | Back up | `/squad`, `/squad/[athleteId]` | Nothing | Same | None | Never |

**Nothing on this page writes anything.** Logging happens in the athlete's own
app, and programme editing happens in the programme section.

---

## 7. How this page is built, in plain English

Built on the server through the same shared loader as wellness and nutrition, so
the permission check, the athlete lookup and the period handling exist once.

The page asks three questions at the same time: which positional unit this
athlete belongs to, what programmes they are assigned, and their recent gym
sessions.

**The prescribed weight is worked out by the database, not the app.** The
calculation joins the exercise to the test that measures its one repetition
maximum, finds the athlete's best result for that test, and multiplies. Doing it
in the database means every screen that shows a prescribed weight gets the same
answer.

**One extra row is always fetched.** The session list asks for one more than it
intends to show, purely so it can tell whether there is more without asking a
second question.

---

## 8. States

**Loading.** Renders when ready.

**Empty, and there are three different empties here.** No programme assigned. A
programme assigned but nothing logged yet. A period chosen that contains no
sessions. Each says which it is, because the three call for different responses
from a coach.

**Unresolvable weights.** An exercise whose weight cannot be worked out says so
rather than showing a blank or a zero, and the honest answer for a coach is that
the athlete needs testing.

**Error.** Surfaces as an error.

**No permission.** The named refusal headed Gym.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **This screen has no entry in the previous specification set.** This file is
  its first specification.
- **The nutritionist exclusion is not built.** Decision D-01.
- **UNVERIFIED: how many sessions the list shows before it truncates**, and
  whether the truncation offers a way to see the rest. Files searched:
  `src/app/(staff)/squad/[athleteId]/gym/page.tsx`.
