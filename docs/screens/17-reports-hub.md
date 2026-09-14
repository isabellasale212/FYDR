# 17. Reports hub

## 1. Page name and URL

**Reports**, at `/reports`.

The way in to seven reports. It holds no data of its own: it exists so that a coach
looking for "the medical one" reads seven titles rather than remembering seven
addresses.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | All eight on Premium; seven on Basic (the GPS report is absent) | Nothing | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | All seven | Nothing | None | Same | Same |
| Medic | Yes | All seven | Nothing | None | Same | Same |
| S&C | Yes | All seven | Nothing | None | Same | Same |
| Nutritionist | Yes | Five. **The injury and availability card is withheld** | Nothing | The injury card entirely | Same | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This page is deliberately open to every staff role, and that is the right
answer.** The six reports each require coach or medic. The hub does not, but it
works out report access anyway and **marks each card unavailable to a role that
cannot open it** (`src/app/(staff)/reports/page.tsx:120`). Nobody is sent down a
link that will refuse them.

The reasoning is recorded in the file itself: redirecting away from the index
entirely would hide that a reports feature exists at all, which is worse than
naming the real reason it is closed to this role. It is the same principle the
specification applies to product tier.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/reports/page.tsx:108`; `requireStaff()` at `src/app/(staff)/reports/page.tsx:119`; a product package check at `src/app/(staff)/reports/page.tsx:121`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Reports, the fourth item in the sidebar.
- The Compliance link on the dashboard's Outstanding entries card, which goes
  straight to one report rather than here.

---

## 4. What you see

**A header** naming the screen.

**One floor for every squad aggregate** (PATTERN-S7 C8, 13 September 2026):
`lib/smallSample.ts` — five athletes with data. Below it a median, a band, a
mean or a heat ramp is not shown, and the notice says so in one form: "Shading
is off — 3 athletes have data, fewer than 5. The individual numbers are
unchanged." Read by the positional band and the profile's row shading (the two
floors that existed, now one), the training report's heat ramp, the testing
report's median and quartiles, the compliance report's squad mean and the
analytics builder's population mean. Floors of another kind — an ACWR's 21 of
28 days, a rolling band's 10 observations — are about one athlete's history,
not the squad, and stay their own.

**Every report's export is scoped the way the screen was** (PATTERN-S7 C5,
confirmed 13 September 2026): the five export routes resolve the group filter
through `resolveGroupFilter` — the address's `?groups=` first, then the sticky
`fydr-group-filter` cookie every chip row writes — so a bare export URL, bookmarked or
typed, carries the scope the page was showing; the exports hub posts the scope
its page resolved.

**Seven cards in two groups** (PATTERN-S7 A1, 13 September 2026; seven since the
catalogue addendum split the training report the same day), each card with a
title, a sentence on what the report answers, and where its numbers come from.
The groups are what the question is about: **"About the squad over a period"**
— Compliance, Injury & availability, Training load, GPS report, Squad weekly —
and **"About one athlete, session or test"** — Athlete report, Testing.

| Card | What it answers | Package |
|---|---|---|
| Compliance | Who has and has not submitted what was expected | Base |
| Injury and availability | Who is unavailable, why in limited terms, and when they are expected back | Base |
| Training load | RPE × minutes, per athlete, over the period (the seventh; `65-training-load-report.md`). When the club has session RPE off the card's line says so and still links — the report carries the off state (`docs/decisions/absence-rule.md`) | Base |
| GPS report | One session, every athlete, every GPS metric, on one board (was "Training report"; `23-gps-report.md`) | **Premium**, and the card says so |
| Athlete report | Everything about one athlete over a period | Base |
| Squad weekly | The squad's week on one page | Base |
| Testing | Test results and personal bests | Base |

**The GPS report card is absent on the Basic package** (D-20 without exception,
Isabella, 15 September 2026). Until then it was dimmed and badged "Premium" so a
Basic club could see the report existed — the locked-destination pattern she
rejected: a wholly premium destination is absent from navigation and refuses at
the URL through the denied screen, logged; the Settings plan page is the one
place a club learns what Premium contains.

---

## 5. Every number on this page

None. The hub displays no figures of its own.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Compliance card | The grid | Opens the compliance report | `/reports/compliance` | Nothing | Coach, medic, sport scientist, S&C, nutritionist | None | Never |
| Injury and availability card | The grid | Opens the injury report | `/reports/injuries` | Nothing | Everyone except the nutritionist | None | **Should be hidden from the nutritionist. Not built** |
| Training load card | The grid | Opens the Training load report | `/reports/training-load` | Nothing | As the report (not the nutritionist) | None | Never; with session RPE off the line says so |
| GPS report card | The grid | Opens the GPS report | `/reports/gps` | Nothing | As the report | None | **Absent on the Basic package** (D-20); the URL refuses through the denied screen |
| Athlete report card | The grid | Opens the athlete picker | `/reports/athlete` | Nothing | As the report | None | Never |
| Squad weekly card | The grid | Opens the squad weekly report | `/reports/squad` | Nothing | As the report | None | Never |
| Testing card | The grid | Opens the testing report | `/reports/testing` | Nothing | As the report | None | Never |

**Nothing on this page writes anything.**

**Every report's Export CSV is a dialog** (PATTERN-S7 C3 and PATTERN-S8 C8, 13
September 2026; B11's one dialog pattern, `--w-dialog: 640px`). It names the file
before it is written — "Export compliance-2026-08-17-to-2026-09-13.csv" — and
states what the file holds: the report and its window, the scope with its athlete
count, every filter applied ("Ranked test: 40m sprint", "Session: Tuesday gym, 9
Sept", "The medic's copy") or "No filter beyond the window and the scope above.",
the row count with its noun ("15 rows, one per athlete"), on the medic's copy of
the injury report "Contains medical information. Handle under the club's data
policy.", and "Written to the audit log with your name and the row count." The
primary action is the download itself; Cancel writes nothing. **The file's own
header reads the same sentences back** as `#` lines — the definition first, then
who exported it and when — and **the audit row** (`report.<type>.export`) carries
`file`, `rows`, `filters` and `medical`. One descriptor (`src/lib/exportDescriptor.ts`),
built by the page for the dialog and by the route for the file and the audit row.

---

## 7. How this page is built, in plain English

Built on the server. The seven cards are a fixed list in the page itself, not a
database read, so the hub cannot fall out of step with what exists by showing a
report that has been removed.

The only thing it asks the server is the club's package, so it can mark the
Premium card.

---

## 8. States

**Loading.** Renders immediately.

**Empty.** Not possible. The seven cards always exist.

**Error.** Not possible for the card list. A failure to read the package would at
worst mark the Premium card wrongly.

**No permission.** Athletes are redirected. A staff member with no report access
sees all seven cards marked unavailable to them, with the reason, rather than being
turned away or sent down links that refuse.

**Wrong tier.** The GPS report card is absent; seven cards remain.

**Offline.** Not handled.

---

## 9. Open issues

- **The nutritionist should not see the injury card.** Decision D-01.
- ~~UNVERIFIED: whether the Premium card is clickable on the Base package.~~ It
  is not drawn (15 September 2026); verified as Marlow Vale's sport scientist.
