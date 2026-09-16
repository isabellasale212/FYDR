# 45. Log results

## 1. Page name and URL

**Log results**, at `/testing/[testDefId]`.

Records what the squad did on one test.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The squad and their results | Log and correct results | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Same | Log and correct | None | Base | Same |
| Medic | Yes | Same | Record and edit results — **corrected 15 September 2026** with the Testing row (`decisions/decision-batch-2026-09-15.md` #4): `test_results_staff_insert` / `_update` have admitted the medic since `0024` | None | Base | Row-level security (0073) |
| S&C | Yes | Same | Log and correct | None | Base | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/testing/[testDefId]/page.tsx:26`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A test's name on the testing screen.
- A result cell on the testing report.

## 4. What you see

**Who this test is for** (migration 0130, 14 September 2026, decision batch
#3) — the first card under the group filter. The sentence says who the test is
assigned to today, resolved by the database: "Assigned to the whole squad — 29
athletes in data today.", or "Assigned to 14 athletes today: Backs, Dan
Okonkwo. A group is read as its members now, so an athlete who joins or leaves
it is assigned or not with it.", or "Assigned to nobody. {test} appears on no
sheet and no report until it is assigned." Then the chips — Whole squad, each
group, each athlete — each with its own remove for the roles that define a
test; then "+ Whole squad" when it is not, a group picker with Add, an athlete
picker with Add. Every definition starts assigned to the whole squad. Removing
is a `removed_at`, never a delete, and nothing already logged changes. The
sheet below lists the assigned athletes within the group filter; with nobody
assigned it says so and points up.

The test's name, unit and direction. The squad, with a field per athlete for the
day's result, and their previous best beside it for context.

**Phone width, 16 September 2026 (the evening queue, 2.7).** Below 768px the
page is the logging sheet: a **Player** name filter (start of a first or last
name; "12 of 30" beneath it) above the grid, the date in the crumb ("· today"),
and nothing else — the scope line, the assign control, the date stepper and
the autosave footer prose are the desktop's. The grid's cells, + Attempt and
the per-cell saved state are unchanged.

**The text rule, 16 September 2026.** The footer paragraph — "Values save on
their own when you press Enter or move to the next box — there is no save
button… Tap a name for history…" — is gone at every width (category 1: helper
prose). Each cell's own saved state is the fact, and stays.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-028 | The entered value | One result for one athlete on one day | That day | Blank. A blank is not a zero |
| MET-029 | The best beside it | **Their best attempt on that day.** See D-40 | Per test date | Blank for an athlete who has never done it |

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
