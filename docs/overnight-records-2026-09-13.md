# Overnight records — 2026-09-13 (builder)

Step 1 reports answered before building, in the order the queue put them. Each
is a record of what the running product does today, read from the code and the
schema, not from a board or a document. Where an answer is the builder's own
(Isabella asleep; the standing rule for the night), it says so and is also on
`docs/design-decisions-outstanding.md` with a recommendation.

---

## PATTERN-S9 — Step 1, the five questions (item 1's "S9 declined-state report")

**1. Does an invite and password flow exist, or is account creation staff side only?**
Exists, and it is the only path. `lib/invite.ts` issues
`auth.admin.generateLink({ type: 'invite' })` — the auth user is created with **no
password**, the single-use token is verified by this app's own `/auth/confirm`
and lands on `/login/reset/confirm?invite=1`, where the athlete sets a password
and is signed in by the same act. Both creation paths use it: a staff member
(`settings/users/create`, the bulk invite) and an athlete (`squad/new/create`,
which creates the athlete row first — name, date of birth, position, squad
number, optional email — and invites only if an email was given). No password is
generated, emailed or shown anywhere (`test:credentials`). Since item 1 of this
queue, deactivating the account bans the auth user and the token dies with it.
**Artboard 1 is unblocked on this question.** The amendment's question — where
the guardian capture sits — is answered under 3.

**2. Is there any field recording a consent decision, its date and its version?**
Two columns exist and **nothing reads or writes them**: `athletes.consent_given_at`
and `athletes.consent_version` (0002), created against the original data model
with a comment that the lawful basis is unresolved (O-951) and the names are
kept pending it. No app code references either (grep: only the generated
types). `athlete_consents` (0002, G-11) holds granular, revocable purposes —
`healthkit_sync` (removed product) and `leaderboard_visibility` (removed by
0116) — with `granted_at`, `withdrawn_at` and a `notice_version`; it is the wrong
shape for the decision this board draws (two blocks, each with a version, a
decline and a withdrawal). **No health-data record exists at all.** Decided
(Isabella, tonight's queue): name the health record now; do not rename the
performance columns — comment them to `docs/decisions/lawful-basis-open.md`.

**3. Is a guardian contact held for an athlete under 18? Can the app tell who is
under 18 without displaying a date of birth?** No guardian field exists anywhere
— `athletes` carries `parental_consent_recorded_at / _by / _method` (an admin
recording an offline process; "There is no parent login") and nothing naming or
addressing a guardian. Age: yes — `date_of_birth` is required for every linked
athlete (`athletes_dob_required_when_linked`), `athlete_is_minor()` (0010; a null
date of birth counts as a minor) and `ageFrom()` decide it in the database and
the app, and 0116 already keys the ranked boards on it without printing a date.
**Where the capture sits (the amendment's question):** on the Add athlete form
(`/squad/new`), which is where the date of birth is asserted — when the date
entered makes the athlete under 18, a guardian name and email are shown and
required whenever an invite email is given (no invite, no guardian needed yet);
and on the athlete's profile edit for a club adding it later or correcting it.
The bulk invite (`settings/users/bulk-invite`) invites existing athlete rows and
refuses an under-18 row with no guardian recorded, naming the athlete. Artboard
4A shows the name and the address masked (`j***@***.com`) and never asks the
athlete for either.

**4. Can an account exist in a declined state?** **No.** Consent is implied by the
row: every athlete with `status <> 'left_club'` is in every denominator (26 query
sites filter exactly that; `generate_compliance_expectations` writes expectations
for every such athlete in a session's groups), every entry form accepts them,
and nothing distinguishes "declined" from "never asked" from "agreed". The
`athlete_status` enum (`active | injured_long_term | left_club`) is the club
relationship, not the data decision, and must not gain a consent value.

**The builder's answer, applied tonight** (on the sheet with this recommendation):

- Two records on `athletes`, each four columns. Performance: the existing
  `consent_given_at`, `consent_version`, plus `consent_declined_at`,
  `consent_withdrawn_at`. Health, named now: `health_consent_given_at`,
  `health_consent_version`, `health_consent_declined_at`,
  `health_consent_withdrawn_at`. The version is the string the screen showed
  (`LEGAL-3D` decides the rule for re-asking; until then the stored string is
  the placeholder's reference so a reviewer can see what was agreed to).
- **`athletes.in_data`**, a stored generated column:
  `consent_given_at is not null and consent_declined_at is null and
  consent_withdrawn_at is null`. One predicate, computed by the database, that
  every denominator reads. A declined athlete is in the squad, in the lists,
  has no entries and no readiness, and is dropped from every count.
- **Four not-active states, rendered differently** (queue-pending item 4 asked
  for two; four is what the columns distinguish): *not yet answered* (no
  decision; the athlete has not opened the app or has not reached 3A), *guardian
  consent outstanding* (under 18; the request is sent and undecided),
  *declined* (`consent_declined_at`, the date shown), *withdrawn*
  (`consent_withdrawn_at`, the date shown). The squad list shows the state and
  its date; cells read an em dash; the athlete keeps schedule, gym programme
  view, nutrition guidance and messages and is locked out of the entry forms.
- **Which forms 4A locks (finding 3):** all four — the morning check-in, the
  session rating, gym set logging and the nutrition weigh-in/check-in — because
  each is the athlete entering data about themselves, which is the processing
  being agreed to. Locking two and leaving two would make the decision a
  decoration. The board draws two because the persona review found two on Today;
  the other two live on the Gym and Nutrition tabs.
- **The denominators.** `generate_compliance_expectations` skips athletes not
  `in_data`, so every compliance figure drops them by construction. The
  headcount denominators ("30 athletes", "20 of 28 available") read
  `in_data` through one shared filter (`lib/queries/inData.ts`), applied at the
  26 sites — the squad list and the athlete's own profile are the two surfaces
  that deliberately keep showing a declined athlete, with the state.
- **Existing rows.** Every athlete today has no decision recorded. The
  migration **backfills the performance record for athletes with a linked
  account** (`consent_given_at = now()`, `consent_version = 'seed-pre-S9'`)
  because every one of them is synthetic seed data (the decision batch: "All
  production data is synthetic") and because leaving them undecided empties
  every staff screen the moment the migration lands. The health record is not
  backfilled: nothing in the product has ever asked, and a synthetic "yes" to
  an Article 9 question is not worth writing. **Sheet item:** whether the
  backfill is right, and whether real clubs' athletes (none exist yet) must all
  go through 3A on their next open — recommended: yes, that is the flow's job.
- **What the health record gates.** The clinical tables: with
  `health_consent_declined_at` or `_withdrawn_at` set, `injuries` and
  `injury_clinical` refuse a new row for that athlete at the database (a policy
  predicate on the athlete's health state), the New injury form shows a
  BlockedButton naming the reason, and the medic sees "no health data consent"
  on the injuries list. Availability (the coach's non-injury absence, ADR-008)
  is an operational fact, not health data, and is not gated. Wellness is
  performance data on this board (3A's block 1 names it) and is gated by the
  performance record. **Sheet item:** whether wellness (sleep, soreness, mood)
  is health data under Article 9 — the solicitor's call, beside `LEGAL-3B`.

**5. Can the app tell whether it is installed, and can that be stored per athlete?**
Neither exists. The manifest declares `display: standalone` (2026-09-07); nothing
reads `matchMedia('(display-mode: standalone)')` or `navigator.standalone`, and
no table holds a per-athlete device state — `push_tokens` is 43 seeded rows from
the abandoned Expo plan that no code has ever written (`platform-decision.md`:
"Do not read them as devices"). **Built tonight:** the athlete app records, once
per session start, `athlete_devices` (`athlete_id`, `platform`
iOS/Android/desktop from the user agent, `display_mode` standalone/browser,
`push_supported`, `last_seen_at`), one row per athlete per (platform,
display_mode) — the staff reachability figure reads "can receive reminders" as
"has a standalone row" (push itself is S11's; the figure is honest about what it
measures and says so in its caption). **iOS Safari toolbar:** the bottom bar
with the share control in the middle is iOS 15 (September 2021) onward; before
that the bar was at the top with the share control in it — the schematic draws
the bottom bar and the caption names "the share control", which is true of both.
**Android:** Chrome and Edge fire `beforeinstallprompt`, so the card offers a
real "Install" button that calls `prompt()` and keeps the three steps as the
fallback ("Or from the browser menu: Add to Home screen"); Samsung Internet and
Firefox use the menu route. The card's eyebrow reads "From Fydr, not from
Android" there.

**The five findings, carried:** (1) the decline is visible by name on the squad
list — flagged in the build report for the solicitor beside `LEGAL-3C`; (2) a
subject access row beside withdrawal with `LEGAL-3F`, no export; (3) all four
forms lock, above; (4) "no published mean is recomputed retrospectively" is
`LEGAL-3E`'s and nothing recomputes either way; (5) ATH-ADULT-03's 44px submit
is left alone and reported under the accessibility sweep.

---

## PATTERN-S3 — Step 1, what exists for C1, C2, C3 and C6 (item 3)

Read from the schema and the code on scratch, with the sheet rows' own
history (C4, C5, C7, D1 built; C8 decided tonight: body site and side are not
coach-visible, a club setting defaulting to off).

**C1 — the read flag.** `availability` (0042) is the ledger the C7 history is
built on: `id, org_id, athlete_id, status, restrictions[], reason_category,
injury_id, effective_from, effective_to, set_by, note, created_at` —
close-then-insert, one open row per athlete. **Nothing records that the athlete
has seen their current status**; Today's `AvailabilityBanner` renders the open
row on every visit with no memory. The athlete cannot write `availability`
(the coach, the sport scientist and the medic can — 0068). **Proposed and
built:** `availability.athlete_seen_at timestamptz` on the row, set by
`mark_availability_seen()` (definer, the athlete's own open row) when the
status screen is opened; the Today card is emphasised while the open row is
unseen and was set by staff, for every status including a return to
available (the cleared state), and goes the first time the screen is opened.
No timer.

**C2 — the status screen.** Nothing like it exists. The athlete sees the
availability line on Today (`AvailabilityBanner`, with the restriction line
and the body area phrase) and, on Today, their own clinical record through
`injury_clinical_athlete_view` (0009; everything but the working notes; adults
only — `athlete_age_years >= 18` is in the view). `/me` shows the line. **Built:**
`/me/status` — three cards in order (Can I train today · What can I do and not
do · When am I back), answers as sentences, restrictions one row each, the
stage ladder where a protocol exists, medical detail lower and labelled for
the athlete and their medical team, "Not known yet" where the medic has set
nothing, the cleared state after an injury.

**C3 — protocol stages.** A bare counter in a string, and not even that any
more: since PATTERN-S3 D1 `lib/restrictions.ts` strips protocol, stage and
diagnosis entries from the restriction line at every read, and the seed no
longer writes one. `injuries.status` is the only structure
(`open | rehab | return_to_play | closed`); `injury_timeline_event` records a
`stage_change` when that enum moves (0080's trigger). **No stage is data, no
criteria exist, nothing is numbered.** **Built:** `injury_protocols`
(`injury_id`, `total_stages`, opened by the medic) and the append-only
`injury_stage_events` (`from_stage`, `to_stage`, `moved_by`, `moved_at`,
`restriction_line`, `criteria_reviewed`, `reason`), written only by
`move_injury_stage()` — advancing moves exactly one stage and requires a
rewritten restriction line and the criteria-reviewed confirmation; any other
stage requires a reason. Read by the medic and the athlete (their own), never
the coach: the tables carry no coach policy, so a stage is not reachable from
a coach session at the database, and the ladder's words — Done, Now, Next,
Later, Cleared — are state words with no invented stage names. The next
stage's criteria live in the club's protocol, and the screen says so.

**C6 — rehab proposals.** `programme_assignments.status` has `proposed`
(0079); `INJURY_PROGRAMME_PROPOSER` is the S&C; a proposal reaches the athlete
only when the medic signs it off (`signOffProposal` sets `active` and writes a
`programme_signed_off` timeline event — **approval does assign**, the
assignment is the same row). **No returned state and no return reason exist:**
the medic's note stays in the injury timeline the S&C cannot read, and
InjuryTimeline.tsx's own header records that "the medic's reason for sending
it back reaches them in person — a deliberate limit of this build". **Built:**
`returned` joins `assignment_status`; `programme_assignments` gains
`decided_by`, `decided_at`, `return_reason`; `decide_proposal(id, decision,
reason)` (medic only: approve → `active` as today, return → `returned` with a
required reason) and one list at `/programmes/proposals` the S&C and the medic
both see — Proposed, Approved (the `active` row of an injury-linked
assignment, in the board's word), Returned with the reason shown in full. An
S&C re-proposes by assigning again; the returned row stays as the record.

**C8 — body site and side (decided tonight).** Stored per injury as
`body_area` and `side`. Today the coach reads both at the database
(`injuries_staff_select` admits every staff role but the nutritionist) and on
screen (the injuries list, the availability line's phrase, the injury report,
the allocation and rehab boards). **Built with C1:** `organisations.
coach_sees_injury_site boolean not null default false`, and the two columns
taken away from `authenticated` at the table (`revoke select (body_area, side)`)
and given back only through `injuries_staff`, a view that masks them to null
for a coach unless the club's setting is on — so a coach's direct API read
cannot obtain them, which is the check the S3 prompt asks for. The medic, the
sport scientist and the S&C read them as before; the athlete reads their own.
The Club settings page carries the switch (sport scientist only) with both
consequences stated.

**Not in this cluster:** the injury form's two-column split (C9), From/Until
dates on the absence form (C5's open half), the academy slot on the status
screen (the board draws it; nothing in the schema names an academy squad —
"Academy" is a group name, 0116's ruling).

---

## Match participation — Step 1, what exists (item 5a; answer and stop)

**Read from the schema on scratch and the code, 14 September 2026. Nothing
built.** `docs/decisions/scope.md` set the bar: "A product sold to rugby clubs
that cannot say who played is not complete." This is what it can say today.

### What exists for who played, and for how long

- **Nothing records who played or for how many minutes.** There is no
  `match_participation`, no lineup, no minutes column anywhere. The only
  per-athlete tables a match session touches are:
  - `session_participants` (`athlete_id` or `group_id`): who was **expected** —
    the roster the session was built for, not who took the field. The four
    seeded match sessions each carry two rows (two groups); the two September
    fixtures carry 29 athlete rows (the whole squad), which is the same fact
    stated athlete by athlete.
  - `session_attendance` (`attendance`: full | modified | absent | excused,
    `modified_reason`, `recorded_by/at`, migration 0003): **the closest thing
    to "who played"** — a coach records it on the Timetable screen for any
    session, matches included. On scratch two match sessions have 28
    attendance rows each (1 Aug and 8 Aug), the rest none. It records
    presence, not minutes, and "full" for a match means "took part fully", not
    80 minutes.
  - `gps_records.duration_s` (per athlete per session, when a unit was worn):
    the only **minutes-shaped** number in the schema, and only for a Premium
    club with an import. Three of the seeded match sessions have 28 GPS rows
    each. It is time the unit was recording, which is not minutes played.
  - `training_entries` (the athlete's RPE with `duration_min`): 25–28 ratings
    on each seeded match; the athlete's own claim of how long, entered after.
- **The fixture** (`fixtures`: opponent, kickoff_at, venue, home_away,
  competition, importance, status planned | played | cancelled, result as free
  text "W 24-19") carries the outcome and nothing about the team.

So "who played" is answerable today only as "who the coach marked present on
the Timetable", and "minutes" is not answerable at all.

### `sessions.fixture_id` — what writes it

The premise "nothing writes it" is out of date since 9 September:

- `createSession` writes `fixture_id: input.fixtureId ?? null` and **creating a
  fixture creates its linked match session** (`cf12b85`, decided 2026-09-09).
- Applying a week template writes `fixture_id` on the MD (offset 0) session
  (`lib/queries/weekTemplates.ts`).
- Read by the session detail (a link to the fixture), the fixture detail (the
  week's sessions by `fixture_id`), the schedule grid and the athlete report's
  session columns.

Every fixture on scratch created since then has exactly one linked session.
What is **not** written: nothing back-fills a session created before a fixture
existed, and nothing links a hand-made match session to a fixture after the
fact (the session form has no fixture field).

### The seeded match sessions, as they stand on scratch tonight

Four seed sessions titled "Fixture" (`5e550000-…0001/0009/0017/0025`, Saturdays
11 Jul–1 Aug, 19:30, status completed). **Three of the four are already
linked** — to fixtures Harlequins (18 Jul), Gloucester (25 Jul), Bath (1 Aug),
each `status played` with a result, created 8 Aug with `created_by null` (a
seeding run, not a person). One is an orphan: **11 July, no fixture.** Two
things about the three links are worth knowing before any rule is written:
the fixtures' `kickoff_at` is 15:00 while their sessions start at 19:30 (the
seed and the link disagree by four and a half hours); and the seed fixtures
from `f1c50000-…` (Exeter 2 Aug, Bristol 8 Aug, Northampton 22 Aug) each have
their own linked session, so the 8 Aug "Fixture" session (`…0033`) is linked
to Bristol Bears correctly.

### What linking would touch

Nothing in the schema — the column, the FK and the two writers exist. What a
"link" needs is a **rule and a place**:

1. **A place** — the session form and the session detail gain a fixture
   field/action ("This is the match against …") for a `session_type = 'match'`
   session; the fixture detail gains "attach an existing session". Both are
   one update of `sessions.fixture_id` through `updateSession` (audited by
   0104's trigger already).
2. **A rule for the seed** — see below.
3. **Screens that read the link** already do the right thing once it is set:
   fixture detail lists the week, session detail links up, the schedule grid
   suppresses the duplicate fixture block.

Nothing downstream computes from the link (no report joins sessions to
fixtures for a metric), so linking is safe to do without a migration.

### The four orphans (now one): recommendation, not a decision

The options as the queue put them — leave as orphans, link by date, delete —
against what is on scratch:

- **Link by date** is what the 8 Aug seeding run evidently did for three of
  them (same Saturday → linked), and it left the kick-off times disagreeing.
  For the remaining orphan (11 Jul) there is no fixture to link to; "link by
  date" would mean **creating** a fixture for it, which is inventing an
  opponent.
- **Delete** removes 28 RPE ratings and two participant rows that the
  compliance and load figures already count for that week — a change to
  history for the sake of tidiness, and CLAUDE.md rule 4's instinct (nothing
  athlete-linked is hard-deleted) applies to the session they answered for.
- **Leave** costs nothing: an unlinked match session is a legal object (the
  schedule allows a match without a fixture; `fixturesToDraw` handles it) and
  the athletes' entries stay counted.

**Recommend:** leave the 11 July session as it is — an unlinked match, which
the product supports — and **do not manufacture a fixture for it**. When the
"attach an existing session" action exists (1 above), a coach can link it if
an opponent is known. Separately, and worth doing when the fixture form is
next touched: **align the three seed fixtures' kick-off with their sessions**
(15:00 → 19:30, or the reverse) so the fixture detail does not say one time
and the session card another. That is a seed correction on scratch, not
product behaviour.

### What "who played" would need, if it is to be answered (not built)

The smallest honest shape is **match participation as a row per athlete per
fixture**, written by a coach after the match: `fixture_id`, `athlete_id`,
`role` (started | replacement | unused | not in squad), `minutes` (integer,
nullable — "played, minutes not recorded" must be a state), `recorded_by/at`,
audited like attendance. It is not `session_attendance` re-used: attendance is
about training presence and "modified", and a match asks a different question
("started or came on, and when"). A migration, a form on the fixture detail
(the natural place: the fixture is the match), an athlete-facing line on My
data's sessions tab, and the match report's thinness (`scope.md`) answered
from it. Recommend it is briefed as its own row, after the fixture-form
attach action, so the two land in the order a coach meets them.

---

## Premium contents — Step 1, what is premium and what breaks (item 5b; answer and stop)

**Read from the code and the schema, 14 September 2026, under
`docs/decisions/absence-rule.md`, `docs/decisions/premium-downgrade.md` and
`docs/12-product-tiers.md` §3, with 0119's tier gate now at the database.
Nothing built.**

### What is premium today, surface by surface

Two tiers exist in the database: `organisations.tier` = `core` (the UI's
"Basic", the doc's "Club") or `performance` ("Premium"); `isPremium()` is an
equality check against `performance`, so an unknown value fails closed to
Basic. On scratch Ashcombe and Harlow Vale are `performance`, Marlow Vale is
`core`.

**At the database (0119, 13 September):** every staff SELECT / INSERT /
UPDATE policy on `gps_records`, `import_batches`, `import_held_rows` and
`athlete_import_aliases` carries `and auth_org_is_premium()`. A Basic club's
staff read returns no rows, never an error. Written exceptions, tested (740):
the athlete's own `gps_records` self-select (their data, Article 15) and the
service role (the SAR pack). `compute_leaderboard` gates GPS-metric boards
itself (0094).

**At the route or the region (app-side), each one calling `isPremium()`:**

| Surface | Kind | On Basic |
|---|---|---|
| `/analytics` (the four panels) | Whole destination | Absent from the sidebar (`PREMIUM_ONLY`), `PlanGate` at the URL. The only wholly-premium destination. |
| `/reports/gps` and its CSV and PDF | Whole report | Absent from the reports index; `PlanGate` at the URL; the routes refuse. |
| `/settings/imports`, upload, held rows, template, batch export | Whole area (the hook) | The row on Settings reads as locked; the routes refuse; the database returns nothing anyway. |
| Leaderboards on `gps.*` metrics | A region: the catalogue on `/leaderboards/new`, the board page, its export and PDF, the athlete's board list and board page | The GPS metrics are not offered; an existing GPS board refuses with the plan named (`metricWithheld`). |
| The athlete report's GPS columns and tiles | A region | Rendered only on Premium (`isPremium` in the page and the PDF). |
| The Settings hub and Club details | The plan card, the tier label, the preview switch for Fydr staff | "Basic" and the plan card; nothing else changes. |
| ACWR | Computed from RPE × duration on both tiers | Unchanged; `12-product-tiers.md` promises a GPS-load ACWR on Premium that is **not built** (the ratio reads session load only). |

**What is NOT gated and reads GPS anyway** (all correct under keep-and-hide,
because the database now returns no rows to a Basic club): the dashboard's
GPS-flag session lookup, `myLatestRecord`'s `gps` domain (My data's "last
record" line), the squad weekly and training report queries in `reports.ts`
and `trainingReport.ts` (they render GPS sections "only with GPS data" — on
Basic there is none), `leaderboardWall.ts`. Before 0119 these were the leak;
now they are the absence rule's first row working as written.

**Premium in the tier document that has no gate in code** (nothing to gate
because nothing is built, or the gate is missing): GPS-domain **thresholds
and flags** (`flag_domain = 'gps'` rules exist in the seed — "Acute chronic
ratio high" is domain `gps` — and the thresholds screen offers no tier check;
a Basic club can write a GPS-domain rule that never fires because it has no
GPS rows — harmless but unexplained); vendor APIs, API export, named support
(not built; a commitment on the table).

### What a free club sees, under the absence rule

The rule has three rows and the product hits all three:

1. **Bought — silent.** Analytics, the GPS report and the import area are
   gone from navigation and refuse at the URL. The `PlanGate` page names the
   feature and the plan; it does not upsell inside a page. **One deviation
   worth knowing:** the Settings hub's Imports row is present and *locked*
   with the plan named — a premium REGION inside a base page, which the rule
   allows ("an upsell card, never vanishes silently"). The reports index
   simply omits the GPS report, which is the destination form of the rule.
   Both are within the rule; they are two different readings of the same
   absence, and a Basic administrator meets both.
2. **Chosen — visible and reversible.** Session RPE off (0118) and, since
   tonight, the coach injury-site setting (0122): the surfaces stay and name
   the switch.
3. **Not yet done — says so.** Empty states with the denominator.

Where the free club is **under-served by the split as built**: the tier
document's §3.2 promises "GPS views, GPS flags, GPS leaderboards" as the
premium line and everything else in both — and that holds — but it also lists
"Analytics builder, presets, saved views: Both" and "the bar chart is Premium"
(§3.3), which the row-27 amendment reversed (the whole destination is
Premium). §3.2 still says Both; §3.1 row 27 says P. **The document contradicts
itself in two places about one screen**; the code follows row 27. Recommend
§3.2's analytics row is rewritten to "P — the whole destination (row 27)"
when the inventory is written.

### What breaks on downgrade (keep and hide), with 0119 landed

Simulated by reading each premium surface as a `core` club would (Marlow Vale
on scratch, and the Fydr-staff preview which resolves downward only):

- **Nothing is deleted and nothing errors.** GPS rows, batches, held rows and
  aliases stay; the policies return no rows to staff; the athlete still reads
  their own GPS through My data (the written exception). Restore = the tier
  flips back and every read returns; `auth_org_is_premium()` reads the table,
  not the JWT, so it applies on the next request.
- **A GPS leaderboard the club built while Premium** stays in
  `leaderboards`; the board page refuses with the plan named; the athlete's
  board list omits it. `compute_leaderboard` refuses at the database. The
  *manage* list still shows the board's row — a premium region that names
  its state, within the rule.
- **A GPS-domain threshold** stays active and never fires (no rows); its
  flags already raised stay on the Flags screen and the dashboard, readable,
  because `flags` is not a gated table. Correct under keep: a flag raised
  while paying is history. It reads oddly only because nothing on the flag
  says "from a GPS rule your plan no longer reads" — recommend the flag's
  domain word carries the plan note on Basic (one line in `flagWords`).
- **The athlete report** loses its GPS columns silently (rendered only on
  Premium) — the rule's "premium region inside a base page shows an upsell
  card" is **not met there**: the columns vanish rather than say why.
  Recommend one `PlanGateCard` row in the report's GPS section on Basic.
- **The dashboard's GPS flag → session association** and the squad weekly's
  GPS sections degrade to absent without a word; both are data-absence forms
  ("GPS sections render only with GPS data", §3.1 row 28) and the rule's
  third row would want a sentence — but on Basic the truthful sentence is the
  *first* row's ("bought"), which is silent. **This is the one place the
  three-row rule needs a fourth word:** a base club with GPS history it can
  no longer see. Recommend: silent, as the rule says, but the Settings plan
  card states "Your GPS records from before {date} are kept and return with
  Premium" — the one place a downgraded club would look. Needs a read of
  `max(gps_records.record_date)` through the service role or a definer
  function (staff cannot read the table on Basic — by design).
- **Retention** still runs over hidden GPS rows (`lib/retention/compute.ts`
  uses the admin client) — the decision's "kept under the club's normal
  retention" holds without a change.
- **Saved views, scheduled reports of the GPS report** — a `report_schedules`
  row for the GPS report on a Basic club: the run would refuse (the route
  gates). Not verified end to end tonight; recommend a test when schedules
  are next touched.

### The inventory, as the mechanism (S12) needs it

For "what do I get for paying", the true list today is short and honest:
**the GPS import and everything downstream of it** — the GPS report, GPS
leaderboards, the athlete report's GPS columns, GPS flags — **plus the
Analytics destination** (four panels of data every club holds: session load,
readiness, tonnage, ACWR). The second is the only premium thing a Basic club
already has the data for, which is exactly §3.3's argument for keeping it in
both tiers and row 27's decision against. Recommend the inventory names it as
a deliberate choice ("the view is premium, the numbers are not") so the
downgrade card can say the same.

**Decisions this raises (on the sheet with recommendations):** the §3.2 ↔ row
27 contradiction; the athlete report's silent GPS columns on Basic; a plan
note on GPS flags a Basic club still sees; the downgrade sentence on the plan
card.
