# 45. Log results

## 1. Page name and URL

**Log results**, at `/testing/[testDefId]`.

Records what the squad did on one test.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The squad and their results | Log and correct results | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Same | Log and correct | None | Base | Same |
| Medic | Yes | Same | **View only** in the agreed model | None | Base | **NOT BUILT** |
| S&C | Yes | Same | Log and correct | None | Base | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

## 3. How you get here

- A test's name on the testing screen.
- A result cell on the testing report.

## 4. What you see

The test's name, unit and direction. The squad, with a field per athlete for the
day's result, and their previous best beside it for context.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-028 | The entered value | One result for one athlete on one day | That day | Blank. A blank is not a zero |
| MET-029 | The best beside it | Their best ever for this test | All time | Blank for an athlete who has never done it |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| A result field | Per athlete | Records a result | Stays here | Writes a result and **may re-decide that athlete's personal best** | Coach, S&C, sport scientist | Form submission | **Not built** |
| Date | Header | The date the test was done, not the date it is typed | Stays here | Applies to what is saved | Same | None | Never |
| **Mark as best by hand** | Per athlete | Overrides the automatic best | Stays here | Sets a manual best, **and the automatic rule stops overriding it** | Same | Form submission | Not shown where no results exist |
| An athlete's name | Per athlete | Opens their history for this test | `/testing/[testDefId]/[athleteId]` | Nothing | Any staff today | None | Never |

**Why a manual best exists.** A mistimed sprint would otherwise sit permanently as
an athlete's personal best, and re-running the automatic rule would keep restoring
it. Marking by hand stops that
(`supabase/migrations/0024_testing.sql:31`).

**Corrections do not overwrite.** A corrected result supersedes the old one, which
is kept. Performance data that can be silently edited is worthless for trends.

## 7. How this page is built, in plain English

Built on the server; the form runs in the browser.

Saving a result triggers the database to re-decide who holds the best for that
test, unless a manual best is in force.

## 8. States

**No athletes in scope.** Says so. **Saving.** Disabled and says so. **Error.**
The form stays with the values entered. **Offline.** The connection sentence.

## 9. Open issues

- **The nutritionist should not reach this.** Decision D-01.
- **UNVERIFIED: whether the date defaults to today or must be chosen**, which
  matters because filing a result against the wrong day silently misplaces it in
  every trend. Files searched: `src/app/(staff)/testing/[testDefId]/page.tsx`.
