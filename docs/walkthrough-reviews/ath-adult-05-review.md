# Persona review — ATH-ADULT-05, Rate a session (RPE)

**Persona.** An athlete who has just finished training, phone in one hand, still
warm, wanting this gone in ten seconds. Unlike the wellness check-in this is not
a daily fixed ritual — it arrives when a session does, sometimes twice in a day.

**Reviewed 2026-09-10** against the running screen at **375×812** and **375×667**,
signed in as a real athlete with a genuinely outstanding RPE (Conor Moroney,
"Contact prep", 09:30, MD-2), plus `CR10List.tsx`, `RpeForm.tsx`,
`lib/validation/training.ts` and the live accessibility tree.

**Nothing was submitted.** `training_entries` is ADR-005 immutable and this is
Conor's real outstanding rating; the form state is local until submit, so the
whole flow could be measured without spending it.

---

## The measured screen

| Element | Top | Height | |
|---|---|---|---|
| Sheet head | 0 | 120 | |
| Session card — "09:30 · Contact prep · Training · Main pitch · MD-2" | 148 | 64 | correctly named here |
| Direction — "Rate the whole session, not the hardest bit." | 240 | 32 | |
| **CR-10 grid**, 10 options | 286 | 124 | 5×2, each **60.6 × 58** |
| "How long were you training?" | 410 | 37 | |
| Duration stepper — "− 80 MINUTES +" | 457 | 44 | pre-filled |
| "Scheduled for 80 min" | 503 | 19 | the reference value |
| "Add a note" | 549 | 44 | |
| **Submit — "Choose a rating"** | **622** | 56 | **bottom 678, above the 812 fold** |
| Immutability note | 686 | 75 | **below the button** |

**Page height 868px.** At **375×812** the submit button is fully visible without
scrolling. At **375×667** all ten ratings are still above the fold and the
button needs **11px** of scroll.

**This screen does not have ATH-ADULT-03's problem.** The primary action is
reachable, the ratings all fit, and the duration is pre-filled from the schedule
with its source printed underneath. Structurally it is the better of the two
write forms.

---

## The defects this review found

### 1. Two of the ten ratings cannot be announced at all

Read from the real accessibility tree, not the markup:

| Radio | Accessible name |
|---|---|
| 1, 2, 3 | "Very easy", "Easy", "Moderate" |
| **4** | **(empty)** |
| 5 | "Somewhat hard" |
| **6** | **(empty)** |
| 7–10 | "Hard", "Very hard", "Extremely hard", "Maximal" |

Every child of the option's `<label>` is `aria-hidden` — the numeral, the tick,
and (for 4 and 6) the "·" that stands in for a missing word. With all children
hidden the label contributes no text at all. The eight anchored steps announce
the **word without the number**, so a screen-reader user cannot map what they
hear onto the 1–10 scale their coach speaks in.

`ScaleInput` on the wellness screen already solves this exact problem with a
`visually-hidden` label reading "3, All right". The pattern exists in this
codebase; `CR10List` does not use it. Filed as **§0t**.

### 2. "Add a note" throws keyboard focus to `<body>`

Measured twice with focus placed on the button first: the click swaps the button
out for the textarea and `activeElement` becomes `BODY`. A keyboard or
screen-reader user loses their place in the form and must tab back from the top
of the document; the textarea they asked for is never focused. The button also
carries neither `aria-expanded` nor `aria-controls`. Check-in does the
equivalent with a native `<details>`/`<summary>` and gets all of it for free.
Filed as **§0t**.

### 3. The same 1.24:1 disabled label as ATH-ADULT-03

"Choose a rating" is the instruction — the label *is* the error message, by
design. Measured from rendered pixels: fill `rgb(221,230,250)`, glyph
`rgb(253,254,255)`, **1.24:1**. Identical to check-in because it is the same
shared `.subm` pair (`:disabled` opacity 0.45 compounding with `[disabled]`
background at 0.35 alpha). Here it is arguably worse than on check-in: this
label carries the *only* instruction telling the athlete what to do next.

---

## 1. How many taps, and is any step redundant?

**Two taps**: one rating, one submit — and at 812 no scrolling. That is close to
ideal for a task done after every session, and materially better than
ATH-ADULT-03.

**Nothing is redundant.** Duration defaults to the scheduled 80 minutes, so the
stepper is genuinely optional, and "Scheduled for 80 min" underneath tells the
athlete where the number came from — the same good pattern as sleep's 7.0
default, done one step better because it names its source.

---

## 2. Does any label or copy not match how this person thinks?

**"Rate the whole session, not the hardest bit." is the best line on the
screen** — it pre-empts the single most common way an RPE gets misreported.

**"Choose a rating" as the disabled label is right in principle** and is the
same "the count is the message" idea as wellness's "N to go". It just cannot be
read (defect 3).

**The two unlabelled steps are a real ambiguity, not only an a11y problem.** 4
and 6 render as "·". A sighted athlete reading "3 Moderate", "·", "5 Somewhat
hard" has to infer that 4 means *between moderate and somewhat hard*. That is
a legitimate design choice — the CR-10 scale genuinely has unanchored steps —
but it is worth confirming it is intended rather than inherited.

**The scale runs 1–10, not 0–10.** The walkthrough says 0–10. There is no zero
option on screen, which is correct for "rate the session you just did" — a
session you did not do has no RPE — but it differs from the published CR-10
scale, where 0 is "rest".

---

## 3. Where is a mistake most likely, and can it be undone?

**The likely mistake is rating the wrong session**, and this screen is not where
that goes wrong — the session card names it clearly ("Contact prep", 09:30, Main
pitch, MD-2). The failure is upstream on Today, where every RPE row reads "How
hard was it?" regardless of session (**§0r**). An athlete with two sessions in a
day picks blind on Today and only discovers which one they opened *here*.

That makes this screen the last line of defence for §0r, and it does its part.

**Before submit everything is revocable** — `CR10List`'s own comment notes you
can clear an answer by tapping twice. After submit nothing is: `ENTRY_CORRECTION`
is staff-only. The cliff is the button, as with wellness.

**The immutability note is below the button again** (note 686, button 622), the
same placement problem as ATH-ADULT-03 — read only by someone who scrolled past
the control without pressing it.

---

## 4. Anything they must read that the screen could infer?

No, and it infers well. The duration comes from the schedule, the session
identity comes from the session, and the only thing asked of the athlete is the
one judgement no system can make for them.

---

## 5. Is there a moment where it's unclear whether something worked?

**Less than on wellness.** The submit button is visible from the start, so the
transition from "Choose a rating" (disabled) to "Submit rating" (enabled)
happens in view — the thing ATH-ADULT-03 gets wrong. The tick glyph on the
chosen option gives a second, local confirmation.

The one moment that *is* unclear is pressing "Add a note": the button vanishes,
a textarea appears in its place, and for a keyboard user focus silently goes to
the body (defect 2). Visually it is fine; non-visually it is a dead end.

---

## Summary for design

1. **Ratings 4 and 6 have no accessible name**, and the other eight lose their
   number. The fix pattern already exists in `ScaleInput`. **§0t.**
2. **"Add a note" destroys keyboard focus** and is not announced as a
   disclosure. **§0t.**
3. **"Choose a rating" measures 1.24:1** — the same shared `.subm` compounding
   as ATH-ADULT-03, and here the unreadable label is the only instruction.
4. **The immutability note sits below the button it warns about**, as on
   ATH-ADULT-03.
5. **Steps 4 and 6 render as "·"** — worth confirming as intended.

Right as it stands and worth protecting: the primary action is above the fold at
812 and 11px away at 667; all ten ratings fit; targets are 60.6 × 58; the
duration is pre-filled *and* cites its source; the session is properly named
here; and "Rate the whole session, not the hardest bit." does real work.

**Note for the serial rule:** items 3 and 4 are shared with ATH-ADULT-03 —
same `.subm` class and the same note placement. They should be solved once,
across both flows, not twice.

---

## Claims checked against the running screen

| Walkthrough claim | Verdict |
|---|---|
| Heading "How hard was it?" | **Correct** — `h1` |
| Direction line "Rate the whole session, not the hardest bit." | **Correct** |
| Stepper `aria-label`s "5 minutes less" / "5 minutes more" | **Correct** |
| "Add a note" reveals a textarea `id="rpe-note"`, label "Add a note" | **Correct** — and the button is *replaced*, not kept |
| Submit "Choose a rating" disabled / "Submit rating" enabled | **Correct** — observed disabled; label and `disabled` confirmed in `RpeForm` |
| Network failure → outbox | **Correct** |
| **"radio inputs, 0–10 with word labels"** | **Wrong on both counts.** The scale is **1–10** — ten options, no zero — and **4 and 6 have no word**, rendering "·" (`CR10_ANCHORS` sets them `null`). |
| **"The same immutability sentence appears above the button"** | **Wrong**, the same way as ATH-ADULT-03: it is below (note 686, button 622), and it is three sentences, not one. |
| Step 1's "also visible" list | **Omits** the session card ("09:30 · Contact prep · Training · Main pitch · MD-2"), the duration heading "How long were you training?", the stepper's value and unit, the "Scheduled for 80 min" reference line, and the four tab-bar links. |
| — | **Not documented:** the duration is pre-filled from the session's scheduled length, and the tick glyph marks the chosen row. |

Recorded, not corrected in the walkthrough `.md`.

**One code comment is also wrong** and is filed in §0t rather than here:
`base.css:2948` names the anchors as "4=Somewhat hard/5=Hard/7=Very hard"; the
real positions, from `CR10_ANCHORS` and confirmed on screen, are 5, 7 and 8.
The radio `value` and the displayed numeral match at every step, so nothing is
stored wrongly — only the comment misleads.
