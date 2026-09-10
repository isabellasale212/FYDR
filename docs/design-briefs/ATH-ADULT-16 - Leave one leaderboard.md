# Design brief — ATH-ADULT-16, Leave one leaderboard

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**These four flows share one review**, because they are one decision an athlete
makes in four places: do I want to be ranked, and do I want to look.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-16 — Leave one leaderboard

**Entry point.** "Leave this leaderboard" on `/my-data/boards/{id}`.

**Steps.**

1. Press "Leave this leaderboard" — label becomes "Leaving…" while in flight.

**Branches.**

- There is **no confirmation step**. One press leaves the board.

**End state.** The athlete no longer appears on that board. This right cannot be
removed by the club: migration `0016` carries a hard `check (allow_opt_out)` on
GDPR Article 7(3) grounds.

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

1. **Say whether leaving can be undone.** This is the only control in the four
   flows with no confirmation, and — unlike the global toggle, which advertises
   "tap to rejoin" — nothing on the board screen says whether the athlete can
   come back. Answer it in the copy, not with a dialog (§4.1).
2. **Nothing else.** The control's size, placement and lack of confirmation are
   all correct and constrained above.
