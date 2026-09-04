# 52. Data retention

## 1. Page name and URL

**Data retention**, at `/settings/retention`.

How long the club keeps each kind of athlete data, what is due for removal, and
the control that actually removes it.

**This screen deletes athlete data. It is the most consequential screen in the
app.**

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The schedule and the preview | **Run retention, which deletes data** | None | Base | **Currently admin only**, `src/app/(staff)/settings/retention/page.tsx:30`, and again on both server routes. Decision D-07 |
| Coach, Medic, S&C, Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

## 3. How you get here

- The Data retention link in the Settings administration block.

## 4. What you see

**The retention schedule**, one row per category, each saying what is kept, for
how long, and **when the clock starts**, which is the part people get wrong.

**Which categories are automated here** and which are handled elsewhere.

**A preview**, showing what would be removed if retention ran now. **Preview only**
is labelled as such.

**The nightly retention reports.**

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Records due for removal, per category | How much would go if run now | Per the category's own rule | Zero is a good outcome |

**One rule worth stating in full.** Injury clinical detail is kept for **eight
years from closure, and longer where the athlete was under 18 at the time**. Where
no date of birth is on file the minor extension cannot be applied and the eight
year rule alone governs (`src/lib/retention/compute.ts:88`).

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| **Preview** | The body | Shows what would be removed. **Changes nothing** | Stays here | Nothing | Sport scientist | None needed | Absent for everyone else |
| **Run retention** | The body | **Permanently removes the records the preview named** | Stays here, with the result | **Deletes athlete data, and audits what was deleted** | Sport scientist | **Yes** | Absent for everyone else |

**Preview and run are separate on purpose.** The preview is safe and can be run
freely; the run is not reversible. Both are checked again on the server, not just
in the browser.

**Athlete data is never hard deleted by any other route in Fydr.** Everything else
uses a soft delete, meaning a record is marked removed and kept. This screen is
the only exception, and it exists because retention obligations require actual
removal.

## 7. How this page is built, in plain English

Built on the server. Preview and run are two separate server routes, each checking
the permission again.

The categories, their periods and where each clock starts are computed rather than
listed, so the preview and the run cannot disagree about what is due.

## 8. States

**Nothing due.** Says so. **Preview run.** Results shown, with nothing changed.
**Run completed.** Names what was removed. **Error.** Surfaces as an error and
nothing is removed. **Offline.** The connection sentence.

## 9. Open issues

- **This belongs to admin today, and moves to the sport scientist.** Decision
  D-07. **Of the eleven capabilities being moved, this is the one worth pausing
  over**: it permanently deletes athlete records, and it is moving to the role
  that does day to day performance analysis.
- **UNVERIFIED: whether the run is all or nothing**, or whether a failure part way
  through leaves some categories processed. Files searched:
  `src/app/(staff)/settings/retention/run/route.ts`, `src/lib/retention/compute.ts`.
