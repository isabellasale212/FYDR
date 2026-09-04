# 28. Rehab groups

## 1. Page name and URL

**Rehab groups**, at `/injuries/rehab-groups`.

Which injured athletes are working together, so rehabilitation is organised as
groups rather than as a list of individuals.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The board | View and edit | The eight clinical fields | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The board | **View only** in the agreed model | The same eight | Base | **NOT BUILT** |
| Medic | Yes | The board | View and edit | None | Base | Same guard |
| S&C | Yes | The board | View and edit. **Rehabilitation is shared S&C and medical work** | The same eight | Base | **NOT BUILT** |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/injuries/rehab-groups/page.tsx:31`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A link from the injuries area. **Not in the sidebar.** Decision D-34.

## 4. What you see

A header with the group filter, then a board of rehab groups, each holding the
athletes assigned to it, in the limited injury view: body area, restrictions and
expected return, never a diagnosis.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-013 | Availability, per athlete | Whether they can train | Now | Unknown |
| None | Athletes per group | How many are in each | Now | An empty group says so |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the board | Stays here | Nothing | Any staff today | None | Never |
| Move an athlete between groups | The board | Reassigns them | Stays here | Updates their rehab assignment | Medic and S&C in the agreed model | None. Reassignment is reversible | Should be hidden from view only roles. **Not built** |
| An athlete's name | The board | Opens that athlete | `/squad/[athleteId]` | Nothing | Any staff today | None | Never |

## 7. How this page is built, in plain English

Built on the server, which reads the rehab groups and the board of assignments,
scoped by the group filter. The board runs in the browser so that reassigning is
immediate.

## 8. States

**Empty.** A club with no rehab groups sees an empty state explaining what they
are for. **No injured athletes.** A good outcome, said as one. **Error.** Surfaces
as an error. **No permission.** Athletes redirected; the nutritionist should be
and is not. **Wrong tier.** Not applicable. **Offline.** Not handled.

## 9. Open issues

- **No role gate.** Decision D-01.
- **UNVERIFIED: whether reassigning is written immediately or held until a save**,
  which decides what a dropped connection costs. Files searched:
  `src/components/RehabGroupBoard/RehabGroupBoard.tsx`.
