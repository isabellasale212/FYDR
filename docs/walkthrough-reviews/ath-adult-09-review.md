# Persona review — ATH-ADULT-09, Log a gym session set by set

**Persona.** An athlete mid-session, between sets, phone on the bench, hands
chalked or cold, glancing down for two seconds at a time. This is the only
athlete flow used *during* an activity rather than after it.

**Reviewed 2026-09-10** at **375×812** as a real athlete on a real assigned
session (Conor Moroney, "Lower A", Pre-season strength · Accumulation · Week 1 ·
Day 1, 12 sets across 4 exercises).

**Read-only. No set was logged and the session was not finished.** Logging
writes rows and finishing changes session state whose reversibility the
walkthrough itself flags as unestablished — so the screen, its states and its
accessible names were measured without exercising the write path. What that
leaves unverified is listed at the end.

**One write did happen, unavoidably.** `startOrGetSessionLog` creates the
session log on page load — the clock read "00:01" the moment the screen
appeared. Opening the screen at all is a write. That is §0g's known behaviour;
the row was left in place per "work on the app, not the data".

---

## The measured screen

| Element | Detail |
|---|---|
| Eyebrow | "PRE-SEASON STRENGTH · ACCUMULATION · WEEK 1 · DAY 1" |
| `h1` | "Lower A" |
| Progress | "0 of 12 sets · **00:47**" — a running clock, not just a count |
| Exercise 1 | "Back squat", "3 × 8–10 @ 100 kg · 90s rest" |
| Exercise 2 | "Romanian deadlift", **"3 × 8 @ No 1RM test linked to this exercise yet."** |
| Disclosure | **"2 more · Split squat, Nordic curl ›"** |
| | "Session RPE (optional)" |
| Finish | "Finish early · 0 of 12", top 695 |
| Footer | "Sets save as you log them." |

**Page height 812 — one screen.** Set buttons **105.7 × 42px**; weight steppers
"Decrease/Increase the weight for {exercise}".

---

## The findings

### 1. The prescription line breaks mid-sentence

Romanian deadlift reads **"3 × 8 @ No 1RM test linked to this exercise yet."** —
one `<span class="scheme num">`, verified as a single element rather than two
run together. The `{load}` slot of a `{sets} × {reps} @ {load}` template has
received the explanatory sentence meant for the weight row. It parses as an
instruction until the "@" and then becomes an apology. The same sentence renders
correctly below under "NO LOAD SET". Filed as **§0u**.

### 2. The most-tapped control in the app misses the 44px floor

Every set button is **42px** tall. Twelve taps in this session alone, mid-workout,
with chalked hands — and it is the one control that misses a floor the wellness
scales (55.3 × 44) and CR-10 grid (60.6 × 58) both clear. Filed as **§0u**.

### 3. Half the session is behind a disclosure

Only two of four exercises render; "2 more · Split squat, Nordic curl ›" hides
the rest. Defensible — it keeps the working set in view — but it means the
progress line ("0 of 12") counts sets the athlete cannot see, and an athlete
part-way through has to open a drawer to find what remains. Undocumented until
now; **corrected in the walkthrough.**

---

## 1. How many taps, and is any step redundant?

**Twelve taps minimum**, one per set, plus a disclosure and a finish. That is
the flow working as intended — one tap per set is the right cost.

**Sequential gating is the right call and is invisible.** Sets 2 and 3 are
`disabled` until set 1 is logged; measured, only the first set of each rendered
exercise is enabled. The walkthrough calls this "the single most common source
of 'the button does nothing'", and nothing on screen explains it — a disabled
button with no reason given.

## 2. Does any label or copy not match how this person thinks?

**The accessible names are the best in the athlete app**: "Log set 1 of 3, Back
squat" says the action, the position and the exercise. Whoever wrote these did
the job §0t's CR-10 list still needs doing.

**"change it if it is not right today"** under "RECOMMENDED" is good — it gives
explicit permission to deviate from the coach's number, which is exactly the
hesitation an athlete has.

**"Finish early · 0 of 12" is a well-judged label** — it states the consequence
in the control rather than in a dialog.

## 3. Where is a mistake most likely, and can it be undone?

**Logging the wrong set is the likely error, and this is the one athlete entry
that is genuinely correctable** — ATH-ADULT-11 exists, and pressing a logged set
opens the correction rather than re-logging. Good.

**The dangerous one is "Finish early", with no confirmation step and unknown
reversibility.** The walkthrough flags reopening as unestablished; that question
is deliberately **left unresolved here** and not walked.

## 4. Anything they must read that the screen could infer?

It infers well — prescription, recommended load and rest all come from the
programme. The clock is inferred too, and per §0g its `mm:ss` has unbounded
minutes, so a session left open reads "177:19".

## 5. Is there a moment where it's unclear whether something worked?

**Yes: a disabled set button gives no reason.** An athlete who taps set 3 first
gets nothing at all — no message, no explanation of sequence. That is the
documented "button does nothing" case, and the screen never says why.

"Sets save as you log them." is the right reassurance in the right place.

---

## Summary for design

1. **The prescription line breaks mid-sentence** when no 1RM is linked. **§0u.**
2. **Set buttons are 42px** — the most-tapped control, under the floor. **§0u.**
3. **A disabled set button explains nothing**, and this is the app's most
   common "it does nothing" complaint.
4. **Half the exercises sit behind a disclosure** while the progress count
   includes them.
5. Right and worth keeping: the accessible names, "change it if it is not right
   today", "Finish early · {n} of {m}" stating its own consequence, and
   correctable sets.

---

## What this review did not verify, and why

- **The logged-state accessible name** ("Set {n} logged, {reps} reps at {load} kg.
  Correct it.") and `aria-pressed="true"` — needs a real write.
- **The "Your weight" / "Recommended" dual display** — needs a weight change.
- **"Bodyweight"** — not present on this session; only "NO LOAD SET" was.
- **Outbox behaviour on a failed log** — needs a write and a forced failure.

All four need a set logged on a real session. Ready to do on your word.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| `h1` is the session name | **Correct** — "Lower A" |
| Per-set button for every prescribed set | **Correct** for rendered exercises |
| Unlogged accessible name "Log set {n} of {total}, {exercise}" | **Correct**, verified |
| Weight `aria-label`s "Decrease/Increase the weight for {exercise}" | **Correct** |
| "No load set" when a weight applies but none is set | **Correct** — Romanian deadlift |
| "Bodyweight" when none applies | **Not observed** on this session |
| Non-next sets are disabled | **Correct** — only the first set of each exercise is enabled |
| **Progress line "{done} of {total} sets"** | **Incomplete** — it also carries a running clock. **Corrected.** |
| **"one card per exercise"** | **Incomplete** — only two render; the rest are behind "{n} more · {names}". **Corrected.** |
| — | **Undocumented:** "Session RPE (optional)", "Sets save as you log them.", and that opening the page writes a session log. **Now recorded.** |
