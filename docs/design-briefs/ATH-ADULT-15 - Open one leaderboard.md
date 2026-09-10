# Design brief — ATH-ADULT-15, Open one leaderboard

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**These four flows share one review**, because they are one decision an athlete
makes in four places: do I want to be ranked, and do I want to look.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-15 — Open one leaderboard

**Entry point.** A board row on `/my-data/boards`.

**Steps.**

1. The board renders with heading "{board.name}".
   - Visible: a "←" dismiss link (→ `/my-data/boards`), a separate **"Back"**
     button (the shared `BackButton`, **29px tall**), the subtitle
     "Whole squad · all time", a ranking table with a `visually-hidden` caption
     and columns POS / ATHLETE / {metric}, the athlete's own row marked, and
     **"Leave this leaderboard"** (44px).
   - **There is no "Back to leaderboards" control.** An earlier version of this
     document listed one; measured 2026-09-10, the string does not appear.

**Branches, each a distinct screen with its own heading:**

- IF the board is not available to this athlete THEN heading "This leaderboard
  is not available".
- IF the club's plan does not include it THEN heading "Not on your club's plan".

**End state.** Stays on `/my-data/boards/{id}`.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-15-to-18-review.md`** —
covers all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint every leaderboard proposal must satisfy

1. **Leaving must stay at least as easy as being added.** GDPR Article 7(3);
   migration `0016` carries a hard `check (allow_opt_out)` so a club cannot
   remove the right. **Do not add a confirmation step to leaving** — a club
   adds an athlete with no confirmation at all, so a dialog on the way out
   makes withdrawal harder than consent, which is the thing forbidden.
2. **"Do not include me on any leaderboard, including ones published later"
   must keep saying that.** It is a standing objection, not a one-off, and the
   clause is what makes it one.
3. **Hiding and leaving must stay visibly different things.** One changes what
   the athlete sees; the other changes whether anyone else sees them. The cards
   currently say so explicitly and should keep doing it.
4. **"Applies to this device only" must stay** while the preference lives in
   `localStorage`. It is an honest disclosure of a real limitation.
5. **The athlete's own row stays marked** on a board.

## 5. What a proposal should address

1. **Two back affordances**, a "←" link and a 29px "Back" button (§0w).
2. **Nothing says what leaving does to the ranking others see** — the athlete is
   about to press an unconfirmed, possibly irreversible control with no statement
   of its effect beyond its own label.
3. **Unverified branches:** "This leaderboard is not available" and "Not on your
   club's plan" were not reachable for this athlete.
