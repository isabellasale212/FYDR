# Design brief — ATH-ADULT-21, Edit my profile

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-21 — Edit my profile

**Entry point.** "Me" → the "Edit profile" card.

**Steps.**

1. Edit "Phone" (`id="athlete-phone"`, `type="tel"`).
2. Press "Save" — label becomes "Saving…" while in flight.

**Branches.**

- Date of birth is **not editable here**: it needs staff. Name, position **and
  squad number** are likewise staff-owned — the card says so: "Your name, date of
  birth, position and squad number are set by staff and aren't editable here."
- On success a `role="status"` line reads **"✓ Saved."** beneath the button.
  Verified by submitting the form unchanged.

**End state.** Stays on `/me`.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-19-to-22-review.md`** — covers
all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **Name, date of birth, position and squad number stay staff-owned** and the
   card keeps saying so.
2. **"✓ Saved." stays** — it is the clearest write confirmation in the athlete
   app.

## 5. What a proposal should address

1. **Nothing of substance.** One field, one button, one confirmation. If the
   proposal for the "Me" screen as a whole moves this card, keep those three.
