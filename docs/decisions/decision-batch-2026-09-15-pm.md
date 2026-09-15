# Decisions, 15 September 2026 (afternoon) — the choices the overnight build made without a rule

Isabella's rulings on the items the builder flagged as "built with a
choice" in the overnight report, plus one guard decision. The body mass
rulings from the same sitting are in `decisions/body-mass-rule.md` and the
programme dating in `decisions/programme-dates.md`; neither is repeated
here.

## 1. Athlete profile panels on a desktop (STAFF-SS-02-05 C4)

The ruled panel order was drawn as a phone list. Its desktop mapping is
**column-first** — first half down the left column, the rest down the
right — so "Body weight above Flags" is literally true on a desktop. The
board's desktop frame shows Athleticism top-left and Flags top-right, which
no mapping of the phone list reproduces; the phone list is the complete
ruled statement and wins, the desktop frame is treated as a sketch.

**The ACWR and wellness card stays as its own card**, after Athleticism,
rather than folding into the header as the board draws it.

**Entries and corrections returns to the foot of the page.** Built fourth
and full-width, which broke the two-column grid through the middle of the
page. The order was ruled to fix what a person reads first, not to force a
full-width band mid-page, and the original reason for putting it last —
the last thing a coach sees is their own tool — still holds.

## 2. Form drafts: every form, cleared on sign-out (PATTERN-S6 C3)

**Every form holds its draft through session expiry**, not only the three
athlete entry forms built. The staff forms — the injury form, a new
session, a new threshold — are added.

**Drafts are cleared on sign-out, and a staff draft is cleared at the end
of the working day** even where nobody signs out. A held draft lives in
browser storage on that device; an athlete's phone is their own, but the
injury form may be filled on a shared laptop in the physio room and its
draft can hold body area, mechanism and description — the clinical content
the column-level separation exists to protect.

**The sign-in button does not read "Sign in and send."** The builder was
right not to build it: the draft is restored, not sent, and the button
would be describing something it does not do.

## 3. Week template over a non-empty week (PATTERN-S4 / B7)

**Kept as built.** Applying a template replaces the week, except that
sessions already carrying data and the fixture's match are kept, and the
B11 dialog states the consequence before anything is pressed ("This will
remove 3 sessions already in this week and add 7 from the template").

Accepted cost: the resulting week is a hybrid, and an S&C expecting seven
sessions may get nine. That is stated in the dialog rather than hidden.
Silently destroying collected data to satisfy a plan is the worse failure
by a distance.

## 4. Today's gym row (PATTERN-S6 C2)

**Kept as built** — the row appears only for a session the athlete opened
today and has not finished (earliest started, where two are open). It never
claims a session is due, so it cannot be wrong about it.

The gap behind it — nothing maps a programme's week and day numbers onto a
calendar — is closed separately by `decisions/programme-dates.md`.

## 5. Every guard asserts its own coverage

Any guard that walks a list of files, roles, routes or screens **asserts
the number it expected to find and fails loudly when the count does not
match.** Eleven roles means eleven, or the run fails.

Why: the accessibility sweep's reporter silently skipped three roles whose
filenames contained underscores, and printed a clean-looking report anyway.
That is the third instance of one failure — a check that cannot tell
"this passed" from "this never ran". The other two were the `--fs-*`
tokens placed inside a CSS comment, which broke the stylesheet for six
commits while roughly two hundred guards read the file as text and none
noticed, and the request memo that was correct by audit but not by
construction.

**Run as one pass across the guard suite before the accessibility sweep's
step 2 begins**, since step 2 is driven by exactly this kind of
enumeration.
