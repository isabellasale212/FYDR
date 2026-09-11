# Design brief — ATH-ADULT-23, Pick a colour for my initials

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-23 — Pick a colour for my initials

**Entry point.** "Me" → "Photo" card, **only when no photo is set**.

**Steps.**

1. Press one of eleven chips: "Default", then "Blue", "Green", "Purple",
   "Slate", "Indigo", "Cyan", "Olive", "Magenta", "Steel", "Plum".
   - The group is labelled "Or pick a colour for your initials".

**Branches.**

- IF the save fails THEN the previous colour is restored and "Could not save
  that colour. Try again." renders.

**End state.** Saves immediately on press — no Save button. Verified 2026-09-11:
`users.avatar_colour` is written on press, the Photo card's own preview changes
at once, and `aria-pressed` moves to the chosen chip.

**But the hero avatar at the top of `/me` does not change until the next
navigation.** It is server-rendered from the row, while the picker updates only
its own client-side preview — so on the same screen the athlete sees the card
preview turn blue while the large avatar above it stays on the old colour. After
a reload both agree. Recorded as a finding for the flow.

**The eleven chips are `aria-pressed` toggles in a plain `<div>`** — no
`role="radiogroup"`, no `fieldset`, and the "Or pick a colour for your initials"
line is a paragraph not tied to them. Same shape as the nutrition answers
(§0u). Each is 44px.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-23-to-26-review.md`** — covers
all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **Saves on press, no Save button.** Keep it.
2. **Appears only when no photo is set** — a picker with no visible effect is
   worse than no picker (ATH-ADULT-22's recorded reason).
3. **The eleven colours are a fixed palette** from the design system; a proposal
   does not add or remove one.

## 5. What a proposal should address

1. **The avatar the athlete is colouring does not change** until the next
   navigation, while the card's own preview does. Both are on screen at once.
2. **Group the eleven** so they announce as one choice with a position.
