# 40. New leaderboard

## 1. Page name and URL

**New leaderboard**, at `/leaderboards/new`.

Creates a board: what it ranks, over what period, for whom.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The form | Create a board | None | Base, GPS measures need Premium | Route guard |
| Coach | **No** in the agreed model | Nothing | Nothing | The whole page | Same | **NOT BUILT.** Decision D-05 |
| Medic | **No** in the agreed model | Nothing | Nothing | The whole page | Same | **NOT BUILT** |
| S&C | Yes | The form | Create a board | None | Same | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Same | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

## 3. How you get here

- The New leaderboard control. It redirects to the management screen when reached
  without the right context.

## 4. What you see

A name, the measure to rank, how to summarise it, the period, and who is in
scope.

**On the Base package the GPS measures are not offered**, because a board built on
them would never populate.

## 5. Every number on this page

None. The measure chosen here becomes MET-037 for that board.

**Readiness is not offered**, deliberately. See MET-039: ranking how an athlete
says they feel teaches athletes that honest answers put them at the bottom.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Name | Top | Names the board | Stays here | Nothing until submitted | S&C and sport scientist | None | Never |
| Measure chooser | Middle | Picks what to rank | Stays here | Nothing until submitted | Same | None | GPS measures absent on Base |
| Summary chooser | Middle | Total, average or count, limited to what the measure allows | Stays here | Nothing until submitted | Same | None | Options not permitted by the measure are absent |
| Period | Middle | Bounds the board | Stays here | Nothing until submitted | Same | None | Never |
| **Create** | Foot | Writes the board | The board | Creates one board | S&C and sport scientist | The form is the confirmation | Disabled while saving |

## 7. How this page is built, in plain English

Built on the server, which supplies the measures and the package. Which summaries
a measure permits is a property of the measure, so a board cannot be built that
averages something only meaningful as a total.

## 8. States

**Saving.** Disabled and says so. **Error.** The form stays. **Offline.** The
connection sentence.

## 9. Open issues

- **Every staff role can create a board.** Decision D-05.
- **Two measures can be chosen that no upload will ever populate.** Decision D-24.
