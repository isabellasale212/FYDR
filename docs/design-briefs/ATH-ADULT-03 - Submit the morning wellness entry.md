# Design brief — ATH-ADULT-03, Submit the morning wellness entry

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**This is the athlete app's most-used screen.** Every athlete is asked to
complete it every morning, and the screen's own subhead promises 45 seconds.
Two measured defects were found while preparing this brief; both are described
below and **neither has been fixed** — they are the design problem, not
background.

---

## 1. What exists now

**`docs/walkthrough-screenshots/athlete-adult/ATH-ADULT-03 - Submit the morning wellness entry.pdf`**
— cover plus 7 frames, the empty form through to the completed state.

**`docs/walkthrough-screenshots/athlete-adult/ATH-ADULT-03w - Submit the morning wellness entry — submitted.pdf`**
— cover plus 6 frames, the real write.

Both verified present before this brief was written. `CAPTURE-REPORT.md` records
`ATH-ADULT-03w` as **5 of 6 steps**: the opening pre-answer frame was lost to a
sign-in detection bug during the capture run. The write itself succeeded, and
the flow is one-shot per athlete per day, so the frame could not be re-taken.
That gap is known and is not a defect in the screen.

---

## 2. The flow, verbatim from the walkthrough document

## ATH-ADULT-03 — Submit the morning wellness entry

**Entry point.** The "Wellness" to-do row on `/today`. Direct URL `/check-in`.

**Steps.**

1. Optionally adjust sleep hours with "−" (`aria-label="Half an hour less
   sleep"`) or "+" (`aria-label="Half an hour more sleep"`). Range 0–14, half-hour steps.
   - Also visible at this step: five 1–5 scale inputs, in this order —
     **sleep quality, soreness, fatigue, mood, stress** — each a radio group
     whose options are labelled "{step}, {word}"; a free-text box with
     placeholder "Anything you want your coach or medical staff to know."; the
     submit button; and the sheet's dismiss control.
2. Choose a value on each of the five scales.
   - Same controls visible.
3. Optionally type in the free-text box.
4. Press the submit button.

**Submit button states.**

| Label | When |
|---|---|
| "Submit entry · {N} to go" | One or more of the five scales is still unanswered. Button is **disabled**. |
| "Submit entry" | All five answered. Enabled. |
| Disabled, same label | While the submission is in flight. |

**Branches.**

- IF fewer than five scales are answered THEN the button stays disabled and its
  label counts what remains. There is no error message; the count *is* the message.
- IF the network fails THEN the entry is written to a local outbox and the flow
  still completes — **deliberately silent**, because the athlete has done the
  thing. `/today` retries it. See ATH-ADULT-30 for what the athlete sees.
- IF an entry already exists for today THEN this screen is not reached — see
  ATH-ADULT-04.

**End state.** Redirect to `/today?submitted=1`, which renders a toast with a
"Dismiss" button.

**Note.** A sentence above the button states the entry cannot be edited once
sent. Corrections are staff-only (`ENTRY_CORRECTION` = sport scientist, coach,
medic) — an athlete cannot revise their own wellness entry.

---

## ATH-ADULT-04 — Wellness entry: already submitted today

**Two claims in the above are wrong** and are corrected in §6. They are left
verbatim here so the document and the brief can be compared.

---

## 3. What the screen is made of

Measured in the live DOM at **375×812**, signed in as a real athlete with no
entry for today.

| Element | Top | Height | |
|---|---|---|---|
| Sheet head — "This morning", subhead, "✕" | 0 | 82 | |
| Sleep stepper — "−" / "7.0 hours" / "+" | 110 | 44 | pre-filled and already valid |
| Scale 1 — Sleep quality | 166 | 118 | |
| Scale 2 — Soreness | 295 | 118 | |
| Scale 3 — Fatigue | 425 | 118 | |
| Scale 4 — Mood | 554 | 118 | |
| Scale 5 — Stress | 684 | 118 | ends at **801** — clears the fold by **11px** |
| `<details>` "Add heart rate or weight" | ~830 | — | collapsed, below the fold |
| "Comment or injury issue (optional)" | ~900 | — | below the fold |
| **Submit button** | **1030** | 51 | **229px below the fold** |
| Immutability note (40 words, 13px) | 1089 | 75 | **below the button** |

**Page height 1,272px on an 812px viewport.** At 375×667 only three of the five
scales are above the fold and the button needs 414px of scroll.

**Each scale** is a `<fieldset class="sc">`: a legend, a live readout
("not answered" in amber → "{N} of 5"), five radio options, and end labels.
Option targets measure **55.3 × 44px** with 8px gaps — the 44px floor is real.
Each option carries a clipped `<label class="visually-hidden">` reading
"3, All right" for screen readers, with the numeral itself `aria-hidden`.

**The five scales, with their end labels:**

| Scale | 1 | 5 |
|---|---|---|
| Sleep quality | Very poor | Very good |
| Soreness | Very sore | No soreness |
| Fatigue | Exhausted | Very fresh |
| Mood | Very low | Very good |
| Stress | Very stressed | Very relaxed |

Note the polarity: **5 is always the best state**, including for soreness and
stress where the intuitive reading is the opposite. The subhead states this
rule once globally, and every scale restates it through its own end labels.

---

## 4. Tokens in play

| Element | Current |
|---|---|
| Sheet surface | `--surf` `#fcfdfe` |
| Phone ground | `--phone-bg` `#dbe7fb` |
| Body text | `--text` `#13161c` |
| Secondary text | `--muted` `#484e57` |
| Accent | `--accent` `#1f6fea` |
| Option border | `--border` `#d4dff5` |
| Footer hairline | `--hair` `#1012170d` |
| Control radius | `--r-control` `6px` |
| Disabled opacity | `--o-disabled` `.45` |
| Focus ring | `--focus` `#1f6fea` |

Scale legend 16px/700 `--text`. "not answered" 13px/600 in amber
`rgb(176,125,10)`. Option key 16px/700, radius **14px** (not `--r-control`),
1px `--border`, transparent fill. End labels 11px. Submit 16px/700, radius
`--r-control`. Body font Roboto via `--font-sans`.

**The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`.** That file is the constraint list.

---

## 5. The constraint any proposal must satisfy

1. **The 44px target floor is non-negotiable.** Twenty-five options are tapped
   every morning, often with cold hands. Current targets are 55.3 × 44 and must
   not shrink.
2. **The entry is immutable.** `wellness_entries` is ADR-005. An athlete cannot
   revise their own entry; correction is staff-only (`ENTRY_CORRECTION` — sport
   scientist, coach, medic). Any proposal that makes submission *easier to do
   accidentally* is worse, not better.
3. **Both end labels must stay visible on every scale.** "5 = no soreness" is
   counter-intuitive; an unlabelled scale is a guess.
4. **Real radio inputs must stay.** The keyboard, the screen reader and the
   browser's own group semantics come from them. The visually-hidden label per
   option is what carries "3, All right" to a screen reader.
5. **The polarity rule must remain stated.** Globally, per-scale, or both.
6. **Sleep stays pre-filled at 7.0.** A default that is already valid is why the
   stepper is optional.
7. **No confirm step.** This is a daily task; a second screen would cost more
   than it protects.
8. **`.subm` is shared by four forms** — `CheckInForm`, `RpeForm`,
   `NutritionCheckinForm`, `ProblemReportForm`. Under the serial-implementation
   rule, a change to `.subm` or to `--o-disabled` collides with every other
   athlete write flow and must be flagged before it is built.
9. **`.phone` / `.phone-body` are the athlete shell**, rendered by every athlete
   screen. They are **outside** the scoped freeze exception. A proposal may
   depend on them changing, but that change needs confirming separately.

---

## 6. Persona review

Full review: **`docs/walkthrough-reviews/ath-adult-03-review.md`**. The two
defects it found, both measured on the running screen:

### 6.1 The sticky submit footer does not stick

`.subm` is authored `position: sticky; bottom: 0`. It is inert.

`.phone` uses `min-height: 100dvh`, so the shell grows to its content;
`.phone-body`'s `flex: 1; min-height: 0; overflow-y: auto` is therefore never
bounded and never scrolls (`scrollHeight === clientHeight`, measured). The
document scrolls instead. Sticky resolves against `.phone-body` — a scroll
container that never scrolls — so it has nothing to stick to.

Proved by scrolling it: `.subm`'s top in the viewport at document scroll
0 / 200 / 460 was **1015 / 815 / 555**, moving 1:1 with the page. A working
`bottom: 0` sticky would have pinned at ≤ 642.

Consequence: the primary action of the app's most-used screen is 229px below
the fold at 812 and 414px at 667, on a screen whose five scales clear the 812
fold by 11px — so it looks complete when it is not.

Filed as **§0s** in `docs/Fydr_-_Architecture_To-Do_List.md`. **Not fixed:** the
fix is one property on the shared athlete shell, outside the freeze exception,
and it may be the wrong fix — the tab bar is `position: static` and also scrolls
away, which suggests document-scroll may be the intended model. If so the
correct fix is to drop the sticky and design a footer for a scrolling page.
**A proposal here should say which model it assumes.**

### 6.2 The outstanding-count is written in a colour you can't read

`:disabled` and `[disabled]` both match the submit button, so a 35%-alpha accent
fill is composited at 45% opacity. Measured from rendered pixels:

| State | Fill | Glyph | Contrast |
|---|---|---|---|
| Disabled — "Submit entry · 5 to go" | `rgb(221,230,250)` | `rgb(253,254,255)` | **1.24:1** |
| Enabled — "Submit entry" | `rgb(56,110,226)` | `rgb(255,255,255)` | **4.67:1** |

Not automatically a WCAG failure — 1.4.3 exempts inactive controls — but that
exemption assumes disabled means nothing here needs reading, and this label is
the flow's **only** statement of how many answers remain.

### 6.3 The rest of the review, in short

- **Completion is invisible.** Answering all five enables the button and changes
  its label, and **scrolls nothing** — the athlete's view is identical before
  and after the form becomes valid. Per-scale readouts are the only visible
  feedback and there is no aggregate above the fold.
- **The immutability warning is below the button it warns about** (note y1089,
  button y1030). The copy is good; the placement means it is read only by
  someone who scrolled past the button without pressing it.
- **The comment/injury field is below the fold**, despite having been
  deliberately promoted out of the `<details>` so that "something hurts" would
  not be two taps down.
- **Good and worth keeping:** real 44px targets, the doubly-stated polarity
  rule, the pre-filled sleep default, and no confirm step.

### 6.4 Two document errors, uncorrected

The walkthrough text in §2 says a **sentence above the button** states the entry
cannot be edited. It is **40 words in three sentences**, and it is **below** the
button. Step 1's "also visible" list also omits the `<details>` disclosure
"Add heart rate or weight" and its two fields, the visible label "Comment or
injury issue (optional)", the "7.0 hours" readout, and the per-scale readouts.

Left uncorrected in the walkthrough `.md` pending review, per the standing
instruction not to pre-solve findings.

---

## 7. What a proposal should address

In priority order, from the measurements above:

1. **Getting the athlete to the primary action** — whether by fixing the sticky,
   by restructuring the page so submission is reachable without a blind scroll,
   or by moving completion feedback above the fold. State which shell model the
   proposal assumes (§6.1).
2. **Making the outstanding count legible and visible** — it is currently both
   off-screen and at 1.24:1.
3. **Placing the immutability warning where it is read before the tap**, without
   adding a confirm step.
4. **The 375×667 case**, where only three of five scales are above the fold.

Not in scope: the scales themselves, their order, their wording, or their
targets. Those measured well and the review found no fault in them.
