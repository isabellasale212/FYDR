# Persona review — STAFF-COACH-16 and -17/18/20/21/22 (the reports)

**Persona.** The head coach reading the squad report on Monday morning and one athlete's
report on the way to training.

**Account.** Mark Iremonger (coach only), port 9502; Jane Pemberton for the identity check.
**Reviewed 2026-09-12** at **1280×900 and 375×812**, read-only; no export pressed.

**Method.** All eight report routes fingerprinted for both accounts at both widths and
diffed — `/reports`, `/reports/squad`, `/reports/athlete`, `/reports/athlete/{James
Barnes}`, `/reports/compliance`, `/reports/injuries`, `/reports/testing`,
`/reports/training`.

---

## Identical — with one non-difference worth naming

Every report renders the same headings, the same controls and the same number of leaf nodes
for the coach as for the sport scientist: hub 33/33, squad 181/181, athlete list 239/239,
compliance 31/31, injuries 112/112, testing 271/271, training 296/296. **The only diffs are
the selected period** — the coach's tab was on "Last 28 days" and Jane's on "This season",
so the figures, the date lines and the export links' `?period=` differ; nothing else does.
The period is the browser's, not the role's.

**`REPORT_VISIBILITY` for the coach is the full set**, and the injuries report is the same
censored report the sport scientist reads (`/reports/injuries` never selects
`injury_clinical` — its own header says so). Nothing withheld, nothing extra.

## The phone, where the sport scientist's review could not see

The SS-16 to -22 reviews measured these screens before the shell was built. On the built
shell at 375, as the coach:

- **Four reports scroll the page sideways:** `/reports/squad` (437px — the `.attn-sev`
  severity spans in the attention list), `/reports/athlete` (579px — spans in the athlete
  rows), `/reports/athlete/{id}` (489px), `/reports/training` (381px — `.tr-dials`, and
  `.tr-board-inner` at 548px inside it). The same class as §0ap's three settings screens,
  which are now fixed; these four were not in that list (§0ax).
- **Controls under the floor the shell's generic rules did not reach:** `/reports/squad`
  the week arrow "‹" 31px and the athlete-name links **15px with no padding** (the
  `table .nm` rule floors the roster on `/squad`; these rows are not that markup);
  `/reports/testing` "Manage tests →" 19px; `/reports/training` the "Training" / "Match
  day" chips 35px, "Heat" 22px, "Day" / "Week" 40px, "Rest of the week" 37px. Added to the
  STAFF-SHELL sweep table; §0ax carries the list.
- Heights at 375: squad 4,202, athlete list 2,390, one athlete 2,592, compliance 1,037,
  injuries 2,963, testing 2,372, training 4,238.

## STAFF-COACH-16 — Open the squad report and export it

Identical; "Export CSV" / "Export PDF" carry the coach's period. Not pressed (an export is
audited against the actor's name — the exports page says so — and the coach's persona does
not need one to be reviewed).

## STAFF-COACH-17/18/20/21/22 — Athlete, compliance, squad, testing, training

Identical, each; the athlete report's compliance figure follows the cutoff rule for the
coach as for the sport scientist (the same `queries/rpeSessionWindows.ts` read — 51% this
season for James Barnes as Jane, 14% last 28 days as the coach: different periods, same
rule).

---

## Summary for design

1. **Four reports scroll sideways at 375** — the coach's Monday-morning screen among them.
   *(Defect, §0ax; phone only.)*
2. **Sub-44 controls on three reports at 375** — added to the sweep table; the floor's
   class list needs the report chips and the attention-row name links. *(§0ax, with 1.)*
3. **Nothing coach-specific in the reports.** The SS-16 to -22 briefs are the design
   surface.
4. Right and worth keeping: the export links carrying the period the coach is looking at;
   the censored injuries report reading the same for every non-medic role.

## Claims checked

| Claim | Verdict |
|---|---|
| 16, 17/18/20/21/22 identical to the sport scientist | **Identical** by fingerprint at both widths; the only diffs are the browser's period. |
| Coach sees "every report except the medic's clinical/injury detail" (coach section intro) | **Correct** — the injuries report is censored by construction for every role. |
