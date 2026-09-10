# Design brief — ATH-ADULT-07, Submit the weekly nutrition check-in

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-07 — Submit the weekly nutrition check-in

**Entry point.** The "Weekly check-in" to-do row on `/today`. Direct URL
`/nutrition-check-in`.

**IT IS ALWAYS THE PREVIOUS WEEK, never the one in progress**, and the screen
says which: "WEEK {n} · MON {date} TO SUN {date}". The page resolves
`lastCompletedWeek` — the ISO week just ended — because "did you hit your
protein target most days?" cannot be answered about a week still running. A
`?week=` in the address is clamped so a future week cannot be reached even by
hand. Recorded because it surprised the person writing this document, who read
"Weekly check-in" on today's to-do list and expected today's week: a screenshot
of this screen dated a week behind is correct, not stale.

**Steps.**

1. Press one of three answer chips: "Yes", "Roughly", "No".
   - The three answers are `<button aria-pressed>` toggles, **not** radio
     inputs, and they are **not inside a fieldset or any grouping element** —
     unlike the wellness and RPE scales. Each is full-width, 335 × 64.
   - Also visible: heading "Weekly check-in"; the week line
     "WEEK {n} · MON {date} TO SUN {date}" (11px, uppercased in CSS); the
     question "Did you hit your protein target most days this week?"; the sheet
     dismiss "✕"; an "Add a note (optional)" button; the submit button; the
     line "Saved on this phone first — it sends even if your signal drops.";
     and the four tab-bar links.
   - **There is no "Report a problem" link on this screen.** An earlier version
     of this document listed one; measured 2026-09-10, the string does not
     appear in the document at all.
2. Optionally press "Add a note (optional)", revealing a textarea
   (`id="nutrition-note"`, label "Add a note").
3. Press the submit button.

**Submit button states.**

| Label | When |
|---|---|
| "Choose an answer" | No answer selected. **Disabled.** |
| "Done" | An answer is selected. Enabled. |
| "Saving…" | Submission in flight. |

**Branches.**

- IF a check-in already exists for the week THEN the screen instead offers
  "Change this answer" — see ATH-ADULT-08.

**End state.** Returns to `/today`; the "Weekly check-in" to-do row is gone.

---


*(Corrections from this pass are already applied above where they were
factual; see §3 of the review for what changed.)*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-07-review.md`** — it carries
the measurements, the findings, and the claims checked against the running
screen. Read it before proposing anything.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **It must stay the previous week.** "Did you hit your protein target most
   days?" cannot be asked about a week still running; `?week=` is clamped so a
   future week cannot be reached by hand.
2. **The week must remain stated on screen.** It is the only thing that tells
   an athlete which week they are answering about — and the question currently
   contradicts it (§0u), so the fix is the question, not the week line.
3. **The answers must remain three and mutually exclusive.** Currently
   ungrouped `aria-pressed` toggles; a proposal may regroup them (a fieldset, a
   radiogroup) but must not add a fourth option or a free-text answer.
4. **Targets are 335 × 64 today** — the most generous in the athlete app. Do not
   shrink them.
5. **`.subm` is shared** with CheckInForm, RpeForm and ProblemReportForm. The
   disabled-label contrast is a **same-class collision with ATH-ADULT-03 and
   -05** and must be solved once.

## 5. What a proposal should address

1. **Fix "this week"** so the question agrees with the week line (§0u).
2. **Group the three answers** so they announce as one set.
3. **Make "Choose an answer" legible** — solve once with 03 and 05.

Not in scope: the past-week behaviour itself, which is correct and deliberate.
