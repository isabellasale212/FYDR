# 64. Club setup

## 1. Page name and URL

**Club setup**, at `/settings/setup`. Built 13 September 2026 (PATTERN-S8 C1,
the S8 board's artboard 0).

The setup checklist a new club lands on: five steps, in the order that saves
the most rework, each with a count and a done or outstanding state. **A list of
what is still on a default, not a gate**: the club can use Fydr from the first
step onwards. It lives here in Settings for good; the dashboard carries one line
while any step is outstanding.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden or masked | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The five steps, their counts, the one that matters most | Nothing here — every step links to its own screen | None | Base | `requireStaff()`, then `SETTINGS_ADMIN` (redirects to `/settings`) |
| Coach, Medic, S&C, Nutritionist | **No** | Redirected to Settings | — | The whole page | Base | Same |
| Athlete | **No** | Nothing | — | The whole page | n/a | Middleware, then guard |

## 3. How you get here

- Settings › Club › **Setup checklist** ("2 of 5 done" on the row; "5 of 5 done"
  once finished — the row stays).
- The dashboard's one line, for the sport scientist, while any step is
  outstanding: "Getting Ashcombe Rugby Club set up: 2 of 5 done. Set thresholds
  is still outstanding — every colour and flag on this dashboard is a Fydr
  default, not yours." with **Continue setup**. It is a status line, not the
  dashboard's emphasised card, and it goes once every step is done.

## 4. What you see

The sentence: "Five steps, in this order, because each one needs the one above
it. You can use Fydr from the first step onwards — this is a list of what is
still on a default, not a gate. 2 of 5 done." A five-segment bar. Then the five
steps, each numbered, with a Done or Outstanding pill, why it comes here, its
count, and its own button (a primary button on an outstanding step, a ghost on
a done one). Outstanding rows sit on the warn wash.

| # | Step | Done when | Count |
|---|---|---|---|
| 1 | Add athletes | At least one live athlete | "30 athletes" / "No athletes yet" |
| 2 | Make groups | At least one live group | "5 groups · 3 athletes in none" / "No groups yet" |
| 3 | Set thresholds | At least one active threshold has a creator — **D8, answered 13 September 2026: no creator means a Fydr default** | "0 of 6 lines changed — all Fydr defaults" / "4 lines of 6 Ashcombe's own" / "No thresholds — nothing raises a flag" |
| 4 | Invite staff | At least one staff account, none still invited | "6 of 7 accounts signed in", the state "1 invitation outstanding"; links the users list filtered to `?status=invited` |
| 5 | Assign roles | At least one account, none without a role | "Every account has a role" / "1 account has no role" / "No accounts yet" |

**The one that matters most.** While thresholds are outstanding, a warn-washed
card below the list: "Thresholds, because every colour in the app is currently
a Fydr default — Ashcombe's dashboard is already flagging athletes against lines
nobody at the club chose. The defaults are reasonable, not right, and each rule
says so on the thresholds screen — 'One of the club defaults' — until someone
here sets it."

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | The five counts | Live athletes; live groups and athletes in none; active thresholds and how many are the club's own; staff accounts signed in of total; accounts with no role | Now | Words ("No athletes yet"), never a bare 0 |
| None | N of 5 done | Steps done | Now | — |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| A step's button | Its row | Opens the screen that completes the step | `/squad` or `/squad/new`, `/settings/groups` or `/settings/groups/new`, `/settings/thresholds`, `/settings/users` (`?status=invited` while an invitation is outstanding) | Nothing | Sport scientist | None | Never |

**Nothing on this page writes anything.** It reads counts (`fetchSetupCounts`)
and says them.

## 7. How this page is built, in plain English

Built on the server. `src/lib/setupChecklist.ts` decides the five steps, their
states and their words from the counts; the hub row, the dashboard line and this
page read the same steps.

## 8. States

**Nothing done** — every step outstanding, each pointing at its door.
**Everything done** — "5 of 5 done", every row a ghost button, and "Every step
is done. This page stays here in Settings; nothing on it blocks anything."
**Error** — surfaces as an error.

## 9. Open issues

- None recorded. Whether a threshold's "own" marker should survive a club
  editing a default back to its default value is a property of `created_by`,
  not of this page.
