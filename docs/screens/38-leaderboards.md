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

**Phone width, 16 September 2026 (the evening queue, 2.5).** The column labels
sit in the filled band the athlete app's board carries — one rule,
`table.tbl.lb-table th` — with equal padding all round at `--fs-13`. **The
overlap bug:** the Leaderboard and Ranked-in dropdowns ran into each other by
8px at 390 (a stacked `.rsel` is 128px wide but its `.rsel-wrap` carried a
148px floor); each now takes half the row and the floor is lifted. The 390
sweep had measured the selects' heights, values and option counts, never their
boxes — which is why it passed; a bounding-box check is in the sweep now. The
under-18 exclusion sentence is a figure at phone width ("2 under-18 not
ranked"); the manage page's definition captions are the desktop's (2.3).

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

**Athletes under 18 are never on a ranked board.** Isabella's ruling, 13 September
2026 (Children's Code; migration 0116): the self-granted `leaderboard_visibility`
consent that lifted the exclusion from 0016 to 0115 no longer counts — until S9's
guardian route exists there is no opt-in path for an under-18 at all. "Academy"
is not a rule: age by date of birth is the legal trigger (an athlete with no date
of birth counts as a minor, `athlete_is_minor`); a group name is a club
convention. The published boards hold this at the database; **the staff wall**
(`fetchLeaderboardWall`) holds the same rule in the app on every board including
the wellness streak and compliance, computes nothing for an excluded athlete, and
says what it left out, counted and never named — as the figure "1 under-18
athlete not ranked" since 16 September 2026 (the text rule, category 4: the
sentence "An athlete under 18 is never named on a ranked board; nothing on this
screen changes that" is gone). Its Boards stat reads "club wide · 1 under-18 not
ranked". The rule is `src/lib/rankedBoardEligibility.ts`.

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

**Phone width (16 September 2026, the overnight queue, 2.5).** Below 768px the
wall is not drawn. In its place: a **Leaderboard** dropdown of every board that
exists and a **Ranked in** dropdown (positional unit, age band, whole squad),
then the one board's ranking as a list — position, athlete (opening the
profile), value — grouped by the scope with a count per group; the under-18
sentence beneath. Presentation: the same data, at phone width
(`docs/access-matrix.md` §8).

## 8. States

**No boards.** An empty state. **Below the minimum.** The board says it cannot be
shown and why. **A GPS board on the Base package.** Refused with an explanation.
**Session RPE is off for this club** (`organisations.collects_rpe`, Settings › Club,
migration 0118, 13 September 2026): a board whose measure is session load — RPE ×
minutes — keeps its page and its place in the list; the page shows "Session RPE is
off for this club" with "This club does not collect session RPE, so this board has
nothing to show. A sport scientist can switch it on in Settings › Club." in place
of standings, and the manage list's row says "Ranks nothing while session RPE is
off for this club". Attendance boards are unaffected. Nothing is deleted or
unpublished by the switch (`docs/decisions/absence-rule.md`). **Offline.** Not
handled.

## 9. Open issues

- **Every role can create and delete boards.** Decision D-05.
- **Two rankable measures can never be updated by any upload.** Decision D-24.
