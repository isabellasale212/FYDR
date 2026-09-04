# 01. Dashboard

## 1. Page name and URL

**Dashboard**, at `/dashboard`.

The landing screen for every staff member except one who holds only the
nutritionist role. It answers one question: who needs me this morning.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything on the page | Nothing. This page only links onward | None | Base. The week load card needs Premium, see section 8 | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Everything | Nothing | Clinical detail is not on this page at all | Base | Same guard |
| Medic | Yes | Everything | Nothing | None | Base | Same guard |
| S&C | Yes | Everything | Nothing | None | Base | Same guard |
| Nutritionist | Yes | The page **without** its injury derived parts | Nothing | The availability split and its named lists, the reason and restriction text, and any flag whose domain is injury or availability | Base | **NOT BUILT.** Today the page is gated to coach or medical at `src/app/(staff)/dashboard/page.tsx:151`, which a nutritionist passes because they hold the coach role |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, `src/lib/supabase/middleware.ts:84`, then the page guard, then the database |

**A user with the right role but the wrong tier** sees the page in full except
the Week load card. What that card shows on the Base package is undecided,
decision D-23.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/dashboard/page.tsx:139`; a **coach or medical** check at `src/app/(staff)/dashboard/page.tsx:151`, which renders a named refusal rather than redirecting. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Signing in, for anyone holding coach, medic, S&C or sport scientist.
- The first item in the left sidebar.
- The Fydr wordmark at the top of the sidebar.
- Any link that says Dashboard.

A person holding **only** the nutritionist role does not land here. Where they
land is undecided and is raised in section 9.

---

## 4. What you see

Top to bottom.

**The top bar** carries the group filter and the date. Choosing a group narrows
every number on the page at once, and the choice follows you to every other
screen.

**Five headline tiles** across the top.

- **Need you.** How many athletes have something that wants attention today.
  Clicking it goes to the flags for that day.
- **Wellness in.** What share of today's expected check-ins have arrived.
  Clicking it expands to name who has not submitted, rather than sending you to
  another page to find out.
- **Available.** The squad's availability as a fraction, with modified and out
  counts beneath. Clicking it expands to name them, each with their reason.
- **Open flags.** How many alerts are unresolved. Clicking it goes to the flags
  screen.
- **To matchday.** How many days to the next fixture, and who it is against.
  Clicking it opens that fixture.

**Needs attention.** The ranked list of athletes who need a conversation, each
with a one line reason. This is the page. Everything else is the packaging.

**Today.** What is scheduled, in time order, or a line saying nothing is.

**Ready for Saturday.** The selection picture for the next fixture, on one card:
the opponent and how many days away, a ring showing how many of the squad can be
named, a bar showing the three way availability split, and five rows. The first
three are that split with the players named. The last two are the other things
that bear on selection: flags this week, and sessions still to run.

**Outstanding entries.** What has not been submitted yet, by kind, with a link to
the compliance report.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-012 | Wellness in | Share of expected check-ins received | Today | Empty, never 0 percent, when nobody was expected |
| MET-013 | Fit and available, Doubtful, Ruled out | The three way availability split | Right now | An athlete with no availability record is counted in none of the three |
| MET-014 | Named | How many of the squad can be picked | Right now | No percentage when the squad is empty |
| MET-015 | Week load so far | Squad running this week against a normal week | Monday to today | Empty when no earlier week has GPS data |
| MET-016 | Open flags | Unresolved alerts | Now | Zero is a real answer here |
| MET-001 | Readiness, inside the attention rows | How ready an athlete says they feel | The day quoted | Blank |

Formulas are in `docs/metrics.md`. They are not repeated here.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Top bar | Narrows every number on the page | Stays here, with the group in the address | Nothing. A cookie remembers your choice | Any staff | None | Never |
| Need you tile | Tile strip | Opens the flags for that day | `/flags?date=` | Nothing | Any staff | None | Never |
| Wellness in tile | Tile strip | Expands in place to name who is missing | Stays here | Nothing | Any staff | None | Never |
| Available tile | Tile strip | Expands in place to name who is modified or out, each with a reason | Stays here | Nothing | Any staff | None | Never |
| Open flags tile | Tile strip | Opens the flags screen | `/flags` | Nothing | Any staff | None | Never |
| To matchday tile | Tile strip | Opens the next fixture | `/schedule/fixtures/[id]` | Nothing | Any staff | None | Falls back to `/schedule` when no fixture is booked |
| An attention row | Needs attention | Opens that athlete | `/squad/[athleteId]` | Nothing | Any staff | None | Never |
| Fit and available, Doubtful, Ruled out rows | Ready for Saturday | Opens the squad | `/squad` | Nothing | Any staff | None | Never |
| Flags affecting selection row | Ready for Saturday | Opens the flags screen | `/flags` | Nothing | Any staff | None | Never |
| Sessions left to run row | Ready for Saturday | Opens the schedule | `/schedule` | Nothing | Any staff | None | Never |
| Compliance link | Outstanding entries | Opens the compliance report | `/reports/compliance` | Nothing | Coach or medic today | None | Never |
| Print | Top bar | Opens the browser print dialogue | Stays here | Nothing | Any staff | Browser's own | Never |

**Nothing on this page writes anything.** It is a reading screen. That is worth
stating because it means no confirmation step is needed anywhere on it.

---

## 7. How this page is built, in plain English

The page is built on the server before it reaches the browser. Six questions are
asked of the database at the same time rather than one after another: the group
list, the headline figures, the week strip, today's timeline, the readiness
picture, and the outstanding entries.

**Today is not always the real today.** The page works out the most recent date
that actually has data behind it and uses that, rather than going blank as real
time moves past the point the club's data reaches. Sessions that have passed are
judged against the real clock, not against an end of day stand in.

Two small parts run in the browser rather than on the server: the two tiles that
expand in place, and the group filter chips. Everything else is fixed by the time
the page arrives.

The group filter lives in the address, not in hidden state, so a filtered
dashboard can be sent to a colleague and they will see the same thing.

---

## 8. States

**Loading.** The page renders when its data is ready. There is no partial state.

**Empty.** Each region says so in words: nothing scheduled for this day for this
filter; nobody carrying a restriction; no fixture scheduled.

**Error.** A failed query surfaces as an error rather than an empty region, so a
broken read is never mistaken for a quiet day.

**No permission.** An athlete is redirected before the page is built. A
nutritionist-only user is redirected too, which is an open issue, see section 9.

**Wrong tier.** Undecided for the Week load card. Decision D-23.

**Offline.** Not handled. This is a server rendered page and it does not load at
all without a connection.

---

## 9. Open issues

- **The nutritionist restriction is not built.** Every injury derived region on
  this page is currently visible to whoever holds the coach role, which today
  includes nutritionists. Decision D-01.
- **Where a nutritionist-only user lands is undefined.** The landing rule sends a
  staff member without squad access to Settings. With five roles that rule needs
  rewriting. Decision D-07.
- **What the Week load card shows on the Base package is undefined.** It is built
  entirely from GPS, which is Premium. Decision D-23.
- **UNVERIFIED: whether the attention list has its own limit.** Files searched:
  `src/app/(staff)/dashboard/page.tsx`, `src/lib/queries/flags.ts`.
