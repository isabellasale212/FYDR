# Design brief — ATH-ADULT-05, Rate a session (RPE)

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**Read this alongside ATH-ADULT-03.** The two athlete write forms share the
`.subm` submit block, and two of the findings below are the *same* findings.
Under the serial rule they should be solved once, across both flows.

**Structurally this is the better of the two forms** and the brief should not
undo that: the primary action is above the fold, all ten ratings fit on one
screen, and the duration is pre-filled from the schedule with its source shown.
The problems here are accessibility and legibility, not layout.

---

## 1. What exists now

**`docs/walkthrough-screenshots/athlete-adult/ATH-ADULT-05 - Rate a session (RPE).pdf`**
— captured cleanly; `CAPTURE-REPORT.md` records no problem with this flow.

Measured live at 375×812 and 375×667 signed in as a real athlete with a
genuinely outstanding RPE (Conor Moroney, "Contact prep", 09:30, MD-2). Nothing
was submitted: `training_entries` is ADR-005 immutable and this is his real
rating, so the form was measured with local state only.

---

## 2. The flow, verbatim from the walkthrough document

## ATH-ADULT-05 — Rate a session (RPE)

**Entry point.** An "RPE" to-do row on `/today`, whose name is the session's own
name. Direct URL `/rpe/{sessionId}`.

**Steps.**

1. Choose a rating from the CR-10 list (radio inputs, 0–10 with word labels).
   - Also visible: heading "How hard was it?"; the direction line "Rate the
     whole session, not the hardest bit."; duration stepper "−"
     (`aria-label="5 minutes less"`) and "+" (`aria-label="5 minutes more"`);
     an "Add a note" button; the submit button; the sheet dismiss "✕".
2. Optionally adjust duration with "−" / "+" (5-minute steps).
3. Optionally press "Add a note", which reveals a textarea (`id="rpe-note"`,
   label "Add a note").
4. Press the submit button.

**Submit button states.**

| Label | When |
|---|---|
| "Choose a rating" | No rating selected. **Disabled.** |
| "Submit rating" | A rating is selected. Enabled. |

**Branches.**

- IF no rating is chosen THEN the button stays disabled and reads "Choose a
  rating" — the label is the instruction.
- IF the session id does not resolve THEN see ATH-ADULT-06.
- IF the network fails THEN the entry queues in the outbox, same as wellness.

**End state.** Redirect to `/today`, with a toast.

**Note.** The same immutability sentence appears above the button: once sent it
cannot be edited.

---


**Two claims above are wrong** — the scale is 1–10 not 0–10, and the
immutability note is below the button, not above. See §6.4.

---

## 3. What the screen is made of

Measured in the live DOM at **375×812**.

| Element | Top | Height | |
|---|---|---|---|
| Sheet head | 0 | 120 | no subhead, unlike check-in |
| Session card — "09:30 · Contact prep · Training · Main pitch · MD-2" | 148 | 64 | |
| Direction — "Rate the whole session, not the hardest bit." | 240 | 32 | |
| **CR-10 grid**, 10 options | 286 | 124 | 5×2, each **60.6 × 58** |
| "How long were you training?" | 410 | 37 | |
| Stepper — "− 80 MINUTES +" | 457 | 44 | pre-filled from the schedule |
| "Scheduled for 80 min" | 503 | 19 | names its own source |
| "Add a note" (`.btn-ghost`) | 549 | 44 | |
| **Submit** | **622** | 56 | bottom 678 — **above the 812 fold** |
| Immutability note, 3 sentences | 686 | 75 | **below the button** |

**Page height 868px.** At 812 the button is fully visible with no scroll; at
**667** all ten ratings still fit and the button is **11px** from the fold.

**The CR-10 scale, as rendered:**

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Word | Very easy | Easy | Moderate | **·** | Somewhat hard | **·** | Hard | Very hard | Extremely hard | Maximal |

4 and 6 are deliberately `null` in `CR10_ANCHORS` and render a middot. The radio
`value` matches the displayed numeral at every step (all ten checked). Selection
shows an accent fill plus a "✓" on that row only.

**Submit states:** "Choose a rating" (disabled) → "Submit rating" (enabled,
`rgb(31,111,234)`, opacity 1). Both observed live.

---

## 4. Tokens in play

| Element | Current |
|---|---|
| Sheet surface | `--surf` `#fcfdfe` |
| Accent / selected row | `--accent` `#1f6fea` |
| Secondary text | `--muted` `#484e57` |
| Disabled opacity | `--o-disabled` `.45` |
| Control radius | `--r-control` `6px` |
| Submit label | 16px/700 |

**The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`.** That file is the constraint list.

---

## 5. The constraint any proposal must satisfy

1. **Keep the submit button above the fold.** It is at 678 against an 812 fold
   and 11px from a 667 one. This is the thing ATH-ADULT-03 gets wrong and this
   screen gets right; a proposal must not spend that.
2. **Ten options must stay on one screen.** All ten are above the fold at both
   sizes today, at 60.6 × 58 each — comfortably over the 44px floor.
3. **The entry is immutable.** `training_entries` is ADR-005; `ENTRY_CORRECTION`
   is staff-only (sport scientist, coach, medic). Do not make submission easier
   to trigger accidentally.
4. **Real radio inputs stay**, and every one of them must end up with a
   non-empty accessible name (§6.1).
5. **The duration must keep citing its source.** "Scheduled for 80 min" under a
   pre-filled 80 is what stops an athlete accepting a wrong default blindly.
6. **`.subm` is shared with three other forms** — CheckInForm,
   NutritionCheckinForm, ProblemReportForm. Any change to `.subm`,
   `--o-disabled`, or the `[disabled]` background is a **same-class collision
   with ATH-ADULT-03** and must be flagged and solved once for both.
7. **`.cap` is *not* in play on this screen.** The rating form has no `.cap`
   link (measured). The RPE page's `.cap` link lives in its already-rated
   branch, which is an undocumented flow — see §6.5.

---

## 6. Persona review

Full review: **`docs/walkthrough-reviews/ath-adult-05-review.md`**.

### 6.1 Ratings 4 and 6 have no accessible name — filed as §0t

From the live accessibility tree:

| Radio | Accessible name |
|---|---|
| 1, 2, 3 | "Very easy", "Easy", "Moderate" |
| **4** | **(empty)** |
| 5 | "Somewhat hard" |
| **6** | **(empty)** |
| 7–10 | "Hard", "Very hard", "Extremely hard", "Maximal" |

Every child of the option's label is `aria-hidden` — numeral, tick, and the "·"
standing in for the missing word — so the label contributes no text. The other
eight announce the **word without the number**, so the athlete cannot map what
they hear to the 1–10 scale their coach speaks in.

**The fix pattern already exists in this codebase**: `ScaleInput` aria-hides its
numeral and adds `<label className="visually-hidden">{step}, {word}</label>`,
announcing "3, All right". A proposal may keep 4 and 6 visually unanchored —
that is a legitimate reading of CR-10 — but the accessible name cannot be empty.

### 6.2 "Add a note" destroys keyboard focus — filed as §0t

Measured twice with focus placed on the button first: the click replaces the
button with the textarea and `activeElement` becomes `BODY`. A keyboard user
loses their place and must tab back from the top; the textarea is never focused.
The button also has neither `aria-expanded` nor `aria-controls`. Check-in does
the same job with a native `<details>`/`<summary>` and gets this for free.

### 6.3 "Choose a rating" measures 1.24:1 — shared with ATH-ADULT-03

Fill `rgb(221,230,250)`, glyph `rgb(253,254,255)`, measured from pixels.
Identical to check-in, because `.subm .btn-primary:disabled` (opacity `.45`) and
`.subm .btn-primary[disabled]` (accent at 0.35 alpha) both match and compound.

Worse here than on check-in: this label is not a progress count, it is **the
only instruction on the screen telling the athlete what to do next**.

### 6.4 The rest, in short

- **The immutability note is below the button** (note 686, button 622) — the
  same placement problem as ATH-ADULT-03, and shared with it.
- **Steps 4 and 6 render as "·"**, which asks a sighted athlete to infer that 4
  sits between "Moderate" and "Somewhat hard". Worth confirming as intended.
- **Good and worth protecting:** the button above the fold; ten options on one
  screen at 60.6 × 58; the duration pre-filled *and* sourced; the session
  properly named here; the "✓" as a second local confirmation; and "Rate the
  whole session, not the hardest bit.", which pre-empts the commonest
  misreport.

### 6.5 Document errors found, not yet corrected

- **"radio inputs, 0–10"** — the scale is **1–10**, ten options, no zero.
- **"with word labels"** — 4 and 6 have none.
- **"The same immutability sentence appears above the button"** — it is below,
  and it is three sentences.
- **Step 1's list omits** the session card, the duration heading, the stepper
  value and unit, the "Scheduled for 80 min" line, and the four tab links.
- **Undocumented:** the duration pre-fills from the session's scheduled length;
  the "✓" marks the chosen row; and the page's **already-rated** and
  **not-yet-due** branches have no flow of their own at all.

### 6.6 This screen is the last line of defence for §0r

Every RPE row on Today reads "How hard was it?" regardless of session, so an
athlete with two sessions in a day picks blind and only learns which one they
opened *here*. The session card does that job well and must keep doing it until
§0r is fixed.

---

## 7. What a proposal should address

1. **Give every rating a non-empty accessible name**, including 4 and 6, without
   necessarily changing what is drawn (§6.1).
2. **Make "Add a note" keep focus** and announce itself as a disclosure (§6.2).
3. **Make the disabled label readable** — it is the screen's only instruction.
   Solve it once with ATH-ADULT-03 (§5.6).
4. **Move the immutability note above the button**, once, for both forms.
5. **Confirm or replace the "·" treatment** on steps 4 and 6.

Not in scope: the layout, which measures well; the CR-10 wording, which comes
from `CR10_ANCHORS` and matches the spec table; and the session card.
