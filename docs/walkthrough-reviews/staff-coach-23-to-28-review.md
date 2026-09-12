# Persona review — STAFF-COACH-23, -25, -26 and -28

**Persona.** The head coach checking the Forwards' fuelling target, reading the sprint board,
publishing a board for the squad, and opening the injury board before selection.

**Account.** Mark Iremonger (coach only), port 9502; Jane Pemberton for the identity check.
**Reviewed 2026-09-12** at **1280×900 and 375×812**, read-only — no plan assigned, no board
created or unpublished, no injury logged.

**Method.** Ten routes fingerprinted for both accounts and diffed: `/nutrition`,
`/leaderboards`, `/leaderboards/manage`, `/leaderboards/new`, `/leaderboards/{id}`,
`/injuries`, `/injuries/{James Barnes}`, `/injuries/new`, `/injuries/team-allocation`,
`/injuries/rehab-groups`.

---

## STAFF-COACH-23 — Nutrition: meal library only

**Differs, and not quite as the document said.** The coach's `/nutrition` (529 leaves vs 531,
61 controls vs 63) lacks "Manual target" (`/nutrition/new`) and "New plan" — correct,
`NUTRITION_EDIT` is sport scientist + nutritionist. "Food library" is present — correct,
`MEAL_LIBRARY_EDIT`. **But "Assign" is not absent: it and the six `−`/`+` day-type steppers
render `disabled` for the coach — with no `title`, no `aria-disabled`, no sentence anywhere
on the page saying why.** ("Duplicate" is disabled for every role with "Not available
yet".) The coach sees seven greyed controls and no reason; the profile's Body-weight trio at
least carried a `title` (§0av). Document corrected; filed as the third disabled-without-a-
reason case on §0av.

**3,520px at desktop, 5,728 at phone** — the same long page the sport scientist reads
(SS-23), for a role that can act on none of it except the library. What the coach wants
from this screen is the day's target per group in g/kg; that is the "Day type" section,
which sits below the plan list.

## STAFF-COACH-25 — Explore the leaderboard wall

**Identical, verified** (520 leaves, 51 controls, 3,840 / 6,109px). The coach holds
`LEADERBOARD_EDIT`, so nothing is withheld.

## STAFF-COACH-26 — Publish and manage leaderboards

**Identical, verified** on all three screens — manage (8 leaves), new (36 leaves, 30
controls: the six-step builder including the dead "Tap one below to see why" chips, §0ap
open), the board (163 leaves, "Board actions" present for the coach as `canManage`). The
coach can create, unpublish and delete a board — the 2026-09-04 decision (D-05) said
view-only for the coach and the code says otherwise, recorded on the pilot list as your
call; nothing here changes that.

## STAFF-COACH-28 — Injuries: the board opens, the diagnosis does not

**Identical to the sport scientist's on four of five screens** — the board (29 leaves,
no "+ Injury" for either non-medic role), the detail (12 leaves — the "This is what
coaching staff see…" banner and the censored facts), `/injuries/new` (73 leaves — the
non-clinical form: athlete, body area, side, onset; it opens for the coach, as §0av's
decided direction now wants the board button to), team allocation (233 leaves, read-only
as stated). **Rehab groups differs:** the sport scientist gets "Set phase" / "Remove" per
athlete (20 controls); the coach gets the read list (7 controls) with the page's own note —
"Availability, body area and side, restrictions, expected return, and rehab phase — the
limited injury view a shared phase cannot be managed without. No diagnosis, no clinical
notes, not even for medical, on this screen." `REHAB_ALLOCATION` excludes the coach;
stated in place. **Good.**

**At 375:** nutrition 5,728px, the wall 6,109, manage 812 (fits), new 1,376, board 2,118,
injuries 997, detail 812 (fits), new 812, team allocation 3,866, rehab groups 1,528. No
sideways scroll on any of the ten. Sub-44: "Profile ›" on the wall (19px) and on nutrition
(17px), "the testing wall" inline link (35px) — sweep table.

---

## Summary for design

1. **Seven disabled controls on `/nutrition` with no reason for the coach.** *(Defect,
   §0av; both widths.)*
2. **The coach's nutrition screen is the sport scientist's 5,728px page** for a role whose
   question is one number per group. *(Design; the SS-23 brief, with a coach note.)*
3. **Nothing else coach-specific**; the SS-25, -26 and -28 briefs are the design surface.
4. Right and worth keeping: the rehab-groups note stating the limited view and that even
   medical gets no diagnosis there; the injury detail's coaching-staff banner.
5. Boundaries, left alone: "Manual target" and "New plan" absent; rehab allocation
   read-only; no "+ Injury" on the board today (§0av's decided direction adds it).

## Claims checked

| Claim | Verdict |
|---|---|
| 23: "Food library present; New plan, Create and Assign absent" | Food library **present**; New plan and Manual target **absent**; **Assign present and disabled** with no reason (and the six steppers with it). Corrected. |
| 25, 26 identical | **Identical** by fingerprint, both widths. |
| 28: board, detail, rehab groups, team allocation open; clinical withheld | **Correct**; rehab groups is the read list with the page's note; `/injuries/new` opens (the non-clinical form). |
