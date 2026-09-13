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
