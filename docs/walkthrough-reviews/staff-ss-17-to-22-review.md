# Persona review — STAFF-SS-17 to -22, the other six reports

**Persona.** The sport scientist on Monday, going through the reports before
the coaches' meeting — and sending one on.

**Reviewed 2026-09-11** at **1280×800 and 375×812** as Jane Pemberton. Read-only
throughout; one PDF endpoint fetched to confirm it serves. §0af's stacked
sidebar applies to every phone number. SS-20 is `/reports/squad`, reviewed as
SS-16; not repeated.

---

## The role-gate check this batch carries — clean

The document's claim is that every report page and every export/PDF handler
goes through the same gate, so "there is no door round the back". **Checked
in source, all eighteen handlers** — six pages, six CSV routes, six PDF routes
(`route.tsx`, which a first sweep missed and which serve real
`application/pdf` attachments) — **each calls `requireReport('{key}')`.** The
`REPORT_VISIBILITY` grid opens compliance and injuries to all five roles and
the other four to `REPORT_ACCESS`. And on the injuries report, the sport
scientist sees no Diagnosis or Mechanism — the clinical columns are the
medic's, as documented. **No role-gate finding.** The stale `access-matrix.md`
note the document flags (squad weekly, nutritionist) is left as the code and
the document both have it.

---

## What the six have in common, and the document did not say

**The period control explains itself.** Five of the six carry a `<select>`
whose option labels tell the reader why the narrow choice is usually wrong —
"Today — readiness is read against a 14-day band, and one day is one point";
"Last 7 days — one week is too short to read injury burden"; "Today — testing
is episodic — one day is one session, which the test page already shows". It
is the same instinct as My data's "Today — one day cannot show your usual
range" (ATH-ADULT-12), applied across a report family. **Deliberate, and the
best control pattern in the staff app.** Recorded once, in the document.

**Every report has a PDF endpoint the document omitted**, gated identically to
the CSV.

**Exports carry their scope** — `period`, `to`, `test`, `mode` as each report
needs — matching SS-16.

---

## Per report

**SS-17, Athlete report.** `/reports/athlete` is a **"Pick an athlete"**
roster, not the report — undocumented. The report itself (`/reports/athlete/
{id}`) has four sections — Wellness, Load, Gym and testing, Open flags — the
period select, "Previous page" / "Next page", and exports with `period`. No
group chips, correctly. 3,100px at phone.

**SS-18, Compliance.** The only report that **fits one desktop screen**
(800px). Scope line up top, exports with `period` and `to`. **§0ad applies** —
this report has no cutoff, so a late RPE counts as submitted; nothing on the
screen says so.

**SS-19, Injuries.** Four athlete links for this squad; no clinical columns for
this role, measured. The period options are the most explanatory of the six.

**SS-21, Testing.** Per test definition — the export carries `test={id}`. A
**"+ Log a result"** write entry point sits at the top, unlisted. "Personal
bests", one table, 30 rows.

**SS-22, Training.** The richest and heaviest: a Training / Match day toggle, a
session select and an athlete select, six sections (Board, Individual player,
Outside their normal range, Heat bands, Comparison, Scatter), exports with
`mode`. **4,711px at phone** — the one report a phone cannot reasonably read,
and the one whose "GPS · premium" card on `/reports` says it is a plan gate.
No gate rendered for this account.

---

## Summary for design

1. **The self-explaining period select** is a pattern to protect and, if
   anything, extend. *(Deliberate boundary.)*
2. **The training report at phone width** is 4,711px of charts. *(SS-22 —
   design: is there a phone reading of it, or is the phone use "send the
   PDF"?)*
3. **`/reports/athlete` as a roster** is fine, but its heading "Pick an
   athlete" is the only `h1` in the staff app that is an instruction rather
   than a name. *(SS-17 — recorded.)*
4. **Compliance's missing cutoff** is invisible on the screen. *(SS-18 — §0ad,
   decision pending.)*
5. Right and worth keeping: eighteen gated handlers; exports carrying scope;
   PDFs as real attachments.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Six reports, routes as tabled | **Correct** |
| Export endpoints as tabled | **Incomplete** — every report also has `/pdf`. Recorded. |
| **Every page and every export/pdf handler gated** | **Correct — all eighteen checked in source.** |
| `REPORT_VISIBILITY`: compliance and injuries open to all five | **Correct** in `access.ts` |
| Injuries: content differs by role, clinical columns for medic | **Consistent** — none for SS, measured |
| Shared pattern: period control, group filter, exports with filter | **Correct**; the period control is more than the document says |
| — | **Undocumented:** the "Pick an athlete" roster; "+ Log a result"; the training mode toggle and two selects; every section name; all page heights. Now recorded. |
