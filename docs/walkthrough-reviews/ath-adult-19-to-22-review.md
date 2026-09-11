# Persona review — ATH-ADULT-19 to -22, the "Me" settings flows

**Reviewed together**: four things an athlete does rarely, on the same screen
or one tap from it, mostly once.

**Persona.** An athlete on a bad week who wants the phone to stop buzzing — and,
separately, one setting the app up on day one.

**Reviewed 2026-09-11** at **375×812** as a real athlete (Conor Moroney), after
the §0w merge and a dev-server restart. **19 and 21 exercised; 20 and 22 not** —
reasons below.

---

## What was and was not exercised

- **19** — measured in full; no chip pressed (each is a real preference write,
  and nothing about the chip's behaviour needed one).
- **20** — **deliberately not pressed.** Reading `unmuteAll` first showed it
  resets every type to on rather than restoring; pressing it would have altered
  the review account in a way the control itself cannot undo. Filed as **§0z**.
- **21** — exercised by submitting the form **unchanged** (empty phone → empty
  phone), which verified the in-flight label and the confirmation without
  changing anything.
- **22** — controls measured; no file uploaded.

---

## ATH-ADULT-19 — Change notification preferences

**Measured.** `h1` "Notifications", page **2,405px** (three screens). A "Back"
button *and* a "← Me" link. The "Pause everything" card, then **16 rows** — each
a label, a trigger sentence and one control: fourteen "Push on"/"Push off" chips
and two "Always on" ("Availability changed", "New privacy notice"). A closing
paragraph: *"In-app notifications are always on and can't be turned off here.
Preferences save instantly. Push and email delivery aren't live yet — these
settings will apply as soon as they are."*

**The finding that frames the whole screen:** three screens of toggles for a
delivery channel that is not live. The footer is admirably honest about it, and
that honesty is the right call — but it is the last line on a 2,405px page. An
athlete who came here to make the buzzing stop reads fourteen chips before being
told none of them buzz yet. **Deliberate boundary, preserved; placement is a
design question.**

**No "Email" chip ever renders for an adult.** The only two email-capable types
are `canDisable: false`, so both show "Always on". The doc's "Email on / Email
off" states are real in code and unreachable here. Recorded.

**Two back controls** — the same pairing the builder flagged on
`/me/leaderboards` (§0y). Now on two athlete screens.

**Doc errors, corrected:** the heading said 17 types (it is 16, and the table,
the note, the catalogue and the screen agree); "Weekly nutrition check-in" was
listed as default off — `catalogue.ts` says `push: true` and the screen shows
"Push on".

## ATH-ADULT-20 — Mute everything at once

**Measured.** "Mute everything else", 44px, under copy that is exactly right:
*"Turns off every notification you're allowed to mute in one go. Availability
changes and privacy notices still reach you either way — those two never turn
off."*

**The defect: un-mute is a reset, not a restore.** `unmuteAll` upserts
`push_enabled: true, email_enabled: true` for every disableable type without
reading what it overwrites. Four types default to off, and an athlete may have
turned more off by choice; after mute → un-mute all of them are on. The label
"Turn notifications back on" promises the state they had; the code gives the
loudest state possible. The minor special-case (three types excluded from the
un-mute set) shows the all-on behaviour was noticed for one audience and patched
rather than fixed. **§0z.**

## ATH-ADULT-21 — Edit my profile

**Verified end to end.** "Phone" (`id="athlete-phone"`, `type="tel"`), "Save" →
"Saving…" → "Save", then a `role="status"` **"✓ Saved."** the doc did not
mention. Stays on `/me`. The staff-owned list is name, DoB, position **and squad
number** — the card says all four; the doc said three. Both corrected.

This is the cleanest write flow in the athlete app: one field, one button,
one confirmation, in view, no ambiguity.

## ATH-ADULT-22 — Add, replace or remove my photo

**Measured, not exercised.** "Upload photo" (no photo set), a file input with
`accept="image/jpeg,image/png,image/webp"`, the caption "JPEG, PNG or WebP, up
to 2MB.", and — because no photo exists — the colour picker beneath: "Or pick a
colour for your initials" with eleven named buttons (Default, Blue, Green,
Purple, Slate, Indigo, Cyan, Olive, Magenta, Steel, Plum).

**A note against myself:** a first selector reported no colour picker; it was
looking for `[type=color]` and swatch classes, and the picker is eleven plain
`<button>`s. The doc was right. Recorded so the wrong reading does not come
back.

The eleven colour buttons are the ATH-ADULT-23 flow and are not assessed here
beyond noting they are ungrouped plain buttons — the same shape as the nutrition
answers (§0u).

---

## Summary for design

1. **A three-screen list of toggles for a channel that is not live**, with the
   disclosure on the last line. *(19 — design; the disclosure itself is a
   deliberate boundary and must stay.)*
2. **Un-mute resets rather than restores.** *(20 — defect, §0z.)*
3. **Two back controls on `/me/notifications`**, as on `/me/leaderboards`.
   *(19 — design; §0y already carries the guard gap.)*
4. **"Email" chips are unreachable for adults.** *(19 — recorded; no action.)*
5. Right and worth keeping: the "Pause everything" copy naming the two types
   that never turn off; "Preferences save instantly"; the profile form's "✓
   Saved."; the honest photo caption; and the colour picker appearing only when
   it can have an effect.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| 19: "Me" row reads Notifications / "morning wellness prompt" / "On" / "›" | **Correct** |
| 19: heading "Notifications", "Pause everything" card, one row per type | **Correct** |
| **19: "The 17 athlete notification types"** | **Wrong — 16.** Corrected. |
| **19: "Weekly nutrition check-in" default push off** | **Wrong — push on** in `catalogue.ts` and on screen. Corrected. |
| 19: "Always on" when `canDisable` is false | **Correct** — two rows |
| 19: "Email on / off" rendering | **Unreachable for an adult**; both email types are always-on. Recorded. |
| 19: "← Me" back link | **Correct**, plus an undocumented "Back" button. Corrected. |
| 19: `role="alert"` on save failure | **Not verified** — no failure induced |
| 20: "Mute everything else" | **Correct** |
| 20: "Turn notifications back on" / "Working…" | **Not observed** — not pressed, see §0z |
| **20: (implied) un-mute restores** | **Wrong — it resets to all on.** §0z. |
| 21: "Phone", `id="athlete-phone"`, `type="tel"` | **Correct** |
| 21: "Save" → "Saving…" | **Correct**, observed |
| 21: DoB, name, position staff-owned | **Correct and incomplete** — squad number too. Corrected. |
| 21: stays on `/me` | **Correct**, with an undocumented "✓ Saved.". Corrected. |
| 22: "Upload photo" when none set | **Correct** |
| 22: JPEG / PNG / WebP up to 2MB | **Correct** — `accept` and caption both |
| 22: colour picker shown when no photo | **Correct** |
| 22: "Replace photo", "Remove", error on bad file, picker hidden with a photo | **Not verified** — needs an upload |
