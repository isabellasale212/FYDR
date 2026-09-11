# Design brief — ATH-ADULT-19, Change notification preferences

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-19 — Change notification preferences

**Entry point.** "Me" → the "Notifications" row (subtitle "morning wellness
prompt", value "On" or "Off", chevron "›"). Direct URL `/me/notifications`.

**Steps.**

1. The screen shows heading "Notifications" and a "Pause everything" card, then
   one row per notification type.
   - Every row shows its label, its trigger sentence, and its channel controls.
   - Also visible: a "Back" button (the shared `BackButton`) **and** a "← Me"
     link — two back controls, the same pairing as `/me/leaderboards`; the mute
     control (ATH-ADULT-20); and a closing paragraph that reads
     **"In-app notifications are always on and can't be turned off here.
     Preferences save instantly. Push and email delivery aren't live yet — these
     settings will apply as soon as they are."**
   - **No "Email on" / "Email off" chip renders for an adult athlete.** The only
     two types with an email channel — "Availability changed" and "New privacy
     notice" — are `canDisable: false`, so both render "Always on". The Email
     rendering in the table below is real in code and unreachable on this screen.
2. Press a channel chip to toggle it.

**Channel control states, per row.**

| Rendering | When |
|---|---|
| "Push on" / "Push off" | The type supports push and can be disabled. |
| "Email on" / "Email off" | The type supports email and can be disabled. |
| "Always on" | `canDisable` is false — no control at all. |
| "In-app only" | The type has no push or email channel. |

**The 16 athlete notification types**, in the order they render, with their
triggers (the heading previously said 17; the table, the note beneath it, the
catalogue and the running screen all say 16):

| Label | Trigger | Default |
|---|---|---|
| "Morning wellness prompt" | A wellness entry is expected today | push on |
| "Wellness reminder" | Wellness still outstanding a few hours later | push on |
| "Session rating prompt" | A session you need to rate has ended | push on |
| "Session rating reminder" | A session rating is still outstanding | push on |
| "Matchday fuelling reminder" | The evening before a fixture | push off |
| "Weekly nutrition check-in" | The week has ended and you haven't checked in | push **on** (an earlier version of this table said off; `catalogue.ts` and the running screen say on) |
| "New programme assigned" | A gym or rehab programme starts | push on |
| "Programme changed" | Your assigned programme is edited by staff | push on |
| "Rehab programme assigned" | Medical assigns you a rehab programme | push on |
| "Availability changed" | Your availability status changes | push + email on |
| "Session moved or cancelled" | Today or tomorrow's session changes | push on |
| "A flag was shared with you" | Staff acknowledges a flag raised about you | push off |
| "Test results published" | New test results are ready for you | push on |
| "Weekly personal summary" | Every Monday morning | push off |
| "Weekly leaderboard" | Every Monday morning | push off |
| "New privacy notice" | A new privacy notice version is published | push + email on |

**Branches.**

- IF the athlete is a minor THEN three of these are **locked off** — see
  ATH-MINOR-19.
- IF a save fails THEN a `role="alert"` error paragraph renders above the list.

**End state.** Stays on `/me/notifications`; changes save per toggle.

**Note.** That is all 16 athlete-audience entries in the catalogue — counted,
not sampled. Every one renders a row on this screen.

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

1. **"Availability changed" and "New privacy notice" can never be turned off** —
   `canDisable: false`, and the "Pause everything" copy names them. Keep both the
   rule and the naming.
2. **The delivery disclosure must stay** — "Push and email delivery aren't live
   yet" is true and the athlete is owed it. Where it sits is the design question;
   whether it exists is not.
3. **Preferences save instantly, per toggle.** No Save button; do not add one.
4. **Minors have three types floored off** (ATH-MINOR-19). A proposal must not
   assume every row is toggleable.

## 5. What a proposal should address

1. **The disclosure is the last line of a three-screen list.** An athlete reads
   fourteen chips before learning none of them deliver yet.
2. **Two back controls** — "Back" and "← Me".
3. **Nothing on the screen says the list is 16 long** or groups it; it is one
   undifferentiated column across 2,405px.

Out of scope: the un-mute reset (§0z — a defect, built with ATH-ADULT-20).
