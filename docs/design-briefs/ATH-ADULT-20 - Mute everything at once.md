# Design brief — ATH-ADULT-20, Mute everything at once

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-20 — Mute everything at once

**Entry point.** The "Pause everything" card at the top of `/me/notifications`.

**Steps.**

1. Press the mute button.

**Button states.**

| Label | When |
|---|---|
| "Mute everything else" | Not currently muted. |
| "Turn notifications back on" | Currently muted. |
| "Working…" | Save in flight. |

**Branches.**

- IF the athlete is a minor THEN the three `minorFloorOff` types are **excluded
  from the un-mute set** — turning notifications back on does not turn those on,
  because the club cannot enable them at all.

**End state.** Stays on `/me/notifications`.

**"Turn notifications back on" does not restore — it resets.** `unmuteAll`
writes `push_enabled: true, email_enabled: true` for every disableable type,
without reading what they were before. An athlete who had turned "Weekly
leaderboard" off, then muted everything for a holiday, comes back to find it on.
Measured in source 2026-09-11; the control was deliberately **not pressed** on
the review account for exactly this reason. Filed as a defect.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-19-to-22-review.md`** — covers
all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **The two always-on types stay reachable through a mute.** The card says so
   and the catalogue enforces it.
2. **One press to mute.** An athlete on a bad week should not have to justify it.
3. **§0z is a defect and is out of the brief's scope** — but the label of the
   un-mute control must describe whatever the fixed behaviour is. If the fix
   restores, "Turn notifications back on" is right; if it resets to defaults, it
   is not.

## 5. What a proposal should address

1. **Nothing.** The control, its copy and its placement are right. The only
   problem here is behavioural (§0z), and the brief should not redesign around
   it.
