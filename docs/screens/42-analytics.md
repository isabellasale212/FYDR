# 42. Analytics

## 1. Page name and URL

**Analytics**, at `/analytics`.

Build a view of the club's data and compare cohorts. **Premium package only, and
in the agreed model, sport scientist only.**

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Build and save views | None | **Premium** | Route guard, then a package check at `src/app/(staff)/analytics/page.tsx:220` |
| Coach | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT.** Decision D-02 |
| Medic | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT.** Decision D-02 |
| S&C | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT.** Decision D-02 |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT.** Decision D-02 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This is the only whole destination that disappears from the sidebar on the Base
package** (`src/components/Sidebar/Sidebar.tsx:64`). Everything else that is
Premium sits inside a destination that has Base content too.

## 3. How you get here

- Analytics, the eighth sidebar item, on Premium only.

## 4. What you see

A header with the group filter and a **Compare against** control, which is the
point of the screen: a cohort read against another cohort rather than against
nothing.

Then the built view: the chosen measures over the chosen period, with each
athlete's own normal range where one applies.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| **MET-002** | **Readiness** | **The strict version. A day missing any one of the five scales has no value at all** | Daily | **Empty where every other screen would show a number** |
| MET-003 | Sleep hours | Hours slept | Daily | Blank |
| MET-004 | Soreness | 1 to 5, 5 is least sore | Daily | Blank |
| MET-005 | Body mass | Kilograms | Daily | Blank |
| MET-006 | The shaded band | The athlete's own normal range | 28 observations, with 27 days of run-up fetched | No band until the run-up exists |
| MET-010 | Acute to chronic ratio | This week against a typical week | 7 over 28 days | Withheld below 21 days with data |
| MET-017 to MET-023 | The GPS measures | As in the registry, with the vendor caveat | Per session | Blank |

**This screen shows a different readiness figure from every other screen in
Fydr.** An athlete who filled four of five sliders appears here with nothing and
elsewhere with a score. Decision D-22.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the scope | Stays here | Nothing | Any staff today | None | Never |
| Compare against | Header | Chooses the cohort to compare with | Stays here | Nothing | Same | None | Never |
| Build a view | Header | Opens the builder | `/analytics/build` | Nothing | Sport scientist | None | **Not built** |

## 7. How this page is built, in plain English

Built on the server.

**Bands need run-up.** A 28 observation band on the first visible day needs the 27
days before it, so those are deliberately fetched and not drawn. Without them the
opening third of every short window had no band, which reads as "this athlete has
no norm" when the truth is "we did not ask for the days that would show one".

## 8. States

**Base package.** The whole destination is absent from the sidebar and the address
refuses. **Nobody in scope.** Says so. **A preset whose data exists but which is
not built** is named as such rather than shown empty
(`src/lib/queries/analytics.ts:17`). **Offline.** Not handled.

## 9. Open issues

- **Every staff role reaches this today.** Decision D-02.
- **The readiness figure here disagrees with every other screen**, and an internal
  note claims otherwise. Decision D-22.
