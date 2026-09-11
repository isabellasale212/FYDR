# Design brief — ATH-ADULT-28, View my gym programme

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-28 — View my gym programme

**Entry point.** The "Gym" tab. Direct URL `/programme`.

**Steps.**

1. The screen shows heading "My programme", the programme's own name
   ("Pre-season strength" — rendered as a **second `<h1>`**, so the page has
   two), an eyebrow "GYM · ACCUMULATION · WEEK 1", a "Sessions" list, and a
   "Nutrition targets" card ("Your standing target. Guidance only — nothing to
   log here." — Protein 190g, Carbohydrate 440g).
   - Visible: "Meal ideas ›" → `/programme/nutrition`, rendered **once**, at the
     foot of the Nutrition targets card. An earlier version of this document
     said twice and named a separate "Nutrition" section; measured 2026-09-11,
     neither is so.

**Branches.**

- IF no programme is assigned THEN an empty state renders.

**End state.** Stays on `/programme`.

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

1. **"Guidance only — nothing to log here."** stays on the nutrition targets.
2. **Session rows keep phase · week · day · MD-n** — they are what tells an
   athlete which session is today's.
3. **One `h1`.** The programme name is not a second page heading (§0aa).

## 5. What a proposal should address

1. **The empty state** (no programme assigned) was not reachable and should not
   be assumed to look like the populated one.
