# Persona review — ATH-ADULT-08, Correct a nutrition check-in already submitted

**Persona.** An athlete who answered "Yes" too generously on Sunday and wants
to change it — the only entry in the whole app they are allowed to change
themselves.

**Reviewed 2026-09-10** at **375×812** as a real athlete with an existing answer
(Conor Moroney, week of 2026-08-10, "yes"), through both the card and the
`?correct=1` form.

---

## The measured screen

**Entry card** (`/nutrition-check-in?week=2026-08-10`):

> ✓ Already answered
> For Mon 10 Aug to Sun 16 Aug, you answered Yes.
> **Change this answer**   **Back to today**

**Correction form** (`&correct=1`): an `ⓘ` banner — "Correcting your answer for
this week. This creates a new revision; the original is kept, not overwritten."
— then the week line, the question, the three answers with the previous answer
already `aria-pressed="true"`, "Add a note (optional)", and "Done" **enabled**.

**One screen, no scroll**, both states.

---

## The finding: the flow's only entrance looked like a sentence

Measured before the fix: both `.cap` links rendered `rgb(72,78,87)` / 13px /
400 / **no underline** — identical to the caption prose — at 19.5px tall.

That is the same defect found on ATH-ADULT-04, and it matters more here. On
check-in the undecorated link was "Back", duplicating a 44px ✕ that did the same
job. **"Change this answer" is the only route into this entire flow.** An
athlete who wants to correct an answer and does not spot a grey word among grey
words concludes the app will not let them.

**Fixed 2026-09-10** with the existing `.linklike` pattern, scoped to this file:
now `rgb(0,100,220)` / 600 / underlined, **5.35:1**. **Still open:** 19.5px
against the 44px floor — sizing changes layout, so it is left to design.

---

## 1. How many taps, and is any step redundant?

**Three taps**: "Change this answer", a new answer, "Done". Minimal for a
correction, and the previous answer arriving pre-selected is right — it shows
what is being changed *from*.

## 2. Does any label or copy not match how this person thinks?

**"This creates a new revision; the original is kept, not overwritten." is
unusually honest and should stay.** It pre-empts the fear that correcting looks
like hiding something — the same instinct as check-in's correction paragraph.

**The banner repeats "this week"** for a week a month gone (§0u).

**"Done" rather than "Save changes"** is mild: on a correction the athlete is
confirming a change, and "Done" is the same word the first-time flow uses.

## 3. Where is a mistake most likely, and can it be undone?

**A second correction is refused.** `entry_not_revisable` keeps the revision
chain linear, so an athlete who corrects twice is blocked the second time — and
nothing on the screen warns them before they start. Not verified live: it needs
a real write, which was not performed.

**The note text is never recorded**, only its length — the narrowing done in
migration `0100`. Correct, and invisible here, which is right.

## 4. Anything they must read that the screen could infer?

No. It shows the old answer, the week, and what a correction does.

## 5. Is there a moment where it's unclear whether something worked?

Before the fix, yes — at the entrance. After it, the path reads as a path.

---

## Summary for design

1. **The entrance link had no affordance** — fixed; **19.5px target still open.**
2. **"this week" in the ⓘ banner** for a week a month past. **§0u.**
3. **Nothing warns that a second correction will be refused** before the athlete
   starts.
4. Right and worth keeping: the revision explanation, the pre-selected previous
   answer, and that this is athlete-owned with no staff write path.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Card offers "Change this answer" | **Correct** — → `?week=…&correct=1` |
| Also reachable from `/my-data` per-week "Correct" | **Not verified** — no such link found by grep; not walked, left as the document has it |
| Previous answer pre-selected | **Correct** — `aria-pressed="true"` on "Yes" |
| "Done" enabled immediately | **Correct** |
| `not_permitted` for a non-owner; `entry_not_revisable` when superseded | **Not verified** — both need real writes |
| Note text never recorded, only length | **Correct** by migration `0100`; not re-verified here |
