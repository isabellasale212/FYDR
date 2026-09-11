# Design brief — ATH-ADULT-22, Add, replace or remove my photo

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-22 — Add, replace or remove my photo

**Entry point.** "Me" → the "Photo" card.

**Steps.**

1. Press the upload control.

**Control states.**

| Label | When |
|---|---|
| "Upload photo" | No photo set. |
| "Replace photo" | A photo exists. |
| "Working…" | Upload or removal in flight. |

2. Choose a JPEG, PNG or WebP up to 2MB.
   - Also visible: "Remove" (only when a photo exists); the caption "JPEG, PNG
     or WebP, up to 2MB."; and, when no photo exists, the colour picker
     (ATH-ADULT-23).

**Branches.**

- IF the file is the wrong type or too large THEN an inline `role="alert"` error
  renders and the file input is cleared.
- IF a photo exists THEN the colour picker is **hidden** — a picker with no
  visible effect is worse than no picker.

**End state.** Stays on `/me`; the avatar updates immediately, independent of
the profile form's own "Save".

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

1. **JPEG / PNG / WebP, 2MB** — the `accept` attribute and the caption agree
   and must keep agreeing.
2. **The colour picker appears only when it can have an effect** (no photo).
   "A picker with no visible effect is worse than no picker" is the recorded
   reason; keep it.
3. **The avatar updates independently of the profile form's Save.** Do not
   couple them.

## 5. What a proposal should address

1. **Unverified states** — "Replace photo", "Remove", the bad-file error, and
   the picker hiding once a photo exists — were not reachable without an
   upload. A proposal should not assume they look like the upload state.
2. **The eleven colour buttons are ungrouped** — ATH-ADULT-23's question, noted
   here because they live in this card.
