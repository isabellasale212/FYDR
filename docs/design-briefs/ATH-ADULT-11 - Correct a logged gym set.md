# Design brief — ATH-ADULT-11, Correct a logged gym set

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-11 — Correct a logged gym set

**Entry point.** Two places, both real and both using the same RPC
(`revise_gym_set_log`):
- Inside the live logger: press any **already-logged** set button.
- In history: `/my-data/gym/{gymSessionLogId}` → "Correct" on a set row.

**Steps (in the logger).**

1. Press a logged set's button. An inline panel opens headed "Correcting set
   {n}".
2. Edit "Reps" and/or "Load (kg)".
   - Also visible: "Save correction", "Cancel", and the explanatory line "The
     original is kept. My data marks the day corrected and shows what you first
     reported."
3. Press "Save correction".

**Steps (in history).**

1. Press "Correct" on a set row.
2. Edit the reps field (`aria-label="Set {n} corrected reps"`) and/or load.
3. Press "Save" — label becomes "Saving…" while in flight.

**Branches.**

- IF "Cancel" is pressed THEN the panel closes and nothing is written.
- IF a field is left blank THEN it is **not** treated as zero — the RPC reads a
  blank as "unchanged", which is why the form validates rather than coercing.
- IF the set has already been superseded THEN the RPC refuses.

**End state.** A new revision row is written, the original kept and marked
superseded, and an audit row records the correction with old and new values.
My data marks that day corrected and shows what was first reported.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-11-review.md`** — measurements,
findings, and every claim checked against the running screen. Read it first.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **The revision chain is linear and the original is never overwritten.** Only
   the current revision is revisable; a superseded one refuses with
   `entry_not_revisable`.
2. **Blank means unchanged, not zero.** The form validates rather than coercing,
   so an athlete clearing a field to retype never silently writes a 0.
3. **Correction must stay available on a FINISHED session.** There is no reopen
   (decided), so this flow is the only route to fixing a completed session's
   numbers. `revise_gym_set_log` deliberately has no status guard.
4. **Both entry points use the same RPC** and must keep doing so.
5. **The copy must match behaviour** — see §6.1. Whichever way that is resolved,
   the panel must not claim something My data does not do.

## 5. What a proposal should address

1. **§0v — the promise gap.** Either surface the superseded value in My data, or
   reduce the panel copy to what actually happens. **This is a decision, not a
   default**, and it is out of scope for the brief until Isabella settles it.
2. **Acknowledge a saved correction** — currently the only feedback is the number
   changing.
