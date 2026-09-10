# Design brief — ATH-ADULT-14, See the leaderboards I am on

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-14 — See the leaderboards I am on

**Entry point.** `/my-data/boards`. Also reachable from "Me" → "Leaderboards"
(which opens the *settings* screen, ATH-ADULT-16/17/18, not this one).

**Steps.**

1. The screen shows heading "Leaderboards" and the boards this athlete appears on.
   - Also visible: "Manage who sees you on a leaderboard" → `/me/leaderboards`.

**Branches.**

- IF the athlete has hidden leaderboards THEN a gate renders instead, offering
  "Show them again" → `/me/leaderboards`.
- IF there are no boards THEN an empty state renders.

**End state.** Stays on `/my-data/boards`.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-14-review.md`** — measurements,
findings, and every claim checked against the running screen. Read it first.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **"Manage who sees you on a leaderboard" stays on this screen, in plain
   words.** On a screen that ranks people against teammates, the opt-out being
   visible rather than buried is the design, not an accident.
2. **The board list is derived from consent state** and must not show a board
   the athlete has hidden.
3. **The gate and empty states must survive** — neither was reachable for this
   athlete, so a proposal must not assume the populated case is the only one.

## 5. What a proposal should address

1. **Two screens named "Leaderboards"** — this one and the settings screen at
   `/me/leaderboards` — with one linking to the other.
2. **The single-board case is sparse** at 812px with no scroll. Worth deciding
   deliberately whether that is fine or wants more.
