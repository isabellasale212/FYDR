# Design brief — ATH-ADULT-18, Hide leaderboards from myself

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**These four flows share one review**, because they are one decision an athlete
makes in four places: do I want to be ranked, and do I want to look.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-18 — Hide leaderboards from myself

**Entry point.** "Me" → "Leaderboards" → the "Seeing leaderboards" card.

**Steps.**

1. Press the hide toggle.

**Toggle states.**

| Label | When |
|---|---|
| "Hide leaderboards from me" | Currently visible. |
| "Hidden — tap to show again" | Currently hidden. |

**Branches.**

- This changes **what the athlete sees, not whether they are on a board** — the
  card says so explicitly. Distinct from ATH-ADULT-16 and -17.

**End state.** `/my-data/boards` renders a gate instead of content — "Leaderboards
are hidden · You turned these off on this device. You are still on any board your
club includes you on. **Show them again.**" (a link to `/me/leaderboards`, 34px).

**It is ONE surface, not "across the app".** `LeaderboardVisibilityGate` is used
in exactly one file, `my-data/boards/page.tsx`. Measured with hiding on: `/my-data`
still shows its "Leaderboards" link, ungated, and renders no gate of its own.

**The preference is stored in `localStorage` under `fydr-hide-leaderboards`, so it
is genuinely per-device** — the card's own copy says so ("Applies to this device
only"), and it means the same athlete signing in on another device sees
leaderboards again. Nothing is written to the database, and nothing about board
membership changes.

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

1. **The gate covers one surface; the entry point is not covered.** With hiding
   on, `/my-data` still shows a "Leaderboards" link, ungated — so an athlete who
   hid rankings still sees the way in, and tapping it tells them they hid it.
2. **"Show them again" is the only control on the gate and is 34px** (§0w).
3. **Per-device is a real limitation, honestly disclosed.** If a proposal wants
   it to follow the athlete across devices, that is a data change, not a design
   one, and must be raised rather than assumed.
