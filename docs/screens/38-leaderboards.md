# 38. Leaderboard

## 1. Page name and URL

**Leaderboard**, at `/leaderboards`.

The club's boards. Who is top of what, over what period.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every board | View, create, edit, delete | None | Base, GPS boards need Premium | Route guard, then a coach or medic check |
| Coach | Yes | Every board | **View only** | None | Same | **NOT BUILT.** Decision D-05 |
| Medic | Yes | Every board | **View only** | None | Same | **NOT BUILT** |
| S&C | Yes | Every board | View, create, edit, delete | None | Same | **NOT BUILT** |
| Nutritionist | Yes | Every board | **View only** | None | Same | **NOT BUILT** |
| Athlete | **No** | Nothing here. Athletes see boards in their own app, subject to consent | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/leaderboards/page.tsx:34`; a **coach or medical** check at `src/app/(staff)/leaderboards/page.tsx:50`, which renders a named refusal rather than redirecting. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Leaderboard, the seventh item in the sidebar.

## 4. What you see

A header with the group filter. Then the club's boards, each named, with its
measure and period, and the current standings.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-037 | The position numbers | Where each athlete sits on this measure | The board's period | An athlete with no figure does not appear, rather than appearing last |
| MET-038 | Not shown as a number | The minimum who must qualify before a board displays at all | The period | The board says it cannot be shown, rather than showing two names |

**Three rules a coach should know.**

**Which direction wins is a property of the measure**, not the board. A sprint
time and a distance sort opposite ways.

**Opt outs are absolute and invisible.** An athlete who has opted out does not
appear, and neither the fact nor the reason is shown to anyone reading the board.
A board cannot be configured to refuse opt outs.

**Athletes under 18 appear only with recorded consent.** Silence means absent.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the boards | Stays here | Nothing | Coach or medic today | None | Never |
| A board | The list | Opens it | `/leaderboards/[leaderboardId]` | Nothing | Same | None | Never |
| New leaderboard | Header | Opens the create screen | `/leaderboards/new` | Nothing | S&C and sport scientist | None | **Not built** |
| Manage | Header | Opens the management screen | `/leaderboards/manage` | Nothing | S&C and sport scientist | None | **Not built** |

## 7. How this page is built, in plain English

Built on the server. Standings are computed by the database, which is also where
the opt out and consent rules are applied, so no screen can accidentally show
somebody who should not appear.

## 8. States

**No boards.** An empty state. **Below the minimum.** The board says it cannot be
shown and why. **A GPS board on the Base package.** Refused with an explanation.
**Offline.** Not handled.

## 9. Open issues

- **Every role can create and delete boards.** Decision D-05.
- **Two rankable measures can never be updated by any upload.** Decision D-24.
