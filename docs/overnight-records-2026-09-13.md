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
