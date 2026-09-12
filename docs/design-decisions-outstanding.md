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

**Two decisions from the same message, outside the sheet:** the coach keeps the permission
to create an injury record, and the `/injuries` board shows "+ Injury" to the coach as well
(the coach's form is the non-clinical one, PATTERN-S3 C9; clinical fields stay medic-only)
— filed as a defect on to-do §0av. And Q27 above.

---

## (a) Cheap and uncontroversial

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ~~ATH-ADULT-04~~ | ~~C4~~ | ~~The check-in page would say *who* corrected an entry.~~ **Built with C1** — visibility.md withholds nothing about it and My data already names the person; "Corrected by {name} on {date}" · | | |
| ATH-ADULT-06 | C1 | A subhead "Today 11:30 · Pitch" under the RPE screen's title. | The session block beneath the head already carries the same facts; the subhead would say them twice. | **Keep as built** (no subhead) · small |
| ATH-ADULT-09 | B4 | The set keys (the buttons an athlete taps to log a set) go from 42px to 44px tall — the app's own floor. | Recorded as "44px minimum with the rebuild"; also §0u's second bullet. Not a token: 44 is the floor every other athlete control uses. | **Build now** — one rule, independent of the rebuild · small |
| ~~ATH-ADULT-09~~ | ~~C5~~ | ~~Wake Lock and a buzz on log.~~ **Built** (`lib/wakeLock.ts`; on open, on visibility, released on leave; 10 ms buzz where present) · | | |
| ATH-ADULT-10 | C1 | "Finish early" moves from the footer to the header, leaving the footer to logging. | On the live screen the footer's only action IS finish; moving it leaves a note alone. Belongs with the 09 rebuild. | **Wait for 09 C1**; keep as built · small |
| ATH-ADULT-13 | C4 | On a small phone the set list shows "4 of 6 shown" and truncates. | A session's sets are one list; 667px is not the floor. | **Decline** · small |
| ATH-ADULT-13 | C5 | The session detail hides the athlete tab bar ("a pushed screen"). | The shell draws the bar on every athlete route; hiding it per route is a shell decision, and the screen already has one way back. | **Decline** — keep the bar · small |
| ATH-ADULT-13 | D1 | The §0v "What you reported" card is replaced by a per-row "Corrected · was 100 kg × 8" marker. | The card was built 2026-09-10 with its reasoning (no "by" line); the row marker needs the 3px bar the system lacks (12 B5) and the row-tap correction (13 C2). | **Keep the card until 13 C2/C3 land**, then fold · small now |
| ~~STAFF-SS-01~~ | ~~A1~~ | ~~Doubtful and Ruled out as tone-family cards.~~ **Built** (the availability line's fill and border on the two readiness rows) · | | |
| STAFF-SS-01 | A2 | Dashboard summary cards become buttons that say which state they are in ("Closed · opens a list" / "Open · showing the list") with `aria-expanded`. | As above. | **Build** · small |
| STAFF-SS-01 | A4 | The dashboard's missing check-ins say "Not submitted", never 0 or 0%, ordered by mornings in a row. | As above; the ordering needs the run-length count (a small derivation over existing rows). | **Build** · small–medium |
| STAFF-SS-01 | D3 | "Ready for {matchday}" only when the fixture is within 14 days; otherwise the week card leads. | The dashboard has no fixture range today (`fetchNextFixture` has no upper bound); 14 is the board's placeholder. | **Accept 14 days** and record it in the dashboard spec · small |
| STAFF-SS-01 | Q7 | On a phone, the in-page group filter bar would show only the active chip. | Unclear what then changes the group; the shell's title bar already shows the active group as a chip. | **Leave the chip row as it is** (it wraps; every chip is 44px) · small |
| STAFF-SS-02-05 | C4 | The profile's confirmation before a status change lists who will see what (the athlete, the named coach, everyone else) — PATTERN-S3's rule. | A new step on the availability forms; no data needed. | **Build** on `SetAvailabilityForm` and the coach form · medium |
| STAFF-SS-02-05 | C8 | Empty profile panels state the requirement ("a trend needs three weigh-ins", "no plan assigned, targets are per kilogram, so a plan needs a weigh-in"). | Per-panel copy on each panel's own empty branch; needs the body-weight and nutrition panels read first. | **Build** as one copy pass · medium |
| STAFF-SS-02-05 | D2 | The profile's three disabled weight buttons and the leaderboard builder's chips follow one rule: `aria-disabled` and the reason shown, never a greyed control the reader cannot reach. | The board's rule 4 and §0av / §0ap say the same thing; a decision, not data. | **Decide once** (Builder question 8's recommendation) · small |
| PATTERN-S3 | C4 | Before a status change lands, the screen lists who sees what, by name. | Same as STAFF-SS-02-05 C4. | with it · — |

## (b) Reverses something we decided

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ATH-ADULT-08 | D1 | The nutrition answers read "Yes, most days / Some days / No" instead of "Yes / Roughly / No". | The spec (`04-weekly-nutrition-check-in.md`, the `nutrition_checkin_answer` enum) fixes the words; changing an answer's wording changes what it means (CLAUDE.md §0.06). | **Keep the spec's words** unless the spec is changed first · small (copy) — but the enum values stay |
| ATH-ADULT-09 | D4 | The gym logger drops the gold: logged keys, the progress fill and the "recommended" line move to the accent family. | Reverses the 2026-09-08 redesign decisions recorded in `05-gym-session.md` §13 and pinned by `test-gym-logger-redesign.ts` ("so it is not rebuilt a second time"). | **Reverse** — the board's one-accent rule reads better on the logger and the domain colour stays on the tab bar (12 D4 decides that) · medium |
| ATH-ADULT-12 | D1 | My data draws five segments (Wellness, Gym, Sessions, Nutrition, Tests) instead of three plus a footer card. | Reverses the 8 September decision (`06-my-data.md` §3/§13; `test-my-data-redesign.ts` pins three) — the footer card exists because three destinations would otherwise be orphaned. | **Reverse to five** — five tabs answer the orphan objection directly; Leaderboards keeps its footer row · medium |
| ATH-ADULT-12 | B3 | Segment labels at ~11px so five fit in 343px. | Depends on D1; `--fs-11` exists. | With D1 · small |
| ATH-ADULT-12 | C9 | The five-segment row wraps to two rows at iOS Larger Text. | Depends on D1. | With D1 · small |
| ATH-ADULT-12 | D2 | The active segment is a white card with a shadow, not a solid accent-filled pill. | Reverses the recorded decision in `base.css` (`.md-seg[aria-selected]`: "A SOLID ACCENT-FILLED PILL, not the card-coloured chip… 23e drew") and the guard. | **Reverse with D1** — one decision for the control · small |
| ATH-ADULT-12 | D3 | Deltas are never coloured: muted ink, the figure in bold, ↑↓ not ▲▼ — "a lower RPE and a lower readiness do not mean the same thing". | Reverses `06-my-data.md` §13's green ▲ (guarded) and the amber down/off. | **Reverse** — the board's rule is the better one · small |
| ATH-ADULT-12 | C4 | Deltas compare against the 28-day average ("↓ 0.1 vs your 28-day average") instead of "on last week". | A different comparison is a different metric (MET-001 against the prior week today); needs a `metrics.md` entry. | **Decide with D3**; if reversed, one registry entry · medium |
| ATH-ADULT-12 / STAFF-SS-01 | D4 / D2 | The gym glyph loses its gold on the athlete tab bar and the staff sidebar; every icon neutral, the active one in the accent. | `AthleteTabBar` records "the only coloured icon in the product — gold in both themes" (spec §6); 09 D2 kept it; the staff sidebar draws it the same way. | **One decision for both shells** — recommend keep the gold (it is the product's one domain colour on navigation; the logger's own one-accent rule is separate) · small either way |
| ATH-ADULT-12 | D5 | Readiness headlined "3.8 of 5" instead of 0–100. | MET-001 is a 0–100 composite in `docs/metrics.md`, shown as such in both apps; the board's own prompt calls the out-of-5 figure a placeholder until the composite is confirmed — it is. | **Keep 0–100** · none |
| ATH-ADULT-12 | D7 | The readiness band in `--wash-accent` and the line in `--accent`, "accent and neutrals only". | `WellnessChart` is shared with staff pages (`--chart-wellness`); changing its colours changes staff screens. | If accepted, an athlete-only prop, not a change to the shared colours · small |
| ATH-ADULT-12 | B6 | Hero eyebrows in `--faint` instead of `--muted`. | `.eyebrow` is shared with Today's section titles; a contrast step down on a shared class. | **Decline** · none |
| STAFF-SS-01 | — | (built) the bottom bar + More sheet, superseding §0af's compact top bar | decided and built `af09c17` | — |
| PATTERN-S3 | D2 | A one-time "you were told" card at the top of the athlete's Today, above To do, displacing the availability line's emphasis until the status screen is opened. | Today is ATH-ADULT-02, built and signed off; "one emphasised card per screen" means the new card takes the emphasis from the availability line. | **Decide with C1** — recommend the card replaces the line only while unread · with C1 |
| PATTERN-S3 | D1 | The coach sees the protocol stage today ("Return to play protocol, stage 3 of 6" on the allocation screen). | Either a seed string or an unenforced rule; the board says a coach never reads a stage. ⚠ permissions | **Enforce with C8** (the render drops the site and stage segments for the coach) · small |

## (c) Needs new data or a query

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ~~ATH-ADULT-04~~ | ~~C1~~ | ~~The check-in page shows a "Corrected" pill and the correction when staff corrected the day.~~ **Built** (the day's revision chain; pill + "Corrected by {name} on {date}"; "You sent … at" is the athlete's own time) · | | |
| ATH-ADULT-08 | C1 | A check-in can be corrected once; a second attempt sees a "spent" card instead of the form. | `revise_nutrition_checkin` needs to refuse when the original is itself a revision; the page needs `revision_of`. The design-approach doc lists "corrected once" as decided; the to-do list does not. **⚠ migration** | **Build as one commit** — the refusal, the read, the spent state, then the caption (C3) · medium |
| ATH-ADULT-08 | C2 | After saving a correction the page shows a "Correction saved" card instead of leaving for My data. | Today a saved correction navigates to `/my-data?tab=nutrition`. | With C1 · small |
| ATH-ADULT-08 | C3 | The caption "You can correct this once after you submit." | Asserts C1; not shown until true. | With C1 · none |
| ATH-ADULT-08 / 12 | D2 / D6 | A second weekly question, "How well did you fuel around training?" (1–5), on the check-in and in My data's history. | A data change: a column, the registry, CLAUDE.md rule 8's wording ("one question"). No frame draws it. **⚠ migration** | **Decide the product question first**; if yes, a migration + registry entry + form + history in one brief · large |
| ATH-ADULT-09 | C3 | The weight stepper's increment comes from the exercise (2.5 / 1.25 / 2 kg; bodyweight = reps only). | A constant `WEIGHT_STEP_KG = 2.5` today; needs `weight_step_kg` on the exercise. **⚠ migration** | Schema first, own commit · medium |
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
| STAFF-SS-02-05 | C7 | Restriction text never names a protocol or a diagnosis. | A rule on free text, not a render; the seed carries "Return to play protocol, stage 3 of 6". A2 (the hint) is the guidance half. | Fix the seed; keep the hint · small |
| STAFF-SS-02-05 | C9 | Body mass hidden from the coach by default, as a club setting. | A setting that does not exist. **⚠ migration ⚠ permissions** | Decide the default, then one setting + one render rule · medium |
| PATTERN-S3 | C1 | The athlete is told once about a status change: an emphasised card on Today that stays until the status screen has been opened. | Needs a per-athlete read flag against the availability row. **⚠ migration** | With C2; the flag first · medium |
| PATTERN-S3 | C2 | An athlete status screen answering three questions (can I train today / what can I do / when am I back), the restriction list as rows, the stage ladder, the academy slot. | A new athlete route; nothing like it exists (`/me` shows the line). | Own brief · large |
| PATTERN-S3 | C3 | Stages numbered with state words; advancing moves one stage and asks for a rewritten restriction line and a criteria-reviewed confirmation; any other stage needs a reason. | The protocol is a bare counter in a string today, not data. **⚠ migration** | Schema for stages first · large |
| PATTERN-S3 | C5 | The absence form: illness / personal / academic / representative / other, the same four availability words, Available not offered, a well naming what an absence does not carry. | `availability_reason` has the values (0041) and the coach form exists; the shape and the well are new. **⚠ permissions** (which roles) | **Build** on `SetAvailabilityFormCoach` · medium |
| PATTERN-S3 | C6 | Rehab programme proposals with three states (Proposed / Approved / Returned) and a required return reason, in one list the S&C and the medic both see. | Only "proposed" exists. **⚠ migration** | Schema first · large |
| PATTERN-S3 | C7 | Availability history: one row per change — time, status, the restriction line as it read then, what changed, who. Never edited; a correction adds a row. | No explicit previous value or author on every path. **⚠ migration** (a view over the table and the audit log) | Audit-trigger the availability table as 0104 did sessions, then the view · medium |
| PATTERN-S3 | C8 | Body site and side are not coach-visible: a coach reads the status word, the restriction line and the expected return, nothing else. | Rendered to the coach today; the board puts it behind a club setting defaulting to off. **⚠ permissions ⚠ migration** | Decide the default; the render rule is small, RLS on the column is the real change · medium |
| PATTERN-S3 | C9 | The injury form split by permission (clinical fields in their own column, save works without them) and a pitch-side four-field form at 44px. | A restructure of `NewInjuryForm` / `InjuryMedicalForm`. | **Build** after C8 decides what the coach's form carries · medium |

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
STAFF-SS-02-05's A1–A6 with PATTERN-S3's A1–A3 (one commit, 2026-09-12) — see the records
and the handovers in the commit log.
