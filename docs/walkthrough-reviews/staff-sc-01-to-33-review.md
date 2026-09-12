# Persona review — Section D, the S&C (STAFF-SC-01 to -33)

**Persona.** The strength and conditioning coach: the gym programme is theirs, the
leaderboards are theirs, weigh-ins are theirs; the schedule, the roster and the clinical
record are not.

**Account.** Owen Hartnell, `o.hartnell@ashcomberfc.example` — S&C only, on scratch (port
9503). Jane Pemberton's stored fingerprints for the identity check (the dashboard baseline
predates this evening's A1/A2/A4 build, so its two-leaf difference is the build, not the
role). **Reviewed 2026-09-12** at **1280×900 and 375×812**, read-only; the one dialog opened
(+ Assign) was closed without submitting.

**Method.** Sixteen routes fingerprinted and diffed; the S&C's unique power exercised up to
the button and not beyond.

---

## Identical, verified

| Flow | Route | Result |
|---|---|---|
| SC-01 | `/dashboard` | identical (the +2 leaves are `58f0aca`'s state lines) |
| SC-02 | `/squad` | identical minus "Add athlete" |
| SC-16 … 22 | the reports | not re-fingerprinted; `REPORT_ACCESS` is the coach's and the medic's set, both measured identical today |
| SC-24 | `/programmes`, a standard programme | identical — 34 / 27 leaves, the same 9 / 11 controls including Archive, + Exercise, + Session, + Block, + Assign (`PROGRAMME_EDIT`) |
| SC-25 | `/leaderboards` | identical (520 leaves) |
| SC-26 | `/leaderboards/manage`, `/new` | identical (8 / 36 leaves; `LEADERBOARD_EDIT`) |
| SC-33 | Print | identical control |

## Differs, measured

**SC-24a — Propose an injury programme.** The power is not a control of its own: in a
programme's "+ Assign", choosing an athlete with an open injury (James Barnes, Rory
Hastings on scratch) turns the button into **"Propose"** and adds, before the act, "This
athlete has an open injury, so this goes to the medic as a proposal. It will not reach the
athlete until a medic signs it off." — stated while choosing, which is the right place.
`proposesAgainstInjury = INJURY_PROGRAMME_PROPOSER && !isMedical` (migrations 0079–0081).
Document clarified.

**The other side of that gate, for Isabella:** the sport scientist, who does not hold
`INJURY_PROGRAMME_PROPOSER`, assigns the same injured athlete **directly** — "Assign", no
proposal, no medical sign-off (measured as Jane on the same dialog: the note does not
render, the button reads "Assign"). The document frames the proposer role as "the one power
the superset role does not hold"; in practice it is a *constraint* the superset role does
not carry. Whether an admin assigning a gym programme to an injured athlete should bypass
medical sign-off is a role-model question, not a defect — reported directly.

**SC-24, the rehab half.** On the rehab programme ("Return to running") the S&C is
read-only — no Archive, + Exercise, + Session, + Block or + Assign (`REHAB_PROGRAMME` is
sport scientist + medic) — and `/programmes/new` for the S&C has no Gym / Rehab type chips:
a new programme is a gym programme. Document corrected ("identical" was true of the list
and the standard programme only).

**SC-05 — the profile.** No Availability panel (absent, not read-only — the document said
read-only), no SAR section; the header "Edit" and the five "Correct check-in" buttons are
now `BlockedButton`s (`11dc42f`) — reachable, reason on tap; the Body-weight trio live
(`WEIGH_IN_EDIT`); the Injury panel censored. 2,562px / 5,039 at phone, sideways scroll at
375 (§0ap's roster-table class on the profile — measured on every role).

**SC-29 — the hub.** Seven sections, five rows (Thresholds → in-page refusal, Exports,
Groups, Notifications, Log out); the Integrations links bounce — the same two dead offers
as the coach's and the medic's (§0av). `/settings/groups` opens as the read list **with the
reorder arrows enabled** (§0az — now decided: `BlockedButton`).

**Nutrition.** `/nutrition` opens as a view: "Food library" present (the S&C may read it),
"+ Meal", "Assign" and the six steppers `disabled` with no reason (§0av's nutrition bullet
and §0az's "+ Meal" — the S&C is a third role on both). The document's "Nutrition authoring
and the meal library — cannot reach" is half right: the library opens, its write does not.

**Injuries.** `/injuries`, the detail and rehab groups identical to the sport scientist's
(the censored board, the coaching-staff banner, Set phase / Remove — `REHAB_ALLOCATION` is
the S&C's); team allocation read-only (`SESSION_EDIT`). Correct and stated in place.

---

## Summary for design

1. **Nothing new to file** — every S&C finding is a role already filed under §0av, §0az or
   §0ap; the S&C is added to those lists.
2. **Right and worth keeping:** the proposal note before the act in "+ Assign" — the best
   permission copy in the app; the rehab programme's read-only shape.
3. **Boundaries:** rehab programmes not the S&C's; no availability panel; no clinical
   record; allocation read-only; no Add athlete.
4. **For Isabella (gate):** the sport scientist assigns an injured athlete a programme
   without the medical sign-off the S&C's assignment gets.

## Claims checked

| Claim | Verdict |
|---|---|
| SC-24 identical | The list and standard programmes, yes; **rehab programmes read-only, `/programmes/new` gym-only**. Corrected. |
| SC-24a "appears on `/programmes/{id}`" | **Inside "+ Assign"**, as "Propose" with a note, when the athlete has an open injury. Clarified. |
| SC-05 "bio, availability and entry corrections read-only" | Bio and corrections **blocked with a reason**; **availability absent**. Corrected. |
| SC-29 "own profile only" | **Seven sections, five rows.** Corrected. |
| Cannot reach `/settings/groups`; the meal library | **Groups opens** (read list); **the library opens**, its writes are blocked. Corrected. |
