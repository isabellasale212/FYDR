# 55. Groups

## 1. Page name and URL

**Groups**, at `/settings/groups`.

The squad groups the whole app filters by. Forwards, backs, academy, a rehab
group, an S&C group: whatever subsets the club actually works in.

**This screen is more important than its position in Settings suggests.** Every
multi-athlete screen in Fydr is filtered by these groups, and the choice follows a
person from screen to screen.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every group | View, create, edit, delete | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Every group | View, create, edit, delete | None | Base | Same |
| Medic | Yes | Every group | **View only** in the agreed model | None | Base | **NOT BUILT** |
| S&C | Yes | Every group | **View only** in the agreed model | None | Base | **NOT BUILT** |
| Nutritionist | Yes | Every group | **View only** in the agreed model | None | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/groups/page.tsx:19`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Groups link in Settings.
- A link from the squad overview.

## 4. What you see

Every group with its name and how many athletes are in it. A control to create
another.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Athletes per group | How many are in each | Now | An empty group says so, and is a valid state |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| A group's name | The list | Opens it | `/settings/groups/[groupId]` | Nothing | Any staff today | None | Never |
| New group | Header | Opens the create screen | `/settings/groups/new` | Nothing | Coach and sport scientist | None | **Not built** |
| ▲ / ▼ beside a group | The list, when a type has two or more groups | Swaps the group with its neighbour of the same type | Stays here | `groups.sort_order` on both rows, each checked for the row it changed (`moveGroup`, `mustAffect`) | Coach and sport scientist (`GROUP_EDIT`). Every other role sees the same arrows blocked — `aria-disabled`, the reason beneath the row on tap: "Reordering groups belongs to the coach and the sport scientist." — never a silent no-op (§0az, decided 2026-09-12) | None | Never; the first group's ▲ and the last group's ▼ are disabled |

**An athlete may be in several groups**, and that is the intended use. Groups are
not a hierarchy and do not have to be exclusive.

## 7. How this page is built, in plain English

Built on the server, reading the groups with their membership counts.

## 8. States

**No groups.** An empty state. The whole squad is still reachable: no groups means
no filtering, not no athletes. **Error.** Surfaces as an error. **Offline.** Not
handled.

## 9. Open issues

- **Every role can create and delete groups.** Deleting a group that screens are
  filtered by will change what people see. **UNVERIFIED: what happens to a saved
  filter naming a deleted group.** Files searched: `src/lib/queries/groups.ts`,
  `src/lib/groupFilter.server.ts`.
