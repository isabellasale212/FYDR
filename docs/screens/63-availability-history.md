# 63. Availability history

## 1. Page name and URL

**Availability history**, at `/squad/[athleteId]/availability`, with its CSV at
`/squad/[athleteId]/availability/export`. Built 12 September 2026 (PATTERN-S3 C7).

One athlete's availability, every change since the record began: one row per
change, newest first — when, the status word, the restriction line as it read
then, what changed, who set it. A row is never edited and never removed; a
correction adds a row. If a club disputes an injury, this screen and its CSV are
the record.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every row | Nothing. This is a reading screen | None | Base | `src/lib/athleteDomain.server.ts` (the default staff set), then `availability_staff_select` (0074) |
| Coach | Yes | Every row | Nothing | Nothing clinical is on the page: the restriction line passes through `lib/restrictions.ts` for everyone, so a protocol stage, a diagnosis or a graduated return never appears; "what changed" names status, restrictions, the reason category and the injury link only | Base | Same |
| Medic | Yes | Every row | Nothing here — the clinical record is on the injury | None | Base | Same |
| S&C | Yes | Every row | Nothing | As the coach | Base | Same |
| Nutritionist | Yes | Every row | Nothing | As the coach | Base | Same — the nutritionist reads availability (0074) |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

---

## 3. How you get here

- "Availability history ›" on the athlete profile, under the injury card.
- By address.

---

## 4. What you see

The header with Export CSV and Print. A line: "Every change since the record
began, one row per change, newest first. A row is never edited and never removed
— a correction adds a row. 6 changes on record."

**The table**, newest first, five columns: **When** (the moment the change took
effect, `effective_from`, in the club's timezone), **Status** (the word, with
"· current" on the open interval; no tone — a history is a list of facts, not
alarms), **Restrictions** (the line as it read then, "None" when there was
none), **What changed** against the row before ("Available → Unavailable ·
Restrictions now No contact · Injury-linked", "Restrictions cleared", "Absence ·
academic", "Added to the record · Available", "Re-recorded, nothing changed"),
**Set by** (the person's name; "Not recorded" if the row has none).

A closing card, "What a row holds", says the same in prose, and that nothing
clinical is derived here.

**Empty:** "Nothing on record" with what would fill it.

---

## 5. Every number on this page

None beyond the count of changes.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Export CSV | Header | Downloads the same rows as a CSV (When, When (ISO), Status, Current, Restrictions, What changed, Set by) | A file | An `audit_log` row, `report.availability_history.export` | Any staff who can open the page | None | Never |
| Print | Header | The browser's print | — | Nothing | Any staff | None | Never |

---

## 7. How this page is built, in plain English

The `availability` table is already a ledger: every change closes the open
interval (`effective_to`) and inserts a new row (`setAvailability`), and
migration 0005's one-open-per-athlete constraint keeps it one line. So the
history is the rows themselves, read oldest first without a window
(`fetchAvailabilityLedger`, paged), and `lib/availabilityHistory.ts` computes
each row's "what changed" against the row before — tested with rows, no trigger,
no view, no migration. Names come from one `users` read.

**A coach's Available write carries a reason** (the coach insert policy requires
one), so the reason names an absence only on a row that is one — an Available
row is never called "Absence · personal".

---

## 8. Open issues

- The board's rows also carried injury events ("Injury recorded · Head ·
  protocol started at stage 1"); those are the injury record's, and naming a
  site to a coach is PATTERN-S3 C8 ("not now"). Only availability rows are
  listed.
- Seed data can hold overlapping intervals (a later closed row after an earlier
  open one); the page shows what the table holds and marks the open row current.
