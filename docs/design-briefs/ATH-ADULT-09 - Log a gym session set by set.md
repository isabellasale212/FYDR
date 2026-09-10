# Design brief — ATH-ADULT-09, Log a gym session set by set

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-09 — Log a gym session set by set

**Entry point.** The "Gym" tab → `/programme` → a session row. Direct URL
`/gym/{sessionId}`.

**Steps.**

1. The screen shows heading "{sessionName}", a progress line
   "{done} of {total} sets · {mm:ss}" — it carries a **running clock** as well
   as the count — and a card per exercise.
   - **Not every exercise is shown.** Only the first two render; the rest sit
     behind a disclosure button reading "{n} more · {names}" (measured:
     "2 more · Split squat, Nordic curl" on a four-exercise session).
   - Also present, and not previously listed: a "Session RPE (optional)"
     section, and the line "Sets save as you log them."
   - **Opening this screen writes a row.** `startOrGetSessionLog` creates the
     session log on load, before anything is logged — which is why the clock
     reads a live time the moment the page appears. See §0g.
   - Per exercise, visible at all times: a per-set button for every prescribed
     set; a weight row; and, when the athlete's weight differs from the
     prescription, both numbers — theirs labelled "Your weight", the coach's
     "Recommended".
   - Weight controls: "−" (`aria-label="Decrease the weight for {exercise}"`)
     and "+" (`aria-label="Increase the weight for {exercise}"`).
   - When no weight applies the label reads "Bodyweight"; when one applies but
     none is set, "No load set".
   - Also on screen throughout: the finish button (see ATH-ADULT-10), and the
     four-tab bar.
2. Press the next set's button to log it.
   - Accessible name when unlogged: "Log set {n} of {total}, {exercise}".
     Verified. The buttons measure **105.7 × 42px** — below the app's own 44px
     floor.
   - Accessible name once logged: "Set {n} logged, {reps} reps at {load} kg.
     Correct it." — `aria-pressed` becomes true.
3. Repeat for each set and each exercise.

**Branches.**

- IF a set is **not** the next one in sequence THEN its button is **disabled**.
  Sets are logged in order; an athlete cannot skip ahead to set 3 without
  logging set 2. This is the single most common source of "the button does
  nothing" and it is deliberate.
- IF a set is already logged THEN pressing it opens the inline correction
  (ATH-ADULT-11) rather than re-logging it.
- IF a log fails THEN it queues in the outbox and the set still shows as done.

**End state.** Stays on `/gym/{sessionId}`. The exercise header count moves from
"—" (nothing logged) through "{n} of {total}" to complete.

---


*(Corrections from this pass are already applied above where they were
factual; see §3 of the review for what changed.)*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-09-review.md`** — it carries
the measurements, the findings, and the claims checked against the running
screen. Read it before proposing anything.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **Sequential logging is deliberate.** Sets are logged in order and non-next
   buttons are `disabled`. A proposal may *explain* the rule but must not remove
   it.
2. **Sets stay correctable.** Pressing a logged set opens the inline correction
   (ATH-ADULT-11) rather than re-logging — the one forgiving write in the
   athlete app.
3. **Accessible names must survive.** "Log set {n} of {total}, {exercise}" is
   the best labelling in the athlete app; whatever the button becomes, it keeps
   that name.
4. **Opening the screen already writes a session log** (§0g). A proposal must
   not add a second implicit write.
5. **This screen is used mid-exercise**, hands cold or chalked, glances of two
   seconds. Target size and glanceability outrank density.

## 5. What a proposal should address

1. **Set buttons to the 44px floor** — currently 42 (§0u).
2. **Fix the broken prescription line** when no 1RM is linked (§0u).
3. **Say why a disabled set button is disabled** — the app's most common "it
   does nothing" complaint.
4. **Reconcile the disclosure with the count** — "0 of 12" counts sets hidden
   behind "2 more · …".

Not in scope: the sequential rule itself, and the clock's format (§0g).
