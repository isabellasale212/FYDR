# 46. Test history

## 1. Page name and URL

**Test history**, at `/testing/[testDefId]/[athleteId]`.

One athlete's results for one test, over time.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The history | Nothing here | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The history | Nothing | None | Base | Same |
| Medic | Yes | The history | Nothing | None | Base | Same |
| S&C | Yes | The history | Nothing | None | Base | Same |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing here | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/testing/[testDefId]/[athleteId]/page.tsx:28`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- An athlete's name on the result logging screen.
- A result cell on the testing report.

## 4. What you see

The test, the athlete, and every result they have recorded, in date order, with
the best marked. Superseded results are not shown alongside their corrections.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-028 | Each result | One measurement on one day | All time | An athlete with none sees an empty state |
| MET-029 | The marked best | **The best attempt on that day**, automatic or set by hand. Several dates each carry one. See D-40 | Per test date | Blank |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Download spreadsheet and PDF | Header | Download the history | Server routes | Nothing beyond an audit entry | Same as the page | None | Never |
| Athlete breadcrumb | Header | Opens the athlete | `/squad/[athleteId]` | Nothing | Any staff | None | Never |
| Test breadcrumb | Header | Back to result logging | `/testing/[testDefId]` | Nothing | Any staff | None | Never |

**Nothing on this page writes anything.**

## 7. How this page is built, in plain English

Built on the server. Deleted and superseded results are excluded, so the history
is what the club believes, not everything ever typed.

## 8. States

**No results.** An empty state. **One result.** Shown without a trend, because a
trend needs more than one point. **Offline.** Not handled.

## 9. Open issues

- **The nutritionist should not reach this.** Decision D-01.
