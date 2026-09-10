# Persona review — ATH-ADULT-15 to -18, the leaderboard flows

**Reviewed together**, because they are one decision an athlete makes in four
places: *do I want to be ranked against my teammates, and do I want to look?*

**Persona.** An athlete who is doing fine on the board and enjoys it — or one
who is bottom of it and would rather not see their name there every morning.
The second is the person these flows exist for.

**Reviewed 2026-09-10** at **375×812** as a real athlete on one board
(Conor Moroney). **ATH-ADULT-18 was exercised and restored**; 16 and 17 were
measured but **not pressed** — see below.

---

## What was and was not exercised

**ATH-ADULT-18 was performed.** It writes nothing to the database: the
preference lives in `localStorage` under `fydr-hide-leaderboards`, so it is a
view preference, fully reversible, and reversing it leaves no trace. Toggled on,
the gate verified, toggled back — `localStorage` returned to `null` and the
label to "Hide leaderboards from me".

**ATH-ADULT-16 and -17 were NOT performed.** Both change *consent* — whether
other people see this athlete on a board — rather than what he sees. 17 is
reversible by design ("tap to rejoin"), and 16's reversibility was not
established. Neither was worth exercising on a real record to confirm a label,
so both are measured statically and their end states left unverified. Exercising
them closes the last two gaps in this batch; ready on your word.

---

## The measured screens

**ATH-ADULT-15, one board.** `h1` "Total session load", subtitle
"Whole squad · all time", a ranking table with a `visually-hidden` caption and
columns POS / ATHLETE / TOTAL SESSION LOAD, the athlete's own row marked, and
"Leave this leaderboard" (44px). Page 1,051px. Navigation is a "←" link
(→ `/my-data/boards`) **and** a separate "Back" button at **29px**.

**ATH-ADULT-16.** "Leave this leaderboard", 44px, **no confirmation** — one
press leaves.

**ATH-ADULT-17 and -18** share `/me/leaderboards`, three cards:

| Card | Control | Copy |
|---|---|---|
| "Being named on a leaderboard" | — | "You appear on any leaderboard your club publishes and includes you in, unless you leave it." |
| "Seeing leaderboards" | "Hide leaderboards from me" (44px, `aria-pressed`) | "This changes what you see, not whether you are on a board." / "Applies to this device only." |
| "Every leaderboard at once" | "Leave every leaderboard" (44px, `aria-pressed`) | "Do not include me on any leaderboard, including ones published later." |

---

## The findings

### 1. The gate is one surface, not "across the app"

`LeaderboardVisibilityGate` is used in exactly one file,
`my-data/boards/page.tsx`. Measured with hiding on: `/my-data/boards` renders
"Leaderboards are hidden … **Show them again**", and `/my-data` still shows its
"Leaderboards" link, ungated, with no gate of its own.

So an athlete who hid leaderboards because they did not want to see their
ranking still has a link to leaderboards on the screen they open most — and
tapping it lands them on a gate telling them they hid it. **Design finding**:
the link should probably go or say something different. **Corrected in both the
ATH-ADULT-12 and -18 documents**, which each claimed more coverage than exists.

### 2. Three navigation controls are under the 44px floor

The shared `BackButton` is **29px** everywhere it appears; the gate's
"Show them again" link is **34px** and is the *only* control on that screen. On
`/my-data/gym/{id}` a 29px button sits beside a 19.5px link doing nearly the same
job. Filed as **§0w**, with the decision it needs: does the 44px floor apply to
navigation, or only to actions? If it does, `.back-btn` is a shared-class change
and must be confirmed before it is built.

### 3. The copy on `/me/leaderboards` is the best in the athlete app

Three cards that each say what they do *and what they do not do*:
"This changes what you see, not whether you are on a board."
"Applies to this device only. You stay on any board you are on, and your
position is unchanged." "Do not include me on any leaderboard, **including ones
published later**."

That last clause is doing real GDPR work — a standing objection, not a one-off —
and the device-scoping line is an unusually honest thing to volunteer. **Keep
all of it verbatim.**

### 4. "Leave this leaderboard" has no confirmation, and that is correct

Article 7(3) says withdrawing consent must be as easy as giving it, and
migration `0016` carries a hard `check (allow_opt_out)` so a club cannot remove
the right. A confirmation step would make leaving harder than being added, which
is the thing the regulation forbids. **Deliberate boundary — preserve it.**

---

## 1–5, briefly

**Taps:** one to leave a board, one to hide, one to leave everything. All
correctly cheap; the asymmetry is that *joining* is not a decision the athlete
makes at all — the club includes them, and their only move is to leave.

**Copy:** covered above. The one gap is that nothing on the board screen says
what leaving does to the ranking others see.

**Mistakes:** leaving a board is one unconfirmed press. That is deliberate
(finding 4), but it does mean the most consequential control in these four flows
is also the least guarded — and unlike the global toggle, nothing on the screen
says whether it can be undone.

**Inference:** membership and position are both derived; nothing is asked twice.

**Clarity:** hiding is unambiguous — the label flips to "Hidden — tap to show
again" and the gate explains itself. Leaving one board was not exercised.

---

## Summary for design

1. **The "Leaderboards" link on `/my-data` survives hiding** — one surface is
   gated, the entry point is not.
2. **`BackButton` 29px, "Show them again" 34px** — §0w, needs a floor decision.
3. **Nothing says whether leaving one board can be undone**, on the one control
   here with no confirmation.
4. **Keep the three cards' copy verbatim** — including "including ones published
   later" and "Applies to this device only".
5. **Unverified:** the two ATH-ADULT-15 branch screens ("This leaderboard is not
   available", "Not on your club's plan"), and the end states of 16 and 17.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| 15: heading is the board name | **Correct** — "Total session load" |
| 15: "←" dismiss | **Correct** → `/my-data/boards` |
| **15: "Back to leaderboards"** | **Wrong — no such control.** There is a separate 29px "Back" button. **Corrected.** |
| 15: "Leave this leaderboard" | **Correct**, 44px |
| 15: the two branch headings | **Not verified** — needs an unavailable board and a plan-gated one |
| 16: no confirmation step | **Correct** — one press, no dialog |
| 16: `check (allow_opt_out)`, migration 0016 | **Correct** in source; **end state not verified** (not pressed) |
| 17: "Leave every leaderboard" / "Left every leaderboard — tap to rejoin" | **First label correct**; second **not verified** (not pressed) |
| 18: "Hide leaderboards from me" / "Hidden — tap to show again" | **Both correct**, verified by toggling and restoring |
| 18: changes what you see, not board membership | **Correct** — `localStorage` only, no database write |
| **18: "Leaderboard surfaces across the app render a gate"** | **Overstated.** One surface, `/my-data/boards`. **Corrected.** |
| 12: hidden leaderboards gate the My data leaderboard area | **Wrong** — `/my-data` has a link, not a gated area, and it is not hidden. **Corrected.** |
