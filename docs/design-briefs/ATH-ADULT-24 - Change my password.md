# Design brief — ATH-ADULT-24, Change my password

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-24 — Change my password

**Entry point.** "Me" → the "Password and sign-in" card.

**Steps.**

1. Fill "Current password" (`id="current-password"`).
2. Fill "New password" (`id="new-password"`).
3. Fill "Confirm new password" (`id="confirm-password"`).
4. Press "Change password" — label becomes "Changing…" while in flight.
   - Also visible: the hint "At least 12 characters." beneath the new-password
     field. `autocomplete` is `current-password` / `new-password` /
     `new-password` respectively, so password managers fill the right fields.

**End state.** Stays on `/me`.

**Not exercised** — passwords are never typed in review, and changing this
account's would lock the remaining batches out of it. "Changing…" is therefore
recorded from source, not observed.

**The form has no `method` attribute** — the same defect as sign-in (§0x): a
submit before hydration would put the current and new passwords in the URL.

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

1. **The three `autocomplete` values stay** — `current-password`,
   `new-password`, `new-password`. They are what makes a password manager fill
   the right fields, and they are correct today.
2. **"At least 12 characters." stays in view**, not in a tooltip.
3. **§0x is a defect and out of scope for the brief** — but any proposal that
   restructures the form must not lose `method="post"` once the builder adds
   it.

## 5. What a proposal should address

1. **Nothing of substance.** Three fields, one button, one hint. The only
   problem is the missing `method` (§0x), which is build work.
