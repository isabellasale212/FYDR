# Persona review — ATH-ADULT-10, Finish a gym session

**Persona.** An athlete ending a session — either having done everything, or
stopping early because a coach called time, a niggle appeared, or the gym is
closing.

**Reviewed 2026-09-10** at **375×812** on a real assigned session (Conor
Moroney, "Lower A", 12 sets). **The button was not pressed.** Finishing changes
session state whose reversibility the walkthrough itself records as
unestablished — an open question left deliberately unresolved — so this review
covers the control and its states, not the transition.

---

## The measured control

| | |
|---|---|
| Label observed | **"Finish early · 0 of 12"** |
| Position | top **695** on an 812 viewport — visible without scrolling |
| Height | 46px |
| Enabled | Yes, from the moment the screen loads, with nothing logged |
| Confirmation | **None** |

---

## The finding: the only warning is a label, on a control that is always live

The button is enabled before a single set is logged, and pressing it once ends
the session. There is no confirmation, and the label is the entire warning.

**That is a defensible design and the label is well written** — "Finish early ·
0 of 12" states the consequence *in* the control, which is better than a modal
that gets dismissed reflexively. Two things make it worth a second look:

- **It sits 17px below the last exercise content, in a screen the athlete is
  tapping repeatedly** — twelve set buttons at 42px, then a 46px finish button
  in the same column. The one irreversible control on the screen is the same
  size and shape as the twelve reversible ones above it.
- **Its reversibility is unknown.** `/my-data/gym/{id}` offers per-set
  correction but no "reopen". Left unresolved, as flagged.

---

## 1. How many taps, and is any step redundant?

**One tap.** Nothing redundant — and for an athlete stopping early in a hurry
that is the right cost. The question is only whether one tap is too few for the
one action that cannot obviously be undone.

## 2. Does any label or copy not match how this person thinks?

**"Finish early" is honest** where "Done" or "End session" would not be, and the
count makes the shortfall concrete. **"Finish session"** on completion is right.

Nothing tells the athlete what finishing *does* — that it marks the session
complete and sends it to My data. The label describes the act, not the effect.

## 3. Where is a mistake most likely, and can it be undone?

**This is the most likely accidental irreversible action in the athlete app**:
an always-enabled, unconfirmed button at the bottom of a screen whose whole
purpose is repeated tapping. Whether it can be undone is the open question.

By contrast the twelve set buttons above it are all correctable, so the athlete
has been trained by the screen that tapping is safe.

## 4. Anything they must read that the screen could infer?

The count is inferred and shown. Nothing else is asked.

## 5. Is there a moment where it's unclear whether something worked?

Not established — the transition was not walked.

---

## Summary for design

1. **The one irreversible control is visually peer to twelve reversible ones**,
   always enabled, unconfirmed.
2. **The label says what the button does, not what happens next** — no mention
   that the session goes to My data.
3. **Reversibility is an open question** and is left open.
4. Right and worth keeping: the consequence stated in the label rather than in a
   dialog, and the count that makes "early" concrete.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Present from the moment the screen loads | **Correct** — enabled at 0 of 12 |
| "Finish early · {done} of {total}" when short | **Correct** — "Finish early · 0 of 12" |
| "Finish session" when all logged | **Not observed** — needs 12 real writes |
| No confirmation step | **Correct** — none in the markup |
| Session marked complete, appears in My data's Gym tab | **Not verified** — needs the write |
| **Whether a finished session can be reopened** | **Open question, left unresolved and unwalked**, as the document flags |
