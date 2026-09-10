# Persona review — ATH-ADULT-07, Submit the weekly nutrition check-in

**Persona.** An athlete answering one question about a week that is already
over, prompted by a to-do row that says "Weekly check-in".

**Reviewed 2026-09-10** at **375×812** as a real athlete with no answer for the
week just ended (Conor Moroney), plus the `?correct=1` variant.

---

## The measured screen

| Element | Detail |
|---|---|
| `h1` | "Weekly check-in" |
| Week line | "WEEK 36 · MON 31 AUG TO SUN 6 SEPT" — 11px, uppercased in CSS |
| Question | "Did you hit your protein target most days this week?" |
| Answers | "Yes" / "Roughly" / "No" — `<button aria-pressed>`, **335 × 64 each** |
| "Add a note (optional)" | button |
| Submit | "Choose an answer" (disabled) → "Done" (enabled), **top 509** |
| Footer line | "Saved on this phone first — it sends even if your signal drops." |

**Page height 812px — one screen, no scroll, submit well above the fold.**
Structurally the best of the three athlete write forms.

---

## The finding: the question contradicts the week line

The screen correctly asks about `lastCompletedWeek` and says so in the line
above. The question then reads **"…most days this week?"** — measured four days
after that week ended, and in the correction flow rendered over
"WEEK 33 · MON 10 AUG TO SUN 16 AUG", a month earlier. The `ⓘ` correction
banner repeats it: "Correcting your answer for **this week**."

An athlete who reads the question and not the small uppercase line above it
answers about the wrong week — and the walkthrough itself records that the
past-week behaviour surprised the person documenting it. The layout is
innocent; the pronoun is the whole problem. Filed as **§0u**.

---

## 1. How many taps, and is any step redundant?

**Two taps** — one answer, one "Done" — with no scrolling. Nothing redundant.
The 335 × 64 answer buttons are the most generous targets in the athlete app.

## 2. Does any label or copy not match how this person thinks?

Beyond "this week" above: **"Choose an answer" is the same disabled-label
pattern** as RPE's "Choose a rating" and inherits the same `.subm` contrast
problem (§0s) — the instruction is written where it cannot be read.

**"Saved on this phone first — it sends even if your signal drops."** is good,
and it is the only place in the athlete app that explains the outbox in plain
words before submission rather than after.

## 3. Where is a mistake most likely, and can it be undone?

**This is the one athlete entry that the athlete can correct themselves** —
ATH-ADULT-08 exists precisely for that, and no staff write path to this table
exists at all. So a wrong tap here is genuinely recoverable, unlike wellness
and RPE. That is worth protecting in any redesign.

## 4. Anything they must read that the screen could infer?

No. One question, three answers, everything else optional.

## 5. Is there a moment where it's unclear whether something worked?

The `aria-pressed` state flips and the submit label changes from "Choose an
answer" to "Done", both in view. Clear — except that the disabled label is
unreadable (§0s), so before answering the athlete has no legible instruction.

---

## Summary for design

1. **"this week" contradicts the week line** and is the copy half of the
   past-week finding. **§0u.**
2. **The answers are ungrouped toggle buttons**, not a radio group — the third
   labelling approach for the same kind of control in one app. **§0u.**
3. **"Choose an answer" inherits the 1.24:1 `.subm` problem** — solve once with
   ATH-ADULT-03 and -05.
4. Right and worth keeping: one screen, no scroll, 335 × 64 targets, the outbox
   line, and the fact that this answer is athlete-correctable.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Always the previous week; `?week=` clamped | **Correct** — "WEEK 36 · MON 31 AUG TO SUN 6 SEPT" on 10 Sept |
| Chips "Yes" / "Roughly" / "No" | **Correct**, but they are buttons, not radios, and not grouped |
| "Add a note (optional)" reveals a textarea | **Correct** |
| "Choose an answer" → "Done" | **Correct**, both observed |
| **"a 'Report a problem' link"** | **Wrong — no such link exists.** The string does not appear in the document. **Corrected in the walkthrough.** |
| — | **Undocumented:** the question text, the "Saved on this phone first…" line, and that the answers are ungrouped toggles. **Now recorded.** |
