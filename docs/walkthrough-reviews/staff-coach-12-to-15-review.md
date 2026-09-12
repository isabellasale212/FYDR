# Persona review — STAFF-COACH-12, -13, -14 and -15

**Persona.** The head coach: publishing next week from the sofa on Sunday night, discarding a
week of edits that went wrong, applying the club's one template.

**Account.** Mark Iremonger (coach only), port 9502; Jane Pemberton for the identity check;
Ruth Callaghan (medic), Owen Hartnell (S&C) and Sana Mirza (nutritionist) on port 9503 for
the gate check. **Reviewed 2026-09-12** at **1280×900 and 375×812**. Nothing published:
the pending state was made with a wizard draft and cleared with Discard; storage confirmed
empty; the filter left on Whole squad.

---

## STAFF-COACH-12 — Use the edit-mode toolbar

**Identical, verified** at both widths by driving Edit mode as both accounts: "+ Session"
(the wizard button, `sg-btn-add`), "Apply template" with the one chip ("Standard 1-game
week" → `/schedule/planner/apply?week=…&template=…`), "Save this week as a template" →
`/schedule/planner/new`; absent in Read mode. **At 375 every control is 44px** — the toolbar
"+ Session" was 35 on 2026-09-11 and stays 35 at 1280 by decision.

## STAFF-COACH-13 — Publish the week to athletes

**Identical, verified**, without publishing. Idle: "The athlete app is up to date" with
"Published" disabled (44px at 375; 17 at 1280). Pending (one wizard draft): "1 change not
yet in the athlete app", the subtitle "Athletes still see the schedule as it was before
these edits. Nothing changes on their phone until you publish.", "Discard"
(`.sg-btn-discard`) and "Publish to athletes" (`.sg-btn-publish`) — **44 / 44 at 375**,
37 / 35 at 1280. The §0al persistence is in place for the coach as for the sport scientist
(sessionStorage key written on every step). "Publish to athletes" was not pressed.

**The banner is where the coach looks after adding a session on a phone** — it sits at
644px, under the chip rows and the week nav, so it is off-screen when the wizard at 267px
closes (§0aw's silent add). The sofa case on Sunday night is this banner plus "Publish to
athletes"; the pitch-side case is the same banner after one stepper change.

## STAFF-COACH-14 — Discard every pending change

**Identical, verified** at both widths as the coach: "Discard" → "Discard 1 change? This
can't be undone." with "Yes, discard" and "Never mind" (**52 / 52 at 375**; 37 / 44 at
1280) → "Yes, discard" → the draft leaves the grid (six blocks), the banner returns to
"The athlete app is up to date", the pending store is empty.

## STAFF-COACH-15 — Manage week templates

**Identical, verified** by fingerprint at both widths: `/schedule/planner` (14 leaves,
"+ New template" 50, "Apply" 50, "Edit" 50), `/schedule/planner/new` ("New week template",
the seed chip, "Create and open the builder" 46), `/schedule/planner/apply?template=…`
("Apply to Mon 7 Sept – Sun 13 Sept", the template select, "Add alongside" / "Replace
planned" / "Fill gaps only" at 44, "Apply template" 46). No sub-44 control at 375; at 1280
only the Back button and the 13px breadcrumb, by decision.

**The gate the coach cannot see, checked from three other roles (to-do §0b L728 — "the
New week template screen gates on coach or medical").** As the medic, the S&C and the
nutritionist: `/schedule/planner/new`, `/schedule/planner` and `/schedule/planner/apply`
all land on `/schedule` with the read-only note ("Read only. The schedule is authored by the
sport scientist and the coach."); `/schedule/planner/{id}` renders the template with "Read
only. Templates are authored by the sport scientist and the coach." No template screen
admits a role without `SESSION_EDIT`. **L728 is closed in the code**; ticked.

---

## Summary for design

1. **Nothing coach-specific in these four** — the coach holds `SESSION_EDIT` and every
   control, copy and refusal is the sport scientist's. The SS-12 to -15 briefs are the
   design surface.
2. **The banner at 644px on a phone** is the coach's confirmation of everything they do in
   Edit mode; it is off-screen when the wizard closes and off-screen while editing a block
   below the fold. *(Design — the same finding as §0aw's silent add, restated for the
   banner.)*
3. Right and worth keeping: the pending subtitle ("Nothing changes on their phone until you
   publish."); "Discard N changes? This can't be undone." naming the count; the apply
   screen's three modes as chips with names that say what they do.
4. Boundaries, left alone: templates are read-only for medic, S&C and nutritionist, stated
   in place.

## Claims checked

| Claim | Verdict |
|---|---|
| 12–15 identical to the sport scientist | **Identical** at both widths (12–14 driven, 15 by fingerprint). |
| 12: toolbar "+ Session" 35px | **44 at 375**, 35 at 1280. |
| 13: "Published" 17px; "Discard" 37, "Publish to athletes" 35 | **44 / 44 / 44 at 375**; unchanged at 1280. |
| 14: "Yes, discard" 37, "Never mind" 44 | **52 / 52 at 375**; 37 / 44 at 1280. |
| 15: Apply / Edit 50px; read-only template for roles without `SESSION_EDIT` | **Correct**; read-only verified as medic, S&C, nutritionist. |
| §0b L728: a medic can open the New week template screen | **No** — redirected to `/schedule`, read-only. Closed. |
