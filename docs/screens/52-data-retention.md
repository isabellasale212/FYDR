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

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/retention/page.tsx:29`; a **admin** check at `src/app/(staff)/settings/retention/page.tsx:30`, which redirects. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Data retention link in the Settings administration block.

## 4. What you see

**The retention schedule**, one row per category, each saying what is kept, for
how long, and **when the clock starts**, which is the part people get wrong.

**Which categories are automated here** and which are handled elsewhere.

**A preview**, showing what would be removed if retention ran now. **Preview only**
is labelled as such.

**The consequence, in the same card as the button** (PATTERN-S8 C9, 13 September
2026). Under the preview's table, before Run: "Running now will delete 3 import
files older than 30 days, and redact the clinical detail on 14 closed injury
records and archive them. This cannot be undone." Then who it touches — "Those
records belong to 11 athletes, 2 of them still on the squad: Ade Oyelaran, Ross
Gallagher. Their availability history and everything else about them stays; only
the diagnosis, mechanism, notes, treatment plan, imaging and referral go." — and
what the preview-only categories hold, as visibility: "2,184 rows in the 3
preview-only categories are past their period and untouched by this run — shown so
the club can see what a fuller retention would remove." When nothing is eligible:
"Nothing is eligible today: … Run has nothing to do." and Run is not offered.
**Run now opens a dialog** (B11 — a purge is irreversible) that says the
consequence again with one button, **Run retention**; nothing is written before it.
**The preview is logged as its own action** (`retention.preview`, decision batch
A6) with the counts per category and the athlete totals — never the ids or the
names.

**Below 900px the table is a stack of cards** (PATTERN-S8 C12, 13 September
2026): each row a bordered card, each cell a labelled line carrying its column
heading, the heading row hidden from sight but not from a screen reader, so
nothing scrolls sideways at 375 and nothing is lost (`table.tbl.tbl-cards`).

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
| **Preview** | The body | Shows what would be removed and states the consequence. **Changes nothing** | Stays here | An audit row, `retention.preview`, with the counts (no rows, no names) | Sport scientist | None needed | Absent for everyone else |
| **Run now** | The card, under the consequence | Opens the dialog | Stays here | Nothing | Sport scientist | — | When nothing is eligible ("Nothing to run.") |
| **Run retention** (the dialog) | The dialog | **Permanently removes the records the preview named** | Stays here, with the result | **Deletes athlete data, and audits what was deleted** (`retention.run`) | Sport scientist | **The dialog is the confirmation** | — |

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
- **Resolved: it is not all or nothing.** Categories are processed in sequence and
  the run returns on the first error (`src/lib/retention/compute.ts:206` onward),
  so a failure part way through leaves earlier categories deleted and later ones
  not. Decision D-43.
