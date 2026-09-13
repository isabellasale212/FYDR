# What has shipped on `athlete-spec-builder` since the last production deploy — 2026-09-13 03:30

Production is `a58fd6b` with migrations through **0105**. The branch is at `062068d`; the builder's
queue is **empty** (`origin/build/walkthrough` is an ancestor of HEAD) and the tree is **clean** apart
from the design folders' nested copies, which are never committed. The last build on the reviewer's
machine: 126 suites passed, 0 failed; `next build` exit 0.

**48 code commits, 3 migrations (0106–0108, on scratch only), no token-value change beyond the two of
11 Sept that already shipped.** Grouped by what a person would notice; hashes are the builder's own.

## Migrations (the next deploy carries all three)

- **0106** `gym_tonnage_derived` — tonnage computed from the live sets through `gym_session_logs_current`; the stored column is dead (`5003959`, §0at).
- **0107** `nutrition_checkin_correct_once` — the weekly check-in can be corrected once; a second attempt is refused at the database (`00a7119`).
- **0108** `exercise_weight_step` — `exercises.weight_step_kg`, set on the library form, read by the logger's stepper (`66654d6`).

## Athlete app

- Gym logger: queued sets retried from the logger and on `online`, the row says "N waiting to send" (`84b258e`); a queued set whose slot already holds different numbers is a visible conflict, never a silent drop (`75c6a6e`, §0aa); the session summaries — complete (volume, sets, bests with what they beat) and finished early (`3a2daac`); "Set 1 corrected · was …" under the keys (`aec58c2`); the stepper moves by the exercise's own step (`66654d6`); one accent inside the logger, gold on the tab bar (`7824358`); set keys on the 44px floor (`45816c8`); screen kept on and a buzz on log (`458c6f1`); the prescription line never reads "@ No 1RM test linked…" (`a546137`).
- My data: five segments on one row (`ada5db5`); deltas state, never judge (`029ab76`); accent-and-neutrals readiness chart (`ca69a4b`); an empty period says when the last entry was and offers "Show this season" (`aff2c03`); Tests lists the club's tests, "Not logged" for one without a result (`0b601c1`); the session detail's eyebrow and the Corrected pill and line (`1357d23`); a corrected check-in day says so and by whom (`d3298f4`).
- Nutrition check-in: the question names its week (`fc3c5e0`); correct-once with the spent state (`00a7119`, 0107).
- System states (PATTERN-S6): a send that worked changes the count in place, no toast on Today, the failure sentence, the waiting card (`ea64eaf`).
- Shell rhythm one step down, `--gap-body` 28 → 20 px (`94099bd`, Isabella's 12 Sept decision).

## Staff app

- The phone shell: bottom bar of four plus More, More sheet, 64px title bar, the 44px floor (`af09c17`, `6a2f1d4`); `/injuries` titled "Injuries" (`6ded52a`).
- Dashboard: Doubtful / Ruled out as tone cards (`59eee8d`); summary cards say their state (`58f0aca`); missing check-ins ordered by mornings in a row (`a458c8e`); "Ready for {matchday}" only within 14 days (`ecb9c59`); the attention panel counts athletes and the Flags slot carries the number (`6ecc077`); the thresholds line "set by … · Change ›" (`095ad70`).
- Squad and profile: the roster on a phone — name as the link, pill right, restriction line on the row, no sideways scroll (`6248943`); empty panels state the requirement (`0f96ea4`); the read-only owner well on the Injury card and the Nutrition plan panel (`b15b21d`); **the coach does not see body mass at all** — card, cell, nutrition page, exports (`5a0d5d0`, Q27); "who will read what" before an availability change lands (`47a659e`); the coach's availability form is an absence form, Available withheld (`e7cf2d9`); availability history per athlete with a CSV, no migration (`1bf38b9`); the restriction line drops protocol / stage / diagnosis for every reader (`a25ceab`, PATTERN-S3 D1).
- Schedule (PATTERN-S4 A items): session minutes not contact minutes, Meeting in the legend, the current tab says so, the primary says what it makes (`b3cbaab`); "Expects" computed from `rpeDueAt` (`5f68cb6`); "Yes, remove" no longer promises an undo (`b2062d3`).
- Programmes (PATTERN-S5 A items): bodyweight "logs reps only", the profile's programme link is the tell (`702dd2c`).
- One rule for blocked controls — `BlockedButton`: aria-disabled, the reason on tap (`11dc42f`); the group reorder arrows blocked with their reason, `moveGroup` refuses out loud (`3e7b806`, §0az).
- Exports no longer says "Coach access" to the sport scientist (`e59dceb`); the GPS import page says what a re-upload does (`effc471`); three staff screens no longer scroll sideways at 375 (`6235ae5`).

## Not in this list, by design

Docs-only commits (walkthroughs, reviews, briefs, records, the to-do list, the test-club log), the design folders, and the test scripts that accompany every commit above (48 of the 134 prebuild chain entries are new since `a58fd6b`).

## Still open before the next deploy (reviewer's view)

§0bc (a complete gym session accepts a new set at the database), §0bd (`users_self_update` — any account rewrites its own status / email; the last admin can deactivate herself), §0al reopened (the offline publish still navigates away), §0ba / §0bb (SAR category; the injured-athlete proposal gate at the database), and the test-club run's findings F-01 … F-28 in `docs/test-club-run-2026-09-13.md`, not yet filed on the to-do list because the run is on HOLD.
