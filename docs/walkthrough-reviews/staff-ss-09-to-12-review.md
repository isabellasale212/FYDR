# Persona review — STAFF-SS-09 to -12

**Persona.** The sport scientist planning next week on Friday afternoon —
adding the fixture, staging sessions, moving one, removing one, deciding when to
publish.

**Reviewed 2026-09-11** at **1280×800 and 375×812** as Jane Pemberton. **Every
edit was held locally and discarded; nothing was published or written.** §0af's
stacked sidebar applies to every phone number.

**What was and was not exercised.** SS-09's form measured and its empty-opponent
refusal triggered (local). SS-10: a past session selected (Mon 7 "Unit skills");
then, because the seed has **no future published non-fixture session** this
week and next week is empty, a draft was staged through the toolbar wizard —
Sunday 13, Forwards — to reach the selected-session panel. SS-11 exercised on
that draft: removed, which made it vanish; the ghost/Restore path is for
published sessions and was **not reachable**. SS-12's toolbar measured. Final
state: no pending changes, status "Published".

---

## STAFF-SS-09 — Create a fixture

**Verified on every documented claim** — the ids, placeholders ("Ashfield RFC",
"Ashcombe Park", "League"), the 80-character cap, 14:00 default, both fieldsets
with legends, all seven chips, the load-planning caption, the "names nobody"
note, and the refusal: "Name the opponent." with focus moved to `f-opponent`
and the button back on "Create fixture". This is the best-documented flow in
either document, down to *why* the focus moves.

**Undocumented and now recorded:** "Home" and "Normal" are pressed by default.

**Nothing to raise.** The form says what a fixture does before you make one.

## STAFF-SS-10 — Edit a session in the grid

**Two panels, not one.** Clicking a session opens the selected-session panel;
the toolbar's "+ Session" opens a **three-step wizard** in the same rail — What
(name, type), When & where (day chips, steppers, location), Who (groups, with
"Nobody selected means staff only — no athlete will see this in their app."),
ending in "Add to {weekday}". Undocumented; now recorded in full.

**The steppers are icons.** The document names "Earlier, Later, Shorter,
Longer" as if visible; they are the `aria-label`s of two `−`/`+` pairs, at
**40px**. Past sessions get neither steppers nor Remove — only "Duplicate".

**The athlete preview is partly fiction.** "RPE due by 19:45" is a fixed string
per type (`scheduleGeometry.ts`), not the session's real due time — and since
ATH-ADULT-02's `rpeDue.ts` the real time is `start + duration + 30`. A line
whose job is to show staff what the athlete sees now shows something the
athlete is not shown. **§0aj.**

**Two unlabelled inputs** in the wizard (name, location). **§0aj.**

**Right and worth keeping:** "Held on your screen. Publish to athletes, at the
top of this page, puts it on their phones." — the single most important
sentence in the schedule, and it is where it should be. "Publishes to Forwards
· appears under Today on the morning of Sunday 13 Sept" is the second.

## STAFF-SS-11 — Remove a session, and restore it

**The confirmation is right; the sizes and one sentence are not.** "Remove this
session? You can undo with Discard, until you publish." with "Yes, remove"
(**37px**) and "Never mind" (44px).

**On a draft, removal is final** — it vanishes with no ghost and no Restore,
which SS-10 already describes as "the same act" as Discard. So "You can undo
with Discard" is untrue for the one case it was shown in. **§0aj.** The ghost
and Restore path exists for published sessions and could not be reached on
scratch; recorded as such rather than assumed.

## STAFF-SS-12 — Use the edit-mode toolbar

**Verified.** "+ Session" (a button, **35px**), "Apply template", one template
chip ("Standard 1-game week" — an `<a>` to a planner preview, not an immediate
apply), "Save this week as a template" (an `<a>` to `/schedule/planner/new`).
"No templates yet." not observed because a template exists.

---

## Summary for design

1. **The wizard is undocumented and mostly good** — its copy explains staff-only
   sessions before they are made. *(SS-10 — recorded.)*
2. **"RPE due by 19:45" is fixed text.** *(SS-10 — §0aj, defect.)*
3. **Draft-removal copy promises an undo that does not exist.** *(SS-11 —
   §0aj, defect.)*
4. **Four controls under 44px** — steppers 40, "Yes, remove" 37, "+ Session"
   35, "Next" 35. *(§0aj.)*
5. **Two unlabelled wizard inputs.** *(§0aj.)*
6. Right and worth keeping: SS-09 whole; "Held on your screen…"; the
   staff-only explanation; the confirm-and-Never-mind on removal.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| SS-09: every field, placeholder, cap, default, chip, caption, note, refusal, focus move | **Correct, all of it** |
| SS-10: panel shows name, time line, type, GROUP/DURATION/MD/EXPECTS, preview | **Correct** for a selectable session |
| **SS-10: "four steppers: Earlier, Later, Shorter, Longer"** | **They are `aria-label`s on `−`/`+` icons**, 40px. Corrected. |
| SS-10: "Remove session" not offered for past published sessions | **Correct** — and steppers are absent too. Corrected. |
| SS-10: staged draft has no "Cancel changes" | **Correct**, measured on a wizard draft |
| SS-10: "Held on your screen…" line | **Correct**, verbatim |
| — | **Undocumented:** the three-step wizard. Now recorded. |
| SS-11: confirmation copy and both buttons | **Correct**; sizes recorded |
| **SS-11: ghost, "Removed on your screen…", "Restore session"** | **Not reachable** — no future published session on scratch. On a draft: **vanishes**, and the copy is wrong. Corrected. |
| SS-12: three controls on one row | **Correct**; "+ Session" is 35px, the other two are links to planner routes. Corrected. |
| SS-12: "No templates yet." | **Not observed** — one template exists |
