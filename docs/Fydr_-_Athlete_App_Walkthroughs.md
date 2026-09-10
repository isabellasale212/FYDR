# Fydr — Athlete App Walkthroughs

**Built 2026-09-10 from the running code**, not from the uploaded specification
documents. Every label in quotation marks below is copied from the JSX that
renders it. Where a control's text changes with state, all states are listed
with the condition that produces each.

**Sources.** `src/app/(athlete)/**` (15 routes, 1 route handler),
`src/components/**` resolved by following each page's imports rather than by
folder — a route folder does not contain most of what its screen renders, and
reading it alone produces confident, wrong answers. Cross-checked against
`docs/athlete/screens/*.md` and `docs/athlete/visibility.md`.

**Scope.** The athlete surface is responsive web inside the same Next.js app as
the staff surface. There is no native shell.

## How the two sections relate

Adult and minor are separate top-level sections because behaviour genuinely
differs in three places, all verified in code:

| Difference | Adult | Minor (under 18) | Where |
|---|---|---|---|
| Named on a leaderboard | On by default; may leave | **Never** unless they opt in themselves | `me/leaderboards/page.tsx` `isMinor` branch |
| Three notification types | Toggleable | **Locked off**, club cannot enable | `catalogue.ts` `minorFloorOff`, 3 entries |
| Injury diagnosis and mechanism on Today | Shown when a clinical record exists | **Never shown** | migration `0093`, view-level |

Everything else is identical. **Section B lists every flow ID regardless**, so a
reviewer working only on minors never has to read Section A to know what exists:
identical flows carry a one-line pointer with their entry point, differing flows
are written out in full.

**A minor is "under 18 OR date of birth unknown."** A null date of birth is
treated as a minor — the restrictive default. Noted because it means an athlete
with an incomplete profile silently gets the minor experience.

---

## Table of contents

### Section A — Adult athlete (18 and over)

| ID | Flow |
|---|---|
| ATH-ADULT-01 | Sign in |
| ATH-ADULT-02 | Land on Today and read what is outstanding |
| ATH-ADULT-03 | Submit the morning wellness entry |
| ATH-ADULT-04 | Wellness entry — already submitted today |
| ATH-ADULT-05 | Rate a session (RPE) |
| ATH-ADULT-06 | Rate a session — session not found |
| ATH-ADULT-07 | Submit the weekly nutrition check-in |
| ATH-ADULT-08 | Correct a nutrition check-in already submitted |
| ATH-ADULT-09 | Log a gym session set by set |
| ATH-ADULT-10 | Finish a gym session early |
| ATH-ADULT-11 | Correct a logged gym set |
| ATH-ADULT-12 | Browse My data |
| ATH-ADULT-13 | Open one gym session from history |
| ATH-ADULT-14 | See the leaderboards I am on |
| ATH-ADULT-15 | Open one leaderboard |
| ATH-ADULT-16 | Leave one leaderboard |
| ATH-ADULT-17 | Leave every leaderboard at once |
| ATH-ADULT-18 | Hide leaderboards from myself |
| ATH-ADULT-19 | Change notification preferences |
| ATH-ADULT-20 | Mute everything at once |
| ATH-ADULT-21 | Edit my profile |
| ATH-ADULT-22 | Add, replace or remove my photo |
| ATH-ADULT-23 | Pick a colour for my initials |
| ATH-ADULT-24 | Change my password |
| ATH-ADULT-25 | Change the app's appearance |
| ATH-ADULT-26 | Export my data |
| ATH-ADULT-27 | Report a problem to staff |
| ATH-ADULT-28 | View my gym programme |
| ATH-ADULT-29 | View meal ideas |
| ATH-ADULT-30 | Discard an entry stuck in the offline queue |
| ATH-ADULT-31 | Sign out |
| ATH-ADULT-32 | Today with nothing outstanding (empty state) |
| ATH-ADULT-33 | Today with no sessions scheduled (empty state) |
| ATH-ADULT-34 | Read my availability and its clinical detail |

### Section B — Minor athlete (under 18, or date of birth unknown)

| ID | Flow | Differs from adult? |
|---|---|---|
| ATH-MINOR-01 … 34 | Mirrors every adult flow | See table below |
| ATH-MINOR-14 | See the leaderboards I am on | **Yes** — consent card replaces the informational card |
| ATH-MINOR-14a | Opt in to being named on a leaderboard | **Yes** — flow does not exist for adults |
| ATH-MINOR-19 | Change notification preferences | **Yes** — three rows locked off |
| ATH-MINOR-34 | Read my availability and its clinical detail | **Yes** — diagnosis and mechanism never render |

---

# Section A — Adult athlete (18 and over)

## The shell

Every screen below `/(athlete)` sits inside a four-tab bar, `aria-label="Main"`.
Present at all times, on every flow, unless a flow says otherwise:

| Tab label | Route | Notes |
|---|---|---|
| "Today" | `/today` | |
| "My data" | `/my-data` | |
| **"Gym"** | **`/programme`** | Label and route deliberately differ — the tab says Gym, the URL says programme. A screenshot showing "Gym" is `/programme`. |
| "Me" | `/me` | |

The active tab carries `aria-current="page"`, matching on exact path **or**
prefix — so `/my-data/boards/123` still shows "My data" as current.

Screens opened as sheets (`check-in`, `rpe`, `nutrition-check-in`,
`report-problem`, `me/leaderboards`, `me/notifications`) draw a header with a
single dismiss control at the left; its glyph is "✕" or "←" depending on the
screen, listed per flow.

---

## ATH-ADULT-01 — Sign in

**Entry point.** `https://fydr.app/` — the root redirects to `/login`. Also
reached by following any athlete link while signed out: the middleware redirects
to `/login?next=<path>` and returns there afterwards.

**Steps.**

1. Type into "Email".
   - Also visible: "Password" field, "Sign in" button, "Forgot your password?"
     link. Above them: the wordmark and the eyebrow "ATHLETE AND STAFF", the
     heading "Sign in", and "Use the email address your club invited you on.
     Your morning entry takes 45 seconds."
   - Below: "Your wellness answers are visible to your club's staff. Injury
     detail is medical only."
2. Type into "Password".
   - Same controls visible as step 1.
3. Press "Sign in".
   - Also visible: "Forgot your password?".

**Branches.**

- IF the credentials are wrong THEN the page stays and shows an error; the
  attempt is written to `login_attempts` and to `audit_log`.
- IF the account has no athlete record and no staff role THEN sign-in succeeds
  but no athlete surface is reachable.
- IF arrived with `?next=` THEN the redirect after success is that path, once it
  has passed the safe-redirect check (relative paths only).

**End state.** Redirect to `/today`.

**The refusal copy, resolved 2026-09-10** by submitting deliberately invalid
details against scratch and reading `LoginForm.tsx`. Two messages exist and they
are different cases:

| Message | When |
|---|---|
| "That email and password do not match an account." | Wrong email or wrong password. Deliberately does not say which. |
| "That account holds no role in any club. Ask your club administrator to grant one." | The credentials are right but the account holds no role — the branch this document describes as "sign-in succeeds but no athlete surface is reachable". |

The failed attempt is recorded: a `login_attempts` row appears for that email
with `attempt_count` incremented, carrying `lock_count` and `locked_until`
columns, so repeated failures are rate-limited rather than merely logged.

---

## ATH-ADULT-02 — Land on Today and read what is outstanding

**Entry point.** Automatic after sign-in; the "Today" tab from anywhere.

**Steps.**

1. The screen loads. In order down the page:
   - Greeting heading: "{greeting}, {firstName}" — the greeting word is
     time-of-day aware **in the organisation's timezone**, not the device's.
   - Availability banner, when a current availability row exists (see
     ATH-ADULT-34).
   - Injury diagnosis and mechanism, when a clinical record exists and is
     linked to the availability row (see ATH-ADULT-34).
   - "Team this week: {team_name}." with "Set by your coach." — only when a
     rehab team allocation exists for this week.
   - Section "To do" with a count "{N} left" on the same line.
   - Section "Today" listing the day's sessions.
2. Press a to-do row to start that task.
   - Every to-do row is a full-width link with a three-letter domain glyph, a
     name, a subtitle, and a "›" chevron.

| Domain | Glyph | Row name | Subtitle | Goes to |
|---|---|---|---|---|
| Wellness | "WEL" | "Wellness" | "45 seconds" | `/check-in` |
| Session rating | "RPE" | **"How hard was it?"** — a fixed string, the same for every session | "20 seconds" | `/rpe/{sessionId}` |
| Nutrition | "NUT" | "Weekly check-in" | "Did you hit your protein target most days? · about 10 seconds" | `/nutrition-check-in` |

**Branches.**

- IF nothing is outstanding THEN the to-do list is replaced entirely — see
  ATH-ADULT-32.
- IF no session is scheduled today THEN see ATH-ADULT-33.
- IF a session is cancelled THEN its row renders at 55% opacity and remains
  listed rather than disappearing.
- IF an entry is sitting in the offline queue THEN a queued-write notice appears
  — see ATH-ADULT-30.

**End state.** Stays on `/today`; pressing a row opens that task's sheet.

**Note.** The design's timing clause ("open since 07:00", "due by 19:45") is
deliberately **absent** from the subtitle: `compliance_expectations` holds no
such times, so it was left out rather than invented. A screenshot showing a
timing clause is not this build.

**Corrected 2026-09-10.** This table previously said an RPE row shows the
session's own name — repeating a comment in `today/page.tsx` that says exactly
that. It is not true: `lib/queries/compliance.ts:144` sets
`label: 'How hard was it?'` as a fixed string and never looks the session name
up, although it carries the `session_id`. **Two sessions to rate produce two
identical rows.** Found by measuring the rendered screen rather than reading the
source comment.

**Also incomplete above:** a cancelled session renders at 55% opacity *and* with
its name struck through. The strike-through was omitted.

---

## ATH-ADULT-03 — Submit the morning wellness entry

**Entry point.** The "Wellness" to-do row on `/today`. Direct URL `/check-in`.

**Steps.**

1. Optionally adjust sleep hours with "−" (`aria-label="Half an hour less
   sleep"`) or "+" (`aria-label="Half an hour more sleep"`). Range 0–14, half-hour steps.
   - The stepper shows its current value between the two buttons, "7.0" with
     the unit "hours" beside it; it is pre-filled at 7.0 and already valid.
   - Also visible at this step: five 1–5 scale inputs, in this order —
     **sleep quality, soreness, fatigue, mood, stress** — each a radio group
     whose options are labelled "{step}, {word}", each carrying a live readout
     that reads "not answered" (amber) until answered and "{N} of 5" after;
     a collapsed disclosure "Add heart rate or weight" (a `<details>`/`<summary>`)
     containing two number fields, "Resting heart rate (bpm)" and
     "Body mass (kg)"; a free-text box labelled "Comment or injury issue
     (optional)" with placeholder "Anything you want your coach or medical
     staff to know."; the submit button; and the sheet's dismiss control "✕"
     (an `<a href="/today">`, `aria-label="Close the check-in"`).
2. Choose a value on each of the five scales.
   - Same controls visible.
3. Optionally expand "Add heart rate or weight" and enter either value.
4. Optionally type in the free-text box "Comment or injury issue (optional)".
5. Press the submit button.

**Submit button states.**

| Label | When |
|---|---|
| "Submit entry · {N} to go" | One or more of the five scales is still unanswered. Button is **disabled**. |
| "Submit entry" | All five answered. Enabled. |
| Disabled, same label | While the submission is in flight. |

**Branches.**

- IF fewer than five scales are answered THEN the button stays disabled and its
  label counts what remains. There is no error message; the count *is* the message.
- IF the network fails THEN the entry is written to a local outbox and the flow
  still completes — **deliberately silent**, because the athlete has done the
  thing. `/today` retries it. See ATH-ADULT-30 for what the athlete sees.
- IF an entry already exists for today THEN this screen is not reached — see
  ATH-ADULT-04.

**End state.** Redirect to `/today?submitted=1`, which renders a toast with a
"Dismiss" button.

**Note.** A paragraph of three sentences (40 words) states that the entry
cannot be edited once sent, names telling the coach as the recourse, and
promises My Data will show both the corrected value and what was first
reported. It sits **below** the submit button, not above it. Corrections are
staff-only (`ENTRY_CORRECTION` = sport scientist, coach, medic) — an athlete
cannot revise their own wellness entry.

---

## ATH-ADULT-04 — Wellness entry: already submitted today

**Entry point.** Opening `/check-in` when today's entry exists.

**Steps.**

1. The screen shows the heading "Already submitted" (or the date heading when
   viewing another day: "This morning" for today, otherwise the formatted date).
   - Interactive elements present: the sheet dismiss control "✕", and a "Back"
     link. No form, no submit button.

**Branches.**

- IF the requested date has no entry and is not today THEN the heading reads
  "Nothing submitted" instead.

**End state.** Stays on `/check-in`; "Back" returns to `/today`.

---

## ATH-ADULT-05 — Rate a session (RPE)

**Entry point.** An "RPE" to-do row on `/today`, whose name is the session's own
name. Direct URL `/rpe/{sessionId}`.

**Steps.**

1. Choose a rating from the CR-10 list (radio inputs, 0–10 with word labels).
   - Also visible: heading "How hard was it?"; the direction line "Rate the
     whole session, not the hardest bit."; duration stepper "−"
     (`aria-label="5 minutes less"`) and "+" (`aria-label="5 minutes more"`);
     an "Add a note" button; the submit button; the sheet dismiss "✕".
2. Optionally adjust duration with "−" / "+" (5-minute steps).
3. Optionally press "Add a note", which reveals a textarea (`id="rpe-note"`,
   label "Add a note").
4. Press the submit button.

**Submit button states.**

| Label | When |
|---|---|
| "Choose a rating" | No rating selected. **Disabled.** |
| "Submit rating" | A rating is selected. Enabled. |

**Branches.**

- IF no rating is chosen THEN the button stays disabled and reads "Choose a
  rating" — the label is the instruction.
- IF the session id does not resolve THEN see ATH-ADULT-06.
- IF the network fails THEN the entry queues in the outbox, same as wellness.

**End state.** Redirect to `/today`, with a toast.

**Note.** The same immutability sentence appears above the button: once sent it
cannot be edited.

---

## ATH-ADULT-06 — Rate a session: session not found

**Entry point.** `/rpe/{sessionId}` with an id that does not resolve for this
athlete.

**Steps.**

1. The screen shows the heading "This session isn't there".
   - Interactive elements: the sheet dismiss "✕", and "Back to today".

**End state.** Stays until dismissed; both controls lead to `/today`.

---

## ATH-ADULT-07 — Submit the weekly nutrition check-in

**Entry point.** The "Weekly check-in" to-do row on `/today`. Direct URL
`/nutrition-check-in`.

**IT IS ALWAYS THE PREVIOUS WEEK, never the one in progress**, and the screen
says which: "WEEK {n} · MON {date} TO SUN {date}". The page resolves
`lastCompletedWeek` — the ISO week just ended — because "did you hit your
protein target most days?" cannot be answered about a week still running. A
`?week=` in the address is clamped so a future week cannot be reached even by
hand. Recorded because it surprised the person writing this document, who read
"Weekly check-in" on today's to-do list and expected today's week: a screenshot
of this screen dated a week behind is correct, not stale.

**Steps.**

1. Press one of three answer chips: "Yes", "Roughly", "No".
   - The three answers are `<button aria-pressed>` toggles, **not** radio
     inputs, and they are **not inside a fieldset or any grouping element** —
     unlike the wellness and RPE scales. Each is full-width, 335 × 64.
   - Also visible: heading "Weekly check-in"; the week line
     "WEEK {n} · MON {date} TO SUN {date}" (11px, uppercased in CSS); the
     question "Did you hit your protein target most days this week?"; the sheet
     dismiss "✕"; an "Add a note (optional)" button; the submit button; the
     line "Saved on this phone first — it sends even if your signal drops.";
     and the four tab-bar links.
   - **There is no "Report a problem" link on this screen.** An earlier version
     of this document listed one; measured 2026-09-10, the string does not
     appear in the document at all.
2. Optionally press "Add a note (optional)", revealing a textarea
   (`id="nutrition-note"`, label "Add a note").
3. Press the submit button.

**Submit button states.**

| Label | When |
|---|---|
| "Choose an answer" | No answer selected. **Disabled.** |
| "Done" | An answer is selected. Enabled. |
| "Saving…" | Submission in flight. |

**Branches.**

- IF a check-in already exists for the week THEN the screen instead offers
  "Change this answer" — see ATH-ADULT-08.

**End state.** Returns to `/today`; the "Weekly check-in" to-do row is gone.

---

## ATH-ADULT-08 — Correct a nutrition check-in already submitted

**Entry point.** Two places, both real:
- `/nutrition-check-in` when the week already has an answer — the screen shows
  "Change this answer".
- `/my-data` on the nutrition summary — a "Correct" link per week, going to
  `/nutrition-check-in?week={week_start}`.

**Steps.**

1. Press "Change this answer" (or "Correct" from My data).
2. Choose a different chip: "Yes", "Roughly", "No".
3. Press "Done".

**Branches.**

- IF the athlete is not the owner of the check-in THEN the RPC refuses with
  `not_permitted`. There is **no staff write path to this table at all** — a
  coach cannot answer or change a check-in on an athlete's behalf.
- IF the original was already superseded THEN the RPC refuses with
  `entry_not_revisable` — the revision chain stays linear.

**End state.** Back to `/today` or `/my-data`. A new revision row is written and
the old one marked superseded; an `entry_revision.created` audit event is
recorded naming what changed. **The note's text is never recorded** — only its
length before and after.

---

## ATH-ADULT-09 — Log a gym session set by set

**Entry point.** The "Gym" tab → `/programme` → a session row. Direct URL
`/gym/{sessionId}`.

**Steps.**

1. The screen shows heading "{sessionName}", a progress line
   "{done} of {total} sets · {mm:ss}" — it carries a **running clock** as well
   as the count — and a card per exercise.
   - **Not every exercise is shown.** Only the first two render; the rest sit
     behind a disclosure button reading "{n} more · {names}" (measured:
     "2 more · Split squat, Nordic curl" on a four-exercise session).
   - Also present, and not previously listed: a "Session RPE (optional)"
     section, and the line "Sets save as you log them."
   - **Opening this screen writes a row.** `startOrGetSessionLog` creates the
     session log on load, before anything is logged — which is why the clock
     reads a live time the moment the page appears. See §0g.
   - Per exercise, visible at all times: a per-set button for every prescribed
     set; a weight row; and, when the athlete's weight differs from the
     prescription, both numbers — theirs labelled "Your weight", the coach's
     "Recommended".
   - Weight controls: "−" (`aria-label="Decrease the weight for {exercise}"`)
     and "+" (`aria-label="Increase the weight for {exercise}"`).
   - When no weight applies the label reads "Bodyweight"; when one applies but
     none is set, "No load set".
   - Also on screen throughout: the finish button (see ATH-ADULT-10), and the
     four-tab bar.
2. Press the next set's button to log it.
   - Accessible name when unlogged: "Log set {n} of {total}, {exercise}".
     Verified. The buttons measure **105.7 × 42px** — below the app's own 44px
     floor.
   - Accessible name once logged: "Set {n} logged, {reps} reps at {load} kg.
     Correct it." — `aria-pressed` becomes true.
3. Repeat for each set and each exercise.

**Branches.**

- IF a set is **not** the next one in sequence THEN its button is **disabled**.
  Sets are logged in order; an athlete cannot skip ahead to set 3 without
  logging set 2. This is the single most common source of "the button does
  nothing" and it is deliberate.
- IF a set is already logged THEN pressing it opens the inline correction
  (ATH-ADULT-11) rather than re-logging it.
- IF a log fails THEN it queues in the outbox and the set still shows as done.

**End state.** Stays on `/gym/{sessionId}`. The exercise header count moves from
"—" (nothing logged) through "{n} of {total}" to complete.

---

## ATH-ADULT-10 — Finish a gym session

**Entry point.** The finish button at the foot of `/gym/{sessionId}`, present
from the moment the screen loads.

**Steps.**

1. Press the finish button.

**Button states.**

| Label | When |
|---|---|
| "Finish early · {done} of {total}" | Fewer sets logged than prescribed. |
| "Finish session" | Every prescribed set logged. |

**Branches.**

- IF the athlete finishes early THEN the session is still completed; the label
  is the only warning, and there is no confirmation step.

**End state.** The session is marked complete and appears in My data's Gym tab.

**Flagged as unclear.** Whether a completed session can be reopened from the
athlete side was not established in this pass. `/my-data/gym/{id}` offers
per-set correction (ATH-ADULT-11) but no "reopen". Worth confirming before
matching a screenshot that appears to show a re-entered session.

---

## ATH-ADULT-11 — Correct a logged gym set

**Entry point.** Two places, both real and both using the same RPC
(`revise_gym_set_log`):
- Inside the live logger: press any **already-logged** set button.
- In history: `/my-data/gym/{gymSessionLogId}` → "Correct" on a set row.

**Steps (in the logger).**

1. Press a logged set's button. An inline panel opens headed "Correcting set
   {n}".
2. Edit "Reps" and/or "Load (kg)".
   - Also visible: "Save correction", "Cancel", and the explanatory line "The
     original is kept. My data marks the day corrected and shows what you first
     reported."
3. Press "Save correction".

**Steps (in history).**

1. Press "Correct" on a set row.
2. Edit the reps field (`aria-label="Set {n} corrected reps"`) and/or load.
3. Press "Save" — label becomes "Saving…" while in flight.

**Branches.**

- IF "Cancel" is pressed THEN the panel closes and nothing is written.
- IF a field is left blank THEN it is **not** treated as zero — the RPC reads a
  blank as "unchanged", which is why the form validates rather than coercing.
- IF the set has already been superseded THEN the RPC refuses.

**End state.** A new revision row is written, the original kept and marked
superseded, and an audit row records the correction with old and new values.
My data marks that day corrected and shows what was first reported.

---

## ATH-ADULT-12 — Browse My data

**Entry point.** The "My data" tab. Direct URL `/my-data`, or `/my-data?tab=…`.

**Steps.**

1. The screen loads on the Wellness tab, heading "My data".
   - Segment links, all three always visible: "Wellness", "Gym", "Tests".
     (Route keys are `wellness`, `gym`, `testing` — the **label** is "Tests" but
     the URL says `testing`.)
   - Also visible: a period selector; a "Readiness" chart; "History";
     "Sessions"; "Weekly check-in" with a "Correct" link per week; "Your tests";
     and a flag notice when one exists.
2. Press a segment to switch tab; press "See all {N} {noun} →" to expand a list.

**Branches.**

- IF the athlete has hidden leaderboards (ATH-ADULT-18) THEN the leaderboard
  area is replaced by a gate offering "Show them again".
- IF a period has no data THEN an empty state renders in place of the chart.
- IF an entry was corrected THEN the row shows "What you reported:"; if the
  original falls outside the visible window it reads instead "What you first
  reported is older than the window shown here."

**End state.** Stays on `/my-data` with the tab in the URL.

---

## ATH-ADULT-13 — Open one gym session from history

**Entry point.** `/my-data?tab=gym` → a session row.

**Steps.**

1. The screen shows the session date as its heading and a "Sets" section.
   - Visible: "Back to gym history" (→ `/my-data?tab=gym`), and a "Correct"
     button per set row.

**End state.** Stays on `/my-data/gym/{id}`.

---

## ATH-ADULT-14 — See the leaderboards I am on

**Entry point.** `/my-data/boards`. Also reachable from "Me" → "Leaderboards"
(which opens the *settings* screen, ATH-ADULT-16/17/18, not this one).

**Steps.**

1. The screen shows heading "Leaderboards" and the boards this athlete appears on.
   - Also visible: "Manage who sees you on a leaderboard" → `/me/leaderboards`.

**Branches.**

- IF the athlete has hidden leaderboards THEN a gate renders instead, offering
  "Show them again" → `/me/leaderboards`.
- IF there are no boards THEN an empty state renders.

**End state.** Stays on `/my-data/boards`.

---

## ATH-ADULT-15 — Open one leaderboard

**Entry point.** A board row on `/my-data/boards`.

**Steps.**

1. The board renders with heading "{board.name}".
   - Visible: "←" dismiss, "Back to leaderboards", and "Leave this leaderboard".

**Branches, each a distinct screen with its own heading:**

- IF the board is not available to this athlete THEN heading "This leaderboard
  is not available".
- IF the club's plan does not include it THEN heading "Not on your club's plan".

**End state.** Stays on `/my-data/boards/{id}`.

---

## ATH-ADULT-16 — Leave one leaderboard

**Entry point.** "Leave this leaderboard" on `/my-data/boards/{id}`.

**Steps.**

1. Press "Leave this leaderboard" — label becomes "Leaving…" while in flight.

**Branches.**

- There is **no confirmation step**. One press leaves the board.

**End state.** The athlete no longer appears on that board. This right cannot be
removed by the club: migration `0016` carries a hard `check (allow_opt_out)` on
GDPR Article 7(3) grounds.

---

## ATH-ADULT-17 — Leave every leaderboard at once

**Entry point.** "Me" → "Leaderboards" → the "Every leaderboard at once" card.

**Steps.**

1. Press the global toggle.

**Toggle states.**

| Label | When |
|---|---|
| "Leave every leaderboard" | Currently appearing. |
| "Left every leaderboard — tap to rejoin" | Currently opted out. |

**End state.** Stays on `/me/leaderboards`. Reversible from the same control.

---

## ATH-ADULT-18 — Hide leaderboards from myself

**Entry point.** "Me" → "Leaderboards" → the "Seeing leaderboards" card.

**Steps.**

1. Press the hide toggle.

**Toggle states.**

| Label | When |
|---|---|
| "Hide leaderboards from me" | Currently visible. |
| "Hidden — tap to show again" | Currently hidden. |

**Branches.**

- This changes **what the athlete sees, not whether they are on a board** — the
  card says so explicitly. Distinct from ATH-ADULT-16 and -17.

**End state.** Leaderboard surfaces across the app render a gate instead of
content, offering "Show them again".

---

## ATH-ADULT-19 — Change notification preferences

**Entry point.** "Me" → the "Notifications" row (subtitle "morning wellness
prompt", value "On" or "Off", chevron "›"). Direct URL `/me/notifications`.

**Steps.**

1. The screen shows heading "Notifications" and a "Pause everything" card, then
   one row per notification type.
   - Every row shows its label, its trigger sentence, and its channel controls.
   - Also visible: "← Me" back link, and the mute control (ATH-ADULT-20).
2. Press a channel chip to toggle it.

**Channel control states, per row.**

| Rendering | When |
|---|---|
| "Push on" / "Push off" | The type supports push and can be disabled. |
| "Email on" / "Email off" | The type supports email and can be disabled. |
| "Always on" | `canDisable` is false — no control at all. |
| "In-app only" | The type has no push or email channel. |

**The 17 athlete notification types**, in the order they render, with their
triggers:

| Label | Trigger | Default |
|---|---|---|
| "Morning wellness prompt" | A wellness entry is expected today | push on |
| "Wellness reminder" | Wellness still outstanding a few hours later | push on |
| "Session rating prompt" | A session you need to rate has ended | push on |
| "Session rating reminder" | A session rating is still outstanding | push on |
| "Matchday fuelling reminder" | The evening before a fixture | push off |
| "Weekly nutrition check-in" | The week has ended and you haven't checked in | push off |
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

## ATH-ADULT-20 — Mute everything at once

**Entry point.** The "Pause everything" card at the top of `/me/notifications`.

**Steps.**

1. Press the mute button.

**Button states.**

| Label | When |
|---|---|
| "Mute everything else" | Not currently muted. |
| "Turn notifications back on" | Currently muted. |
| "Working…" | Save in flight. |

**Branches.**

- IF the athlete is a minor THEN the three `minorFloorOff` types are **excluded
  from the un-mute set** — turning notifications back on does not turn those on,
  because the club cannot enable them at all.

**End state.** Stays on `/me/notifications`.

---

## ATH-ADULT-21 — Edit my profile

**Entry point.** "Me" → the "Edit profile" card.

**Steps.**

1. Edit "Phone" (`id="athlete-phone"`, `type="tel"`).
2. Press "Save" — label becomes "Saving…" while in flight.

**Branches.**

- Date of birth is **not editable here**: it needs staff. Name and position are
  likewise staff-owned.

**End state.** Stays on `/me`.

---

## ATH-ADULT-22 — Add, replace or remove my photo

**Entry point.** "Me" → the "Photo" card.

**Steps.**

1. Press the upload control.

**Control states.**

| Label | When |
|---|---|
| "Upload photo" | No photo set. |
| "Replace photo" | A photo exists. |
| "Working…" | Upload or removal in flight. |

2. Choose a JPEG, PNG or WebP up to 2MB.
   - Also visible: "Remove" (only when a photo exists); the caption "JPEG, PNG
     or WebP, up to 2MB."; and, when no photo exists, the colour picker
     (ATH-ADULT-23).

**Branches.**

- IF the file is the wrong type or too large THEN an inline `role="alert"` error
  renders and the file input is cleared.
- IF a photo exists THEN the colour picker is **hidden** — a picker with no
  visible effect is worse than no picker.

**End state.** Stays on `/me`; the avatar updates immediately, independent of
the profile form's own "Save".

---

## ATH-ADULT-23 — Pick a colour for my initials

**Entry point.** "Me" → "Photo" card, **only when no photo is set**.

**Steps.**

1. Press one of eleven chips: "Default", then "Blue", "Green", "Purple",
   "Slate", "Indigo", "Cyan", "Olive", "Magenta", "Steel", "Plum".
   - The group is labelled "Or pick a colour for your initials".

**Branches.**

- IF the save fails THEN the previous colour is restored and "Could not save
  that colour. Try again." renders.

**End state.** Saves immediately on press — no Save button.

---

## ATH-ADULT-24 — Change my password

**Entry point.** "Me" → the "Password and sign-in" card.

**Steps.**

1. Fill "Current password" (`id="current-password"`).
2. Fill "New password" (`id="new-password"`).
3. Fill "Confirm new password" (`id="confirm-password"`).
4. Press "Change password" — label becomes "Changing…" while in flight.

**End state.** Stays on `/me`.

---

## ATH-ADULT-25 — Change the app's appearance

**Entry point.** "Me" → the theme control.

**Steps.**

1. Press one of the segmented options: "Light" (hint "Always light"), "Dark"
   (hint "Always dark"), and a system option.

**End state.** Applies immediately.

**Unverified.** The third option's exact label and hint were not read in this
pass.

---

## ATH-ADULT-26 — Export my data

**Entry point.** "Me" → "Export my data CSV ›".

**Steps.**

1. Press "Export my data CSV ›" (a plain `<a>` to `/me/export`, not a client link).

**End state.** A CSV download of the athlete's own data.

---

## ATH-ADULT-27 — Report a problem to staff

**Entry point.** Two places:
- "Me" → "Report a problem ›".
- The nutrition check-in form's "Report a problem" link.
- Direct URL `/report-problem`.

**Steps.**

1. Optionally press a category chip: "Injury or pain", "Wellbeing", "Something
   else". Pressing the selected chip again clears it.
2. Type into the body field (`id="report-body"`, label "What's going on?").
3. Press the send button.

**Send button states.**

| Label | When |
|---|---|
| "Send to staff" | Default. |
| "Sending…" | In flight. |
| Disabled | Body empty or over the character limit. |

**Branches.**

- Category is optional; the body is not.
- IF the body exceeds the limit THEN the button is disabled.

**End state.** Stays on `/report-problem`; the report appears under "Your
reports" and a toast with "Dismiss" confirms. Also visible throughout: the "✕"
dismiss → `/today`.

---

## ATH-ADULT-28 — View my gym programme

**Entry point.** The "Gym" tab. Direct URL `/programme`.

**Steps.**

1. The screen shows heading "My programme", the programme's own name, a
   "Sessions" list, "Nutrition targets" and a "Nutrition" section.
   - Visible: "Meal ideas ›" → `/programme/nutrition` (rendered in two places on
     this screen).

**Branches.**

- IF no programme is assigned THEN an empty state renders.

**End state.** Stays on `/programme`.

---

## ATH-ADULT-29 — View meal ideas

**Entry point.** "Meal ideas ›" on `/programme`.

**Steps.**

1. The screen shows heading "Meal ideas".
   - Visible: "My programme" back link.

**End state.** Stays on `/programme/nutrition`.

---

## ATH-ADULT-30 — Discard an entry stuck in the offline queue

**Entry point.** `/today`, when a queued write has failed in a way that will
never succeed (a conflict). Queued writes that are merely waiting are **not**
shown — they retry silently.

**Steps.**

1. A `role="alert"` notice names the stuck entry.
2. Press "Discard this one".

**Branches.**

- IF the write is merely queued (offline, retryable) THEN nothing is shown at
  all and it is retried on the next load. This is deliberate: the athlete has
  already done the thing.
- A conflict is **the one queued-write outcome that is surfaced**.

**End state.** The queued item is removed; the entry is not submitted.

---

## ATH-ADULT-31 — Sign out

**Entry point.** "Me" → "Sign out", at the foot of the screen.

**Steps.**

1. Press "Sign out".

**Branches.**

- No confirmation step.

**End state.** Session cleared; redirect to `/login`.

---

## ATH-ADULT-32 — Today with nothing outstanding (empty state)

**Entry point.** `/today` when the to-do list is empty.

**Steps.**

1. In place of the "To do" section: a card with a tick, "You're up to date." and
   "Nothing expected of you today is outstanding."
   - No interactive elements in this card. The "Today" sessions section and the
     tab bar remain.

---

## ATH-ADULT-33 — Today with no sessions scheduled (empty state)

**Entry point.** `/today` when no session names this athlete today.

**Steps.**

1. Under the "Today" heading: "Nothing scheduled" / "You are not named in a
   session today. Rest or check with your coach."

---

## ATH-ADULT-34 — Read my availability and its clinical detail

**Entry point.** `/today`, above the to-do list, when a current availability row
exists.

**Steps.**

1. The availability banner shows status, restrictions, reason category, the
   linked injury, and any note medical staff wrote.
2. Below it, when a clinical record exists **and is linked to that availability
   row**, diagnosis and mechanism render.

**Branches.**

- IF the availability row does not name an injury THEN no injury is attached —
  an athlete out for a non-injury reason with an unrelated injury on file gets
  **nothing**, rather than the wrong injury attached to the wrong absence.
- IF there is no clinical record THEN nothing renders.
- IF the athlete is a **minor** THEN diagnosis and mechanism **never** render —
  the database view withholds them (migration `0093`). See ATH-MINOR-34.
- Each field is guarded separately: a record can carry a diagnosis and no
  mechanism, or the reverse.

**End state.** Stays on `/today`. Read-only — an athlete cannot change their own
availability.

---

# Section B — Minor athlete (under 18, or date of birth unknown)

**How to use this section.** Every adult flow ID has a minor counterpart with
the same number. Four differ and are written out in full below. The rest are
**identical** — same entry point, same controls, same labels, same branches —
and are listed in the table so a reviewer working only on minors can match a
screenshot without reading Section A.

**Who counts as a minor.** Under 18 on today's date, **or date of birth null**.
The null case is treated as a minor deliberately — the restrictive default — and
it means an athlete whose profile is incomplete silently gets this experience.
Date of birth is not athlete-editable, so they cannot correct it themselves.

## Flows identical to their adult counterpart

| ID | Flow | Entry point |
|---|---|---|
| ATH-MINOR-01 | Sign in | `/login` |
| ATH-MINOR-02 | Land on Today | after sign-in; "Today" tab |
| ATH-MINOR-03 | Submit the morning wellness entry | "Wellness" to-do row |
| ATH-MINOR-04 | Wellness: already submitted | `/check-in` when today's exists |
| ATH-MINOR-05 | Rate a session (RPE) | "RPE" to-do row |
| ATH-MINOR-06 | Rate a session: not found | `/rpe/{bad id}` |
| ATH-MINOR-07 | Weekly nutrition check-in | "Weekly check-in" to-do row |
| ATH-MINOR-08 | Correct a nutrition check-in | "Change this answer" / "Correct" |
| ATH-MINOR-09 | Log a gym session | "Gym" tab → session |
| ATH-MINOR-10 | Finish a gym session | finish button on `/gym/{id}` |
| ATH-MINOR-11 | Correct a logged gym set | logged set button; "Correct" in history |
| ATH-MINOR-12 | Browse My data | "My data" tab |
| ATH-MINOR-13 | Open one gym session from history | `/my-data?tab=gym` → row |
| ATH-MINOR-15 | Open one leaderboard | board row on `/my-data/boards` |
| ATH-MINOR-16 | Leave one leaderboard | "Leave this leaderboard" |
| ATH-MINOR-17 | Leave every leaderboard at once | "Every leaderboard at once" card |
| ATH-MINOR-18 | Hide leaderboards from myself | "Seeing leaderboards" card |
| ATH-MINOR-20 | Mute everything at once | "Pause everything" card |
| ATH-MINOR-21 | Edit my profile | "Me" → "Edit profile" |
| ATH-MINOR-22 | Add, replace or remove my photo | "Me" → "Photo" |
| ATH-MINOR-23 | Pick a colour for my initials | "Me" → "Photo", no photo set |
| ATH-MINOR-24 | Change my password | "Me" → "Password and sign-in" |
| ATH-MINOR-25 | Change the app's appearance | "Me" → theme control |
| ATH-MINOR-26 | Export my data | "Me" → "Export my data CSV ›" |
| ATH-MINOR-27 | Report a problem to staff | "Me" → "Report a problem ›" |
| ATH-MINOR-28 | View my gym programme | "Gym" tab |
| ATH-MINOR-29 | View meal ideas | "Meal ideas ›" |
| ATH-MINOR-30 | Discard a queued entry | `/today` conflict notice |
| ATH-MINOR-31 | Sign out | "Me" → "Sign out" |
| ATH-MINOR-32 | Today, nothing outstanding | `/today` |
| ATH-MINOR-33 | Today, no sessions | `/today` |

**Note on ATH-MINOR-17.** "Leave every leaderboard at once" renders for minors
too, and is not redundant: a minor who has opted in via ATH-MINOR-14a can use
either control to come back out.

---

## ATH-MINOR-14 — See the leaderboards I am on

**Entry point.** "Me" → the "Leaderboard" row. **The row's subtitle differs by
age** and is the earliest on-screen signal of which experience an athlete is in:

| Subtitle | Who |
|---|---|
| "you appear unless you leave" | Adult |
| "you choose to appear" | Minor |

The row's value reads "Opted in" or "Opted out" for both.

**Steps.**

1. `/me/leaderboards` opens, heading "Leaderboards", dismiss "←" → `/me`.
2. The first card is headed "Being named on a leaderboard" — **the same heading
   as the adult screen, with different content**:

   > "Because you're under 18, you are never named on a leaderboard unless you
   > choose to be — that choice is yours alone, and nobody at your club can turn
   > it on for you. Turning it off again is just as easy, any time."

   and it carries a **toggle** (ATH-MINOR-14a). The adult card has the same
   heading, different copy, and **no control at all**.
3. Below, identical to adults: "Seeing leaderboards" (ATH-MINOR-18) and "Every
   leaderboard at once" (ATH-MINOR-17).

**Screenshot tell.** Same heading, both ages. The difference is the presence of
a toggle inside the first card. If the first card has a toggle, it is a minor.

---

## ATH-MINOR-14a — Opt in to being named on a leaderboard

**This flow does not exist for adults.** An adult is named by default and can
only leave; a minor is never named unless they turn this on themselves.

**Entry point.** The toggle inside the "Being named on a leaderboard" card on
`/me/leaderboards`.

**Steps.**

1. Press the consent toggle.

**Toggle states.**

| Label | When |
|---|---|
| "Off — tap to appear on leaderboards" | Not consented. The default. |
| "On — tap to turn off" | Consented. |

**Branches.**

- **No staff role can set this.** There is no staff write path — the copy says
  so and the permission model enforces it.
- Reversible at any time from the same control.

**End state.** Stays on `/me/leaderboards`. Until this is on, the athlete
appears on no leaderboard regardless of what staff publish.

---

## ATH-MINOR-19 — Change notification preferences

**Entry point.** Same as adults: "Me" → "Notifications" row.

**Identical to ATH-ADULT-19 except for three rows**, which render **locked**:

| Label | Trigger |
|---|---|
| "A flag was shared with you" | Staff acknowledges a flag raised about you |
| "Weekly personal summary" | Every Monday morning |
| "Weekly leaderboard" | Every Monday morning |

**How a locked row renders.** The label and trigger appear as normal, followed
by a warning line:

> "Off for under-18 accounts — the club can't turn this on for you."

**Branches.**

- IF a locked row's channel chip is pressed THEN nothing happens — the toggle
  returns early. It is **locked, not merely defaulted off**.
- IF "Turn notifications back on" (ATH-MINOR-20) is pressed THEN these three are
  excluded from the set being re-enabled.

**Screenshot tell.** Three rows carrying the under-18 warning line.

---

## ATH-MINOR-34 — Read my availability and its clinical detail

**Entry point.** `/today`, above the to-do list.

**Identical to ATH-ADULT-34 except:** diagnosis and mechanism **never render**,
whatever the record contains. The withholding happens in the database view added
by migration `0093`, not in the page — so it holds regardless of how the screen
is reached.

**What a minor still sees:** availability status, restrictions, reason category,
the linked injury, and any note medical staff wrote.

**Branches.**

- The component renders **nothing at all** rather than a placeholder. There is
  no "hidden for your age" message, because saying a field was withheld is
  itself the disclosure the gate exists to prevent.

**Screenshot tell.** An availability banner with no diagnosis or mechanism block
beneath it is either a minor, or an adult with no clinical record — these two are
**not distinguishable from the screen alone**.

---

# Open questions and things not verified

Listed rather than guessed, per the brief.

1. **Sign-in failure copy** (ATH-ADULT-01) was not read; the exact inline error
   wording is unconfirmed.
2. **Theme control's third option** (ATH-ADULT-25) — label and hint unread.
   "Light" and "Dark" are confirmed.
3. **Reopening a completed gym session** (ATH-ADULT-10) — whether an athlete can
   re-enter a finished session is unestablished.
4. **`/my-data` period selector** — the selector exists and writes a
   `fydr-period` cookie with a 180-day life, but its option labels were not
   enumerated.
5. **Minor status is not directly observable on screen** except through the four
   tells listed above. There is no badge, and `/me` shows no age. A screenshot of
   a screen with none of those four tells cannot be assigned to adult or minor.
6. **`docs/athlete/visibility.md` was not line-by-line reconciled** against this
   document. Where the two disagree, the code was followed.
