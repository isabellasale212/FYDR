# 36. Athlete view of a programme

## 1. Page name and URL

**Athlete view**, at `/programmes/[programmeId]/athlete/[athleteId]`.

One programme as one athlete actually sees it: their real weights, their
overrides, their logged work.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Nothing here | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Everything | Nothing | None | Base | Same |
| Medic | Yes | Everything | Nothing | None | Base | Same |
| S&C | Yes | Everything | Nothing here. Editing is on the programme | None | Base | Same |
| Nutritionist | Yes | Everything | Nothing | None | Base | **NOT BUILT.** Gym is not the nutritionist's, Decision D-04 |
| Athlete | **No** | Nothing here. They see this in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/programmes/[programmeId]/athlete/[athleteId]/page.tsx:65`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- An athlete's name on the programme.
- An athlete's gym page, following their assignment.

## 4. What you see

The programme resolved for this person: every exercise with **their** weight
worked out from **their** best lift, the overrides that apply to them named
rather than silently applied, and what they have actually logged against it.

Exempt exercises are removed from their view; substitutes appear in place of the
original.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-030 | The weight beside each exercise | What this athlete should lift | Current | **Marked unresolvable**, with the reason, never a guess |
| MET-029 | The best lift behind it, with its date | **The most recent flagged attempt**, not the highest ever. See D-40 | Most recent test date | Blank, and the weight becomes unresolvable |
| MET-007 | Session load, where logged | How hard it was | Per session | Blank until logged |

**The test date is shown deliberately.** A weight derived from a six month old
test is not wrong, but it should be visible that it is.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Programme breadcrumb | Header | Back to the programme | `/programmes/[programmeId]` | Nothing | Any staff | None | Never |
| Athlete breadcrumb | Header | Opens the athlete | `/squad/[athleteId]` | Nothing | Any staff | None | Never |

**Nothing on this page writes anything.**

## 7. How this page is built, in plain English

Built on the server, with the resolution done by the database in one pass:
overrides applied, substitutes swapped in, exempt exercises removed, percentages
turned into kilograms from this athlete's best result.

Doing it in the database means this screen, the athlete's own app and any export
all get the same answer.

## 8. States

**Not assigned.** An athlete who is not on this programme is a valid address and
says so. **Unresolvable weights.** Named with the reason, so the honest answer is
that the athlete needs testing. **Nothing logged.** Says so. **Offline.** Not
handled.

## 9. Open issues

- **The nutritionist should not reach this.** Decision D-04.
