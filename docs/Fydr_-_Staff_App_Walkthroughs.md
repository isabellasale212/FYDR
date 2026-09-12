# Fydr — Staff App Walkthroughs

**Built 2026-09-10 from the running code**, not from the uploaded specification
documents. Every label in quotation marks is copied from the JSX that renders
it. Where a control's text changes with state, all states are listed with the
condition that produces each.

**Sources.** `src/app/(staff)/**` — 66 page routes and 20 POST endpoints — with
each page's component tree resolved by following its imports rather than by
folder. Role gates read from `src/lib/access.ts` and from each route's own
`hasAnyRole` calls. Cross-checked against `docs/screens/*.md` (numbered files
only; `docs/screens/legacy/` contradicts the app in places and is not binding).

---

## The five staff roles

There is no "admin" role. `SETTINGS_ADMIN` is **the sport scientist alone** —
the settings-administrator powers belong to that role rather than to a separate
one. A user may hold several roles; permissions are the union.

| Permission set | sport_scientist | coach | medic | strength_conditioning | nutritionist |
|---|:--:|:--:|:--:|:--:|:--:|
| `SETTINGS_ADMIN` | ● | | | | |
| `ANALYTICS` | ● | | | | |
| `GPS_IMPORT` | ● | | | | |
| `CLINICAL_ONLY` | | | ● | | |
| `INJURY_PROGRAMME_PROPOSER` | | | | ● | |
| `SESSION_EDIT` | ● | ● | | | |
| `THRESHOLD_EDIT` | ● | ● | | | |
| `GROUP_EDIT` | ● | ● | | | |
| `PROGRAMME_EDIT` | ● | | | ● | |
| `REHAB_PROGRAMME` | ● | | ● | | |
| `NUTRITION_EDIT` | ● | | | | ● |
| `PROGRAMME_AUTHOR` | ● | | ● | ● | |
| `AVAILABILITY_EDIT` | ● | ● | ● | | |
| `ATHLETE_BIO_EDIT` | ● | ● | ● | | |
| `ENTRY_CORRECTION` | ● | ● | ● | | |
| `LEADERBOARD_EDIT` | ● | ● | | ● | |
| `MEAL_LIBRARY_EDIT` | ● | ● | | | ● |
| `REHAB_ALLOCATION` | ● | | ● | ● | |
| `INJURY_ACCESS` | ● | ● | ● | ● | |
| `REPORT_ACCESS` | ● | ● | ● | ● | |
| `FLAG_EDIT_ANY_DOMAIN` | ● | ● | ● | ● | |
| `ATHLETE_GYM` | ● | ● | ● | ● | |
| `WEIGH_IN_EDIT` | ● | | ● | ● | ● |
| `ALL_STAFF` | ● | ● | ● | ● | ● |

**Read this table two ways.** The sport scientist holds everything except
`CLINICAL_ONLY` and `INJURY_PROGRAMME_PROPOSER` — so they are the superset for
almost every flow, but **cannot** open clinical detail and **cannot** propose an
injury programme. The nutritionist holds only four sets and is by far the most
restricted.

## The sidebar is the same for four of the five roles

Nine destinations, `<nav className="nav" aria-label="Main">`, in this order:

| Label | Route | Who sees the row |
|---|---|---|
| "Dashboard" | `/dashboard` | all staff |
| "Squad overview" | `/squad` | all staff |
| "Schedule" | `/schedule` | all staff |
| "Reports" | `/reports` | all staff |
| "Nutrition" | `/nutrition` | all staff |
| "Gym programme" | `/programmes` | all staff |
| "Leaderboard" | `/leaderboards` | all staff |
| **"Analytics"** | `/analytics` | **sport scientist only** |
| "Settings" | `/settings` | all staff |

Below the nav: a plan link to `/settings#plan`, and "Log out".

**This is the single most important structural fact in this document.** Only one
row is role-gated. A coach, a medic, an S&C and a nutritionist see an **identical
nine-row sidebar** minus Analytics — every other difference between roles appears
*inside* a screen, as a missing button or a read-only panel, not as a missing
destination. Groups, Timetable and Testing have no row at all: they were folded
into Squad overview, Schedule and Reports respectively, and Flags has never had
one.


## Table of contents

### Section A — Sport scientist

| ID | Flow |
|---|---|
| STAFF-SS-01 | Read the dashboard |
| STAFF-SS-02 | Browse the squad and filter by group |
| STAFF-SS-03 | Add an athlete |
| STAFF-SS-04 | Invite a person and hand over their link |
| STAFF-SS-05 | Open an athlete's profile |
| STAFF-SS-06 | Mark a test result as an athlete's best |
| STAFF-SS-07 | Read the week's schedule |
| STAFF-SS-08 | Create a session |
| STAFF-SS-09 | Create a fixture |
| STAFF-SS-10 | Edit a session in the grid |
| STAFF-SS-11 | Remove a session, and restore it |
| STAFF-SS-12 | Use the edit-mode toolbar |
| STAFF-SS-13 | Publish the week to athletes |
| STAFF-SS-14 | Discard every pending change |
| STAFF-SS-15 | Manage week templates |
| STAFF-SS-16 | Open the squad report and export it |
| STAFF-SS-17 … 22 | The other six reports |
| STAFF-SS-23 | Build a nutrition plan and assign it |
| STAFF-SS-24 | Author a gym programme |
| STAFF-SS-25 | Explore the leaderboard wall |
| STAFF-SS-26 | Publish and manage leaderboards |
| STAFF-SS-27 | Analytics |
| STAFF-SS-28 | Injuries |
| STAFF-SS-29 | Settings hub |
| STAFF-SS-30 | Settings sub-screens |
| STAFF-SS-31 | Filter the audit log |
| STAFF-SS-32 | Generate an export |
| STAFF-SS-33 | Print a screen |
### Section B — Coach

| ID | Flow |
|---|---|
| STAFF-COACH-05a | Athlete profile: no clinical detail |
| STAFF-COACH-23 | Nutrition: meal library only |
| STAFF-COACH-28 | Injuries: allocation without the board |
### Section C — Medic

| ID | Flow |
|---|---|
| STAFF-MEDIC-05 | Athlete profile: the only role that sees clinical detail |
| STAFF-MEDIC-19 | The injuries report |
| STAFF-MEDIC-28 | The injury board |
| STAFF-MEDIC-24 | Rehab programmes |
| STAFF-MEDIC-30g | Review a subject-access request |
### Section D — Strength and conditioning

| ID | Flow |
|---|---|
| STAFF-SC-24a | Propose an injury programme |
| STAFF-SC-05 | Athlete profile: gym and weigh-ins, no clinical detail, no bio edit |
### Section E — Nutritionist

| ID | Flow |
|---|---|
| STAFF-NUT-05 | Athlete profile: weigh-ins only |
| STAFF-NUT-07 | Schedule: read-only, and it says so |

Role sections B–E additionally carry a table of every flow identical
to its sport-scientist counterpart, and a list of what that role cannot
reach at all. Those tables are inside each section rather than here.

---

## How the role sections relate

`STAFF-SS-*` (sport scientist) is written out in full, because it reaches almost
every flow. Each other role's section lists **every** flow ID, with either full
detail where behaviour differs or a one-line pointer plus entry point where it is
identical — so a reviewer working on one role never needs to read another's
section. Each role's section ends with **what that role cannot reach at all**.

---

# Section A — Sport scientist

The superset role. Holds `SETTINGS_ADMIN`, `ANALYTICS` and `GPS_IMPORT` alone,
and everything else except `CLINICAL_ONLY` (medic) and
`INJURY_PROGRAMME_PROPOSER` (S&C).

## Global controls present on every screen

Unless a flow says otherwise, all of these are on screen throughout:

- The nine-row sidebar (see above), the plan link, and "Log out".
- On any multi-athlete screen: the **group filter** — a chip row beginning
  "Whole squad" (carrying "✓" when no group is selected), then one chip per
  group (measured: Backs, Forwards, Rehab, Academy; each carrying "✓" when
  active), and a "Clear filter" link that **appears only while a group is
  selected**. The selection persists globally across screens; it is the
  `fydr-group-filter` cookie, not per-screen state.
- **At phone width the sidebar is not a rail.** Below 768px `.sidebar` is
  `position: static` and stacks full-width above the content — measured at
  375×812 as a **640px block** carrying the nine rows and "Log out" — so every
  staff screen on a phone opens on the navigation, with its own heading around
  y≈730 and its first content section further down (Dashboard: y=2209). Between
  768 and 1023px there is a 64px collapsed rail; below that, nothing collapses.
  `base.css`'s own comment records the stacking as intended. Every phone-width
  measurement in this section should be read with that block above it.
- "Log out" in the sidebar is a `<button type="submit">` measuring **17px**
  tall; "Back" (the shared `BackButton`) is 29px on every staff screen.

---

## STAFF-SS-01 — Read the dashboard

**Entry point.** Sign-in lands here. "Dashboard" in the sidebar.

**Steps.**

1. The screen loads with heading "Dashboard", then a day heading, then three
   sections: readiness, "Outstanding entries", and flags.
   - Readiness heading reads "Ready for {matchday}" when a matchday is in range,
     otherwise "Squad readiness".
   - Interactive elements present: the group filter chips; "Compliance ›" →
     `/reports/compliance`; "See every open flag →" → `/flags`; "Full compliance
     report ›"; "Full squad ›"; per-athlete "View player profile" →
     `/squad/{id}` and "Open athlete report" → `/reports/athlete/{id}`; and
     "Expand"/"Collapse" toggles on the collapsible sections.

**Branches.**

- IF nobody was expected to submit today THEN the outstanding section reads
  "Nobody was expected to submit today."
- IF everyone expected has submitted THEN "Nobody outstanding — everyone
  expected has submitted."
- IF a session raised nothing THEN "Nothing was raised against this session." /
  "Nobody flagged and nothing outstanding for this one."

**End state.** Stays on `/dashboard`.

---

## STAFF-SS-02 — Browse the squad and filter by group

**Entry point.** "Squad overview" in the sidebar → `/squad`.

**Steps.**

1. Heading "Squad overview", with a count line reading "{N} athletes in the
   squad" or "{N} athletes in the selected groups".
   - Also visible: "Add athlete" (`.btn-primary`, 50px) → `/squad/new`;
     "Manage groups" (`.btn-ghost`, 44px) → `/settings/groups`; the five group
     filter chips (44px); "Clear filter" **once a group is selected**; and one
     link per athlete carrying their name — **15px tall at desktop, 34px at
     phone width**, in a row per athlete.
   - Measured: "30 athletes in the squad" → "15 athletes in the selected
     groups" on selecting Forwards, with the athlete list falling to 15.
2. Press a group chip to filter, or an athlete's name to open their profile.

**End state.** Stays on `/squad` with the filter applied, or opens
`/squad/{athleteId}`.

---

## STAFF-SS-03 — Add an athlete

**Entry point.** "Add athlete" on `/squad`. Direct URL `/squad/new`.
**Gate:** `SETTINGS_ADMIN` — **sport scientist only**. A coach cannot add an athlete.

**Steps.**

1. Fill the form, heading "Add athlete":

| Label | Field | Required |
|---|---|---|
| "First name" | `id="first-name"` | yes |
| "Last name" | `id="last-name"` | yes |
| "Date of birth" | `id="dob"`, `type="date"` | **yes** — `required`, and the form is not `noValidate`, so the browser refuses to submit without it |
| "Position" | `id="position"`, a select | |
| "Squad number" | `id="squad-number"`, `type="number"` | |
| "Email (optional)" | `id="email"`, `type="email"` | no — hint beneath: "Leave blank to add them to the roster with no app access. You can invite them later from their profile." |

   - Also visible: "Save" and "Cancel".
2. Press "Save" — label becomes "Saving…" while in flight; the button is
   disabled during it.

**Branches.**

- IF "Cancel" is pressed THEN navigate to `/squad`; nothing is written.
- ~~IF date of birth is left empty THEN the athlete is treated as a minor~~ —
  **not reachable from this form**: the field is `required` and native
  validation blocks the submit (measured 2026-09-11). The underlying rule is
  real — `athlete_is_minor()` returns TRUE for a null date of birth, failing
  safe (migration 0093) — but it applies to athletes created by other paths
  (seed, import, a date later cleared), not to one added here.
- The form is `method="post"`; "Cancel" is a `<button type="button">`, not a
  link.
- IF an email is supplied THEN an account and invite link are created; see
  STAFF-SS-04.

**End state.** A confirmation screen with "Back to the squad" (`.btn-primary`).

---

## STAFF-SS-04 — Invite a person and hand over their link

**Entry point.** `/settings/users` → the invite form. Also the email field on
`/squad/new`.
**Gate:** `SETTINGS_ADMIN`.

**Steps.**

1. On `/settings/users` — heading "Users", a count line ("37 users · 9 staff ·
   29 athlete accounts · 1 athlete record with no account"), a "Bulk invite
   athletes →" link to `/settings/users/bulk-invite`, and one row per user with
   six inline role toggles and a "Deactivate" button — press **"+ Invite
   people"** to reveal the form. (The button carries no `aria-expanded`.)
2. Fill the invite form. Its intro reads: "Creates a real account and tries to
   send an invite email; no SMS. If it can't be sent, you'll get an invite link
   to pass on yourself instead." Fields: **"Full name"** (`id="invite-name"`,
   required), **"Email"** (`id="invite-email"`, required), and **"Roles"** —
   six `aria-pressed` toggle buttons (Athlete, Coach, Medic, Sport scientist,
   Strength conditioning, Nutritionist, each 44px) under "Roles are additive —
   tick everything that applies." **At least one role is required**: the route
   answers "Tick at least one role." with a 400 otherwise.
3. Press **"Create account"**.

**End state, two variants.**

- IF the email delivered THEN: "An invite email has been sent to {name}. Keep
  the link below too, in case it doesn't arrive."
- IF it did not THEN: "Send this link to {name} yourself — no invite email went
  out. It signs them in once and lets them choose their own password."

Both show the single-use link, the caption "The link works once and confirms
their email address at the same time. No password has been set for them, and
nobody here can see the one they choose.", and a "Done, I've copied it" button.

**Branches.**

- IF the recipient's address is on a reserved domain (`.example`, `.test`,
  `example.com`) THEN **no request is made at all** — a refused send cannot
  bounce. All 46 seeded accounts are `.example`, so inviting one always lands in
  the second variant.
- The screen states the fact of non-delivery and **not a cause**, because the
  response carries no error field. The real reason is on the audit row.

---

## STAFF-SS-05 — Open an athlete's profile

**Entry point.** An athlete's name on `/squad`; "View player profile" on
`/dashboard`; many report rows.

**Steps.**

1. The profile opens with the athlete's name as heading. **The panels, measured
   2026-09-11 as a sport scientist** (two columns at 1280, one at 375): a bio
   block with "Edit"; **Athleticism**; **Flags** (with "Acknowledge");
   **Goals**; **S&C history log**; **Nutrition plan**; **Injury** (with
   "+ Add note"); **Body weight** (with "+ Log weigh-in" and "Set target
   range"); **Availability** ("Available" / "Modified" / "Unavailable" chips and
   "Update availability"); **Entries and corrections** ("Edit entries",
   "Correct check-in"); **Subject access request** ("Generate subject access
   pack →"). Page 2,721px at desktop, **5,828px at phone**.
   - Sub-routes reachable from here: `/squad/{id}/wellness`, `/squad/{id}/gym`,
     `/squad/{id}/nutrition`.
   - **No diagnosis, mechanism or problem-report content renders for a sport
     scientist** — measured absent. `CLINICAL_ONLY` holds.

**Branches by permission** — this screen checks **seven** different sets, more
than any other in the app:

| Panel / action | Needs |
|---|---|
| Edit bio | `ATHLETE_BIO_EDIT` |
| Set availability | `AVAILABILITY_EDIT` |
| Open injury detail | `INJURY_ACCESS` |
| Read diagnosis and mechanism | `CLINICAL_ONLY` — **medic alone** |
| Correct a wellness or RPE entry | `ENTRY_CORRECTION` |
| Record a weigh-in | `WEIGH_IN_EDIT` |
| See the gym panel | `ATHLETE_GYM` |

- IF the athlete id does not resolve THEN the route refuses (`notFound`).
- ~~Nutrition is read-only here and says so~~ — **not for the sport scientist**:
  the "Nutrition plan" panel carries **"Edit" → `/nutrition`**. The page's own
  comment says the read-only rendering applies to two of the five roles; for
  this role it is a write. Corrected 2026-09-11.

**End state.** Stays on `/squad/{athleteId}`.

**Panel-level control inventory extracted 2026-09-11** (the pass this note
asked for): "Edit" (bio); "Available", "Modified", "Unavailable", "Update
availability"; "Acknowledge" (flags); "+ Add note" (injury); "+ Log weigh-in",
"Set target range" (body weight); "Edit entries", "Correct check-in" (entries
and corrections); "Generate subject access pack →". The panels' own flows
(availability, injury, weigh-in, entry correction) are not separately numbered
in this document; the earlier note's "STAFF-SS-06 … 09" pointed at flows that
are in fact the test page and the schedule. Left for a later pass.

---

## STAFF-SS-06 — Mark a test result as an athlete's best

**Entry point.** "Reports" → "Testing" → a test definition → an athlete, i.e.
`/testing/{testDefId}/{athleteId}`.

**Steps.**

1. Under the "Bests" section, press "Mark best" (`.btn-ghost`) on a result row.
2. A confirm control appears: "Mark as best" (`.btn-primary`, 46px) **and
   "Cancel"** (`.btn-ghost`, 46px), label "Saving…" while in flight. Cancel
   returns the row to "Mark best" with nothing written (exercised).
   - Also visible on this screen throughout: "Print" (calls `window.print()`),
     "Export CSV" and "Export PDF" links, and the athlete's name as heading.

**End state.** Stays on the athlete's test page; the best is recorded.

---

## STAFF-SS-07 — Read the week's schedule

**Entry point.** "Schedule" in the sidebar → `/schedule`.
**Gate:** `SESSION_EDIT` decides *editing*, not access — every staff role can
open this screen.

**Steps.**

1. The screen loads **in Edit mode** for a role holding `SESSION_EDIT`. The
   header carries a segmented control, `role="group"`, `aria-label="Read or edit"`:
   "Read" and "Edit", each an `aria-pressed` button. "Edit" is pressed on load.
   - Also visible: "Back"; the group chips (a `role="group"` labelled "Filter
     by squad group"); the view tabs — **"Week plan" is a plain `<span
     class="sg-viewtab">`, not a link, button or tab, and carries no
     `aria-current`** — and "Today" → `/timetable`; week navigation "‹" (`aria-label="Previous
     week"`), the week range, "›" (`aria-label="Next week"`); the chip row
     "+ Session" → `/schedule/new`, "+ Fixture" → `/schedule/fixtures/new`,
     "Week templates" → `/schedule/planner`; the status banner; and, in Edit
     mode, the toolbar (STAFF-SS-12).

**Branches.**

- IF the role does **not** hold `SESSION_EDIT` THEN the segmented control is not
  rendered at all and its place carries: "Read only. The schedule is authored by
  the sport scientist and the coach." The chip row and every write control are
  also absent from the DOM, not merely hidden.
- IF the week has pending changes THEN see STAFF-SS-13.

**End state.** Stays on `/schedule`.

---

## STAFF-SS-08 — Create a session

**Entry point.** Two, and they behave differently:
- "+ Session" in the header chip row → `/schedule/new`, the full screen below.
- "+ Session" in the **edit-mode toolbar** → starts a draft **in the grid**, not
  this screen (STAFF-SS-12).

**Steps (the full screen).**

1. Fill the form:

| Label | Field |
|---|---|
| "Name" | `id="s-title"` |
| "Date" | `id="s-date"`, `type="date"` |
| "Time" | `id="s-time"`, `type="time"` |
| "Duration (min)" | `id="s-duration"`, `type="number"` |
| "MD offset (optional)" | `id="s-md"`, `type="number"`, placeholder "-2" |
| "Location" | `id="s-location"` |

   - Placeholders: "Captain's run", "-2", "Main pitch". Date pre-fills from
     `?date=`; time defaults to 09:00; duration to 60.
2. Choose a session type from a chip row under the legend "Type" — Training,
   Gym, Fixture, Testing, Recovery, Meeting, Rehab (`aria-pressed` buttons).
3. Choose groups from a chip row under "Who's in it" — Backs, Forwards, Rehab,
   Academy. (**"Rehab" is both a type and a group**, in adjacent rows.)
4. Press "Create session".

**What the form validates, and what it does not.** The form is `noValidate`
and no field is `required`. `onSubmit` refuses only an empty name ("Give the
session a name.") and a missing date or time ("Set a date and time."), focusing
the field. **Duration, type, groups, location and MD offset are not checked** —
a cleared duration submits `null` (§0ah).

**Button states.**

| Label | When |
|---|---|
| "Create session" | Default. |
| "Creating…" | In flight; disabled. |

   - "Cancel" (`.btn-ghost`) is beside it throughout, returning to `/schedule`.

**End state.** Returns to the schedule.

---

## STAFF-SS-09 — Create a fixture

**Entry point.** "+ Fixture" in the schedule header chip row →
`/schedule/fixtures/new`.

**Steps.**

1. Fill "Opponent" (`id="f-opponent"`, placeholder "Ashfield RFC", max 80 chars).
2. Fill "Date" (`id="f-date"`) and "Kick-off" (`id="f-time"`, defaults to 14:00).
3. Choose "Home or away" — a fieldset with a legend and three chips: "Home",
   "Away", "Neutral", each `aria-pressed`. **"Home" is pressed by default.**
4. Optionally fill "Venue" (`id="f-venue"`, placeholder "Ashcombe Park") and
   "Competition" (`id="f-competition"`, placeholder "League").
5. Choose "Importance" — four chips: "Friendly", "Normal", "Key", "Cup final".
   **"Normal" is pressed by default.** Date pre-fills to today; kick-off to 14:00.
   Caption: "Used to weight the match in load planning. Leave it on Normal
   unless this one is treated differently."
6. Press "Create fixture".

**Button states.**

| Label | When |
|---|---|
| "Create fixture" | Default, and **again after an error** — it does not stay in the pending state. |
| "Creating…" | In flight; disabled. |

   - "Cancel" (`.btn-ghost`) is beside it throughout.

**Branches.**

- IF "Opponent" is empty THEN submission is refused with "Name the opponent.",
  and **focus moves to the opponent field and scrolls it into view**. The
  message alone was not enough: it renders inside a long form, and somebody who
  has just pressed the button at the bottom is looking at the button.
- IF date or time is missing THEN "Set a date and kick-off time.", with the same
  focus move to the date field.
- IF the write fails THEN the error renders in a `role="alert"` paragraph and
  the button returns to "Create fixture".

**End state.** Redirect to `/schedule?date={date}`.

**Note, stated on the form itself.** A fixture reaches athletes immediately and
club-wide — every athlete sees the club's next fixture on their Today screen —
but it **names nobody**. A session is what athletes are rostered to.

---

## STAFF-SS-10 — Edit a session in the grid

**Entry point.** `/schedule` in Edit mode → click a session block.

**Steps.**

1. The selected-session panel opens in the right-hand rail, showing the session
   name, "{Weekday} {date} · {start} – {end} · {location}", type, any
   restriction-conflict warning, and GROUP / DURATION / MD / EXPECTS, plus a
   "What the athlete sees" preview.
2. Adjust with the four steppers — **two `−`/`+` pairs whose `aria-label`s are
   "Earlier", "Later", "Shorter", "Longer"**; the words are not visible. Each
   is **40px** (measured 2026-09-11).
   - Also visible: group chips; "Remove session" (when the session is not in the
     past, or is an unpublished draft); "Duplicate"; and, once this session has a
     pending change, "Cancel changes".

**Branches.**

- IF the session has a pending change THEN a line appears beneath the actions:
  "Held on your screen. Publish to athletes, at the top of this page, puts it on
  their phones." — and "Cancel changes" appears.
- IF the session is a **staged draft** THEN "Cancel changes" is **not** offered;
  "Remove session" is the same act and already carries a confirmation.
- IF the session is in the past and already published THEN "Remove session" is
  not offered — **and neither are the four steppers**: the panel for a past
  session carries "Duplicate" only (measured on Mon 7 Sept's "Unit skills").
- **A draft started from the toolbar's "+ Session" does not open this panel.**
  It opens a **three-step wizard** in the same rail — "Step 1 of 3 · What"
  (a name input, placeholder "Session name", **no label or `id`**; the seven
  type chips; "Next", 35px; "Give it a name to continue." until named),
  "Step 2 of 3 · When & where" (seven day chips Mon–Sun for the shown week; the
  same `−`/`+` steppers; a location input, **also unlabelled**), "Step 3 of 3 ·
  Who" (the group chips; "Nobody selected means staff only — no athlete will
  see this in their app."), ending in **"Add to {weekday}"**. A "✕" with
  `aria-label="Discard this session"` (44px) sits in the head throughout. Only
  once added does the draft get the selected-session panel above, with
  "Remove session" and "Duplicate" but no "Cancel changes". The preview line
  under it reads "Publishes to {group} · appears under Today on the morning of
  {date}".
- **The "What the athlete sees" preview's EXPECTS line is a fixed string per
  type** — `scheduleGeometry.ts` `EXPECTS`: training "RPE due by 19:45", gym
  "Sets to log", match "RPE after full time", testing "Staff entered", rehab
  "Stage log". It does not read the session's time. Filed (§0aj).

**End state.** Changes are held locally. Nothing reaches athletes until Publish.

---

## STAFF-SS-11 — Remove a session, and restore it

**Entry point.** "Remove session" in the selected-session panel.

**Steps.**

1. Press "Remove session".
2. A confirmation replaces the actions: "Remove this session? You can undo with
   Discard, until you publish." with "Yes, remove" (`.sg-btn-remove`, **37px**)
   and "Never mind" (`.btn-ghost`, 44px).
3. Press "Yes, remove".
4. The block leaves the grid and is redrawn as a **ghost**: no fill, name struck
   through, in place. The panel stays on it and shows: the name, the time line,
   "Removed on your screen. Athletes still see this session until you publish.",
   and "Restore session".
5. Press "Restore session" to undo.

**Branches.**

- IF "Never mind" is pressed THEN nothing is removed.
- IF the session carried a pending edit THEN **Restore keeps that edit** — it
  returns at the edited time, not the published one.
- IF the ghost is clicked after selecting something else THEN it re-selects and
  Restore is available again.
- A removed session **counts toward no total** — contact minutes and the
  typical-week comparison drop it immediately.

**End state.** Either the session is restored, or the removal stays pending
until Publish.

**The ghost and "Restore session" apply to PUBLISHED sessions only.** Removing
a **staged draft** (one added through the wizard and not yet published) makes it
vanish outright — no ghost, no "Removed on your screen…", no Restore — which is
the "same act as Discard" SS-10 describes. **The confirmation copy is then
wrong for that case**: "You can undo with Discard, until you publish" — there
is nothing to undo to. Measured 2026-09-11 on a wizard draft. The published-
session ghost path was **verified 2026-09-11** on a session published for the
purpose and removed again: ghost with no fill and the name struck through, in
place; the panel reading "Removed on your screen. Athletes still see this
session until you publish." with "Restore session"; the banner at "1 change
not yet in the athlete app"; the removal then published.

---

## STAFF-SS-12 — Use the edit-mode toolbar

**Entry point.** `/schedule` in Edit mode only. Absent in Read mode and absent
entirely without `SESSION_EDIT`.

**Controls, all on one row.**

- "+ Session" — starts a draft **in the grid** via the three-step wizard
  (SS-10), not the `/schedule/new` screen. A `<button>`, **35px**.
- A divider, then the label "Apply template", then one chip per saved template
  — each an **`<a>` to `/schedule/planner/apply?week=…&template=…`**, a preview
  screen, not an immediate application. Measured: one, "Standard 1-game week",
  44px.
- "Save this week as a template" (`.btn-ghost`, 44px) — an **`<a>` to
  `/schedule/planner/new`**.

**Branches.**

- IF no templates exist THEN in place of the chips: "No templates yet."

---

## STAFF-SS-13 — Publish the week to athletes

**Entry point.** The status banner at the top of `/schedule`.

**Banner states.**

| Title | When | Actions |
|---|---|---|
| "The athlete app is up to date" | Nothing pending | "Published" — **disabled** (`.sg-btn-published`, 17px) |
| "{N} change/changes not yet in the athlete app" | Anything pending | "Discard" (`.sg-btn-discard`, 37px), "Publish to athletes" (`.sg-btn-publish`, 35px) |

Both states verified 2026-09-11 by staging one draft and discarding it; "1
change not yet in the athlete app" is the singular.

When pending, a subtitle reads: "Athletes still see the schedule as it was
before these edits. Nothing changes on their phone until you publish."

**Steps.**

1. Press "Publish to athletes" — label becomes "Publishing…" and the button is
   disabled while in flight (verified). On success the banner returns to "The
   athlete app is up to date" and the session appears on each participant's
   Today week strip as a typed marker (e.g. "S 13 · Training · MD+1"), not by
   name.

**Branches.**

- IF the write fails **server-side** THEN a `role="alert"` line beginning "Not
  published:" renders in the banner, and the button returns to enabled.
- **IF the network fails** THEN the line is set and then lost: the handler's
  unconditional `router.refresh()` cannot fetch, Next falls back to a full
  reload, and **every pending change in the week is discarded** with no
  message. Reproduced 2026-09-11 with the network emulated offline. Filed
  (§0al).
- The banner **text** renders for every role; the **actions** only with
  `SESSION_EDIT`.

**End state.** Changes reach athletes; the banner returns to "The athlete app is
up to date".

---

## STAFF-SS-14 — Discard every pending change

**Entry point.** "Discard" in the banner, present only when something is pending.

**Steps.**

1. Press "Discard".
2. A confirmation replaces it: "Discard {N} change/changes? This can't be
   undone." with "Yes, discard" (`.sg-btn-discard`, 37px) and "Never mind"
   (`.btn-ghost`, 44px). Verified: "Discard 1 change? This can't be undone."
3. Press "Yes, discard".

**Branches.**

- IF nothing is pending THEN the button does not render, so this can never
  prompt for a no-op.
- This clears **every** overlay, added draft and removal in the week. To undo
  one session only, use "Cancel changes" or "Restore session" instead.

**End state.** The week returns to its published state.

---

## STAFF-SS-15 — Manage week templates

**Entry point.** "Week templates" in the schedule chip row → `/schedule/planner`.

**Steps.**

1. The screen lists saved templates.
   - Per template: "Apply" (`.btn-primary`, 50px) → `/schedule/planner/apply?template={id}`
     and "Edit" (`.btn-ghost`, 50px) → `/schedule/planner/{id}`. One template on
     scratch: "Standard 1-game week".
   - Also visible: "+ New template" (`.btn-primary`) → `/schedule/planner/new`;
     "Schedule" back link.

**Branches.**

- IF the role lacks `SESSION_EDIT` THEN `/schedule/planner/{id}` renders only:
  "Read only. Templates are authored by the sport scientist and the coach."

---

## STAFF-SS-16 — Open the squad report and export it

**Entry point.** "Reports" in the sidebar → `/reports`, which **is a menu** —
six cards, each a link: Compliance (`/reports/compliance`), Injury &
availability (`/reports/injuries`), Training report (`/reports/training`, "GPS
· premium"), Athlete report (`/reports/athlete`), **Squad weekly
(`/reports/squad`)** and Testing (`/reports/testing`), each with a one-line
description and "CSV · PDF" or "CSV". The squad report is the fifth card. An
earlier version of this document said `/reports` was the report itself;
measured 2026-09-11, it is not.
**Gate:** `REPORT_ACCESS` for the report family; the route itself takes any staff.

**Steps.**

1. On `/reports/squad`, heading **"Squad weekly"**, with sections "Needing
   attention", "Load", "Availability", "Wellness", "Gym and testing" (all five
   verified by name).
   - Also visible: "Export CSV" → `/reports/squad/export?to={date}`; "Export
     PDF" → `/reports/squad/pdf?to={date}`; period navigation — **"Previous
     week" only when the current week is shown** ("Next week" renders only for
     a past week); the group chips; "See all {N} open flags ›" → `/flags`; and
     one link per named athlete → `/squad/{id}` (12 measured).
2. Press "Export CSV" or "Export PDF" to download.

**Branches.**

- The export links carry the **current group filter and period** in their query
  string — an export is of what is on screen, not of the whole squad.
  **Verified**: with Forwards selected the hrefs become
  `…/export?groups={id}&to=2026-09-11`, the CSV serves `200 text/csv` as
  `attachment; filename="squad-weekly-2026-09-05-to-2026-09-11.csv"`, and its
  first line reads "# Squad weekly report, 2026-09-05 to 2026-09-11. Scope:
  Forwards (15 athletes) …".
- **The group filter on this screen is a URL parameter, not the cookie.**
  Pressing a chip navigates to `/reports/squad?groups={id}` and writes no
  cookie. The report *reads* the cookie as its default when the URL has no
  `groups` — so a filter set on `/squad` carries into the report — but a filter
  set here does **not** carry back to `/squad`, which shows "Whole squad" again.
  Measured both directions 2026-09-11. The global-controls note above ("persists
  globally … a cookie") is therefore true in one direction from this screen.

---

## STAFF-SS-17 … 22 — The other six reports

Each is its own route with its own export endpoint, reached by URL or from the
reports surface. They share the pattern of STAFF-SS-16: a period control, the
group filter, and CSV/PDF export links carrying the current filter.

**Reports are gated by their own grid, `REPORT_VISIBILITY`, not by
`REPORT_ACCESS` wholesale.** Two of the six are open to all five roles; four are
not.

| ID | Report | Route | Export endpoint | Who can open it |
|---|---|---|---|---|
| STAFF-SS-17 | Athlete report | `/reports/athlete`, `/reports/athlete/{id}` | `/reports/athlete/{id}/export` | `REPORT_ACCESS` — not the nutritionist |
| STAFF-SS-18 | Compliance | `/reports/compliance` | `/reports/compliance/export` | **all five roles** |
| STAFF-SS-19 | Injuries | `/reports/injuries` | `/reports/injuries/export` | **all five roles** — content differs, see below |
| STAFF-SS-20 | Squad | `/reports/squad` | `/reports/squad/export` | `REPORT_ACCESS` — not the nutritionist |
| STAFF-SS-21 | Testing | `/reports/testing` | `/reports/testing/export` | `REPORT_ACCESS` — not the nutritionist |
| STAFF-SS-22 | Training | `/reports/training` | `/reports/training/export` | `REPORT_ACCESS` — not the nutritionist |

**Two gates, in order.** `requireReportAccess()` redirects a role without
`REPORT_ACCESS` to `/settings?e=no-report-access`; `requireReport(key)` then
applies the per-report grid. **Every report page and every one of its
export/pdf handlers goes through the same gate**, so a role admitted to a page
is admitted to its CSV — there is no door round the back.

**Branch worth naming: the injuries report opens for everyone and shows
different things.** `/reports/injuries` admits all five roles, then computes
`isMedical` from `CLINICAL_ONLY` and decides the clinical columns from it. So a
coach and a medic see the *same report* with *different content* — which means a
screenshot of this report cannot be assigned to a role by its heading alone.

**A stale document, flagged in the code itself.** `access.ts` carries an
explicit warning that `docs/access-matrix.md` §3.5 lists Squad weekly as visible
to the nutritionist, and that **the matrix is wrong** — the decision was taken
twice, most recently 2026-09-06, and both times went the other way. Do not widen
`squad` to match the document. This walkthrough follows the code.

**Per-report inventories, extracted 2026-09-11 as a sport scientist at 1280
and 375** (the pass the note above asked for). Every report also has a
**`/pdf` endpoint** (`pdf/route.tsx`, serving `application/pdf` as an
attachment) alongside its `/export` CSV; the table above listed only the CSV.
**All eighteen handlers — six pages, six CSV, six PDF — were checked in source
and each calls `requireReport('{key}')`.** The gate claim holds.

**A pattern shared by five of the six, worth naming once:** the period control
is a `<select>` whose options *explain themselves* — e.g. "Today — readiness is
read against a 14-day band, and one day is one point", "Last 7 days — one week
is too short to read injury burden", "Today — testing is episodic — one day is
one session, which the test page already shows". The label tells the reader
why the narrow choice is rarely the right one, inside the control.

- **STAFF-SS-17, Athlete report.** `/reports/athlete` is a **"Pick an athlete"**
  roster (heading "Pick an athlete", "Squad roster, choose one for their
  report", "n = 30 athletes", the group chips, a numbered list) — not the
  report. `/reports/athlete/{id}` is: the athlete's name as `h1`, an identity
  line ("Flanker · 23 · 2nd XV · squad no. 21 · Forwards"), a compliance
  figure, then sections **Wellness, Load, Gym and testing, Open flags**; the
  period select; "Previous page" / "Next page"; "Export CSV" →
  `/reports/athlete/{id}/export?period=season`, "Export PDF" → `…/pdf?…`. No
  group chips (single athlete). 1,523px desktop, 3,100 phone.
- **STAFF-SS-18, Compliance.** `h1` "Compliance"; a scope line "Whole squad ·
  Ashcombe Rugby Club · This season · Wed 1 Jul to Fri 11 Sept · 30 athletes";
  the period select ("Today — a single day is 'did they submit today', which
  the dashboard answers"); group chips; exports carrying `period` and `to`.
  **Fits one desktop screen** (800px); 1,498 phone. See §0ad for the cutoff
  question this report carries.
- **STAFF-SS-19, Injuries.** `h1` "Injury & availability"; the same scope line
  shape; period select ("Last 7 days — one week is too short to read injury
  burden"); group chips; four athlete links; exports carrying `period`. **No
  "Diagnosis" or "Mechanism" for the sport scientist** — measured absent; the
  clinical columns are the medic's. 1,370 desktop, 3,267 phone.
- **STAFF-SS-20, Squad.** This is `/reports/squad` — see STAFF-SS-16, which
  covers it. Listed here only for the gate table.
- **STAFF-SS-21, Testing.** `h1` "Testing report"; group chips; **"+ Log a
  result"** (a write entry point, unlisted before); "Print"; exports carrying
  `period` **and `test={id}`** — the report is per test definition; period
  select ("Today — testing is episodic…"); section "Personal bests" with one
  table of 30 rows and 30 athlete links. 1,631 desktop, 2,797 phone.
- **STAFF-SS-22, Training.** `h1` "Training report"; a **mode toggle "Training"
  / "Match day"**; a session `<select>` ("Fri 14 Aug · Captain's run", …) and
  an athlete `<select>` ("Whole squad (none selected)", then names); group
  chips; sections **Board, Individual player, Outside their normal range, Heat
  bands, Comparison, Scatter**; exports carrying `mode=training`. No plan gate
  rendered for this account. **The heaviest report at phone width: 4,711px.**
  2,532 desktop.

---

## STAFF-SS-23 — Build a nutrition plan and assign it

**Entry point.** "Nutrition" in the sidebar → `/nutrition`.
**Gate:** `NUTRITION_EDIT` to write; `MEAL_LIBRARY_EDIT` for the food library.

**Steps.**

1. Heading "Nutrition", with week navigation "‹ Previous week" (a link →
   `/nutrition?week=…`; **"Next week ›" renders only for a past week**), and the
   group filter.
   - Also visible: "Manual target" (`.btn-ghost`, 44px) → `/nutrition/new`;
     "New plan" (`.btn-primary`, 35px); three sections — **"Plans"** (one
     button per plan: "Academy · 5 athletes", "Backs · 14 athletes",
     "Forwards · 15 athletes · 1 override"; **no `aria-pressed` or
     `aria-current`** marks the selected one), **"Day type"** (three buttons:
     "Training day 6.0 g/kg", "Match day 7.5 g/kg", "Rest day 3.5 g/kg", 37px),
     and **"Needs a word"** (a chase list, one button per athlete — "Okonkwo,
     Dan · 0/7 · Weighed in"). The plan panel carries six `−`/`+` steppers at
     32px. **3,520px at desktop, 6,099px at phone** — the longest staff screen
     after the leaderboard wall.
2. Press "New plan" — a create panel toggles open.
3. Press "Create" (disabled until valid).
4. On a plan: "Duplicate" (`.btn-ghost`), "Food library" (`.btn-ghost`), and
   "Assign" (`.btn-primary`, label "Assigning…" while in flight).

**Branches.**

- IF the role lacks `NUTRITION_EDIT` THEN the write controls are absent.
- IF the role lacks `MEAL_LIBRARY_EDIT` THEN "Food library" is absent.
- "New plan" and "Food library" are **toggles**, not navigations — pressing
  "Food library" also closes the meal form.

---

## STAFF-SS-24 — Author a gym programme

**Entry point.** "Gym programme" in the sidebar → `/programmes`.
**Gate:** `PROGRAMME_EDIT`, `PROGRAMME_AUTHOR` or `REHAB_PROGRAMME` to write.

**Steps.**

1. Heading "Gym programme", with the selected programme's name as a second heading.
   - Also visible: "+ New programme" (`.btn-primary`, 50px, rendered **once** —
     an earlier version said twice) → `/programmes/new`; "Exercise library"
     (`.btn-ghost`, 44px) → `/programmes/exercises`; a list of programmes
     (measured: "In-Season max", "Return to running" — a rehab programme —
     "Pre-season strength"); and a detail link whose **label depends on
     permission**. Fits one desktop screen (800px); 1,662 at phone.
2. Press the detail link.

**Detail link states.**

| Label | When |
|---|---|
| "Edit this programme →" | The role may edit this programme. |
| "View full detail →" | It may not. |

**Branches.**

- IF the programme is a **rehab** programme THEN `REHAB_PROGRAMME` decides
  (sport scientist, medic) rather than `PROGRAMME_EDIT` (sport scientist, S&C).
- IF the role is S&C THEN it may additionally **propose** an injury programme
  (`INJURY_PROGRAMME_PROPOSER`) — a power no other role has, including the sport
  scientist.
- `/programmes/{id}/athlete/{athleteId}` shows "Read only for your role." when
  the role cannot edit.

---

## STAFF-SS-25 — Explore the leaderboard wall

**Entry point.** "Leaderboard" in the sidebar → `/leaderboards`.

**Steps.**

1. Heading "Leaderboard".
   - Also visible: "Manage published boards →" (`.btn-ghost`, 44px) →
     `/leaderboards/manage`; the group chips; a **lens selector** — "Result",
     "Improvement", "Standard", each a `<button role="tab">` at 31px **with no
     enclosing `tablist` and no `aria-selected`**; a **scope** chip row —
     "Positional unit" (pressed), "Age band"; a **family** chip row with
     counts — "Speed & power 4" (pressed), "Endurance 2", "Strength 1",
     "GPS 14", "Habits 2" — disabled when the count is zero (none was, on
     scratch, so the branch was not observed); and "Profile ›" → `/squad/{id}`
     for the selected athlete. **3,840px at desktop, 6,592px at phone — the
     longest staff screen.**

**Branches.**

- IF a family has no entries THEN its chip renders **disabled** with a count of 0
  rather than being hidden — an unexplained absence is worse than a greyed
  option.
- IF the role lacks `LEADERBOARD_EDIT` THEN publishing controls are absent;
  the wall itself is readable by all staff.

---

## STAFF-SS-26 — Publish and manage leaderboards

**Entry point.** "Manage published boards →" → `/leaderboards/manage`;
"+ New leaderboard" → `/leaderboards/new`.

**Gates, corrected 2026-09-11 from the `require*` calls rather than the in-page
`hasAnyRole` reads** (the same method error §SS-28 records):

| Route | Gate | Who |
|---|---|---|
| `/leaderboards/manage` | `requireStaff()` only | every staff role |
| `/leaderboards/new` | `LEADERBOARD_EDIT`, else **redirect to `/leaderboards/manage`** | sport scientist, coach, S&C |
| `/leaderboards/{id}` | `requireStaff()` only | every staff role |

An earlier version said `/leaderboards/{id}` "checks both `LEADERBOARD_EDIT`
and `CLINICAL_ONLY`, and refuses otherwise". It refuses nobody: the page is
open to every staff role, and the two constants decide what renders —
`canManage` (`LEADERBOARD_EDIT`) shows the board actions, `isMedical`
(`CLINICAL_ONLY`) shapes the content.

**Steps, measured 2026-09-11 as a sport scientist.**

1. `/leaderboards/manage`: one `.card` link per board — "Total session load ·
   Whole squad · all time · Published" — and "+ New leaderboard"
   (`.btn-primary`). The intro links back to "the testing wall"
   (`/leaderboards`) for internal-only results, and states the three rules:
   wellness and body composition never rank; a board renders only once at least
   three athletes qualify; under-18s appear only if they opt in themselves.
2. `/leaderboards/new` is one form in six numbered steps, every choice a
   `squad-chip` with `aria-pressed`:
   - **1. Metric** — the eligible metrics (eleven on the Premium preview:
     Accelerations … Total session load), then a second row of the
     **ineligible** ones rendered `disabled` (Body mass, Readiness score,
     Sleep, Soreness) under the note "Not every metric can be ranked. Wellness
     and body composition never can, and some depend on your plan. Tap one
     below to see why."
   - **2. Aggregation** — Total / Mean / Best in window.
   - **3. Population** — Whole squad / One group.
   - **4. Window** — Last 28 days / This season (pressed) / All time.
   - **5. Visibility** — Staff only (pressed) / Published to athletes.
   - **6. Name** — one text input; then "Save" (`.btn-primary`).
3. `/leaderboards/{id}`: the board's name as the heading; "Download CSV" and
   "Print PDF" (a server-rendered PDF at `/leaderboards/{id}/pdf`, **not**
   `window.print()`); the summary line ("Published to athletes · Whole squad ·
   All time · Ranking Total session load, total."); a **Board actions** group
   with "Unpublish" and "Delete board" for `LEADERBOARD_EDIT`; the group filter
   chips; then the ranking (#, Athlete, Unit, Relative to leader) with
   "n = 27 athletes".

**Branches.**

- IF a disabled metric is tapped THEN, by the copy, its reason appears. **It
  does not**: a `disabled` button never fires `click`, so the `onClick` that
  would show the reason is unreachable (to-do §0ap).
- IF the role lacks `LEADERBOARD_EDIT` THEN `/new` redirects to `/manage` and
  the board page renders without "Board actions".

---

## STAFF-SS-27 — Analytics

**Entry point.** "Analytics" in the sidebar → `/analytics`. **The only
role-gated sidebar row.**
**Gate:** `ANALYTICS` — sport scientist alone.

**Steps, measured 2026-09-11.**

1. `/analytics` opens on **four fixed boards** — "Training load", "Wellness",
   "Gym volume", "Acute:chronic ratio" — each a `<select>` pair, **Metric**
   (ACWR, Readiness, Total distance, Volume load, Training load, Session RPE,
   Sleep, Sleep quality, Fatigue, Soreness, Stress, Mood, Resting HR) and
   **Window** (28 days, 8 weeks, 12 weeks, 26 weeks), one named athlete
   (default: the first alphabetically, "Aholelei, Sione · Loosehead prop")
   drawn against the population ("n = 30 · whole squad"), and a "Compare two"
   chip (`?compare=1`) that adds a second athlete under "Compare against".
   The group filter chips narrow the population.
2. `/analytics/build` ("Build a view") still exists — Metric, Athlete
   ("Everyone in scope (30)" or one), Timeline (Today … ), Show as (Trend over
   time / Bar, by athlete / …) — **but nothing links to it.** The page header
   says so: the four-board design "has no builder and no link to one, so this
   page has neither." It is reachable by URL only.

**Branches.**

- IF any other role navigates to `/analytics` directly THEN it redirects to
  `/dashboard?e=no-analytics`. They never see the row.

---

## STAFF-SS-28 — Injuries

**Entry point.** No sidebar row. Reached from the athlete profile, from
`/reports/injuries`, and by URL.

**CORRECTED 2026-09-10, and the correction matters.** An earlier version of this
section said `/injuries` was `CLINICAL_ONLY` and that the sport scientist could
not open it. That was wrong, and so was the same claim in the coach and S&C
sections. **Every `/injuries/*` route is gated by `requireInjuryAccess()` →
`INJURY_ACCESS`.**

| Route | Gate | Who |
|---|---|---|
| `/injuries` | `requireInjuryAccess` | sport scientist, coach, medic, S&C |
| `/injuries/{injuryId}` | `requireInjuryAccess` | same |
| `/injuries/new` | `requireInjuryAccess` | same |
| `/injuries/rehab-groups` | `requireInjuryAccess` | same |
| `/injuries/team-allocation` | `requireInjuryAccess` | same |

**Only the nutritionist is shut out**, and a role without it is redirected to
`/?e=no-injury-access`.

**What IS `CLINICAL_ONLY` is the content, not the door.** `/injuries` computes
`isMedical` from `CLINICAL_ONLY` and decides what renders from it. **Observed
side by side on 2026-09-10**, rather than inferred:

| | Coach | Medic |
|---|---|---|
| The injury list | body area, side, since-date, expected return, availability status ("Modified", "Unavailable") | the same |
| "+ Injury" | **absent** | **present** |
| "PROBLEM REPORTS" section | **absent** | **present** — athletes' own words and the medic's clinical notes |
| Rendered page length | ~815 characters | ~1,778 characters |

So the difference is **structural, not a hidden column**: the medic gets a whole
section the coach does not, plus the ability to create an injury. A screenshot
showing "PROBLEM REPORTS" or "+ Injury" is a medic's; one showing only the
injury list is not.

**The sport scientist sees the coach column** (measured 2026-09-11): "Print",
"Team allocation →" and "Rehab groups →" (both `.tiny` links), the group
filter chips, and six `.load-row` links — name, body area, side, since-date —
and nothing else. No "+ Injury", no "PROBLEM REPORTS".

An earlier draft of this table guessed "clinical columns". That was wrong in
detail — worth recording, because the guess sounded right and only looking
settled it. The team-allocation screen states the asymmetry
itself: "**Read only.** Medical sees the whole board and every availability
status…"

**How the error happened, recorded because the method produced it twice.** The
gate map was built by grepping each page for `hasAnyRole(claims.roles, X)`. On
`/injuries` that matched line 46 — the `isMedical` computation — rather than the
`requireInjuryAccess()` call that actually guards the route. The same mistake
put `CLINICAL_ONLY` on `/reports/injuries` in the first draft. Reading the
`require*` helper is the reliable method; the in-page `hasAnyRole` calls decide
what renders, not who gets in.

---

## STAFF-SS-29 — Settings hub

**Entry point.** "Settings" in the sidebar → `/settings`.

**Steps.**

1. Sections in order (measured 2026-09-11; an earlier list had six in a
   different order and missed two): **Plan**, **Integrations**, **Profile**,
   **Photo**, **Edit profile**, **Club details**, **Password and sign-in**,
   **Two-factor authentication**. A Light/Dark appearance segment sits above
   "Plan".
   - "Plan" carries the Basic/Premium **preview** switch (`PlanPreviewSwitch`,
     a cookie — "Your club's real plan does not change") and the feature list
     each plan turns on.
   - "Integrations" rows: Catapult Openfield "Connected" and Vendor CSV import
     "Open" (both → `/settings/imports`), Apple Health "Not connectable yet —
     needs the Fydr phone app". "Locked" replaces "Open" off the premium plan.
   - "Profile" is read-only (Name, Club, Role, Timezone); "Edit profile" is the
     editable pair — Name, Phone, "Save" — with "Club, role and timezone are set
     by the club and aren't editable here."
   - "Photo" and "Password and sign-in" are the same components the athlete app
     uses (`AvatarUploadForm` with its eleven initials colours, Default … Plum;
     `ChangePasswordForm`) — see ATH-ADULT-22/23/24 in the athlete document.
   - "Club details": a "Logo" row ("Upload" with no logo set; "Replace" and
     "Remove" once one is), Club name, Sport (`<select>`, nine sports), Timezone,
     Country code, and "Save" ("Saving…" in flight).
   - "Two-factor authentication": status ("Not enrolled" / "On"), "Set up
     two-factor authentication", and for coach, medical and admin roles a
     warn-toned banner "Your role requires two-factor authentication…". The
     requirement is **prompted, not enforced** — recorded in
     `09-security-and-compliance.md` (RLS `aal` follow-up, O-323).
2. Below the sections, a settings list (`.set-list-row`): Thresholds, Password
   and two-factor (`#password`, in-page), Exports, Groups, GPS imports,
   Notifications, Users, Subject access requests, Data retention, Audit log —
   each gated as SS-30 lists, and the Exports and GPS-imports rows hidden from
   roles without `REPORT_ACCESS` / `GPS_IMPORT` — then **Log out** ("Ends this
   session on this browser only"), a `<form>` whose only control is a 5px-wide
   "›" submit button (to-do §0ap).

**Branches.**

- IF the role lacks `SETTINGS_ADMIN` THEN the administrative sections are absent;
  every staff member still reaches their own profile, photo and password.
- IF the club is not on the premium plan THEN the integrations row reads
  "Locked" rather than "Open".

---

## STAFF-SS-30 — Settings sub-screens

Each is its own route with its own gate.

| ID | Screen | Route | Gate |
|---|---|---|---|
| STAFF-SS-30a | Audit log | `/settings/audit` | `SETTINGS_ADMIN` |
| STAFF-SS-30b | Exports | `/settings/exports` | `requireReportAccess()` → `REPORT_ACCESS` — sport scientist, coach, medic, S&C |
| STAFF-SS-30c | Groups | `/settings/groups`, `/new`, `/{id}` | the list is `requireStaff()` — open to every staff role; `/new` redirects to the list without `GROUP_EDIT`; `GROUP_EDIT` shows "+ New group" and the reorder arrows, `SESSION_EDIT` shows "Open team allocation →" |
| STAFF-SS-30d | Imports (GPS) | `/settings/imports` | `GPS_IMPORT` — sport scientist alone |
| STAFF-SS-30e | Notifications | `/settings/notifications` | — |
| STAFF-SS-30f | Retention | `/settings/retention` | `SETTINGS_ADMIN` |
| STAFF-SS-30g | Subject access | `/settings/subject-access`, `/{id}/review` | the list is `requireSubjectAccess()` — `SETTINGS_ADMIN` **or** `CLINICAL_ONLY`; the review is `CLINICAL_ONLY` alone (else `?e=no-sar-access`) |
| STAFF-SS-30h | Thresholds | `/settings/thresholds`, `/new` | `THRESHOLD_EDIT` — refused **in page**, not by redirect |
| STAFF-SS-30i | Users | `/settings/users`, `/{id}`, `/bulk-invite` | `SETTINGS_ADMIN` |

**Branch worth naming.** A subject-access **request** is administered by the
sport scientist, but its **review** is `CLINICAL_ONLY` — the medic. Neither role
can complete the flow alone.

---

## STAFF-SS-31 — Filter the audit log

**Entry point.** `/settings/audit`.
**Gate:** `SETTINGS_ADMIN`.

**Steps.**

1. Press a type chip — "All", or one per **entity type present in this club's
   log** (`fetchEntityTypes` reads the distinct values, so the row differs per
   club; underscores rendered as spaces). On scratch on 2026-09-11: athletes,
   availability, injuries, injury clinical, organisation, report, sar request,
   session attendance, sign in, team allocations, user, user roles. **No
   session or schedule type** — sessions are not audited (to-do §0al), so no
   chip can exist for them.
2. Set the filters — From / To (`<input type="date">`, defaulting to the last
   30 days), Staff member and Athlete (`<select>`), Search (`<input>`) — and
   press "Apply filters" (`.btn-primary`).
   - Also visible: "Show all time" (`.btn-ghost`), "Clear filters"
     (`.btn-ghost`), and pagination — "Next →" on page 1, "← Previous" once
     past it. There are **no quick-range chips** here; those are on Exports.

**End state.** Stays on `/settings/audit` with the filter in the query string.

---

## STAFF-SS-32 — Generate an export

**Entry point.** `/settings/exports`.

**Steps** ("Pick what, pick who, pick when" is the hub row's own summary).

1. **What:** six domain checkboxes, all on by default — Wellness entries,
   Training RPE entries, Gym session and set logs, Test results, Body
   composition, Nutrition check-ins.
2. **Who:** the group filter chips; the heading reads the scope back ("Whole
   squad · 30 athletes in scope").
3. **When:** From / To (`<input type="date">`), or a quick range chip — Last 7
   / 30 / 90 days.
4. Press "Generate" — label becomes "Generating…" while in flight; one CSV per
   domain, "straight to your downloads — no queue to check back on".

**Copy, flagged.** The intro reads "**Coach** access: every domain below,
squad-wide." for every non-medic role, the sport scientist included (to-do
§0ap).

---

## STAFF-SS-33 — Print a screen

**Entry point.** The "Print" button (`PrintButton`, `.btn-ghost.no-print`),
present on the dashboard, `/injuries`, `/reports/testing` and the testing
detail screen. The leaderboard board's "Print PDF" is **not** this control —
it is a server-rendered PDF route (SS-26).

**Steps.**

1. Press "Print" — calls `window.print()`. No confirmation, no state change.

**Note.** `base.css`'s `@media print` block hides the sidebar, every `button`,
`.btn-primary`/`.btn-ghost` link and **every `<form>`**, strips shadows, sets
`.injuries-board` rows to 9pt, and a 12mm page margin — so the printed output
is not the screen verbatim.

---

# Section B — Coach

Holds `SESSION_EDIT`, `THRESHOLD_EDIT`, `GROUP_EDIT`, `AVAILABILITY_EDIT`,
`ATHLETE_BIO_EDIT`, `ENTRY_CORRECTION`, `LEADERBOARD_EDIT`, `MEAL_LIBRARY_EDIT`,
`INJURY_ACCESS`, `REPORT_ACCESS`, `FLAG_EDIT_ANY_DOMAIN`, `ATHLETE_GYM`.

**Sidebar:** eight rows — everything except "Analytics".

## Identical to the sport scientist

**Verified 2026-09-12 for 01, 02, 05 and 07** by fingerprinting each route for
a coach (Mark Iremonger) and the sport scientist at 1280 and 375 — headings,
controls, every leaf node, page height — and diffing. Identical except:
"Add athlete" absent on `/squad` (02); the SAR section and three role-disabled
Body-weight controls on the profile (05, see 05a). The phone shell differs only
by the More sheet's missing "Analytics" row.

| ID | Flow | Entry point |
|---|---|---|
| STAFF-COACH-01 | Read the dashboard | sidebar "Dashboard" |
| STAFF-COACH-02 | Browse the squad and filter by group | sidebar "Squad overview" |
| STAFF-COACH-05 | Open an athlete's profile | athlete name on `/squad` |
| STAFF-COACH-07 | Read the week's schedule | sidebar "Schedule" |
| STAFF-COACH-08 | Create a session | "+ Session" |
| STAFF-COACH-09 | Create a fixture | "+ Fixture" |
| STAFF-COACH-10 | Edit a session in the grid | click a block in Edit mode |
| STAFF-COACH-11 | Remove a session, and restore it | "Remove session" |
| STAFF-COACH-12 | Use the edit-mode toolbar | `/schedule` Edit mode |
| STAFF-COACH-13 | Publish the week to athletes | banner |
| STAFF-COACH-14 | Discard every pending change | banner "Discard" |
| STAFF-COACH-15 | Manage week templates | "Week templates" |
| STAFF-COACH-16 | Squad report and export | sidebar "Reports" |
| STAFF-COACH-17/18/20/21/22 | Athlete, compliance, squad, testing, training reports | by route |
| STAFF-COACH-25 | Explore the leaderboard wall | sidebar "Leaderboard" |
| STAFF-COACH-26 | Publish and manage leaderboards | "Manage published boards →" |
| STAFF-COACH-29 | Settings hub — own profile, photo, password only | sidebar "Settings" |
| STAFF-COACH-30c | Groups | `/settings/groups` |
| STAFF-COACH-30h | Thresholds | `/settings/thresholds` |
| STAFF-COACH-33 | Print a screen | "Print" |

## Differs

### STAFF-COACH-05a — Athlete profile: no clinical detail

Identical to STAFF-SS-05 except the coach **cannot** read diagnosis or
mechanism (`CLINICAL_ONLY`). They see availability status, restrictions and
expected return; not what is wrong. This is the injury boundary and it is
enforced in the database, not the page.

**Measured 2026-09-12 as Mark Iremonger on James Barnes's profile (injured),
both widths.** The Injury section reads status · body area · restrictions ·
expected return and nothing clinical; `/injuries/{id}` opens with an `i`
banner "This is what coaching staff see. Diagnosis, clinical notes and
treatment plan are medical only and are not shown here, by design." Also
absent for the coach: the **Subject access request** section and its
"Generate subject access pack →". Present but **disabled** (`disabled` +
`aria-disabled`, reason in a `title`): the Body weight section's "+ Log
weigh-in", "Set target range" and "Edit entries" — weigh-ins are
`WEIGH_IN_EDIT` (sport scientist, medic, S&C, nutritionist), the target range
`NUTRITION_EDIT`. Present and live: "+ Log injury" → `/injuries/new` — the
coach may create an injury record (§3.2 "New injury VC VC VC VC X",
`injuries_staff_insert`), although the `/injuries` board hides its "+ Injury"
from the same role.

### STAFF-COACH-23 — Nutrition: meal library only

`/nutrition` opens, but the coach holds `MEAL_LIBRARY_EDIT` and **not**
`NUTRITION_EDIT`. "Food library" is present; "New plan", "Create" and "Assign"
are absent.

### STAFF-COACH-28 — Injuries: the board opens, the diagnosis does not

**Corrected 2026-09-10.** This said `/injuries` and `/injuries/{id}` were closed
to a coach. They are not: `INJURY_ACCESS` includes the coach, so the board,
the detail pages, rehab groups and team allocation all open. What a coach does
not get is the **clinical content** inside them — diagnosis and mechanism are
withheld by `CLINICAL_ONLY`, the same way they are on the athlete profile.

## Cannot reach at all

- `/analytics` — `ANALYTICS`; redirects to `/dashboard?e=no-analytics`.
  `/analytics/build` **opens** and renders an in-page refusal ("Not part of
  this role") with no data — measured 2026-09-12.
- `/settings/audit`, `/settings/retention`, `/settings/users*`,
  `/settings/subject-access`, `/squad/new`, `/squad` administration —
  `SETTINGS_ADMIN`. Measured 2026-09-12: the settings routes land on a bare
  `/settings` with no message, except `/settings/subject-access`, which
  carries `?e=no-sar-access`; `/squad/new` lands on `/squad` silently. **`/injuries` and `/reports/injuries` are NOT on this list:
  both open for a coach, with clinical content withheld.**
- `/settings/imports` — `GPS_IMPORT`.
- `/programmes` authoring — `PROGRAMME_EDIT` / `PROGRAMME_AUTHOR` /
  `REHAB_PROGRAMME`. The coach can view a programme; the detail link reads "View
  full detail →" rather than "Edit this programme →".

---

# Section C — Medic

Holds `CLINICAL_ONLY` **alone**, plus `REHAB_PROGRAMME`, `PROGRAMME_AUTHOR`,
`AVAILABILITY_EDIT`, `ATHLETE_BIO_EDIT`, `ENTRY_CORRECTION`, `REHAB_ALLOCATION`,
`INJURY_ACCESS`, `REPORT_ACCESS`, `FLAG_EDIT_ANY_DOMAIN`, `ATHLETE_GYM`,
`WEIGH_IN_EDIT`.

**Sidebar:** eight rows — everything except "Analytics".

## Identical to the sport scientist

| ID | Flow | Entry point |
|---|---|---|
| STAFF-MEDIC-01 | Read the dashboard | sidebar "Dashboard" |
| STAFF-MEDIC-02 | Browse the squad | sidebar "Squad overview" |
| STAFF-MEDIC-16/17/18/20/21/22 | Reports and exports | sidebar "Reports" |
| STAFF-MEDIC-25 | Explore the leaderboard wall | sidebar "Leaderboard" |
| STAFF-MEDIC-29 | Settings hub — own profile only | sidebar "Settings" |
| STAFF-MEDIC-33 | Print a screen | "Print" |

## Differs

### STAFF-MEDIC-05 — Athlete profile: the only role that sees clinical detail

Identical to STAFF-SS-05, **plus** diagnosis and mechanism. The medic is the
only staff role that reads them — the sport scientist does not.

### STAFF-MEDIC-19 — The injuries report

**Corrected 2026-09-10.** This said `/reports/injuries` was `CLINICAL_ONLY` and
that the medic was the only role able to open it. Wrong on both counts:
`REPORT_VISIBILITY.injuries` admits **all five roles**. What the medic uniquely
gets is the **clinical content**, decided inside the page by `isMedical`. So a
coach and a medic open the same report and see different things.

### STAFF-MEDIC-28 — The injury board

**Corrected 2026-09-10.** This said `/injuries` and `/injuries/{injuryId}` were
`CLINICAL_ONLY`. Every `/injuries/*` route is gated by `requireInjuryAccess()`
→ `INJURY_ACCESS`, which admits the sport scientist, coach, medic and S&C; only
the nutritionist is shut out. `/injuries/rehab-groups` additionally reads
`REHAB_ALLOCATION` for what it offers.

**What the medic actually gets that the others do not**, observed side by side
rather than inferred: a **"PROBLEM REPORTS"** section carrying athletes' own
words and the medic's notes, and a **"+ Injury"** control. Measured page
lengths: coach and S&C ~815 characters, medic ~1,778. See STAFF-SS-28 for the
full table.

### STAFF-MEDIC-24 — Rehab programmes

The medic holds `REHAB_PROGRAMME`, so may author a **rehab** programme, and
`PROGRAMME_AUTHOR`, so may author generally — but **not** `PROGRAMME_EDIT`, so a
standard gym programme owned by S&C is read-only to them. The detail link's
label is the tell.

### STAFF-MEDIC-30g — Review a subject-access request

`/settings/subject-access/{requestId}/review` is `CLINICAL_ONLY`. The medic
reviews; the sport scientist administers. **Neither can complete the flow alone.**

## Cannot reach at all

- `/analytics` — `ANALYTICS`.
- `/schedule` **editing**, `/schedule/new`, `/schedule/fixtures/*`,
  `/schedule/planner/*`, `/timetable` — `SESSION_EDIT`. G-33 took scheduling off
  this role; RLS enforces it, and the schedule screen renders the read-only line.
  **`/injuries/team-allocation` is NOT on this list** — corrected 2026-09-10: it
  is `requireInjuryAccess`, which the medic holds, not `SESSION_EDIT`.
- `/settings/groups`, `/settings/thresholds` — `GROUP_EDIT` / `THRESHOLD_EDIT`.
- `/settings/audit`, `/settings/retention`, `/settings/users*`, `/squad/new` —
  `SETTINGS_ADMIN`.
- `/settings/imports` — `GPS_IMPORT`.
- Leaderboard publishing — `LEADERBOARD_EDIT`.
- Nutrition plan authoring — `NUTRITION_EDIT`; and the **meal library**, which
  needs `MEAL_LIBRARY_EDIT` the medic does not hold.

---

# Section D — Strength and conditioning

Holds `PROGRAMME_EDIT`, `PROGRAMME_AUTHOR`, `INJURY_PROGRAMME_PROPOSER`
**alone**, `LEADERBOARD_EDIT`, `INJURY_ACCESS`, `REHAB_ALLOCATION`,
`REPORT_ACCESS`, `FLAG_EDIT_ANY_DOMAIN`, `ATHLETE_GYM`, `WEIGH_IN_EDIT`.

**Sidebar:** eight rows — everything except "Analytics".

## Identical to the sport scientist

| ID | Flow | Entry point |
|---|---|---|
| STAFF-SC-01 | Read the dashboard | sidebar "Dashboard" |
| STAFF-SC-02 | Browse the squad | sidebar "Squad overview" |
| STAFF-SC-16/17/18/20/21/22 | Reports and exports | sidebar "Reports" |
| STAFF-SC-24 | Author a gym programme | sidebar "Gym programme" |
| STAFF-SC-25 | Explore the leaderboard wall | sidebar "Leaderboard" |
| STAFF-SC-26 | Publish and manage leaderboards | "Manage published boards →" |
| STAFF-SC-29 | Settings hub — own profile only | sidebar "Settings" |
| STAFF-SC-33 | Print a screen | "Print" |

## Differs

### STAFF-SC-24a — Propose an injury programme

`INJURY_PROGRAMME_PROPOSER` belongs to **S&C alone** — not to the sport
scientist, not to the medic. This is the one power the superset role does not
hold. It appears on `/programmes/{programmeId}`.

### STAFF-SC-05 — Athlete profile: gym and weigh-ins, no clinical detail, no bio edit

Sees the gym panel (`ATHLETE_GYM`) and may record a weigh-in (`WEIGH_IN_EDIT`),
but holds neither `ATHLETE_BIO_EDIT`, `AVAILABILITY_EDIT` nor `ENTRY_CORRECTION`
— so bio, availability and entry corrections are all read-only, and diagnosis
and mechanism are withheld.

## Cannot reach at all

- `/analytics` — `ANALYTICS`.
- All scheduling — `SESSION_EDIT`. **`/injuries` and `/reports/injuries` are NOT
  closed to S&C: `INJURY_ACCESS` includes this role, with clinical content
  withheld.**
- `/settings/groups`, `/settings/thresholds`, `/settings/audit`,
  `/settings/retention`, `/settings/users*`, `/settings/imports`, `/squad/new`.
- Nutrition authoring and the meal library.

---

# Section E — Nutritionist

The most restricted role. Holds only `NUTRITION_EDIT`, `MEAL_LIBRARY_EDIT`,
`WEIGH_IN_EDIT` and `ALL_STAFF`.

**Sidebar:** eight rows — everything except "Analytics". **The nutritionist sees
almost the whole nav and can act on almost none of it.** This is the widest gap
in the app between what a role can navigate to and what it can do, and it is the
most likely source of a "why is this button missing" question.

## Identical to the sport scientist

| ID | Flow | Entry point |
|---|---|---|
| STAFF-NUT-01 | Read the dashboard | sidebar "Dashboard" |
| STAFF-NUT-02 | Browse the squad | sidebar "Squad overview" |
| STAFF-NUT-23 | Build a nutrition plan and assign it | sidebar "Nutrition" |
| STAFF-NUT-29 | Settings hub — own profile only | sidebar "Settings" |
| STAFF-NUT-33 | Print a screen | "Print" |

## Differs

### STAFF-NUT-05 — Athlete profile: weigh-ins only

May record a weigh-in (`WEIGH_IN_EDIT`). Everything else on the profile is
read-only: no bio edit, no availability, no entry correction, no injury access,
**and no gym panel** — `ATHLETE_GYM` excludes this role, the only one it excludes.

### STAFF-NUT-07 — Schedule: read-only, and it says so

`/schedule` opens with no segmented control and the line "Read only. The schedule
is authored by the sport scientist and the coach."

## Cannot reach at all

- `/analytics` — `ANALYTICS`.
- **Four of the six reports** — athlete, squad, testing and training all need
  `REPORT_ACCESS`, which excludes this role; `requireReportAccess()` redirects to
  `/settings?e=no-report-access`. **Compliance and injuries do open**, and the
  injuries report renders without its clinical columns. Squad weekly being closed
  to this role is deliberate and re-decided twice — see STAFF-SS-17…22.
- All scheduling, all injuries, all programme authoring, all leaderboard
  publishing, all settings administration, GPS imports.

**Resolved rather than left open.** The "Reports" row renders for this role and
is not a dead end: `/reports` itself takes any staff and computes, per report,
whether this role may open it. Compliance and injuries do; athlete, squad,
testing and training redirect to `/settings?e=no-report-access`. So a
nutritionist pressing "Reports" lands somewhere real, and only meets the redirect
on four of the six.

---

# Open questions and things not verified

Listed rather than guessed, per the brief.

1. **Per-report control inventories** (STAFF-SS-17…22) were not individually
   extracted. The list of reports and their exports is complete; the step-level
   controls inside each are not.
2. **The athlete profile's panels** (STAFF-SS-05) — this screen checks seven
   permission sets and each panel carries its own flow. The panel-level control
   inventory is not exhaustive here.
3. **`/analytics` and `/analytics/build`** — control inventory not extracted.
4. **`/leaderboards/manage` and `/leaderboards/new`** — control inventory not
   extracted.
5. **`/flags`, `/compliance`, `/testing`, `/timetable`** — these have routes and
   are reachable, but were not walked in this pass. `/flags` has **no sidebar
   row** and is reached only from dashboard and report links.
6. **`/platform/sign-in-probes`** — an internal route with no sidebar entry. Its
   gate and audience were not established; it may not be a customer-facing
   surface at all.
7. **Destructive settings actions** — `/settings/retention/run` and
   `/settings/subject-access/{id}/release` are POST endpoints with real
   consequences. Their confirmation flows were not walked.
8. **`ALL_STAFF` does not include an "admin" role** because none exists. If a
   screenshot shows an admin-labelled role, it is not from this build.
