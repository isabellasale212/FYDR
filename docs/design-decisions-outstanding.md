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

## (a) Cheap and uncontroversial

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ATH-ADULT-04 | C4 | The check-in page would say *who* corrected an entry ("Corrected by Jane Pemberton"). | A visibility decision — whether an athlete sees which member of staff changed their entry — not stated in `docs/athlete/visibility.md`. | **Keep to "Corrected on {date}"** unless visibility.md says otherwise · small |
| ATH-ADULT-06 | C1 | A subhead "Today 11:30 · Pitch" under the RPE screen's title. | The session block beneath the head already carries the same facts; the subhead would say them twice. | **Keep as built** (no subhead) · small |
| ATH-ADULT-09 | B4 | The set keys (the buttons an athlete taps to log a set) go from 42px to 44px tall — the app's own floor. | Recorded as "44px minimum with the rebuild"; also §0u's second bullet. Not a token: 44 is the floor every other athlete control uses. | **Build now** — one rule, independent of the rebuild · small |
| ATH-ADULT-09 | C5 | The screen stays awake during a session (Wake Lock) and a set logged gives a short vibration on Android. | New behaviour, no decided direction; both feature-detected, nothing on iPhone Safari for haptics. | **Build** — `navigator.wakeLock` on open/visibility, `navigator.vibrate(10)` on log · small |
| ATH-ADULT-10 | C1 | "Finish early" moves from the footer to the header, leaving the footer to logging. | On the live screen the footer's only action IS finish; moving it leaves a note alone. Belongs with the 09 rebuild. | **Wait for 09 C1**; keep as built · small |
| ATH-ADULT-13 | C4 | On a small phone the set list shows "4 of 6 shown" and truncates. | A session's sets are one list; 667px is not the floor. | **Decline** · small |
| ATH-ADULT-13 | C5 | The session detail hides the athlete tab bar ("a pushed screen"). | The shell draws the bar on every athlete route; hiding it per route is a shell decision, and the screen already has one way back. | **Decline** — keep the bar · small |
| ATH-ADULT-13 | D1 | The §0v "What you reported" card is replaced by a per-row "Corrected · was 100 kg × 8" marker. | The card was built 2026-09-10 with its reasoning (no "by" line); the row marker needs the 3px bar the system lacks (12 B5) and the row-tap correction (13 C2). | **Keep the card until 13 C2/C3 land**, then fold · small now |
| STAFF-SS-01 | A1 | Dashboard: Doubtful and Ruled out become tone-family cards (warn/bad fill and border), not stripes — the treatment ATH-ADULT-02 approved for the availability line. | Shell scope was record-only overnight; the dashboard rebuild (C2) was not decided. | **Build** as the first dashboard step · small |
| STAFF-SS-01 | A2 | Dashboard summary cards become buttons that say which state they are in ("Closed · opens a list" / "Open · showing the list") with `aria-expanded`. | As above. | **Build** · small |
| STAFF-SS-01 | A4 | The dashboard's missing check-ins say "Not submitted", never 0 or 0%, ordered by mornings in a row. | As above; the ordering needs the run-length count (a small derivation over existing rows). | **Build** · small–medium |
| STAFF-SS-01 | D3 | "Ready for {matchday}" only when the fixture is within 14 days; otherwise the week card leads. | The dashboard has no fixture range today (`fetchNextFixture` has no upper bound); 14 is the board's placeholder. | **Accept 14 days** and record it in the dashboard spec · small |
| STAFF-SS-01 | Q7 | On a phone, the in-page group filter bar would show only the active chip. | Unclear what then changes the group; the shell's title bar already shows the active group as a chip. | **Leave the chip row as it is** (it wraps; every chip is 44px) · small |

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

## (c) Needs new data or a query

| Flow | ID | What it changes | Why it isn't built | Recommendation · cost |
|---|---|---|---|---|
| ATH-ADULT-04 | C1 | The check-in page shows a "Corrected" pill and "Corrected on {date}" when staff corrected the day. | The page's fetch (`fetchWellnessDay`) does not select the revision's `revision_of`/`submitted_at`. | **Build** — select two columns, show the pill and the date · small |
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
(A1), 12 (A1–A4), 13 (A1–A5) and the STAFF-SS-01 shell (C1, A5, B1 for the shell) — see the
records and the handovers in the commit log.
