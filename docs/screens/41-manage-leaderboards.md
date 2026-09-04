# 41. Manage leaderboards

## 1. Page name and URL

**Manage leaderboards**, at `/leaderboards/manage`.

Where boards are edited, retired and reordered.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every board | Edit, retire, reorder | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-05 |
| Medic | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| S&C | Yes | Every board | Edit, retire, reorder | None | Base | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

## 3. How you get here

- The Manage control on the leaderboard screen.
- Redirected here from the create screen when it lacks context.

## 4. What you see

Every board with its measure, period and scope, and the controls to change or
retire each.

## 5. Every number on this page

None beyond each board's own configuration.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Edit a board | A row | Changes its configuration | Stays here | Updates the board | S&C and sport scientist | Form submission | **Not built** |
| Retire a board | A row | Stops it appearing | Stays here | Marks it retired | Same | Yes | **Not built** |
| New leaderboard | Header | Opens the create screen | `/leaderboards/new` | Nothing | Same | None | **Not built** |

**Changing a board's measure changes what it has always shown**, because standings
are computed live rather than stored. A board renamed and re-pointed is not a new
board with a fresh history: it is the same board showing something else.

## 7. How this page is built, in plain English

Built on the server; editing runs in the browser.

## 8. States

**No boards.** An empty state. **Error.** Surfaces as an error. **Offline.** Not
handled.

## 9. Open issues

- **Every staff role can manage boards.** Decision D-05.
- **UNVERIFIED: whether retiring a board is reversible.** Files searched:
  `src/lib/queries/leaderboards.ts`.
