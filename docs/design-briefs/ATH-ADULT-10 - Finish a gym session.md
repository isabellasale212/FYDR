# Design brief — ATH-ADULT-10, Finish a gym session

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-10 — Finish a gym session

**Entry point.** The finish button at the foot of `/gym/{sessionId}`, present
from the moment the screen loads.

**Steps.**

1. Press the finish button.

**Button states.**

| Label | When |
|---|---|
| "Finish early · {done} of {total}" | Fewer sets logged than prescribed. |
| "Finish session" | Every prescribed set logged. |

**Branches.**

- IF the athlete finishes early THEN the session is still completed; the label
  is the only warning, and there is no confirmation step.

**End state.** The session is marked complete and appears in My data's Gym tab.

**Flagged as unclear.** Whether a completed session can be reopened from the
athlete side was not established in this pass. `/my-data/gym/{id}` offers
per-set correction (ATH-ADULT-11) but no "reopen". Worth confirming before
matching a screenshot that appears to show a re-entered session.

---


*(Corrections from this pass are already applied above where they were
factual; see §3 of the review for what changed.)*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-10-review.md`** — it carries
the measurements, the findings, and the claims checked against the running
screen. Read it before proposing anything.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **Finishing early must stay possible in one tap.** An athlete stopping
   because of a niggle or a closing gym should not be made to justify it.
2. **The label must keep stating the consequence.** "Finish early · {done} of
   {total}" is better than a modal that gets dismissed reflexively.
3. **Whether a finished session can be reopened is an OPEN QUESTION**, recorded
   in the walkthrough and deliberately left unresolved. **A proposal must not
   assume either answer.** If it depends on one, say so and stop.
4. **The button stays reachable without scrolling** — it is at top 695 on an 812
   viewport today.

## 5. What a proposal should address

1. **Distinguish the one irreversible control from the twelve reversible ones**
   above it — it is currently their visual peer, always enabled, unconfirmed.
2. **Say what finishing does**, not just what the button is — the session is
   marked complete and appears in My data's Gym tab.

Not in scope: adding a confirmation dialog before the reopen question is
settled; the answer to that question changes whether one is needed at all.
