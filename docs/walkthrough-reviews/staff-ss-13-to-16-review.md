# Persona review — STAFF-SS-13 to -16

**Persona.** The sport scientist deciding whether the week is ready to go to
the athletes; and, on Monday, reading the squad report before the coaches'
meeting and sending the PDF round.

**Reviewed 2026-09-11** at **1280×800 and 375×812** as Jane Pemberton. **Nothing
was published or written.** §0af's stacked sidebar applies to every phone
number.

**What was and was not exercised.** SS-13: both banner states measured by
staging one wizard draft — "Publish to athletes" was **not** pressed. SS-14
exercised in full on that draft: Discard, the confirmation, "Yes, discard",
back to "up to date". SS-15 measured. SS-16 measured on `/reports/squad` at
both widths; a group filter applied there and on `/squad` to test persistence
in both directions; the CSV export fetched read-only and its scope line read;
all filters cleared after.

---

## STAFF-SS-13 — Publish the week to athletes

**Both states verified verbatim.** Idle: "The athlete app is up to date" with
"Published" disabled. Pending: "1 change not yet in the athlete app" (the
singular, which the document showed as "change/changes"), the subtitle
"Athletes still see the schedule as it was before these edits. Nothing changes
on their phone until you publish.", and "Discard" / "Publish to athletes".

**Not exercised:** the publish itself, "Publishing…", and the "Not published:"
failure line. Publishing writes to every Forwards athlete's Today.

**The banner is the right control in the right place** — it is the first thing
on the schedule and it says, in plain words, that nothing has reached anyone
yet. For a persona whose real fear is "did I just change the athletes' week by
accident", that sentence is the whole design. Preserve it.

## STAFF-SS-14 — Discard every pending change

**Verified in full.** "Discard" → "Discard 1 change? This can't be undone." →
"Yes, discard" / "Never mind" → the draft gone, banner back to "up to date",
"Published" disabled again. Nothing written at any point.

**"This can't be undone." is exactly right** for the one action in the grid
that really cannot be — and the document's own note that per-session undo
lives in "Cancel changes" / "Restore session" instead is the correct
distinction.

## STAFF-SS-15 — Manage week templates

**Verified.** "Week templates"; one template on scratch ("Standard 1-game
week") with "Apply" (`.btn-primary`, 50px) → the planner apply route and "Edit"
(`.btn-ghost`, 50px); "+ New template" → `/schedule/planner/new`; "Schedule"
back link. The read-only branch for a role without `SESSION_EDIT` is not
verifiable as a sport scientist.

**Nothing to raise** on the list screen itself.

## STAFF-SS-16 — Open the squad report and export it

**The document had the entry point backwards.** `/reports` is a **menu** of
six report cards — Compliance, Injury & availability, Training report ("GPS ·
premium"), Athlete report, Squad weekly, Testing — each with a one-line
description and its export formats. The squad report is the fifth card,
**`/reports/squad`, heading "Squad weekly"**. The document said `/reports` was
the report "not a menu". **Corrected.**

**On the real screen, everything else the document claimed is right:** all five
section names, "Export CSV" / "Export PDF", the group chips, "See all 72 open
flags ›" → `/flags`, twelve athlete links. "Previous week" only — "Next week"
renders only when a past week is shown; the document's "‹ and ›" implied
both. Corrected.

**The export claim is true, and I got it wrong first.** My first read showed
export hrefs without the group and a CSV scope of "Whole squad" — because the
chip press had **navigated** to `?groups=…` and my measurement ran on the page
that had gone. Re-measured on the landed page: hrefs carry
`?groups={id}&to=2026-09-11`, the CSV serves `200 text/csv` as an attachment
named `squad-weekly-2026-09-05-to-2026-09-11.csv`, and its first line reads
"Scope: Forwards (15 athletes)". **The export is of what is on screen.**
Recorded against myself so the wrong first reading does not resurface.

**The finding that survived is the mechanism.** On `/squad` the filter is the
cookie; on `/reports/squad` it is a URL parameter and no cookie is written. The
report reads the cookie as a default, so `/squad` → report carries; report →
`/squad` does not — Squad overview shows all 30 again. Measured both ways.
**§0ak**, with a sweep of the other multi-athlete screens still to do.

**At phone width the report is 4,595px** under the stacked sidebar: five
sections and twelve athlete rows. The two exports are at the top, which is
right — the pitch-side use of this screen is "send the PDF", not "read it on
the phone".

---

## Summary for design

1. **The filter is a cookie on one screen and a URL on another**, carrying one
   way only. *(SS-16 — §0ak, defect.)*
2. **`/reports` is a menu**; the document said otherwise. *(SS-16 — corrected.)*
3. **Banner and confirm controls under 44px** (Published 17, Publish 35,
   Discard 37, Yes discard 37) — added to the STAFF-SHELL sweep table per the
   decision, not filed.
4. Right and worth keeping: "Nothing changes on their phone until you
   publish."; "This can't be undone."; the export scope written into the CSV's
   first line; the report's exports at the top.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| SS-13: both banner titles, subtitle, actions | **Correct**, verbatim; sizes recorded |
| SS-13: "Published" disabled when nothing pending | **Correct** |
| SS-13: "Publishing…", "Not published:" | **Not exercised** — publish writes to athletes |
| SS-14: "Discard {N} change/changes? This can't be undone.", both buttons | **Correct** — "Discard 1 change?" |
| SS-14: button absent when nothing pending | **Correct** |
| SS-15: per-template Apply/Edit, "+ New template", "Schedule" back | **Correct**; sizes recorded |
| SS-15: read-only branch | **Not verifiable as SS** |
| **SS-16: "`/reports`. This *is* the squad report, not a menu."** | **Wrong — a menu of six; the report is `/reports/squad`.** Corrected. |
| SS-16: five sections | **Correct**, by name |
| SS-16: exports, chips, "See all {N} open flags", athlete links | **Correct** |
| SS-16: "‹" and "›" period navigation | **"Previous week" only on the current week.** Corrected. |
| SS-16: exports carry filter and period | **Correct** — verified from the CSV's own scope line |
| Global: filter "persists globally … a cookie" | **True from `/squad`, not from the report.** §0ak. |
