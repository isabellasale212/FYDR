# Design brief — ATH-ADULT-17, Leave every leaderboard at once

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**These four flows share one review**, because they are one decision an athlete
makes in four places: do I want to be ranked, and do I want to look.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-17 — Leave every leaderboard at once

**Entry point.** "Me" → "Leaderboards" → the "Every leaderboard at once" card.

**Steps.**

1. Press the global toggle.

**Toggle states.**

| Label | When |
|---|---|
| "Leave every leaderboard" | Currently appearing. |
| "Left every leaderboard — tap to rejoin" | Currently opted out. |

**End state.** Stays on `/me/leaderboards`. Reversible from the same control.

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

1. **The relationship between this and leaving one board is not shown.** An
   athlete who has left every board still sees "Leave this leaderboard" on an
   individual board if they reach one. Worth making the global state visible
   where the per-board control lives.
2. **The end state was not verified** — the toggle was measured, not pressed,
   because it changes consent rather than view.
