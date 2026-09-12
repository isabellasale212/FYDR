# Pilot-readiness list — for the morning of 2026-09-12

*Compiled the evening of 2026-09-11 (first committed as `pilot-readiness-2026-09-11.md`, renamed on Isabella's overnight queue). Re-checked against the to-do list at the time of the rename; the overnight summary notes any handover that changed a line.*

Compiled by the reviewer from every open item on `docs/Fydr_-_Architecture_To-Do_List.md` (§0r onward, plus everything older still unticked), against the code as it stands at `bbbcf72` and production at `7df310e` + migrations through `0102`. One line per item, by its section and line. Group 1 says what fixing it needs: **build**, a **decision** from Isabella, or **both**. Nothing here changes code.

The 2026-09-04/05 decision queue (§0b, L710–759) was never ticked as it was built; the last section sorts it into what the code already does and what is still open, so the groups above it are not padded with finished work.

## Group 1 — blocks a pilot

Data loss, wrong data shown, security, or something a club would see go wrong in its first week.

| # | Item | Needs |
|---|---|---|
| 1 | **§0a L318 / §2 L1981 — Supabase is on the Free tier: no automated backups, no point-in-time recovery.** First real athlete's data has no restore path. | **You** — decided 2026-09-12: gated on signing the pilot club; hard gate before the first real account. |
| 2 | ~~**§0al L1289 — a network failure at schedule publish wipes every pending change.**~~ | **Closed overnight, `71035f5`** — sessionStorage round-trip, no refresh after a failure. |
| 3 | ~~**§0aa L1128 — a gym set queued offline is silently discarded.**~~ | **Closed, `75c6a6e`** — a differing value is a visible conflict with two ways out. |
| 4 | ~~**§0u L995 / L1005 — "Sessions logged" counts sessions that were only opened.**~~ | **Closed overnight, `068e5ba` + `e052fd0`.** |
| 5 | ~~**§0ad L1176 — the compliance report counts an RPE as submitted however late it arrives.**~~ | **Closed this morning, `9ec24c8` + `67cf9aa` + `0c63b4c`** — 284 of 631 this season (was 302); James Barnes 51% (was 52). Migration 0105 is on scratch only. |
| 6 | **§0e L92 — tell the medical staff that `mechanism` is athlete-visible.** A medic who writes a mechanism note thinking it is private is the first-week incident this list exists to prevent. | **You** — confirmed 2026-09-12: you have the sentence and deliver it. |
| 7 | **§4 L1991 / L1992 / §5 L1998 — special-category (medical) data obligations confirmed, a DPA template, and legal review before the first pilot club.** Real athletes' injury records without a signed DPA is the exposure, not a bug. | **You / legal** — 2026-09-12: solicitor quote being obtained. |
| 8 | ~~**§0ai L1255 (+§0ah L1242) — a session can be created with no type, no groups, no duration.**~~ | **Closed at the form overnight, `eff27bb` + `586520d`** — measured: duration `required`, "Choose at least one group." refusal. Two edges remain as Builder questions 1, 2 and 4 (nullable column, week-template path, the grid's "Add to day"). |
| 9 | ~~**§0at — gym tonnage stored only after a correction.**~~ | **Closed, `5003959` + migration 0106** — derived through the view; 0 of 45 null; 0106 on scratch only. |

Not in group 1, and why: §0aq (the sign-in timing floor) is security, but the production measurement shows the real and unknown paths matching — it is a latent weakening, not an exposure; it sits in group 2. §0ae part 2 is closed by 0102 on production (box closed today). §0e L185 (49 of 59 tables unaudited) is posture, not a week-one failure; group 3, with the sessions slice in group 2.

## Group 2 — should fix before pilot

Visible and embarrassing; no harm.

- ~~**§0af L1220** — below 768px the sidebar stacks 640px above every staff screen.~~ **Closed, `af09c17`** — bottom bar + More sheet, 44px floor applied generically; measured.
- ~~**§0s L903** — the athlete check-in's submit button sits 229px below the fold.~~ **Closed overnight** by the ATH-ADULT-03 build (`6618b7f` + `5ae00ea`, merged `b13cc29`); the footer pins and the button measures inside the viewport at scroll 0.
- ~~**§0u L961** — the gym prescription line reads "3 × 8 @ No 1RM test linked to this exercise yet."~~ **Closed, `a546137`.**
- ~~**§0u L971** — the nutrition check-in says "this week" about a week that has ended.~~ **Closed, `fc3c5e0`.**
- **§0u L987** — a failed gym set retries only from Today, so the set count stays wrong for the rest of the workout.
- ~~**§0z L1100** — "Turn notifications back on" resets every preference.~~ **Closed overnight, `d8938b1` (migration 0103, scratch only).**
- **§0aa L1130** — `/programme/nutrition` says "your last recorded weight" without saying it is the staff skinfold measurement, while `/me` shows the athlete's own self-reported mass.
- ~~**§0ah L1242** — a session saves with no duration.~~ **Closed at the form, `586520d`**; the nullable column and the week-template path are Builder questions 1 and 2.
- ~~**§0aj L1262** — "What the athlete sees" says an RPE is "due by 19:45".~~ **Closed, `5f68cb6`** — "RPE due from HH:MM" from `rpeDueAt`.
- ~~**§0aj L1264** — "Yes, remove" on a staged draft promises an undo that does not exist.~~ **Closed, `b2062d3`.**
- ~~**§0ak L1273** — the group filter is a cookie on one screen and a URL parameter on another.~~ **Closed overnight, `f2b72ea`**, exercised both directions.
- ~~**§0al L1293** — publishing or removing a session writes no audit row.~~ **Closed overnight, `f5a59c4` (migration 0104, scratch only).**
- **§0ap L1327** — the leaderboard builder says "Tap one below to see why" and the disabled chips cannot be tapped. *Not built (`220d8e9`): Builder question 8 — reachable tap vs inline reason is yours to decide.*
- **§0ap L1329** — the Settings hub's Log out row is a 5px-wide target dressed as a row (the sidebar's Log out works, so not blocking).
- ~~**§0ap L1333** — subject-access, retention and the board ranking scroll the page sideways at 375.~~ **Closed, `6235ae5`** — 375 on all three.
- ~~**§0ap L1331** — Exports says "Coach access" to the sport scientist.~~ **Closed, `e59dceb`.**
- ~~**§0as** — the GPS import page says re-uploading duplicates rows.~~ **Closed, `effc471`.**
- **§0aq L1339** — failed sign-ins from Dublin take 1.1–1.6 s, above the 800 ms floor; profile and decide whether to raise `FAILED_SIGN_IN_MIN_MS`.
- ~~**STAFF-SS-01 D1**~~ — **decided 2026-09-12 (Isabella): the staff phone shell is a bottom bar with a "More" sheet**, superseding §0af's top bar. Staff phone work can proceed against the STAFF-SS-01 board.
- **§0e L181** — "some pages, including a forgot-password page, show the wrong logo": `/login/reset` measured correct on production; needs you to say where you saw it before anyone can fix it.
- ~~**§0e L244–251** — move production to London.~~ **Decided against 2026-09-12:** production stays in eu-west-1; the compliance doc now states Ireland and the EEA-adequacy basis and withdraws the "stays in the UK" claim.
- **§0b L713** — a saved group-filter cookie naming a deleted group: behaviour unverified (decided target: fall back to everyone). A club renames or deletes a group in week one.
- **§0b L723** — the analytics screen's stricter readiness needs its own label ("Complete-day readiness"); not found in the code.
- **§0b L728** — the New week template screen's gate reads "coach or medical", not "coach or sport scientist"; a medic can get in. Unverified today; a role-gate item, so yours to confirm before it is scheduled.
- **§0b L729** — New fixture: an expired session on submit silently redirects with nothing saved.
- **§0b L731 / L732** — wellness expected on training days only, derived from the schedule (and whether match days count). If compliance still expects a check-in on rest days, the percentage is wrong the way §0ad's is; verify before deciding.
- **§0b L734** — a nutrition plan for an athlete with no recorded weight should give general guidance, not skip them; not found in the code.
- **§0b L740 (D-05)** — coaches can create and delete leaderboards; the 2026-09-04 decision said view-only. The code's comment records the current state as deliberate; decision needed either way.
- **§0b L755 (D-35)** — only a medic should close an injury; availability by the coach is the documented non-injury exception. The "close" half is unverified.
- **§0b L759 / §4 L1993–1994** — retention period after an athlete leaves; encryption at rest confirmed; CLOUD Act exposure. Compliance-doc inputs the DPA (group 1, #7) will need.
- **§0e L589** — Supabase's own `auth.audit_log_entries` is empty on both projects; the app's own sign-in audit covers the practical need, but the vendor table being empty is worth one support question.

## Group 3 — after pilot

Accessibility, cosmetics, deferred features, and process notes.

- **§0t L915 / L945 / L953** — CR10 ratings 4 and 6 have empty accessible names; "Add a note" drops focus to `<body>`; a stale CSS comment on anchor positions.
- **§0u L967 / L983** — gym set buttons at 42px; the three nutrition answers are not a radio group.
- ~~**§0w L1060**~~ (closed by `98cfeec`), **§0y L1092 / L1094** — "Show them again" with no link affordance; two back controls on `/me/leaderboards`.
- **§0aa L1124 / L1126** — two `<h1>` on `/programme`; "1 characters over".
- **§0ab L1136** — the no-role screen (C3), deferred by decision.
- **§0ad L1182** — the RPE subtitle's "· 20 sec" has no binding source.
- **§0af L1226 / L1228** — "+ Invite people" without `aria-expanded`; role toggles under copy that says "tick".
- **§0ai L1253 / L1257** — the "Week plan" tab is a `<span>`; "Rehab" is both a type and a group.
- **§0aj L1268** — two unlabelled inputs in the draft wizard.
- **§0am L1298 / L1300** — the leaderboard lens is tabs without a tablist; the plan list has no selected state.
- ~~**§0ao L1317** — prebuild prints ~51 expected error lines per build.~~ **Closed overnight, `dd02445`** — the chain writes nothing to stderr.
- ~~**§0ar L1347** — failed sign-in audit rows record no user agent.~~ **Closed overnight, `4c7a127`.**
- **§0e L81** — push notifications, on hold by decision until ~3 weeks of real sign-in data.
- **§0e L185** — widen the audit triggers across the remaining 49 tables, in batches (sessions first — group 2).
- **§0b L687** — the platform-level view of sign-ins against non-existent addresses; "not urgent" by its own text.
- **§0b L711** — quiet hours: columns exist, no screen.
- **§0b L715 / L726 / L727 / L741** — verification tasks: test-direction recalculation, a stale ACWR comment, template-edit safety for older weeks, the two un-uploadable leaderboard measures.
- **§0b L716** — a Timetable link from the dashboard (the schedule has one).
- **§0b L720** — warn before granting a role that combines with nutritionist.
- **§0b L733** — Settings designed as one coherent screen.
- **§0b L735 / L736 / L737 / L738 / L743 / L744 / L745** — reopen a dismissed flag; GPS halves; the D-11 verdict cutoffs (not found by grep — verify); warn before editing a board's measure (no such edit exists in the UI today); exercise delete; programme-edit warning; programme versioning.
- **§0b L748–751, §3 L1988, §2 L1982** — the shared offline-then-sync foundation, service worker and IndexedDB. Large; §0al's narrow fix (group 1) is the pilot-relevant slice.
- **§0b L752** — club-configurable positional groupings (a rugby pilot uses the hardcoded six).
- **§0b L754** — two "sync" buttons with the same name.
- **§0b L758** — the retention run is not resumable or transactional; no retention period elapses in a pilot.
- **§0f L1356**, **§0g L1368 / L1378** — seed dates drift; a two-point area fill; the gym clock's unbounded minutes.
- **§0k L1807 / L1809 / L1811 / L1813**, **§0l L1839**, **§0m L1873**, **§0n L1900**, **§0p L1957** — a 0.5px spec divergence; UA-default font sizes on two controls; rem spacing; five dead inline margins; unused breakpoints; no client-side validation (a product decision); no icon library; truncate refusal not widened to the other immutable tables.
- **§1 L1965–1969** — raw GPS readings: what the screen shows, whether the vendor exports per-reading data, the table, the aggregation, the retention.
- **§2 L1983**, **§3 L1987** — a consolidated verified-state document; confirm the build matches the decision.
- **§5 L1997** — the Apple engineer meeting.
- **§0 L321** — "log into the Supabase dashboard and check `organisations` yourself" — a 2026-09-04 verification note; close if done.

## Open on paper, built in the code — close the box, do not schedule

Checked today from the `require*` calls, `src/lib/access.ts`, the migrations on production, and the prebuild suite list:

- **§0b L710 (D-24)** running distance and HIE accepted on import (twelve columns) — the template route carries them.
- **§0b L712** group create/edit/delete is sport scientist and coach — `GROUP_EDIT`.
- **§0b L714** medic logs and corrects test results — `ENTRY_CORRECTION` includes medic.
- **§0b L717 / L725** build-order and review-process notes — met; the role model exists.
- **§0b L718 (G-03)**, **L719** — temporary passwords gone, invite links on both paths; the Resend key is set in production and an `invite.email_sent` row proves a real send (`send.ts` header).
- **§0b L721 (D-42 / G-25)** — GPS re-upload no longer duplicates: unique index 0064, upsert in `commitGpsImport`, both on production. Only the page copy is stale (§0as, group 2).
- **§0b L722 (D-01 / G-01)** — every `/injuries/*` route is `requireInjuryAccess()`; the nutritionist is out.
- **§0b L724 (D-02)** — Analytics is `['sport_scientist']`, redirect otherwise.
- **§0b L730 (D-27)** — "This session has recorded data. Cancel it instead." is the message.
- **§0b L739** — "Delete board", irreversible, "cannot be undone" in the confirmation.
- **§0b L742 (D-04)** — `PROGRAMME_EDIT = ['sport_scientist', 'strength_conditioning']`.
- **§0b L746 (D-03)** — `NUTRITION_EDIT = ['sport_scientist', 'nutritionist']`.
- **§0b L747 (D-06)** — `SESSION_EDIT = ['sport_scientist', 'coach']`.
- **§0b L753 (D-31)** — the schedule links to `/timetable`.
- **§0b L756 (D-34)** — Injuries has no sidebar row.
- **§0b L757** — Add athlete exists (`/squad/new`, reviewed as STAFF-SS-03).
- **§0e L111** — the launch sign-in page (headline, three-column grid) — `1299d95` and `9db60c5`, on production.
- **§1 L1971 / L1972** — `app_role` has all five roles and every screen read today gates on them.
- **§0v L1025** and **§0ae part 2** — closed today on the list itself (built `6398493`; migration 0102).

**Closed on the to-do list the same evening (`- [x]` with an evidence line each), on Isabella's "continue".** Left open on purpose: §0b L725 ("don't blanket-approve batches that mix cosmetic and access-control changes") is a standing process rule, not a task, and stays as one.
