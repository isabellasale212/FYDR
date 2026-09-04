# 44. Testing

## 1. Page name and URL

**Testing**, at `/testing`.

The tests the club runs, and the way in to logging results.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every test | View, create, edit | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Every test | View, create, edit | None | Base | Same |
| Medic | Yes | Every test | **View only** in the agreed model | None | Base | **NOT BUILT** |
| S&C | Yes | Every test | View, create, edit | None | Base | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Not in the sidebar.** The previous specification records testing as folded into
Reports.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/testing/page.tsx:17`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Define a test link on the testing report.
- A direct link.

## 4. What you see

The club's test definitions, each with its name, unit, and **which direction is
better**. Then a way in to logging results for each.

A club with none sees an **Add a test** prompt.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-028 | Result counts per test | How many results exist | All time | Zero says so |

**The direction recorded against a test governs MET-029 everywhere.** For a sprint
the lowest time is the best; for a lift the highest weight is. Nothing else in the
app decides this.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Add a test | Header or empty state | Defines a new test | Stays here | Writes a test definition | Coach, S&C, sport scientist | Form submission | **Not built** |
| A test's name | The list | Opens result logging | `/testing/[testDefId]` | Nothing | Any staff today | None | Never |

**Changing a test's direction after results exist would re-decide every personal
best for it.** Worth stating on the edit control.

## 7. How this page is built, in plain English

Built on the server.

## 8. States

**No tests.** An empty state with a prompt. **Error.** Surfaces as an error.
**Offline.** Not handled.

## 9. Open issues

- **The nutritionist should not reach testing.** Decision D-01.
- **Not in the sidebar.** Part of decision D-34.
- **Resolved, and it is silently allowed with a real consequence.** Changing the
  direction recalculates nothing: the rule that flags the best attempt runs when a
  result is written, not when a definition changes
  (`supabase/migrations/0024_testing.sql:163`). Every existing flag keeps pointing
  at what used to be the best. Decision D-41.
