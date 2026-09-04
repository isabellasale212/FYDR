# 39. Board detail

## 1. Page name and URL

**Board detail**, at `/leaderboards/[leaderboardId]`.

One board in full: the standings, the measure, the period.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The standings | Nothing here | None | Base, **Premium for a GPS board** | Route guard, then a package check at `src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:95` |
| Coach | Yes | The standings | Nothing | None | Same | Same |
| Medic | Yes | The standings | Nothing | None | Same | Same |
| S&C | Yes | The standings | Nothing here | None | Same | Same |
| Nutritionist | Yes | The standings | Nothing | None | Same | Same |
| Athlete | **No** | Nothing here | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:47`; a **coach or medical** check at `src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:59`, which renders a named refusal rather than redirecting; a product package check at `src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:95`; a product package check at `src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:97`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A board on the leaderboard screen.

## 4. What you see

The board's name, its measure and period, and the standings. Athletes who have
opted out are simply absent.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-037 | Position | Where each athlete sits | The board's period | An athlete with no figure is absent |
| MET-038 | Not shown | The minimum population | The period | The board refuses to display |

The measure itself is whichever metric the board ranks: MET-001 is deliberately
excluded, see MET-039.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| An athlete's name | A row | Opens that athlete | `/squad/[athleteId]` | Nothing | Any staff | None | Never |
| Download spreadsheet and PDF | Header | Download the board | Server routes | Nothing beyond an audit entry | Same as the page | None | Never |
| Leaderboard breadcrumb | Header | Back to the list | `/leaderboards` | Nothing | Any staff | None | Never |

## 7. How this page is built, in plain English

Built on the server. A board on a GPS measure is refused on the Base package
**with an explanation of what it would show**, rather than being blank.

## 8. States

**Below the minimum population.** Says so. **A GPS board on Base.** An explanation
and an upgrade prompt. **Nobody qualifies.** Says so. **Offline.** Not handled.

## 9. Open issues

- None specific to this screen beyond D-24.
