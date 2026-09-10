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
  group (each carrying "✓" when active), and a "Clear filter" link. The
  selection persists globally across screens; it is a cookie, not per-screen state.

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
   - Also visible: "Add athlete" (`.btn-primary`) → `/squad/new`; "Manage
     groups" (`.btn-ghost`) → `/settings/groups`; the group filter chips;
     "Clear filter"; and one link per athlete carrying their name.
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
| "Date of birth" | `id="dob"`, `type="date"` | see branches |
| "Position" | `id="position"`, a select | |
| "Squad number" | `id="squad-number"`, `type="number"` | |
| "Email (optional)" | `id="email"`, `type="email"` | no |

   - Also visible: "Save" and "Cancel".
2. Press "Save" — label becomes "Saving…" while in flight; the button is
   disabled during it.

**Branches.**

- IF "Cancel" is pressed THEN navigate to `/squad`; nothing is written.
- IF date of birth is left empty THEN the athlete is treated as a **minor** by
  every age gate in the athlete app. This is not warned about on this form.
- IF an email is supplied THEN an account and invite link are created; see
  STAFF-SS-04.

**End state.** A confirmation screen with "Back to the squad" (`.btn-primary`).

---

## STAFF-SS-04 — Invite a person and hand over their link

**Entry point.** `/settings/users` → the invite form. Also the email field on
`/squad/new`.
**Gate:** `SETTINGS_ADMIN`.

**Steps.**

1. Fill the invite form. Its intro reads: "Creates a real account and tries to
   send an invite email; no SMS. If it can't be sent, you'll get an invite link
   to pass on yourself instead."
2. Submit.

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

1. The profile opens with the athlete's name as heading, and panels for bio,
   availability, injuries, wellness, gym, nutrition and weigh-ins.
   - Sub-routes reachable from here: `/squad/{id}/wellness`, `/squad/{id}/gym`,
     `/squad/{id}/nutrition`.

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
- Nutrition is **read-only here and says so**.

**End state.** Stays on `/squad/{athleteId}`.

**Flagged as needing its own pass.** This screen is the densest in the app and
its panels each carry their own flows (availability, injury, weigh-in, entry
correction). They are listed as STAFF-SS-06 … 09 below, but the panel-level
control inventory was not exhaustively extracted in this pass and should be
before a screenshot is matched to a specific panel state.

---

## STAFF-SS-06 — Mark a test result as an athlete's best

**Entry point.** "Reports" → "Testing" → a test definition → an athlete, i.e.
`/testing/{testDefId}/{athleteId}`.

**Steps.**

1. Under the "Bests" section, press "Mark best" (`.btn-ghost`) on a result row.
2. A confirm control appears: "Mark as best" (`.btn-primary`), label "Saving…"
   while in flight.
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
   - Also visible: "Back"; the group chips; the view tabs "Week plan" (current)
     and "Today" → `/timetable`; week navigation "‹" (`aria-label="Previous
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

2. Choose a session type from a chip row (one chip per type).
3. Choose groups from a chip row (one chip per group).
4. Press "Create session".

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
   "Away", "Neutral", each `aria-pressed`.
4. Optionally fill "Venue" (`id="f-venue"`, placeholder "Ashcombe Park") and
   "Competition" (`id="f-competition"`, placeholder "League").
5. Choose "Importance" — four chips: "Friendly", "Normal", "Key", "Cup final".
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
2. Adjust with the four steppers: "Earlier", "Later", "Shorter", "Longer".
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
  not offered.

**End state.** Changes are held locally. Nothing reaches athletes until Publish.

---

## STAFF-SS-11 — Remove a session, and restore it

**Entry point.** "Remove session" in the selected-session panel.

**Steps.**

1. Press "Remove session".
2. A confirmation replaces the actions: "Remove this session? You can undo with
   Discard, until you publish." with "Yes, remove" (`.sg-btn-remove`) and "Never
   mind" (`.btn-ghost`).
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

---

## STAFF-SS-12 — Use the edit-mode toolbar

**Entry point.** `/schedule` in Edit mode only. Absent in Read mode and absent
entirely without `SESSION_EDIT`.

**Controls, all on one row.**

- "+ Session" — starts a draft **in the grid**, not the `/schedule/new` screen.
- A divider, then the label "Apply template", then one chip per saved template.
- "Save this week as a template" (`.btn-ghost`).

**Branches.**

- IF no templates exist THEN in place of the chips: "No templates yet."

---

## STAFF-SS-13 — Publish the week to athletes

**Entry point.** The status banner at the top of `/schedule`.

**Banner states.**

| Title | When | Actions |
|---|---|---|
| "The athlete app is up to date" | Nothing pending | "Published" — **disabled** |
| "{N} change/changes not yet in the athlete app" | Anything pending | "Discard", "Publish to athletes" |

When pending, a subtitle reads: "Athletes still see the schedule as it was
before these edits. Nothing changes on their phone until you publish."

**Steps.**

1. Press "Publish to athletes" — label becomes "Publishing…" while in flight.

**Branches.**

- IF the write fails THEN a `role="alert"` line beginning "Not published:"
  renders in the banner, and the button returns to enabled.
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
   undone." with "Yes, discard" and "Never mind".
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
   - Per template: "Apply" (`.btn-primary`) → `/schedule/planner/apply?template={id}`
     and "Edit" (`.btn-ghost`) → `/schedule/planner/{id}`.
   - Also visible: "+ New template" (`.btn-primary`) → `/schedule/planner/new`;
     "Schedule" back link.

**Branches.**

- IF the role lacks `SESSION_EDIT` THEN `/schedule/planner/{id}` renders only:
  "Read only. Templates are authored by the sport scientist and the coach."

---

## STAFF-SS-16 — Open the squad report and export it

**Entry point.** "Reports" in the sidebar → `/reports`. This *is* the squad
report, not a menu.
**Gate:** `REPORT_ACCESS` for the report family; the route itself takes any staff.

**Steps.**

1. Heading "Reports", with sections "Needing attention", "Load", "Availability",
   "Wellness", "Gym and testing".
   - Also visible: "Export CSV" → `/reports/squad/export`; "Export PDF" →
     `/reports/squad/pdf`; period navigation "‹" and "›"; the group chips; "See
     all {N} open flags ›" → `/flags`; and one link per named athlete →
     `/squad/{id}`.
2. Press "Export CSV" or "Export PDF" to download.

**Branches.**

- The export links carry the **current group filter and period** in their query
  string — an export is of what is on screen, not of the whole squad.

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

**Flagged.** The per-report control inventories were not individually extracted
in this pass. The table above is derived from the route and endpoint files and
is complete as a *list*; the step-level detail inside each report needs its own
pass before a screenshot is matched to a specific control.

---

## STAFF-SS-23 — Build a nutrition plan and assign it

**Entry point.** "Nutrition" in the sidebar → `/nutrition`.
**Gate:** `NUTRITION_EDIT` to write; `MEAL_LIBRARY_EDIT` for the food library.

**Steps.**

1. Heading "Nutrition", with week navigation "‹ Previous week" and "Next week ›",
   and the group filter.
   - Also visible: "Manual target" (`.btn-ghost`) → `/nutrition/new`; "New plan"
     (`.btn-primary`).
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
   - Also visible: "+ New programme" (`.btn-primary`, rendered twice on the
     screen) → `/programmes/new`; "Exercise library" (`.btn-ghost`) →
     `/programmes/exercises`; and a detail link whose **label depends on
     permission**.
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
   - Also visible: "Manage published boards →" (`.btn-ghost`) →
     `/leaderboards/manage`; the group chips; a lens selector; a scope chip row;
     a family chip row whose chips carry counts and are **disabled when the
     count is zero**; and "Profile ›" → `/squad/{id}` for the selected athlete.

**Branches.**

- IF a family has no entries THEN its chip renders **disabled** with a count of 0
  rather than being hidden — an unexplained absence is worse than a greyed
  option.
- IF the role lacks `LEADERBOARD_EDIT` THEN publishing controls are absent;
  the wall itself is readable by all staff.

---

## STAFF-SS-26 — Publish and manage leaderboards

**Entry point.** "Manage published boards →" → `/leaderboards/manage`; "+ New"
→ `/leaderboards/new`.
**Gate:** `LEADERBOARD_EDIT` — sport scientist, coach, S&C. **Not** medic, **not**
nutritionist.

**Branch worth naming.** `/leaderboards/{id}` checks both `LEADERBOARD_EDIT`
**and** `CLINICAL_ONLY`, and refuses otherwise — so a medic reaches a published
board by a different gate than a coach does.

**Flagged.** The control inventory for the manage and new screens was not
extracted in this pass.

---

## STAFF-SS-27 — Analytics

**Entry point.** "Analytics" in the sidebar → `/analytics`. **The only
role-gated sidebar row.**
**Gate:** `ANALYTICS` — sport scientist alone.

**Steps.**

1. `/analytics` opens; `/analytics/build` is the builder.

**Branches.**

- IF any other role navigates to `/analytics` directly THEN the route refuses.
  They never see the row.

**Flagged.** Control inventory not extracted in this pass.

---

## STAFF-SS-28 — Injuries

**Entry point.** No sidebar row. Reached from the athlete profile, from
`/reports/injuries`, and by URL.
**Gate:** `INJURY_ACCESS` for the board (sport scientist, coach, medic, S&C);
`CLINICAL_ONLY` for detail.

| Route | Gate |
|---|---|
| `/injuries` | `CLINICAL_ONLY` |
| `/injuries/{injuryId}` | `CLINICAL_ONLY`, refuses otherwise |
| `/injuries/new` | — |
| `/injuries/rehab-groups` | `CLINICAL_ONLY`, `REHAB_ALLOCATION` |
| `/injuries/team-allocation` | `SESSION_EDIT` |

**Branch worth naming.** `/injuries` and `/injuries/{id}` are **`CLINICAL_ONLY`**
— the sport scientist cannot open them. `/injuries/team-allocation` is
`SESSION_EDIT`, so the coach can allocate rehab teams while being unable to read
the injuries behind them. The team-allocation screen says so on itself: "**Read
only.** Medical sees the whole board and every availability status…"

---

## STAFF-SS-29 — Settings hub

**Entry point.** "Settings" in the sidebar → `/settings`.

**Steps.**

1. Sections in order: "Plan", "Integrations", "Profile", "Photo", "Password and
   sign-in", "Club details".
   - "Integrations" rows link to `/settings/imports` with a state label:
     "Connected", "Locked", or "Open".
   - "Profile", "Photo" and "Password and sign-in" are the same components the
     athlete app uses (`AvatarUploadForm`, `ChangePasswordForm`) — see
     ATH-ADULT-22/23/24 in the athlete document for their control detail.
   - "Club details" carries a "Logo" row with "Upload"/"Replace" and "Remove",
     and a "Save" button (label "Saving…" in flight).

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
| STAFF-SS-30b | Exports | `/settings/exports` | — |
| STAFF-SS-30c | Groups | `/settings/groups`, `/new`, `/{id}` | `GROUP_EDIT` (+`SESSION_EDIT` on the list) |
| STAFF-SS-30d | Imports (GPS) | `/settings/imports` | `GPS_IMPORT` — sport scientist alone |
| STAFF-SS-30e | Notifications | `/settings/notifications` | — |
| STAFF-SS-30f | Retention | `/settings/retention` | `SETTINGS_ADMIN` |
| STAFF-SS-30g | Subject access | `/settings/subject-access`, `/{id}/review` | `SETTINGS_ADMIN`; review is `CLINICAL_ONLY` |
| STAFF-SS-30h | Thresholds | `/settings/thresholds`, `/new` | `THRESHOLD_EDIT` |
| STAFF-SS-30i | Users | `/settings/users`, `/{id}`, `/bulk-invite` | `SETTINGS_ADMIN` |

**Branch worth naming.** A subject-access **request** is administered by the
sport scientist, but its **review** is `CLINICAL_ONLY` — the medic. Neither role
can complete the flow alone.

---

## STAFF-SS-31 — Filter the audit log

**Entry point.** `/settings/audit`.
**Gate:** `SETTINGS_ADMIN`.

**Steps.**

1. Press a type chip — "All", or one per action type (underscores rendered as
   spaces).
2. Press "Apply filters" (`.btn-primary`).
   - Also visible: "Show all time" (`.btn-ghost`), "Clear filters"
     (`.btn-ghost`), quick-range chips, and pagination "← Previous" / "Next →".

**End state.** Stays on `/settings/audit` with the filter in the query string.

---

## STAFF-SS-32 — Generate an export

**Entry point.** `/settings/exports`.

**Steps.**

1. Choose a quick range chip.
2. Press "Generate" — label becomes "Generating…" while in flight.

---

## STAFF-SS-33 — Print a screen

**Entry point.** The "Print" button, present on the dashboard, the testing
screens and other report surfaces.

**Steps.**

1. Press "Print" — calls `window.print()`. No confirmation, no state change.

**Note.** A dedicated `@media print` stylesheet exists, so the printed output is
not the screen verbatim.

---

# Section B — Coach

Holds `SESSION_EDIT`, `THRESHOLD_EDIT`, `GROUP_EDIT`, `AVAILABILITY_EDIT`,
`ATHLETE_BIO_EDIT`, `ENTRY_CORRECTION`, `LEADERBOARD_EDIT`, `MEAL_LIBRARY_EDIT`,
`INJURY_ACCESS`, `REPORT_ACCESS`, `FLAG_EDIT_ANY_DOMAIN`, `ATHLETE_GYM`.

**Sidebar:** eight rows — everything except "Analytics".

## Identical to the sport scientist

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

### STAFF-COACH-23 — Nutrition: meal library only

`/nutrition` opens, but the coach holds `MEAL_LIBRARY_EDIT` and **not**
`NUTRITION_EDIT`. "Food library" is present; "New plan", "Create" and "Assign"
are absent.

### STAFF-COACH-28 — Injuries: allocation without the board

The coach holds `SESSION_EDIT`, so `/injuries/team-allocation` opens. `/injuries`
and `/injuries/{id}` do **not** — they are `CLINICAL_ONLY`. The allocation screen
states the asymmetry on itself.

## Cannot reach at all

- `/analytics`, `/analytics/build` — `ANALYTICS`.
- `/injuries`, `/injuries/{injuryId}`, `/reports/injuries` — `CLINICAL_ONLY`.
- `/settings/audit`, `/settings/retention`, `/settings/users*`,
  `/settings/subject-access`, `/squad/new`, `/squad` administration —
  `SETTINGS_ADMIN`.
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

`/reports/injuries` is `CLINICAL_ONLY`: **the medic is the only role that can
open it.**

### STAFF-MEDIC-28 — The injury board

`/injuries` and `/injuries/{injuryId}` are `CLINICAL_ONLY`. `/injuries/rehab-groups`
additionally accepts `REHAB_ALLOCATION`.

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
  `/schedule/planner/*`, `/timetable`, `/injuries/team-allocation` —
  `SESSION_EDIT`. G-33 took scheduling off this role; RLS enforces it, and the
  schedule screen renders the read-only line.
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
- `/injuries`, `/injuries/{injuryId}`, `/reports/injuries` — `CLINICAL_ONLY`.
- All scheduling — `SESSION_EDIT`.
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
