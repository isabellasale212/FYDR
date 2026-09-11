# Design brief — ATH-ADULT-29, View meal ideas

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-29 — View meal ideas

**Entry point.** "Meal ideas ›" on `/programme`.

**Steps.**

1. The screen shows heading "Meal ideas", eyebrow "MY PROGRAMME · MEAL IDEAS".
   - Visible: a "Back" button (the shared `BackButton`) **and** a "My programme"
     link → `/programme` — two back controls, the same pairing as three other
     athlete screens.
   - Opening copy: "Portions below are scaled to your last recorded weight,
     {kg} kg, on a training day. Reference only — nothing here is logged or
     tracked." and, when the club has no recipes of its own, "Your club hasn't
     added its own recipes to the library yet — these are the standard starting
     meal ideas everyone begins with."
   - **The weight is the staff measurement, not the athlete's own.** It reads
     `body_composition` (skinfold, staff-entered), while `/me`'s "Body mass …
     self-reported" reads the athlete's wellness entries. On the review account
     the two disagree by 7.5 kg (98.5 vs 106.0) and neither screen says why.

**End state.** Stays on `/programme/nutrition`.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-27-to-30-review.md`** — covers
all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **The weight the portions scale to must say whose measurement it is.** It is
   the staff `body_composition` figure, not the athlete's self-report, and the
   two can differ. Copy, not data — the sources stay separate (§0aa).
2. **"Reference only — nothing here is logged or tracked."** stays.
3. **The club-has-no-recipes disclosure stays** while the library is the
   default one.

## 5. What a proposal should address

1. **Two back controls** — "Back" and "My programme".
2. **The scaling sentence** (§4.1) — the design should decide where the source
   and date of the weight are shown.
