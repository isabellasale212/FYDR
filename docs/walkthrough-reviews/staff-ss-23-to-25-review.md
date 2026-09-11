# Persona review — STAFF-SS-23 to -25

**Persona.** The sport scientist as the club's all-rounder: setting the
Forwards' carbohydrate target, checking who is on the rehab programme, seeing
who tops the sprint board this month.

**Reviewed 2026-09-11** at **1280×800 and 375×812** as Jane Pemberton,
read-only — no plan, programme or board created, assigned or published. §0af's
stacked sidebar applies to every phone number.

---

## STAFF-SS-23 — Build a nutrition plan and assign it

**Measured.** "Nutrition"; "‹ Previous week" only (current week); "Manual
target" (44px) and "New plan" (35px); three sections — **Plans** (three
group plans as buttons, one visually selected, no `aria-pressed`/`aria-current`),
**Day type** (Training 6.0 g/kg, Match 7.5, Rest 3.5 — buttons at 37px),
**Needs a word** (a per-athlete chase list, "0/7 · Weighed in" across the
board — seed timing, §0f). The selected plan's panel: "Duplicate" (disabled),
"Food library", "Assign", six `−`/`+` steppers at 32px. **3,520px at desktop,
6,099px at phone.**

**For the persona this is the right set of things** — the plan, the day-type
targets and the chase list are the three questions a nutrition-minded sport
scientist has on a Monday — on one very long page. The Needs-a-word list is
the pitch-side part and it is at the bottom.

**Nothing announces which plan is selected** (§0am). The document's "Next
week ›" is conditional, as on the reports. "New plan" and "Food library" are
toggles as documented; not exercised.

## STAFF-SS-24 — Author a gym programme

**Measured.** "Gym programme"; the selected programme "In-Season max" as a
second heading; three programmes listed, one of them rehab ("Return to
running"); "+ New programme" **once** (the document said twice); "Exercise
library"; the permission-dependent detail link reading **"Edit this programme
→"** for this role. **Fits one desktop screen** (800px); 1,662 at phone.

**Nothing to raise.** The one screen in this batch that fits.

## STAFF-SS-25 — Explore the leaderboard wall

**Measured.** "Leaderboard"; "Manage published boards →"; a lens of three
`role="tab"` buttons (Result / Improvement / Standard) at 31px **with no
`tablist` and no `aria-selected`**; scope chips (Positional unit pressed, Age
band); family chips with counts (Speed & power 4 pressed, Endurance 2,
Strength 1, GPS 14, Habits 2 — none at zero, so the disabled branch was not
observed); "Profile ›" for the selected athlete. **3,840px at desktop, 6,592px
at phone — the longest staff screen.**

**The family chips carrying counts is good design** and the document's reason
— "an unexplained absence is worse than a greyed option" — is right. The lens
is the a11y gap (§0am): tabs that are not a tablist and never say which one is
on.

---

## Summary for design

1. **Two very long screens** — nutrition 6,099px and the leaderboard wall
   6,592px at phone — under the stacked sidebar. *(Design; STAFF-SHELL.)*
2. **Lens tabs without a tablist or a selected state.** *(SS-25 — §0am.)*
3. **Plan list without a selected state.** *(SS-23 — §0am.)*
4. **Sub-44 controls** — New plan 35, day types 37, steppers 32, lens 31 —
   added to the STAFF-SHELL sweep table per the decision.
5. Right and worth keeping: counts on the family chips; the day-type targets
   stated in g/kg on the button; the permission-dependent detail link on
   programmes.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| 23: "‹ Previous week" and "Next week ›" | **Previous only on the current week.** Corrected. |
| 23: "Manual target", "New plan" | **Correct**; sizes recorded |
| 23: on a plan — Duplicate, Food library, Assign | **Correct** (Duplicate disabled on the selected plan) |
| 23: "New plan" / "Food library" are toggles | **Not exercised** |
| **24: "+ New programme" rendered twice** | **Once.** Corrected. |
| 24: "Exercise library", detail link label by permission | **Correct** — "Edit this programme →" for SS |
| 24: rehab programmes gated by `REHAB_PROGRAMME` | **Not testable from one role**; one rehab programme listed |
| 25: "Manage published boards →", group chips, lens, scope, family chips, "Profile ›" | **Correct**; the lens is `role="tab"` ×3 without a tablist. Recorded. |
| 25: family chips disabled at zero | **Not observed** — none at zero |
| 25: publishing controls absent without `LEADERBOARD_EDIT` | **Not testable as SS** |
