# Design decisions outstanding — every unbuilt item across `docs/designs`

**Living list, opened 2026-09-12.** One row per item that a design board proposed and the
build did not do. The source of each row is the flow's A/B/C/D record in
`docs/overnight-records-2026-09-12.md`; this sheet is the decision view of the same items.
When a new design folder lands, its record is written, its A items (and B items with a
nearest existing token) are built, and its C and D items are appended here in the same
format. When an item is built or declined, its row is struck through with the commit or
the decision, not deleted.

**Cost:** small = under an hour · medium = an afternoon · large = a day or more, or its own
brief. **⚠ migration** = needs a database migration. **⚠ permissions** = touches who may
read or write something (CLAUDE.md §5: the test comes before the rule).

**Reading the groups.** (a) is safe to say yes to as a batch. (b) is where a board disagrees
with something already decided and recorded — each needs an explicit "reverse" or "keep".
(c) needs data or a query we do not have today; the cost is mostly there. (d) cannot be
expressed in the 171 tokens; each is a proposed new token (or a substitute), per §0.01.

---

## Decisions — 2026-09-12 (Isabella), recorded by the reviewer

Read each row below against its group; a row not named here is **approved and queued**
("everything else in groups (a) to (d)").

**Struck — already live:** STAFF-SS-01 C5 (the last-admin guard at the database is migration
0101, on production since 2026-09-11; 0102 covers the self-grant).

**Declined:** ATH-ADULT-08 D1 (the answers' words stay "Yes / Roughly / No") · ATH-ADULT-12
D2 (the active segment stays the accent-filled pill) · ATH-ADULT-12 C4 (deltas stay "on last
week") · ATH-ADULT-12 B6 (hero eyebrows stay `--muted`) · ATH-ADULT-12 D5 (readiness stays
0–100) · **the 3px bar pattern** wherever it appears (ATH-ADULT-12 B5's `--border-accent-w`
row bar and the same bar in STAFF-SS-01 B1 — the rest of B1's substitutions stand) ·
ATH-ADULT-10 C2 (no confirmation before finishing early) · **motion tokens** (ATH-ADULT-09 B3
and any other `--ease-*` / duration proposal — the "no motion tokens" rule stands) · **the
second nutrition question** (ATH-ADULT-08/12 D2/D6) · STAFF-SS-01 C4 ("Send a reminder").

**Gold — kept on navigation, reversed inside the gym logger:** ATH-ADULT-12 D4 / STAFF-SS-01
D2 declined (the gym glyph keeps its gold on the athlete tab bar and the staff sidebar);
ATH-ADULT-09 D4 **approved** (inside the logger the logged keys, the progress fill and the
"recommended" line move to the accent family).

**Approved and queued — everything else in (a) to (d)**, including the gym logger rebuild
(ATH-ADULT-09 C1) **with two new tokens, `--hit-lg: 56px` and `--hit-md: 52px`** (09 B2 —
a §0.01 system decision: the builder dates them beside their values in `tokens.css` and
records them in the Decisions Log; the other (d) rows that name a token are approved on the
same footing, each dated at the value). STAFF-SS-02-05 C9 is approved with a wider rule than
its row: **the coach does not see body mass at all — the section as well as the three
buttons** (Q27 of the data-architecture briefing, closed 2026-09-12).

**Later the same day (evening):** PATTERN-S4 D1 (sessions live on create, no publish/discard) — **DECLINED**: publish stays; "nothing changes on their phone until you publish" is the schedule's core promise and dropping it discards the offline-publish protection just built (§0al). Every S4 row that depends on D1 falls with it. And a new rule outside the sheet: the injured-athlete proposal gate applies to every role except the medic, at the database (to-do §0bb).

**Two decisions from the same message, outside the sheet:** the coach keeps the permission
to create an injury record, and the `/injuries` board shows "+ Injury" to the coach as well
(the coach's form is the non-clinical one, PATTERN-S3 C9; clinical fields stay medic-only)
— filed as a defect on to-do §0av. And Q27 above.

---

## (a) Cheap and uncontroversial

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ~~ATH-ADULT-04~~ | ~~C4~~ | ~~The check-in page would say *who* corrected an entry.~~ **Built with C1** — visibility.md withholds nothing about it and My data already names the person; "Corrected by {name} on {date}" · | | |
| ~~ATH-ADULT-06~~ | ~~C1~~ | ~~A subhead under the RPE title.~~ **Kept as built** (decided 2026-09-12) · | | |
| ~~ATH-ADULT-09~~ | ~~B4~~ | ~~The set keys go from 42px to 44px tall.~~ **Built** · | | |
| ~~ATH-ADULT-09~~ | ~~C5~~ | ~~Wake Lock and a buzz on log.~~ **Built** (`lib/wakeLock.ts`; on open, on visibility, released on leave; 10 ms buzz where present) · | | |
| ~~to-do §0az~~ | ~~—~~ | ~~The group reorder arrows: a silent no-op for the medic, the S&C and the nutritionist.~~ **Built** 2026-09-12 (added here as uncovered by the sheet: the to-do decision names the BlockedButton treatment; `moveGroup` checks its rows) · | | |
| ATH-ADULT-10 | C1 | "Finish early" moves from the footer to the header, leaving the footer to logging. | On the live screen the footer's only action IS finish; moving it leaves a note alone. Belongs with the 09 rebuild. | **Wait for 09 C1**; keep as built · small |
| ~~ATH-ADULT-13~~ | ~~C4~~ | ~~"4 of 6 shown".~~ **Declined** · | | |
| ~~ATH-ADULT-13~~ | ~~C5~~ | ~~No tab bar on the session detail.~~ **Declined** — the bar stays · | | |
| ATH-ADULT-13 | D1 | The §0v "What you reported" card is replaced by a per-row "Corrected · was 100 kg × 8" marker. | The card was built 2026-09-10 with its reasoning (no "by" line); the row marker needs the 3px bar the system lacks (12 B5) and the row-tap correction (13 C2). | **Keep the card until 13 C2/C3 land**, then fold · small now |
| ~~STAFF-SS-01~~ | ~~A1~~ | ~~Doubtful and Ruled out as tone-family cards.~~ **Built** (the availability line's fill and border on the two readiness rows) · | | |
| ~~STAFF-SS-01~~ | ~~A2~~ | ~~Summary cards say which state they are in.~~ **Built** ("Closed · opens a list" / "Open · showing the list", ▸/▾, a --surf2 well closed, the surface with an accent ring open) · | | |
| ~~STAFF-SS-01~~ | ~~A4~~ | ~~Missing check-ins by run length, "Not submitted".~~ **Built** (`lib/missingRuns.ts`; the Wellness in list, longest run first, last entry date) · | | |
| ~~STAFF-SS-01~~ | ~~D3~~ | ~~"Ready for {matchday}" only within 14 days.~~ **Built** (`FIXTURE_RANGE_DAYS = 14`; "Squad readiness · No fixture in the next 14 days" beyond it). The board's "the week card leads and the matchday card is absent" is a structure change, with C2's remaining steps · | | |
| ~~STAFF-SS-01~~ | ~~Q7~~ | ~~Only the active chip on a phone.~~ **Left as is** (decided 2026-09-12) · | | |
| ~~STAFF-SS-02-05~~ | ~~C4~~ | ~~Who will read what, before a status change lands.~~ **Built** (`AvailabilityAudience` on both forms; the coaches by role — no per-athlete coach exists in the data) · | | |
| ~~STAFF-SS-02-05~~ | ~~C8~~ | ~~Empty panels state the requirement.~~ **Built** (body weight, nutrition plan, flags; the injury panel from A4) · | | |
| ~~STAFF-SS-02-05~~ | ~~D2~~ | ~~One rule for blocked controls.~~ **Built** (`BlockedButton`: aria-disabled, the reason on tap/focus, never a title — the builder's chips, the weigh-in trio, the bio Edit, the correction button, the leaderboard family chips; 06-design-system.md §7.0) · | | |
| ~~PATTERN-S3~~ | ~~C4~~ | ~~Who sees what, by name.~~ **Built** with STAFF-SS-02-05 C4 · | | |

## (b) Reverses something we decided

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ~~ATH-ADULT-08~~ | ~~D1~~ | ~~"Yes, most days / Some days / No".~~ **Declined** — Yes / Roughly / No stay · | | |
| ~~ATH-ADULT-09~~ | ~~D4~~ | ~~The logger drops the gold.~~ **Reversed and built** (fill, keys — logged / current / not reached —, the live head, the deviation line "prescribed 100 kg · +2.5" in --muted; the gold stays on navigation) · | | |
| ~~ATH-ADULT-12~~ | ~~D1~~ | ~~Five segments.~~ **Reversed and built** (Wellness · Gym · Sessions · Nutrition · Tests; Leaderboards keeps its footer row) · | | |
| ~~ATH-ADULT-12~~ | ~~B3~~ | ~~Labels at 11px.~~ **Built** with D1 (`--fs-11`) · | | |
| ~~ATH-ADULT-12~~ | ~~C9~~ | ~~Wraps at Larger Text.~~ **Built** with D1 (basis auto, flex-wrap) · | | |
| ~~ATH-ADULT-12~~ | ~~D2~~ | ~~The active segment as a white card.~~ **Declined** — the accent-filled pill stays · | | |
| ~~ATH-ADULT-12~~ | ~~D3~~ | ~~Deltas never coloured.~~ **Reversed and built** (`.rd-delta` and `.hist-delta` in --muted, the figure --text bold, ↑ ↓) · | | |
| ~~ATH-ADULT-12~~ | ~~C4~~ | ~~Deltas vs the 28-day average.~~ **Declined** 2026-09-12 — the comparison stays "on last week" · | | |
| ~~ATH-ADULT-12 / STAFF-SS-01~~ | ~~D4 / D2~~ | ~~The gym glyph loses its gold on navigation.~~ **Declined** 2026-09-12 — the gold stays on the athlete tab bar and the staff sidebar · | | |
| ~~ATH-ADULT-12~~ | ~~D5~~ | ~~Readiness "of 5".~~ **Declined** — 0–100 stays · | | |
| ~~ATH-ADULT-12~~ | ~~D7~~ | ~~Accent and neutrals only on the athlete's chart.~~ **Built** as `accentOnly`, an athlete-only prop (the line and band were already the accent; the out-of-range markers now are too on My data; staff pages unchanged) · | | |
| ~~ATH-ADULT-12~~ | ~~B6~~ | ~~Eyebrows in --faint.~~ **Declined** · | | |
| STAFF-SS-01 | — | (built) the bottom bar + More sheet, superseding §0af's compact top bar | decided and built `af09c17` | — |
| PATTERN-S3 | D2 | A one-time "you were told" card at the top of the athlete's Today, displacing the availability line's emphasis until the status screen is opened. | **Decided 2026-09-12: reverse — the card takes the emphasis while unread.** Waits on C1 (the read flag, ⚠ migration), which is "not now". | With C1, when C1 is scheduled · — |
| PATTERN-S4 | D1 | Sessions are live the moment they are created, moved or removed — no pending queue, no Publish, no Discard. | Reverses the schedule's held-until-publish model (07-schedule.md §6: one session published alone puts a half-updated week on phones; §0al's offline hold and the ghost/Restore were built on it today). Most of the S4 board (the grid-click popover writing on Add, a drag writing at once, the three-timeframe confirmation, "N sessions live") depends on this. | **Decide once.** If reversed: the publish machinery, the sessionStorage hold, the ghost/Restore and the banner go; each write is already its own audited act (0104) · large |
| ~~PATTERN-S3~~ | ~~D1~~ | ~~The coach sees the protocol stage.~~ **Enforced** (`lib/restrictions.ts` drops protocol / stage / diagnosis entries from the restriction line at every query read, for every viewer; the seed no longer writes one — SS-02-05 C7 done with it) · | | |

## (c) Needs new data or a query

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ~~ATH-ADULT-04~~ | ~~C1~~ | ~~The check-in page shows a "Corrected" pill and the correction when staff corrected the day.~~ **Built** (the day's revision chain; pill + "Corrected by {name} on {date}"; "You sent … at" is the athlete's own time) · | | |
| ~~ATH-ADULT-08~~ | ~~C1~~ | ~~A check-in can be corrected once; a second attempt sees a "spent" card.~~ **Built** — migration 0107, the chain read, the spent state, My data's Corrected mark · | | |
| ~~ATH-ADULT-08~~ | ~~C2~~ | ~~"Correction saved" on this page.~~ **Built** · | | |
| ~~ATH-ADULT-08~~ | ~~C3~~ | ~~The caption "You can correct this once after you submit."~~ **Built** · | | |
| ATH-ADULT-08 / 12 | D2 / D6 | A second weekly question, "How well did you fuel around training?" (1–5), on the check-in and in My data's history. | A data change: a column, the registry, CLAUDE.md rule 8's wording ("one question"). No frame draws it. **⚠ migration** | **Decide the product question first**; if yes, a migration + registry entry + form + history in one brief · large |
| ~~ATH-ADULT-09~~ | ~~C3~~ | ~~The weight stepper's increment comes from the exercise.~~ **Built** — migration 0108 `exercises.weight_step_kg`, set on the library's create form; existing exercises keep 2.5 (no edit form for a library row exists — recommend: add the step to the exercise detail's edit when that screen is built) · | | |
| ATH-ADULT-09 | C4 | Queued sets send on the `online` event and from the logger itself ("6 of 12 sets · 2 waiting to send"); today only Today's flusher retries. | Behaviour, no decided direction (§0u's fifth bullet). §0aa's conflict path is built, so the retry is safe to run from the logger. | **Build** — mount the flusher's retry in the logger and on `window.online` · medium |
| ATH-ADULT-09 | C6 | A session-complete summary: total volume first, sets done, personal bests ("Best before today 100 kg × 8 · 21 Aug"). | No query gives a per-exercise best before a date. | `fetchPersonalBestsBefore(date)`, then the screen · medium |
| ATH-ADULT-10 | C3 | The early-finish summary (dashed neutral bar, "Not logged" rows, no totals). | With 09 C6. | With 09 C6 · small on top |
| ATH-ADULT-11 | C2 | After a correction the logger's strip reads "Set 1 corrected · was 100 kg × 8". | The logger reads `gym_set_logs_current` only; the superseded values are not on this screen. | Read the superseded row (as My data does since §0v); own commit · small |
| ATH-ADULT-12 | C2 | Sessions and Nutrition become hero-card tabs: RPE eleven-bar chart with this week solid, "n = 3 rated sessions this week"; nutrition weeks as question/answer rows. | Needs a Monday-week "RPE this week" and a 28-day RPE mean in `metrics.md`; depends on D1. | Own brief after D1 · large |
| ATH-ADULT-12 | C3 | One plain-English line per hero ("Readiness steady over 28 days, averaging 67." / "Two CMJ results is not enough to show a trend."). | Needs a rule for "steady" and a minimum n, in the registry. | State the rule in `metrics.md` first · medium |
| ATH-ADULT-12 | C5 | The gym hero becomes "Back squat best 102.5 kg, up 5 kg this block". | Needs 09 C6's best-per-exercise query and dated programme blocks ("since 18 Aug" as the fallback). | After 09 C6 · medium |
| ATH-ADULT-12 | C6 | An empty period says when the last entry was and offers "Show this season"; a brand-new athlete gets "Nothing on record yet." | Needs a latest-date-per-domain query unbounded by the period. | `fetchMyLatestRecordByDomain`, then the three empty states; the button is a Link to `?period=season` · medium |
| ATH-ADULT-12 | C7 | Tests lists only tests assigned to the athlete; an assigned test with no result reads "Not logged". | `fetchMyTestSummary` is built from results, so neither case is listed today. | Read the athlete's assigned definitions joined to results · medium |
| ATH-ADULT-13 | C1 | The session detail's eyebrow reads "Gym · Lower A · complete". | `fetchGymSessionLog` selects neither the programme session's name nor `status`. | Extend the select; with C3 · small |
| ATH-ADULT-13 | C2 | Tapping a set row opens the logger's correction panel; the footer becomes Save correction / Cancel; the per-row "Correct" buttons go. | New interaction; the panel is inline in the table today; belongs with 09 C1 so the panel is one component. | With 09 C1 · medium |
| ATH-ADULT-13 | C3 | A "Corrected" pill on the gym history list row and "Set 1 was corrected on Fri 14 Aug. Both values are kept on record." on the detail. | The list read has no per-session revised flag. | A flag on the view or a chained read, then the marker · medium |
| STAFF-SS-01 | A3 / C3 | The dashboard's attention panel counts *athletes* ("5 athletes"), names them with the reading in plain words, and the Flags tab badge shows the same number. | Flags are one row per athlete per metric per detection; a distinct-athlete count is a query change. | **Build** the count once, read it in both places · medium |
| STAFF-SS-01 | C2 | The dashboard rebuild as drawn: matchday lead card, thresholds footer line ("Thresholds set by Jane Pemberton · 24 Aug · Change ›"), "Not checked in" by run length, the week strip yielding on a heavy morning, role versions (S&C four toggles, nutritionist two). | Several steps, each undecided; the thresholds line needs `thresholds.created_by/updated_at` surfaced (they exist). | **Approve as a series**: A1, A2, A4 first (group a), then the thresholds line, then the role versions · large in total |
| STAFF-SS-01 | C4 | "Send a reminder" on a missing check-in. | Nothing in the product sends a push or an email (no provider). | **Leave off until a sender exists** · large (a sender) |
| STAFF-SS-01 | C5 | The last-admin guard enforced at the database (the prompt's own gate). | A permissions migration; the client-only guard was §0ae's finding. **⚠ migration ⚠ permissions** | **Build, test first** (a pgTAP file, then the trigger) · small–medium |
| STAFF-SS-01 | D4 | Only the medic sees an unavailability *reason*; non-clinical reasons (Academic) show without the "Medical" label. | Whether the reason column is gated by role under RLS needs reading against `docs/access-matrix.md` before the copy is built. **⚠ permissions** | Confirm the policy first, then the copy · small |
| STAFF-SS-02-05 | C1 / B1 | Every profile opens with one emphasised status header — name, position, group, availability, restrictions, bio figures, development plan — the coach's without body mass. | A per-role render and the body-mass club setting (C9). `--blue-100/200` → `--wash-accent` / `--border-accent-soft`. **⚠ permissions** | After the Step 1 inventory; the header first, the setting second · medium |
| STAFF-SS-02-05 | C2 / B4 | The squad list on a phone: 60px rows, the name as the link, the pill right, the restriction line on the row. | A responsive restructure of the roster table into rows. | **Build** · medium |
| STAFF-SS-02-05 | C3 / B2 | The phone profile gets a sticky 52px jump bar ("Flags · panel 1 of 10") and an "All panels" sheet listing every panel with a value each. | A new component; SS-01's sheet is the shape; the panel order is C4's. | After C4 · medium |
| STAFF-SS-02-05 | C4 / B3 | Panels ordered by role from one library; a panel a role cannot see is absent — no heading, lock or count. | Needs the per-role, per-panel inventory the prompt's Step 1 asks for. **⚠ permissions** | The inventory first (a review), then the order · large |
| STAFF-SS-02-05 | C5 | Read-only panels end with an owner line ("Read-only · set by medical staff · Ruth Callaghan · Fri 11 Sept"). | Who-and-when is not on every panel's last write (availability has `created_by`; plans and thresholds carry a time, not always a person). | Add the person where missing, then the line · medium |
| ~~STAFF-SS-02-05~~ | ~~C7~~ | ~~Restriction text never names a protocol.~~ **Built** with PATTERN-S3 D1 (the read-side filter and the seed) · | | |
| STAFF-SS-02-05 | C9 | Body mass hidden from the coach by default, as a club setting. | A setting that does not exist. **⚠ migration ⚠ permissions** | Decide the default, then one setting + one render rule · medium |
| PATTERN-S3 | C1 | The athlete is told once about a status change: an emphasised card on Today that stays until the status screen has been opened. | Needs a per-athlete read flag against the availability row. **⚠ migration** | With C2; the flag first · medium |
| PATTERN-S3 | C2 | An athlete status screen answering three questions (can I train today / what can I do / when am I back), the restriction list as rows, the stage ladder, the academy slot. | A new athlete route; nothing like it exists (`/me` shows the line). | Own brief · large |
| PATTERN-S3 | C3 | Stages numbered with state words; advancing moves one stage and asks for a rewritten restriction line and a criteria-reviewed confirmation; any other stage needs a reason. | The protocol is a bare counter in a string today, not data. **⚠ migration** | Schema for stages first · large |
| PATTERN-S3 | C5 | The absence form: illness / personal / academic / representative / other, the same four availability words, Available not offered, a well naming what an absence does not carry. | `availability_reason` has the values (0041) and the coach form exists; the shape and the well are new. **⚠ permissions** (which roles) | **Build** on `SetAvailabilityFormCoach` · medium |
| PATTERN-S3 | C6 | Rehab programme proposals with three states (Proposed / Approved / Returned) and a required return reason, in one list the S&C and the medic both see. | Only "proposed" exists. **⚠ migration** | Schema first · large |
| PATTERN-S3 | C7 | Availability history: one row per change — time, status, the restriction line as it read then, what changed, who. Never edited; a correction adds a row. | No explicit previous value or author on every path. **⚠ migration** (a view over the table and the audit log) | Audit-trigger the availability table as 0104 did sessions, then the view · medium |
| PATTERN-S3 | C8 | Body site and side are not coach-visible: a coach reads the status word, the restriction line and the expected return, nothing else. | Rendered to the coach today; the board puts it behind a club setting defaulting to off. **⚠ permissions ⚠ migration** | Decide the default; the render rule is small, RLS on the column is the real change · medium |
| PATTERN-S3 | C9 | The injury form split by permission (clinical fields in their own column, save works without them) and a pitch-side four-field form at 44px. | A restructure of `NewInjuryForm` / `InjuryMedicalForm`. | **Build** after C8 decides what the coach's form carries · medium |
| PATTERN-S4 | C2 / B1 / B3 | Clicking an empty grid slot opens a 320px popover anchored at the click (date and time pre-filled, drag sets the duration, a ghost holds the slot, flips at the edges; a bottom sheet on a phone) and "Add session" writes it. | Depends on D1 (writes on Add). `--grid-hour-h: 40px` and `--ring-invalid` are its tokens (the ring composes from `--bad-rgb`; the hour height is a new layout value). | With D1 · large |
| PATTERN-S4 | C3 | A drag writes the move immediately; typed edits are held until Save changes. | Depends on D1. | With D1 · medium |
| PATTERN-S4 | C4 | A session in the past, or already rated, opens read-only with the reason. | Needs the rule for editing a rated session (does the rating follow, detach or revise?). | Decide the rule first · small after |
| PATTERN-S4 | C5 | Expected attendees are counted as distinct athletes across the selected groups, with the denominator ("0 of 30 athletes are expected"). | A query; and whether an unavailable athlete is still expected. | The same distinct count as SS-01 A3 and S5 C4 · medium |
| PATTERN-S4 | C6 / B4 | The phone: day-first with the dashboard's week strip and 44px rows — no grid at 375. | A new phone layout for the schedule inside SS-01's shell. | **Build** · medium |
| PATTERN-S4 | C7 | Applying a template states where each offset lands and what happens to what is already there. | `/schedule/planner/apply` restructure; merge-or-replace is undecided (Q5). | Decide merge/replace, then build · medium |
| PATTERN-S4 | C8 | A group with no session reads a dash and "5 athletes · nothing scheduled", not 0m. | The stats panel lists only groups with sessions. | Read all groups; small · small |
| PATTERN-S4 | C9 / C10 | The destructive confirmation answers three timeframes; every count states its denominator ("6 sessions live in the athlete app"). | Depend on D1. | With D1 · small after |
| PATTERN-S5 | C1 | A logged set keeps the prescription it was logged against — reps, load and step snapshotted at logging, so editing a block never rewrites what a past set is compared to. | `gym_set_logs` holds the actuals and joins the programme exercise live. **⚠ migration** | **Build first** — it is what "Prescribed 100 kg · +2.5" on the logger (09 C1, approved) should read · medium |
| PATTERN-S5 | C2 / C5 / C6 | Every prescription write states its effective date ("Save from Sat 12 Sept"; "38 sets already logged keep the prescription they were logged against"); the mid-block confirmation screen; the primary carries the number or date it commits. | With C1. | After C1 · medium |
| PATTERN-S5 | C3 / C10 | The per-athlete adjustment screen: one card with controls, parent rows in `--muted`, a required note, remove-override as a tertiary; the phone version stacked. | The override note is not required server side (Q5). **⚠ migration** (a check) | Build with the check · medium |
| PATTERN-S5 | C4 | An assignment's headline is the distinct athlete count, with its arithmetic. | The distinct-count query (S4 C5 / SS-01 A3). | With that query · small after |
| PATTERN-S5 | C7 | A nutrition plan authored as rules per kilogram with the worked example, "not set" as a dashed frame, the squad mean with its n, "Coach-set guidance, not a clinical prescription". | `NutritionWorkspace` restructure; the rules exist as columns. | **Build** · medium |
| PATTERN-S5 | C8 | "each side" beside a unilateral exercise's name. | The exercise record has no unilateral flag. **⚠ migration** | Schema first · small |
| PATTERN-S5 | C9 | Weeks run down, sessions across; a week not reached reads "not reached", never 0 of 24. | The block view does not exist in this shape. | With C2 · medium |

## (d) Needs a new token

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ATH-ADULT-09 | B1 | The logger's numbers at `--t-num-hero` 48px (the weight and rep values, today 24/28). | The board's token does not exist; the *value* 48 does (`--fs-48`), but the change belongs to the rebuild (C1), which is not approved. | Decide with C1 · none alone |
| ATH-ADULT-09 | B2 | `--hit-lg` 56px and `--hit-md` 52px controls (the "Log set" primary and the steppers). | New spacing steps; **not approved** (2026-09-12: "the 56px/52px/48px size tokens are NOT approved"). | If the rebuild is approved, add both as named tokens in that commit · medium |
| ATH-ADULT-09 | B3 | The set chip fills over 300ms on `--ease-ring`. | A motion token; declined in 03 and protected ("no motion tokens"). | **Stays declined** · none |
| ATH-ADULT-09 | C1 | The set-by-set rebuild: one exercise at a time, two 48px numbers between 52px steppers, one "Log set 2 · 100 kg × 8" primary, chips as the state display. | Depends on B1/B2; changes what the screen does, not only how it looks. | Its own brief once B1/B2 are decided · large |
| ATH-ADULT-10 | C2 | A confirmation before finishing early ("Keep logging" primary; "Finish early" secondary with "4 sets short"; what is saved and where it goes). | A dialog is a component shape the system does not have (03 declined the discard dialog for the same reason). | If a dialog pattern is approved once, build it here first · medium |
| ATH-ADULT-11 | C1 | While a correction panel is open the footer swaps to "Save correction" / "Cancel". | With 09 C1. | With 09 C1 · small on top |
| ATH-ADULT-12 | B1 | Charts at `--chart-h: 84px` with a `--chart-stroke: 2.5px` line — the first plotted-series tokens in the athlete app. | Two new tokens; the readiness SVG is viewBox-scaled and the gym bars a fixed 72px today. | **Add both** when the Sessions chart (C2) is built, one commit, `06-design-system.md` updated with it · small (the tokens) |
| ATH-ADULT-12 | B2 | Prior values in every chart in `--blue-200`. | A new colour role; nearest existing `--wash-accent-strong`, but tied to D7. | Map to `--wash-accent-strong` if D7 is accepted · small |
| ATH-ADULT-12 | B4 | The empty-state "Show this season" button at `--hit-lg` 56px. | No such token; 44px is the floor. | 44px, with C6 · none |
| ATH-ADULT-12 | B5 | Corrected markers in `--pill-accent` / a 3px `--border-accent-w` bar. | No such names; the existing neutral pill (§0v) is in use; a 3px row bar is a pattern the system lacks. | Keep the neutral pill; the bar with 13 C3 if a row-marker pattern is approved · small |
| ATH-ADULT-12 | C8 | The period control on the title line as a menu (accent with a chevron; the current option carries the wash and a tick). | `PeriodSelector` is a shared staff `<select>` (ten pages); a custom menu is a new component shape. | Keep the select; if the menu is wanted it is an athlete-only component, own brief · medium |
| STAFF-SS-01 | B1 | The dashboard's emphasised card in `--blue-100` + `--blue-200`; the 3px `--border-accent-w` bar on dense rows; `--pill-accent` + `--accent` actions. | Names that do not exist; the accent wash family (`--wash-accent`, `--border-accent-soft`) maps the card as ATH-ADULT-04 did; the 3px bar is the same missing pattern as 12 B5. | Map the card to the wash family with A1; decide the 3px bar once for 12 B5 / 13 C3 / SS-01 · small |

---

**Not on this sheet, because they were built:** every A item of 04, 06, 08, 09 (A3, A4), 10
(A1), 12 (A1–A4), 13 (A1–A5), the STAFF-SS-01 shell (C1, A5, B1 for the shell), and
STAFF-SS-02-05's A1–A6 with PATTERN-S3's A1–A3, PATTERN-S4's A1–A3 and A5–A8, and
PATTERN-S5's A1 and A7 (2026-09-12) — see the records and the handovers in the commit log.
