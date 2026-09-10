# Design brief — ATH-ADULT-13, Open one gym session from history

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-13 — Open one gym session from history

**Entry point.** `/my-data?tab=gym` → a session row.

**Steps.**

1. The screen shows the session date as its heading and a "Sets" section.
   - Visible: a "Back" button (the shared `BackButton`), a "Back to gym
     history" link (→ `/my-data?tab=gym`) — **two separate back affordances** —
     and a "Correct" button per set row.
   - **A COMPLETE session still offers "Correct" on every set.** Measured on a
     session with `status = 'complete'`: six set rows, six "Correct" buttons.
     `revise_gym_set_log` has no session-status guard, unlike
     `revise_gym_session_log` directly beneath it, which is explicitly "a
     COMPLETE session only". This is what makes the no-reopen decision workable.

**End state.** Stays on `/my-data/gym/{id}`.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-13-review.md`** — measurements,
findings, and every claim checked against the running screen. Read it first.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **"Correct" stays on every set row, including on completed sessions** — there
   is no reopen (decided), so this is the only route to fixing them.
2. **The table keeps its `<caption>`**, visually hidden, and its column headers.
3. **The summary line stays** — "6 sets logged · session RPE 5.8 · 4050 kg
   total" answers the question before the table does.

## 5. What a proposal should address

1. **Two adjacent back affordances** — a "Back" button and a "Back to gym
   history" link — of which only one says where it goes.
2. **A correction leaves no visible trace** on this screen (§0v, pending
   decision).
