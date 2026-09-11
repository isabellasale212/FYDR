# Persona review — STAFF-SS-05 to -08

**Persona.** The club's sport scientist and admin — opening a player's profile
after a flag, checking a sprint result, planning the week.

**Reviewed 2026-09-11** at **1280×800 and 375×812** as Jane Pemberton. Conor
Moroney's profile and test page used as the subject; nothing written. **§0af
applies to every phone measurement here** — the 640px stacked sidebar sits above
each screen.

**What was and was not exercised.** SS-05 inventoried at both widths. SS-06's
confirm step opened and **cancelled** (nothing marked). SS-07 measured in Edit
mode as loaded. SS-08 measured; nothing created.

---

## STAFF-SS-05 — Open an athlete's profile

**Measured.** "Conor Moroney", 2,721px at desktop in two columns; **5,828px at
phone** in one — seven screens, with the sidebar above. Ten panels, none of
which matched the document's list by name: Athleticism, Flags, Goals, S&C
history log, Nutrition plan, Injury, Body weight, Availability, Entries and
corrections, Subject access request. Eleven write controls. Three sub-routes as
documented.

**The clinical boundary holds** — no diagnosis, mechanism or problem-report
content renders for this role. Measured absent, not assumed.

**Two document errors.** The panel list was a paraphrase ("bio, availability,
injuries, wellness, gym, nutrition and weigh-ins"); now the real ten. And
"Nutrition is read-only here and says so" is **wrong for this role** — the
panel carries "Edit → /nutrition"; the page comment says two *other* roles get
it read-only. **Both corrected**, and the inventory pass the document asked for
is done.

**For the persona, the profile is the right shape at desktop** — two columns
put Flags beside Athleticism at the top, which is the pairing a sport
scientist reads first. **At phone it is a seven-screen scroll** with the
availability controls at y=2706 and entries-and-corrections at y=5102; the two
panels a pitch-side admin most needs are the furthest down. **Design.**

## STAFF-SS-06 — Mark a test result as an athlete's best

**Verified in full, then cancelled.** "Bests" — season's best 1.7s, all-time
best, "Season trend +0.6% · New PB", the line "lower is better on this test";
"Mark best" (`.btn-ghost`, 44px) on the non-best attempt; pressing it gives
"Mark as best" (`.btn-primary`, 46px) **and "Cancel"** (46px) — the document
omitted Cancel; corrected. Print / Export CSV / Export PDF present.

**Nothing to raise.** The best-marking control is on the row it applies to,
confirms in place, and can be backed out.

## STAFF-SS-07 — Read the week's schedule

**Verified.** Edit mode on load with the `role="group"` "Read or edit" control,
"Edit" pressed; "Previous week" / "Next week"; "7 – 13 Sept"; "+ Session" →
`/schedule/new?date=…`, "+ Fixture", "Week templates"; status "Published"; the
toolbar carrying "+ Session". 24 session blocks in the grid. 2,617px at desktop,
3,692px at phone.

**"Week plan" is a `<span>`.** The current view tab is not a link, button or
tab and has no `aria-current`; "Today" beside it is a link. **§0ai.**

**The read-only branch** for a role without `SESSION_EDIT` cannot be verified
as a sport scientist; recorded as such.

## STAFF-SS-08 — Create a session

**Measured.** "New session"; all six fields with the documented ids, plus
placeholders the document lacked ("Captain's run", "-2", "Main pitch"); date
pre-filled from `?date=`, time 09:00, duration 60. Seven type chips under
"Type", four group chips under "Who's in it", all `aria-pressed`. "Create
session" (`.btn-primary`, 46px) and "Cancel" (`.btn-ghost`, 46px).

**What is validated: name, date, time. What is not: everything else.** The form
is `noValidate` with no `required` anywhere; `onSubmit` refuses an empty name
and a missing date/time and stops. Type, groups, location and duration pass
through unchecked. **Duration → §0ah** (decided: required). **Type and groups →
§0ai.** A session with no group has no expected attendees, which is what the
dashboard and compliance count.

**"Rehab" is a type and a group**, in adjacent rows. Recorded (§0ai).

---

## Summary for design

1. **Profile at phone width is seven screens** with availability and
   corrections at the bottom. *(SS-05 — design; under §0af.)*
2. **"Week plan" current tab is a span.** *(SS-07 — §0ai.)*
3. **Session form validates three of nine inputs.** *(SS-08 — §0ah, §0ai.)*
4. **Clinical boundary holds on the profile** for this role. *(SS-05 —
   deliberate boundary, verified.)*
5. Right and worth keeping: the profile's desktop pairing of Flags and
   Athleticism; "lower is better on this test" beside the trend; the confirm-
   and-cancel on Mark best; the session form's focused inline errors.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| SS-05: panels for bio, availability, injuries, wellness, gym, nutrition, weigh-ins | **Paraphrase** — ten real panels recorded. Corrected. |
| SS-05: three sub-routes | **Correct** |
| SS-05: seven permission sets | **Not testable from one role**; `CLINICAL_ONLY` verified absent for SS |
| **SS-05: "Nutrition is read-only here and says so"** | **Wrong for this role** — "Edit → /nutrition". Corrected. |
| SS-06: "Mark best" `.btn-ghost` on a result row | **Correct**, 44px |
| SS-06: confirm "Mark as best" `.btn-primary` | **Correct**, plus an undocumented Cancel. Corrected. |
| SS-06: Print, Export CSV, Export PDF | **Correct** |
| SS-07: Edit mode on load, Read/Edit `role="group"` | **Correct** |
| SS-07: "Week plan" (current) and "Today" view tabs | **"Week plan" is a span**, not a tab. Corrected. |
| SS-07: chip row, week nav, status | **Correct** |
| SS-07: read-only branch for non-editors | **Not verifiable as SS** |
| SS-08: six fields, ids, types | **Correct**; placeholders added |
| SS-08: type chips, group chips | **Correct** — seven and four, named |
| SS-08: "Creating…" | **Not observed** — not submitted |
| — | **Undocumented:** what the form validates. Now recorded. |
