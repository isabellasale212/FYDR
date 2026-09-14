# Fydr architecture to-do

**Rewritten 13 September 2026. Reconciled 14 September 2026 (reviewer,
bookkeeping pass) against `docs/decisions/` and the running code and both
databases, read-only.** This is the working list.
`docs/Fydr_-_Architecture_To-Do_List.md` is the ARCHIVE: full incident
write-ups, measurements and reasoning, worth reading when you want to know why
something is true. Several of its statements are now wrong.

**The [verify] items are gone.** Every one was checked on 14 September against
the code at `3e1bdbb` and against scratch and production, both at migration
0127. What was closed is struck with the evidence; what was still open is
stated as open with the evidence. **§8 is the count**: how many rows are
genuinely open, and who each is waiting on.

---

## 1. Standing decisions

See `docs/decisions/scope.md` and `docs/platform-decision.md` for the two most
recent. In brief:

- **Scope:** v1, the complete product across free and premium, ready to sell.
- **Platform:** one web product, two installable web apps, robust offline
  outbox and push on both, no native, Apple Health removed entirely.
- **Design system:** System A (Claude Design's) adopted 14 Sept, in three
  layers, with three of System B's things kept (`--hit-lg`/`--hit-md`, the dark
  theme's colours, `--r-full`) and four rulings the same day (`--fs-*`/`--sp-*`
  stay as the working scale with System A's role names pointed at them;
  `--pad-card` 18px; `--sidebar-w` stays 236px; eyebrows to
  `--t-eyebrow-tracking`). `docs/decisions/design-system-adoption.md`.
- **Roles:** five staff roles, sport scientist holding admin duties. Athlete is
  a separate account type.
- **Injury visibility:** coach, sport scientist and S&C see status,
  restrictions, expected return. **Body site and side are a club setting,
  default OFF** (batch B2, migration 0122). Diagnosis, mechanism, severity,
  imaging, referral, treatment notes are medic-only. Protocol stage is stripped
  at every query read for every viewer.
- **Report visibility:** S&C sees every report except clinical detail.
  Nutritionist sees Compliance and a censored injury and availability report
  only. Squad weekly stays closed to them.
- **Premium boundary (D-20) and the absence rule:** a wholly premium
  destination disappears from the sidebar and refuses at the URL; a premium
  region inside a base page shows an upsell card; a club setting switched off
  leaves the destination in place with its off state; nothing recorded yet is
  an empty state. Downgrade is keep and hide. Analytics is wholly premium, GPS
  included. One plan page in Settings is where a basic club learns what
  premium is. `docs/decisions/absence-rule.md`, `premium-downgrade.md`.
- **RPE:** stays; a club setting (0118); one tap on Today; CR-10, 0 to 10
  (0117). 0 is rest, never missing.
- **Billing:** out of scope permanently.
- **Credentials:** no temporary passwords, invite links only. **Deactivate is
  the revoke** (batch B1): deactivating bans the auth user, so an outstanding
  invite or magic link is refused from the same moment.
- **Schedule:** sessions are not live on create, publish stays (S4 D1
  declined). A rated session opens read-only (B6). Applying a template replaces
  the week, with the consequence named first (B7).
- **Nutrition:** targets recompute on every weigh-in; day types are three
  independent numbers with no shared rate; the resolved side shows the club
  default labelled as the club default.
- **Athlete transfers:** a fresh record, stated plainly, never a silent refusal.
- **Under-18s:** excluded from ranked boards and streak mechanics by age alone;
  the minor's own opt-in removed until the guardian route exists (0116); both
  guardian consent methods are built; reminders default off for athletes, on
  for staff. **No real athlete account is created until the performance
  consent record's name is settled** (lawful basis).
- **Reports:** athletes export nothing; no automatic squad weekly; weeks are
  Monday to Sunday, club local time; the catalogue is eight reports (the
  training report split into GPS and Training load; the match report added).
- **Offline conflicts:** a held availability write that lands after a newer
  value is never applied; refused, shown as a conflict, the medic's value
  stands (B12).

---

## 2. Hard gates: before the first real person touches the app

All Isabella's, not the builder's. None can be closed from the repository.

- [ ] **Supabase Pro, bought against the production project
      (`asbxorjytxsvrzefwzqp`, `eu-west-1`).** Free tier has no automated
      backups and no point-in-time recovery. ~~Decide the production region~~
      **Decided 12 Sept: production STAYS in eu-west-1, Ireland** (the archive's
      Decisions Log; Vercel functions moved to `dub1` beside it). The move's
      four-step recipe stays in the archive in case the decision is ever
      reopened.
- [ ] **Verify `fydr.app` in Resend.** `EMAIL_FROM_ADDRESS` lives in Vercel,
      not in the repository, so this cannot be checked from here. What the
      database shows: one `invite.email_sent` row on production (8 Sept) and
      the from-address is not recorded in it. Until verified, **invites cannot
      reach a real player.**
- [ ] **DPA, legal review, ICO registration — now the six solicitor questions
      in `docs/decisions/lawful-basis-open.md`** (lawful basis for performance
      data under the coach–player power imbalance; the Article 9 condition for
      health data and whether the medic role unlocks the health-care condition;
      controller or processor; the guardian route and the Children's Code;
      whether a DPIA is required; the DPA template). **On the critical path
      ahead of S9's legal placeholders and therefore ahead of the first club.**
      The under-18 question rides with it.
- [ ] **Tell the medical staff that the injury `mechanism` field is
      athlete-visible.** No length limit, no constraint, no guidance shown to
      the medic typing it. A live example already carries an assessment
      finding. A conversation, not a ticket.

---

## 3. Open security and correctness

- ~~**Invitation revoke does not exist (S8 D5).**~~ **Decided (batch B1) and
  built 13 Sept: deactivate is the revoke** — the auth user is banned, the
  invite, a magic link and a password sign-in all refused from the same moment;
  `user.invites_revoked` audited. Guard `test:revoke`.
- ~~**Archived groups keep scoping every screen (S8 D9).**~~ **Built 13 Sept
  (`0427575`, with the §0ak cookie fix):** `resolveGroupFilter` drops ids that
  are not live groups, the shell rewrites the cookie and says so once.
- [ ] **`auth.audit_log_entries` has never received a row.** *Re-checked 14
      Sept, read-only: 0 rows on scratch and 0 on production.* Two questions
      remain, both outside this repository: whether GoTrue needs it enabled,
      and whether the dashboard retains the history independently.
      **Outside.**
- [ ] **Sign-in attempts against unknown addresses are recorded nowhere.**
      *Verified 14 Sept: still true — `signInSubmission.ts` writes the failed
      sign-in audit row only for accounts that exist.* Approved: a
      platform-level view gated by `isPlatformStaff()`. Settle two things while
      building: what is stored in place of the attacker-controlled email, and
      whether every attempt is written or only streak boundaries. **Build.**
- [ ] **Audit trigger widening: 35 of 66 tables** (was "26 of 59"). *Counted
      14 Sept on production and scratch, identical.* 0088, 0089 and 0091 are
      on production. **`organisations` now has a trigger** — the "excluded for
      shape" note is stale. **`sessions` and `session_participants` have had
      triggers since 0104**, so batch A5's audit-log sentence ("Sessions and
      schedule changes are not written to the log yet") is false on the running
      screen — see §5. The 30 tables without one: `athlete_devices`,
      `athlete_import_aliases`, `body_mass_target_ranges`,
      `compliance_expectations`, `flag_actions`, `flags`, `gps_records`,
      `group_memberships`, `groups`, `guardian_consent_requests`,
      `import_batches`, `import_held_rows`, `injury_protocols`,
      `injury_stage_events`, `login_attempts`, `meal_library`,
      `meal_library_items`, `metric_definitions`, `notification_preferences`,
      `nutrition_rules`, `nutrition_targets`, `problem_report_notes`,
      `problem_reports`, `push_tokens`, `seasons`, `session_attendance`,
      `teams`, `test_definitions`, `threshold_revisions`, `vendor_profiles`.
      Rules unchanged: `audit_log` never gets a trigger; `session_attendance`,
      `group_memberships`, `compliance_expectations`, `flags` and
      `flag_actions` are the high-volume set and need Isabella's decision, not
      a sweep; `metric_definitions` has no `org_id`. **`groups`, the nutrition
      tables, `test_definitions` and `injury_protocols` /
      `injury_stage_events` are the low-volume, human-actor tables the next
      batch should take.** **Build (the batch); Isabella (the five high-volume
      tables).**
- ~~**Migration 0090**, four tables holding grants their migrations say they
  do not have.~~ **Closed.** *Verified 14 Sept on both projects:
  `injury_timeline_event` authenticated INSERT,SELECT; `login_attempts` SELECT;
  `sar_requests` INSERT,SELECT,UPDATE; `sar_clinical_reviews` INSERT,SELECT;
  nothing for `anon` — exactly the intents 0090 restored.*
- ~~**`app_role` enum** said to hold four values rather than five.~~
  **Closed.** *Verified 14 Sept: six values on both projects — athlete, coach,
  medic, sport_scientist, strength_conditioning, nutritionist.*
- [ ] **NEW, 14 Sept: the audit log's coverage sentence is wrong.**
      `settings/audit/page.tsx:199` says "Sessions and schedule changes are not
      written to the log yet"; they have been since migration 0104
      (`sessions.create/update`, `session_participants.add/remove`, measured on
      the test club on 12 Sept). The sentence was batch A5's; A5 assumed the
      trigger was still to come. **Build** (one sentence; `groups` is what the
      log genuinely cannot show).

---

## 4. Open product decisions

- ~~**Does a fixture create a linked match session?**~~ **Decided 14 Sept and
  built 15 Sept:** `sessions.fixture_id` has been written since 9 Sept; the
  orphan gets an attach action, no backfill (0127).
- ~~**Does the app record who played and how many minutes?**~~ **Built 15
  Sept:** `match_participation` — started, came on, minutes, nothing more; the
  coach's post-match sheet on the fixture; the match report at `/reports/match`.
- ~~**RPE scale.**~~ **Decided and built (0117):** 0 to 10, CR-10; 0 is a real
  value.
- ~~**Who may change an athlete's availability status.**~~ **Settled at the
  database and accepted (ADR-008, migration 0068; D-35):** injury-linked
  availability and closing an injury are the medic's alone
  (`availability_medical_*`, `injuries_medical_update`); a non-injury absence
  (illness, personal, academic, representative, other) is the coach's and the
  sport scientist's (`availability_coach_*_noninjury`). *Read from
  `pg_policy` on production, 14 Sept.*
- [ ] **Wellness notification timing:** every morning at 08:00, or only on
      mornings a check-in is expected. Written in `docs/platform-decision.md`
      part two as expected mornings only, **marked "OPEN, Isabella to confirm"**
      there. Note that the wellness *expectation* itself is unconditional daily
      (0044: one row per athlete per day), so "expected mornings" is every
      morning unless that rule changes. **Isabella.**
- ~~**The clinical-conflict rule for staff offline.**~~ **Decided (batch
  B12).** The build rides with PATTERN-S6 C4 on the S11 foundation (§5).
- ~~**Premium:** contents, what a free club sees in its place, downgrade.~~
  **Decided 13–14 Sept and built 14–15 Sept:** keep and hide; the plan page;
  `PlanGateCard`; the tier gate at the database (0119, 0125); the three gaps.
- [ ] **Retention period after an athlete leaves a club.** *Still nowhere: the
      retention schedule (`52-data-retention.md`) has no "after leaving"
      clock, and there is no way to mark an athlete as left at all (archive
      §0be).* **Isabella, with the solicitor** — it belongs in the same
      conversation as the DPA.
- [ ] **GPS raw data:** does the vendor export per-reading data at all, what
      would the screen show, how long are readings kept. The first gates both.
      **Outside (the vendor).**

---

## 5. Build backlog

**Boards still to draw:**

- [ ] **S11, installability and offline.** *Inventory done 13 Sept; verified
      14 Sept that nothing has been built since: no service worker anywhere
      (no `public/`, no `sw` file, no `serviceWorker.register`), the manifest
      is `src/app/manifest.ts`, the four athlete queues are still
      `localStorage`, staff writes are not queued.* Manifest, icons, splash,
      app shell, one shared IndexedDB outbox for both apps, service worker,
      retry with backoff, visible queue state, manual "send now" (Isabella's
      ruling needed — the S6 board said none), last sync time, the on-screen
      teaching of the iOS install flow. **The board is Isabella's to commission;
      the build is the builder's after it.** It carries with it: S6 C4 and C5
      (staff offline, rule decided), S6 D1 (the offline token), S6 C3 (the
      form that survives expiry, decided B9), the guardian link's rate limit,
      and STAFF-SS-01 C4 once S9's sender exists.
- ~~[ ] **S12, premium.**~~ **The mechanism is built without a board (14–15
  Sept).** One line from Isabella that no board is wanted closes it.

**S9, notifications.** Specified in `docs/platform-decision.md` part two.
*Verified 14 Sept: not started — no service worker, no VAPID keys, no
subscription table (0121 `athlete_devices` is the reachability figure, not a
push subscription); the preference columns exist (0008) and no screen sets
quiet hours.* `push_tokens` holds 43 seeded rows from the abandoned Expo plan
that no code has ever written; do not read them as devices. **Build, after
S11's service worker; the consent flow (S9 artboards 1–6) is built and gated on
the LEGAL placeholders.**

**Decided on the sheet, not yet built** (each a row on
`docs/design-decisions-outstanding.md`, marked DECIDED · unbuilt there):
body mass as a flaggable metric on change over time (B3); MET-014 retired from
the registry (B4); the profile panel order, one order one exception (B5) and
the phone jump bar with it; the rated session read-only (B6); the template
replaces the week with the consequence named (B7); Today's gym row (B8); the
part-filled form surviving expiry (B9); one PDF renderer with Print opening it
(B10) and the two print tokens with it; "the week has closed" on a refused
held item (A20); the injury form split by permission (S3 C9, unblocked by C8);
PATTERN-S5's authoring rows (C2/C5/C6 the effective date, C3/C10 the
adjustment screen with its check, C8 "each side", C9 the block view).

**Known bugs and gaps** — verified 14 Sept:

- ~~Re-uploading a GPS file duplicates every row.~~ **Closed (0064/0072).**
  *Re-imported on the test club 12 Sept: 3 rows, not 6; the corrected value
  replaced the old.*
- [ ] GPS import accepts ten headings; running distance and high intensity
      efforts are rankable measures with data that no upload can update.
      *Still true: `gpsImport.ts` has no heading for either.* **Build · small.**
- ~~The new week template screen gates on "coach or medical".~~ **Closed:**
  `planner/new/page.tsx` gates on `SESSION_EDIT`.
- ~~The new fixture screen's expired-session guard does not fire.~~ **Closed:**
  `createFixture` calls `assertLiveSession` before any write
  (`schedule.ts:931`).
- ~~Session deletion gives a worded refusal for two linked types and a generic
  error for the other four.~~ **Closed:** one rule — "This session has
  recorded data. Cancel it instead." / "This session is in the past. Cancel it
  instead of deleting it." (`schedule.ts:1442-1445`).
- ~~Editing a test's direction does not recalculate personal bests.~~
  **Closed in substance:** the personal best is picked at read time by the
  definition's current direction (`testing.ts:615`, the "phantom PB" fix), so a
  direction edit needs no recalculation. Residual, small: `is_best` within one
  session is stamped at insert by the direction of the day.
- [ ] The retention run is neither resumable nor transactional. **Decided as a
      known limitation (D-43)** with the recommendation "make it resumable";
      *verified 14 Sept: unchanged (`retention/compute.ts`, sequential, returns
      on the first error).* **Build · low.**
- [ ] Positional groupings are a hardcoded six-unit rugby mapping and need a
      club-level table. *Still true: `nutritionRules.ts:111` and
      `leaderboardWallMath.ts:132`.* **Build (⚠ migration) · medium.**
- ~~The launch sign-in page headline and feature grid.~~ **Closed:**
  `.launch-claim-h` is `clamp(34px, 3.5vw, var(--fs-48))` at `--w-black` in
  the product face; the Sora question is moot (the face is Roboto).
- [ ] The collapsed sidebar rail's 5.6px ringed dot. Correct, and faint.
      **Cosmetic; re-measure in the accessibility re-run after conformance.**
- [ ] **NEW, 14 Sept:** the audit log's coverage sentence (§3, last item).

**Permission tightenings** — ~~agreed and [verify] unbuilt~~ **all built,
verified 14 Sept in `access.ts` and, for the write paths, at the database on
the test club (12 Sept: every wrong role's insert on `sessions`, `thresholds`,
`groups`, `programmes`, `nutrition_targets`, `meal_library`, `leaderboards`,
`gps_records` refused with 403):** schedule editing to coach and sport
scientist (D-06, `SESSION_EDIT`); nutrition authoring to nutritionist and sport
scientist (D-03, `NUTRITION_EDIT`); gym programmes to S&C and sport scientist
(D-04, `PROGRAMME_EDIT`); group create, edit, delete to coach and sport
scientist (`GROUP_EDIT`); analytics to sport scientist only (D-02,
`ANALYTICS`); availability-setting and injury-closing on the injury record to
medic only (D-35, `injuries_medical_update`, `availability_medical_*`).
**Leaderboards (D-05)** were recommended as S&C and sport scientist; the access
matrix's 2026-09-05 correction keeps the coach (VECD) and `LEADERBOARD_EDIT`
matches the matrix — D-05 is superseded by the matrix, not unbuilt.

**Smaller agreed items** — verified 14 Sept:

- [ ] A dismissed flag reopenable by coach or medic. *Not built: `dismissFlag`
      exists, no reopen.* **Build · small.**
- [ ] A real delete for exercises, refused by name if a live programme
      references it. *Not built; there is no exercise detail page at all
      (audit finding 33), which is where it belongs.* **Build · small–medium.**
- [ ] Gym programme changes versioned with a warning naming how many athletes
      are assigned. *This is PATTERN-S5 C2/C5/C6 — one item, counted there.*
- ~~A warning before editing a leaderboard's measure.~~ **Moot:** a board's
  measure cannot be edited (create, publish, delete only).
- ~~"Retire a board" renamed "Delete a board" and explicitly irreversible.~~
  **Built** ("Delete this board? This cannot be undone.").
- ~~A warning when granting a role that combines with nutritionist.~~ **Built**
  in the role-change preview (S8 C4, D-25 stated).
- [ ] Quiet hours per person. *The columns exist (0008); no screen sets them.*
      **Part of S9.**
- [ ] The timetable linked from the dashboard. *Not built: the dashboard links
      the compliance report, the setup checklist and each session's own page.*
      **Build · tiny, or drop** — the timetable was folded into Schedule.
- ~~The injuries screen kept out of the sidebar.~~ **True as built.**
- ~~The analytics readiness calculation relabelled "Complete-day readiness".~~
  **Done in substance:** the analytics panel's definition line reads "the five
  morning answers on 0 to 100, a day missing any answer has no value (MET-002)";
  the label stays "Readiness".
- ~~Match days count as training days for wellness expectation.~~ **Moot:**
  the wellness expectation is unconditional daily (0044), match day or not.

---

## 6. Working rules that must not be lost

- **Tests first, Run-verified with a real write, report after each batch, tell
  Isabella before deploying.** No exceptions.
- **Scratch database only for agent work.** No production writes, no `db:push`
  to production, no Vercel commands from the builder.
- **Deploys run from a clean worktree at an approved commit, database first,
  then app.** `vercel link` always carries `--scope fydr --project fydr`, and
  the `project.json` id is compared before deploying. Rollback commands are
  emergency-only and never part of a normal paste. **Do not deploy anything
  between `d6fb005` and `075d5ce`** (the broken stylesheet).
- **Do not blanket-approve batches mixing cosmetic fixes with access control.**
- **Check each table's actual shape before assuming a pattern fits.** Two shape
  surprises in ten tables, twice.
- **A policy replacement must assert what the old policy refused**, not only
  what the new one allows.
- **Guards run in `prebuild` and fail the build:** invisible-gate,
  default-privileges, service-role grants, audit-trigger volume,
  inclusive-copy, session-creating-route sweep, policy-replacement,
  `check:css-parses` (the stylesheet as CSS, not text — added 14 Sept after
  six commits shipped a parse error the text guards could not see).
- **Seeded dates drift.** `seed.sql` authors dates as offsets from
  `current_date`. Re-check before any demo.
- **Harlow Vale RFC (`d4174e69`, scratch) is the standing demo club.** Keep
  it; the test-club run resumes there.

---

## 7. Closed, as one-liners

Audit triggers on 35 tables, on production. Sign-in history in `audit_log`
including the PKCE reset path. Failed sign-ins against real accounts recorded.
Real client IP and user agent forwarded to GoTrue. `login_attempts` execute
grant fixed and put in the migration history. `users.last_seen_at` written on
sign-in and excluded from the audit diff. The GPS tier gate moved inside
`compute_leaderboard`, then to every GPS policy (0119) and analytics (0125).
Default-privilege gaps closed, 0090 included. Email sending live for invite and
reset. The invisible-gate guard and the six real bugs it found. 108 occurrences
of "he" about athletes rewritten. Timetable and attendance permissions. Flags
and player-profile field-level rules. Favicon, apple-icon, OG image and
manifest, all previously 404. The five-role model throughout. Deactivate is the
revoke. `users_self_update` narrowed (0109); a complete gym session refuses a
new set (0110); the offline publish keeps the week and the message. Every
permission refusal logged with a reference. Match participation and the match
report. The premium mechanism end to end. System A adopted in three layers.
**Migrations 0101 to 0127 on production.**

---

## 8. The count — 14 September 2026

Rows genuinely open across this file and `docs/design-decisions-outstanding.md`,
after the reconciliation. A row is counted once, where it is waiting.

### Waiting on a build — 33 rows

The builder's, in the order the sheet and this file name them. Ten are rulings
already in hand.

| # | Row | Where | Size |
|---|---|---|---|
| 1 | Body mass as a flaggable metric on change over time (B3) | sheet · SS-01 D7 | medium |
| 2 | Retire MET-014 from the registry (B4) | sheet · SS-01 D8 | small |
| 3 | Profile panel order, one order one exception (B5) | sheet · SS-02-05 C4 | medium |
| 4 | The phone profile's jump bar and "All panels" sheet (with 3) | sheet · SS-02-05 C3 | medium |
| 5 | The injury form split by permission, the pitch-side form (C8 decided) | sheet · S3 C9 | medium |
| 6 | A rated session opens read-only with the reason (B6) | sheet · S4 C4 | small |
| 7 | Applying a template replaces the week, consequence named (B7) | sheet · S4 C7 | medium |
| 8 | Prescription writes state their effective date; the mid-block confirmation | sheet · S5 C2/C5/C6 | medium |
| 9 | The per-athlete adjustment screen with the note's check (⚠ migration) | sheet · S5 C3/C10 | medium |
| 10 | "each side" on a unilateral exercise (⚠ migration) | sheet · S5 C8 | small |
| 11 | The block view, weeks down, "not reached" never 0 of 24 | sheet · S5 C9 | medium |
| 12 | Today's gym row with its count (B8) | sheet · S6 C2 | small |
| 13 | A part-filled form survives session expiry (B9; on S11) | sheet · S6 C3 | medium |
| 14 | Staff offline writes queue, the conflict rule as B12 (on S11) | sheet · S6 C4 | large |
| 15 | The schedule offline: drag disabled, + Session queues (with 14) | sheet · S6 C5 | medium |
| 16 | "Could not be sent — the week has closed" on a refused held item (A20) | sheet · S6 C10 | small |
| 17 | The offline tone token, if no wash reads right (with 14) | sheet · S6 D1 | — |
| 18 | One PDF renderer, Print opens it (B10) | sheet · S7 C4 | medium |
| 19 | `--print-paper` / `--print-ink` dated with 18 | sheet · S7 D3 | — |
| 20 | The five class-3 colour-alone rows (3.1–3.5), one commit after conformance | sheet · A11y | small |
| 21 | The check-in's submit to 56px (`--tap-commit`) | sheet · S9 finding 5 | one line |
| 22 | The accessibility re-run from the top against the settled product | sheet · A11y measurements | medium |
| 23 | The guardian link's rate limit (with S11) | sheet · S9 | small |
| 24 | The audit-trigger batch: `groups`, the nutrition tables, `test_definitions`, the injury protocol tables | §3 | medium |
| 25 | Sign-in attempts against unknown addresses, the platform-staff view | §3 | medium |
| 26 | The audit log's false coverage sentence | §3 / §5 | one line |
| 27 | S9 push: service worker, VAPID, subscriptions, the send path, quiet hours (after S11) | §5 | large |
| 28 | GPS import headings for running distance and high-intensity efforts | §5 | small |
| 29 | The retention run made resumable (D-43) | §5 | low |
| 30 | Positional groupings as a club-level table (⚠ migration) | §5 | medium |
| 31 | A dismissed flag reopenable by coach or medic | §5 | small |
| 32 | A real delete for exercises, refused by name (with the exercise detail page) | §5 | small–medium |
| 33 | The timetable link from the dashboard — or drop it | §5 | tiny |

Not counted above, because it is one board and one build that carry rows 13,
14, 15, 17, 23 and 27 with them: **S11** (row 1 of the next table).

### Waiting on Isabella — 17 rows

| # | Row | Where | What is needed |
|---|---|---|---|
| 1 | **S11, installability and offline — the board** | §5 | commission the board; the build follows |
| 2 | S11 "send now": the platform decision asks for it, the S6 board refused it | sheet · S11 | one line (recommend: on the queue screen only) |
| 3 | S12: confirm no board is wanted now the mechanism is built | sheet · S12 | one line |
| 4 | ATH-ADULT-10 C2: declined 12 Sept, "unblocked" by B11 on the 13th | sheet · (d) | one line: which stands |
| 5 | ATH-ADULT-12 C8: the period control as a menu, athlete-only | sheet · (d) | wanted or not |
| 6 | Testing sentence Q3: reword "never assigned", or add test assignment | sheet · S7 catalogue | one line |
| 7 | S9 seed backfill: keep it, or every existing athlete through 3A | sheet · S9 | one line |
| 8 | S9 password rule two: the athlete's own checkbox stays | sheet · S9 | one line |
| 9 | A rendered accessibility check in prebuild or nightly | sheet · A11y guards | decide |
| 10 | The five accessibility rulings the re-run will ask for | sheet · A11y rulings | one line each |
| 11 | Gym per-set RPE and template `planned_rpe` outside the club setting | sheet · RPE package | one line (recommend: outside) |
| 12 | The medic's injury CSV: four clinical columns, or reword the sentence | sheet · four small things | one line |
| 13 | Wellness notification timing: 08:00 every morning, or expected mornings | §4 | confirm |
| 14 | Retention period after an athlete leaves (with the solicitor) | §4 | decide |
| 15 | The five high-volume tables and the audit trigger | §3 | decide |
| 16 | Supabase Pro | §2 | buy |
| 17 | Verify `fydr.app` in Resend | §2 | do |

Plus the conversation with the medical staff about the `mechanism` field (§2),
which is a conversation and not a row.

### Waiting on somebody outside the product — 8 rows

| # | Row | Where | Who |
|---|---|---|---|
| 1 | Lawful basis, Article 9, controller/processor, the Children's Code, the DPIA, the DPA template — the six questions | §2 · `lawful-basis-open.md` | a solicitor |
| 2 | The LEGAL placeholders in the built consent flow (LEGAL-1A, 3A–3F, 4A); no real athlete account until the performance record is named | sheet · S9 | a solicitor |
| 3 | Whether a practitioner-registration field unlocks the health-care condition | sheet · Children's Code | a solicitor |
| 4 | The visible decline in the squad list beside "saying no does not affect selection" | sheet · S9 finding 1 | a solicitor |
| 5 | Whether sleep, soreness, mood and stress are Article 9 data | sheet · S9 | a solicitor |
| 6 | `auth.audit_log_entries` never receives a row | §3 | Supabase / GoTrue |
| 7 | GPS raw data: does the vendor export it, what would the screen show, how long kept | §4 | the GPS vendor |
| 8 | A discarded import spelling held again next time | sheet · four small things | parked until a club asks |

**Total genuinely open: 58 rows** — 33 on the builder (ten of them already
ruled), 17 on Isabella (most one-liners; one board; two purchases), 8 outside
(five with one solicitor). Nothing else on either file is open: the rest is
built, declined, cut, moot or superseded, and says which.
