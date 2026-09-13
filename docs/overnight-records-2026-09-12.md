# Overnight proposal records — 2026-09-12 (builder)

One record per flow, in the format the ATH-ADULT-03 record used: **A** buildable now
from existing tokens with no behaviour change and no spec conflict; **B** needs a
token or pattern the system lacks, with the substitution; **C** behaviour, needs
scheduling; **D** collisions and spec conflicts. Every B, C and D carries a one-line
recommendation. Overnight rule: only A items and already-decided filed defects were
built; each flow is its own commit. Collision check covers every flow in this
queue (04, 06, 08, 09, 10, 11, 12, 13, STAFF-SS-01) and everything built on the
branch (01, 02 + follow-up, 03, the brand accent, §0ah/§0ai/§0ak/§0al/§0ao/§0ar/§0u/§0z).

Every token mapping below is by **role** onto `src/styles/tokens.css` (171 tokens).
Claude Design's own names (`--t-page`, `--blue-100`, `--ring-select`, `--r`) never
enter the code.

---

## ATH-ADULT-04 — Wellness already submitted

**Source.** `docs/designs/ath-adult-04-06-08 final/` — board "ATH-ADULT-04-06-08 · After
submit states" (8 frames), `notes.md`, `prompt.rtf`. Frames for this flow:
`f-04-today` (today's entry) and `f-04-past` (a past day, corrected by staff).
Screen: `src/app/(athlete)/check-in/page.tsx`, the non-form branches.

**Step 1 of the prompt, from the code.** *Exit destinations:* `backHref` already
resolves per branch — `/today` for today's entry, `/my-data?tab=wellness` for a
past day — and there is no referrer involved, so "no referrer → Today" holds by
construction. *Corrected-by attribution:* `fetchWellnessDay` reads
`wellness_entries_current` (`id, entry_date, …, submitted_at`) and does not select
`revision_of` or `created_by`, so the page cannot tell a corrected day from an
original today. Attribution: `users_org_select` (0012) lets any authenticated
member read every `users` row in their organisation, so a staff name IS readable by
an athlete under RLS — but showing it is a visibility decision (`docs/athlete/
visibility.md` governs what an athlete reads about staff), not one for a build
overnight; the prompt's fallback "Corrected on {date}" is the safe form (C4 below).

### A. Buildable now — existing tokens, no behaviour change

| # | Change | Before | After (real tokens) |
|---|---|---|---|
| A1 | The form's subhead only on the form | "45 seconds · 5 is always the best you can feel" rendered in every branch, including Already submitted and Nothing submitted | Rendered inside the form branch only; the after-submit branches carry title alone |
| A2 | The fact is the largest thing | `.card-title` 16/800 "Already submitted"; the time in 13px `.import-sub` | Heading `--fs-28`/800 (B1); the fact line "You sent today's check-in at 11:37." at `--fs-20`/700 `--text` (`.num`); the recourse under it at `--fs-13 --muted` |
| A3 | One emphasised card | plain `.card` | `.after-card`: `--wash-accent` fill, `1px --border-accent-soft`, `--r-toggle` (the athlete card radius), `--shadow`, `padding --sp-18`; `--text` on the wash measured 14:1 light / 11:1 dark |
| A4 | Every exit a 44px button in the footer | `.linklike` "Back", 28.6 × 19.5px | `.subm` footer (03's, reused unchanged) with a full-width `.btn-primary` labelled after the destination: "Back to Today" / "Back to My data" |
| A5 | Recourse copy per the board | the 40-word paragraph | "You can't change an entry yourself. Tell your coach or medical staff and they can correct it for you." + "The original stays visible in My data, marked Corrected." |
| A6 | Nothing submitted (past day) takes the same shape | plain card + "Back" link | the same card and footer; copy unchanged |

### B. Needs a token or pattern we lack — substitution

| # | Board | Ours | Note |
|---|---|---|---|
| B1 | `--t-page` 30px heading | no 30 on the scale | `--fs-28`. **Recommend:** accept 28 |
| B2 | `--blue-100` / `--blue-200` emphasised card | `--wash-accent` / `--border-accent-soft` | the accent wash family, on the navy accent. **Recommend:** accept |
| B3 | `--t-num-lead` 20px | `--fs-20` | exact |
| B4 | kit Button primary / secondary | `.btn-primary` / `.btn-ghost` at the 03 footer size | as 03 |

### C. Behaviour — needs scheduling

- **C1 Corrected state on the check-in page** (`f-04-past`): a "Corrected" pill and "Corrected on {date}" need `revision_of`/`submitted_at` of the revision in the page's fetch — new information on this screen. **Recommend:** select `revision_of` in `fetchWellnessDay` and show the pill + "Corrected on {date}" (no name, see C4); small, decided by the board; own commit.
- **C2 Time of a past day's submission** already shown; unchanged.
- **C4 "Corrected by {name}"**: readable under RLS (`users_org_select`), but whether an athlete should see which member of staff changed their entry is a visibility decision. **Recommend:** "Corrected on {date}" only until `docs/athlete/visibility.md` says otherwise.

### D. Collisions and spec conflicts

- **D1 The bottom sheet** the board assumes was declined for 03 (forms stay pages); these states are built on the pages, and "the sheet footer" is 03's `.subm`, reused as-is — no rule in it is edited, so no collision with 03. **Recommend:** as built.
- **D2 Class-level collisions with the queue:** none. `.after-card`, `.after-fact`, `.after-heading` are new classes; `.subm`, `.sheet-head`, `.card` are read, not edited. 12-13 (My data) shows the Corrected marker on its own screens (§0v, built) — copy agreement only.
- **D3 `docs/athlete/screens/02-morning-check-in.md` §3** describes the Already submitted card; updated in the same commit.

**Filed defects for 04:** none on the to-do list beyond §0w's "Back" target size, which A4 closes.

**Built:** A1–A6 with B1–B4. **Not built:** C1 (needs the fetch change), C4.

---

## ATH-ADULT-06 — RPE already rated, and Session not found

**Source.** Same board; frames `f-06-rated` and `f-06-missing`. Screen:
`src/app/(athlete)/rpe/[sessionId]/page.tsx`.

**Step 1, from the code.** *RPE already rated* exists: when `fetchTrainingEntryForSession`
returns a row the page renders a `.card` "✓ Rated" with "Rated at HH:MM. RPE N · M min."
and a 40-word recourse paragraph and a "Back to today" link. *Session not found* renders
`.empty` with the verbatim body and HTTP 200; the only exit is the ✕. The h1 is
"Rate {session name}" per 02's decision RPE 3.

### A. Buildable now

| # | Change | Before | After (real tokens) |
|---|---|---|---|
| A1 | Already rated: the fact is the largest thing | `.card-title` "✓ Rated", 13px prose | heading "Already rated" `--fs-28`/800; fact "You rated this session 5 of 10 at 11:36." `--fs-20`/700 `--text`; recourse "You can't change a rating yourself. Tell your coach and they can correct it for you." + "The original stays visible in My data, marked Corrected." at `--fs-13 --muted` |
| A2 | One emphasised card | plain `.card` | `.after-card` (04's B2) |
| A3 | Exit is a footer button | `Back to today` text link inside the card | `.subm` footer, `.btn-primary` "Back to Today" |
| A4 | Session not found: outcome at page size, exit in the footer | `.empty` dashed panel, no exit but ✕ | `.after-card` with heading "This session isn't there" at `--fs-28`, body verbatim ("It may have been cancelled or is not one of yours. Nothing is lost, there is nothing to rate."), footer "Back to Today"; title "Rate a session" kept; HTTP 200 kept |
| A5 | Close button names the screen | `aria-label="Close"` | `aria-label="Close the session rating"` (both branches) |

### B

| # | Board | Ours |
|---|---|---|
| B1–B4 | as 04 | as 04 |

### C

- **C1 Subhead "Today 11:30 · Pitch" under the title.** The page already shows the session block (time, title, place, MD) beneath the head, which carries the same facts; the board's subhead would duplicate it. **Recommend:** keep the session block, no subhead — or decide to replace the block with the subhead in a later pass; not both.
- **C2 "7 of 10"** — the fact line states the denominator; ours is "5 of 10" from the entry. Built as copy (A1); a half-point rating from staff correction (e.g. 4.3, present on scratch) prints as "4.3 of 10". **Recommend:** accept.

### D

- **D1 Board title "Team run" vs 02's decided "Rate Team run".** 02's decision RPE 3 stands (the row and the heading are the same function of the title). **Recommend:** keep "Rate {name}".
- **D2 "Session not found stays vague"** — verbatim copy kept; the current body has an em dash ("Nothing is lost — there is nothing to rate."); the prompt's exact text uses a comma. **Built with the comma**, as instructed.
- **D3 Collisions:** none — `.after-card` shared with 04 (same commit series, same definition, added once in 04's commit and reused here).

**Filed defects for 06:** §0t (two RPE ratings cannot be announced; the note button destroys focus) belongs to 05 (the form), not to this after-submit flow — not touched.

**Built:** A1–A5. **Not built:** C1.

---

## ATH-ADULT-08 — Weekly nutrition check-in after submit, and the correction

**Source.** Same board; frames `f-08-answered`, `f-08-correcting`, `f-08-saved`,
`f-08-spent`. Screens: `src/app/(athlete)/nutrition-check-in/page.tsx`,
`src/components/NutritionCheckinForm/NutritionCheckinForm.tsx` (correction mode).

**Step 1, from the code.** *Revision status:* `fetchCheckinForWeek` selects
`id, week_start, answer, note, submitted_at` from `nutrition_checkins_current` — not
`revision_of` — so the page cannot tell a corrected entry from an original.
*"Once":* `revise_nutrition_checkin` (0010, restated 0099) refuses only a superseded or
deleted original; a revision can itself be revised — **the once-only rule the board
states is not enforced anywhere today**, so `entry_not_revisable` is not what a
second attempt meets; it succeeds. *Nutrition questions:* the live build has ONE
question (protein: Yes / Roughly / No); the board's notes say two, but every frame on
the board draws one. *Corrected-by:* the athlete corrects their own entry; no staff
name is involved.

### A. Buildable now

| # | Change | Before | After (real tokens) |
|---|---|---|---|
| A1 | Answered: the fact is the largest thing | `.card-title` "✓ Already answered", 13px prose | heading "Already answered" `--fs-28`/800; fact "You answered Yes." `--fs-20`/700; meta "Sent {Sun 6 Sept} at {11:37}." `--fs-13 --muted num`; the existing sentence "This is the one entry you can change yourself. A correction creates a new revision and the original is kept." |
| A2 | One emphasised card | plain `.card` | `.after-card` |
| A3 | Leaving is the primary, correcting the secondary, both 44px in the footer | two `.linklike` links (19.5px) | `.subm` footer: `.btn-primary` "Back to Today", `.btn-ghost` "Correct this answer" beneath it, stacked at `--sp-8` |
| A4 | The correction banner names the week | "Correcting your answer for this week." | "Correcting your answer for Mon 31 Aug to Sun 6 Sept." — from `weekStart`/`weekEnd` already on the form; the revision sentence kept verbatim |
| A5 | The action names the act | "Done" | "Save correction" (correction mode only) |
| A6 | A way to leave without saving | none but ✕ | `.btn-ghost` "Keep the original" in the footer, linking back to the answered state |
| A7 | The previous answer stays tagged | the old answer simply deselects | a "Your answer" `.pill.pill-neutral` on the original option once a different one is chosen |
| A8 | Subhead names the week | none | `.sheet-head .s` "Mon 31 Aug to Sun 6 Sept" on the after-submit branches |
| A9 | Close button names the screen | "Close" | "Close the check-in" |

### B

| # | Board | Ours |
|---|---|---|
| B1–B4 | as 04 | as 04 |
| B5 | `--pill-accent` "Corrected" pill | `.pill.pill-accent` — exists; used only by C-states |
| B6 | dashed accent border on a previous scale point | n/a — the scale question does not exist (D2) |

### C. Behaviour

- **C1 Once-only correction, and the spent state** (`f-08-spent`): needs `revise_nutrition_checkin` to refuse when the original is itself a revision, `fetchCheckinForWeek` to read `revision_of`, and the page to show the spent card before the form is offered. The design-approach doc lists "Nutrition can be corrected once" under decisions already made, but nothing on the to-do list files it with a direction. **Recommend:** one commit — migration adding the refusal, the query reading `revision_of`, the spent state as drawn, the caption "You can correct this once after you submit." only once true.
- **C2 "Correction saved" state on this page** (`f-08-saved`): today a saved correction navigates to `/my-data?tab=nutrition`. **Recommend:** stay on the page and show the saved card; own commit with C1.
- **C3 The caption "You can correct this once after you submit."** asserts C1; not shown until C1 holds.

### D. Spec conflicts and collisions

- **D1 Answer wording.** Board: "Yes, most days / Some days / No". Spec (`docs/athlete/screens/04-weekly-nutrition-check-in.md`, `nutrition_checkin_answer` enum): Yes / Roughly / No. The wording of an answer changes what it means (CLAUDE.md §0.06). **Built with the spec's words; recommend:** keep them unless the spec is changed first.
- **D2 Two questions.** The notes describe a second question (fuelling around training, 1–5); no frame draws it and the schema has no column. A second question is a data change (migration, registry, CLAUDE.md rule 8 wording). **Recommend:** decide the product question separately; nothing built.
- **D3 Collisions:** none — `.after-card` shared with 04/06; `NutritionCheckinForm`'s footer is 03's `.subm` (D7 in 03 kept its tiny line — unchanged here; the 3b board owns that copy).

**Filed defects for 08:** §0u's nutrition item ("fix the copy, keep the default", decided 2026-09-10) — the past-week default is kept; the copy fix is in the board's week-naming (A4/A8).

**Built:** A1–A9 with B1–B4; C1–C3 on 2026-09-12 (decision sheet group (c)) — migration 0107, the chain read, the spent state, "Correction saved", the caption, My data's Corrected mark. **Not built:** D2 (declined — the second question).

---

## ATH-ADULT-09 — Log a gym session set by set

**Source.** `docs/designs/ath-adult-09-10-11 final/` — board "ATH-ADULT-09-10-11 · Gym logger
pattern" (13 frames), `notes.md`, the Claude Code prompt. Screen:
`src/components/GymSessionLogger/GymSessionLogger.tsx` on `/gym/[sessionId]`.

**The board is a different logger.** It draws a set-by-set screen: one exercise at a time,
weight and reps as two 48px numbers between 52px steppers, one 56px "Log set 2 · 100 kg × 8"
primary, and set chips as the state display. The live logger is a card per exercise with a
row of set keys (tap the next key to log the prescribed set), a weight stepper per card, a
session-RPE field and "Finish early / Finish session" in the footer. So most of the board is
a rebuild (C), and the prompt's own prerequisite — "the new design system and kit components
are in code" — is not met: there is no kit. What follows is what can be moved onto the
board's rules without changing what the screen does.

**Step 1 of the prompt, from the code.** (1) `--t-num-hero` is not a token in this system
(no such name in `tokens.css`; the dial and the stepper values use `--fs-24`/`--fs-28`
directly) — the "global change" the prompt asks about has nothing to change; a 48px step
does not exist (B1). (2) Prescription: `sets`, `reps_min`, `load_basis` and the recommended
load come from the programme exercise (`recommendedFor`); the weight step is a constant
`WEIGHT_STEP_KG = 2.5` in the component — **no per-exercise step and no "has a weight"
flag** beyond `load_basis === 'none'` for bodyweight (C3). (3) Offline: `logMutation` enqueues
each set (`enqueueGymSetLog`) and `OutboxFlusher` — mounted on `/today` — retries; nothing
flushes on the `online` event or from this screen (C4, and §0aa's discard question). (4)
Correcting: `revise_gym_set_log` (0044/0045), online only, no limit on how many times or
how long after, the original kept as a superseded row; My data marks the session corrected
(§0v). (5) Personal bests: no query says "best before today" per exercise; it would be a
max over `gym_set_logs_current` joined to exercise, filtered to dates before today (C6).
(6) Wake Lock: iPhone Safari 16.4+ and Android Chrome support `navigator.wakeLock`; where
absent the call rejects and the screen dims as today (C5). (7) Haptics: none in iPhone
Safari (`navigator.vibrate` is not implemented); Android Chrome has `vibrate()` (C5).

### A. Buildable now

| # | Change | Before | After (real tokens) |
|---|---|---|---|
| A3 | Structure from spacing, not borders | `.gym-ex-card` 1px `--border` | no border; `--surf` on the tinted page; the `--r-toggle` radius kept |
| A4 | The header never scrolls away | static `.gym-head` | `position: sticky; top: 0` on `--phone-bg`, its hairline kept |
| A5 | Rest is plain text | already "· 90s rest" in the exercise head | unchanged |
| A6 | Footer note "Sets save as you log them." | already there | unchanged |

Two items that are composable from existing tokens are **not** A, because they reverse a
recorded decision (see D4): the one-accent chip states (logged `--accent` + ✓, current
`--wash-accent` + `--ring-accent`, not reached `--faint` on `--surf2` undimmed) and the
neutral deviation line ("Prescribed 100 kg · **+2.5**" in `--muted`, real minus sign).

### B

| # | Board | Ours | Note |
|---|---|---|---|
| B1 | `--t-num-hero` 48px (and 34 → 48) | no step at 48 or 34; `--fs-32`/`--fs-48` exist | a value change on a token this system does not have. **Recommend:** decide with the rebuild (C1); nothing built |
| B2 | `--hit-lg` 56px, `--hit-md` 52px | no such tokens; the floor is 44 | new spacing steps — flagged per §0.01. **Recommend:** if the rebuild is approved, add `--hit-lg`/`--hit-md` as named tokens in that commit |
| B3 | `--dur-move` 300ms on `--ease-ring` for the chip fill | declined in 03 (B1) | **Recommend:** stays declined; the chip flips on `--t-state` |
| B4 | 48px set chip "stays literal" | ours 42px | **Recommend:** 44px minimum with the rebuild |

### C

- **C1 The set-by-set rebuild** (two 48px numbers, one "Log set N · W kg × R" primary, steppers for both values, exercise-at-a-time). **Recommend:** its own brief once B1/B2 are decided; it changes what the screen does, not only how it looks.
- **C2 Set chips as the correction target with no disabled control** — today a not-reached key is `disabled` so sets log in order. **Recommend:** keep order enforcement, present it as `aria-disabled` with the not-reached look (as 03 did for blocked actions), in C1.
- **C3 Stepper increment from the exercise record** (2.5 / 1.25 / 2 kg; bodyweight = reps only): needs a `weight_step_kg` on `programme_exercises` (or the exercise library) and a migration. **Recommend:** schema first, own commit.
- **C4 Queued sets send on the `online` event and from this screen** — the count "6 of 12 sets · 2 waiting to send". **Recommend:** mount the flusher's retry in the logger and on `window.online`; ties to §0aa's discard question.
- **C5 Wake Lock and haptics.** **Recommend:** `navigator.wakeLock?.request('screen')` on open, release on finish/exit, re-acquire on `visibilitychange`; `navigator.vibrate?.(10)` on log — both feature-detected; small, own commit.
- **C6 Session complete summary** (total volume first, sets done, personal bests "Best before today 100 kg × 8 · 21 Aug"). **Recommend:** a `fetchPersonalBestsBefore(date)` query, then the screen.

### D

- **D1 "Not logged" for an absent value** vs My data's em-dash convention (`my-data/gym/[id]`, `GymSessionSetsList`: "an em dash for a missing number, never a 0"). The 12-13 board (My data and history) owns those rows and is in this queue. **Collision — not built here; recommend** 12-13 decides the missing-value word for My data and the logger follows.
- **D2 The gold `--gym` domain colour** stays on the tab bar and the domain chips (the board's "no second hue" is scoped to the logger).
- **D3 Collisions with the queue:** `.gym-ex-card` and `.gym-head` are edited here and by no other queued flow; 10 and 11 share this component and are recorded below as the same series.
- **D4 The board reverses the 2026-09-08 redesign decisions on colour.** `docs/athlete/screens/05-gym-session.md` §13 records, and `scripts/test-gym-logger-redesign.ts` pins, the gold `--gym` progress fill, gym-tinted logged keys with `--gym-on-tint` ink and a ✓, and the amber "recommended N kg" sub-line — "so it is not rebuilt a second time". The board's "one accent, amber and teal are gone from the logger" undoes all three. A spec conflict by the overnight rule, so **not built. Recommend:** confirm the reversal; then one commit repoints the keys, the fill and the deviation line to the accent family (all existing tokens) and rewrites §13 and the guard.

**Filed defects for 09:** §0u item 1 ("sessions logged" counts) — built overnight (068e5ba). §0g (page-load row creation) — decided to keep. §0aa gym discard — question recorded (Builder 3).

**Built:** A3, A4. **Not built:** B1–B4, C1–C6, D1, D4.

---

## ATH-ADULT-10 — Finish a gym session early

**Source.** Same board: the finish-early control, the confirmation, the early summary.

### A

| # | Change | Before | After |
|---|---|---|---|
| A1 | The control is not shaped like logging a set | `.btn-primary` "Finish early · 4 of 12" in the footer | dashed 1px `--border-strong` outline, no fill, `--muted`, 44px (`.gym-finish-early`), same footer position |

### C

- **C1 Move to the header** — the board puts it in the header and leaves the footer to the logging action; on the live screen the footer's only action IS this one, so moving it leaves the footer with a note alone. **Recommend:** with the C1 rebuild of 09.
- **C2 The confirmation** ("Keep logging" primary; "Finish early" destructive secondary with "4 sets short"; what is saved, unlogged sets are not zero, where the session goes, corrections stay open). New behaviour. **Recommend:** own commit; the dialog pattern from 03's declined discard dialog is the shape.
- **C3 The early summary** (different title, dashed neutral bar, "Not logged" rows, no totals block). **Recommend:** with C6 of 09 (the complete summary), one commit for both summaries.

### D

- **D1 "Not logged"** as 09 D1 (12-13 owns My data's rows).

**Built:** A1. **Not built:** C1–C3.

---

## ATH-ADULT-11 — Correct a logged gym set

**Source.** Same board: the correction reached from the chip, the footer swap, the strip.

### A

- none beyond 09's chip colours: the correction panel already opens from a logged key and keeps its Save/Cancel pair.

### C

- **C1 "Save correction" / "Cancel" replace the logging action while the panel is open** — the panel sits inside the exercise card today and the footer is unchanged while it is open. **Recommend:** with 09's C1.
- **C2 After saving: the chip keeps its ring, the row shows the old value, the strip reads "Set 1 corrected · was 100 kg × 8"** — the logger reads `gym_set_logs_current` only, so the superseded values are not on this screen. **Recommend:** read the superseded row alongside (as My data does since §0v) and render the strip; own commit.

### D

- **D1** §0v (My data marks a corrected session; built) already shows both values on My data — the strip on the logger would be the same fact in a second place; keep the wording identical when built.

**Built:** nothing. **Not built:** C1–C2.

---

## ATH-ADULT-12 — My data

**Source.** `docs/designs/ath-adult-12-13 final/` — board "ATH-ADULT-12-13 · FINAL" (14 frames),
`notes.md`, the Claude Code prompt. Screen: `src/app/(athlete)/my-data/page.tsx` (1,926 lines,
five `?tab=` routes, three segments drawn).

**The board is a different information architecture.** Five tabs on the segmented track
(Wellness, Gym, Sessions, Nutrition, Tests), every tab a hero card (eyebrow, 48px figure, a
delta that never judges, a plain-English fact line, one chart) over a list card with a
denominator caption, and words for every absent value. The live screen draws three segments
with a footer card reaching the other destinations, hero cards on Wellness/Gym/Tests only,
tables on Sessions and Nutrition, a period `<select>` under the track, and an em dash for an
absent value. The prompt's prerequisites ("the new design system and kit components are in
code", "the gym logger (09-11) is built") are not met — there is no kit, and 09's rebuild
(C1) is recorded, not built.

**Step 1 of the prompt, from the code.** (1) Readiness: MET-001 is a 0–100 composite,
`readiness_score` on `wellness_entries`, headlined as such today; the board's "3.8 of 5"
would be a different metric (D5). (2) Programme blocks carry no dates the athlete surface
reads; "since {date}" is the fallback. (3) Last entry per domain, unbounded by the period:
no query — `fetchMyEarliestRecord` gives the *earliest* across all domains for the `all`
window, nothing gives the latest per domain (C6). (4) Corrections: no per-session revised
flag — the detail page reads `fetchGymSetRevisionChains` per session (§0v), the list reads
nothing; `total_volume_kg` is **stored** and 0045's `revise_gym_set_log` recomputes it from
live sets, so "recomputed after a correction" is true. (5) Week boundary: the nutrition
check-in uses a Monday week (`weekStart`); the training tab has no "this week" (C3).
(6) Nutrition: the live check-in asks **one** question (08 D2 stands). (7) Tests: `fetchMyTestSummary`
is built from `test_results`, so only definitions with at least one result are listed —
an assigned test with no result does not appear at all (the `latestValue === null` branch
is defensive), and "never assigned" is not a distinction the read makes (C7). (8) Usual-range band: MET-006, a 14-day rolling mean ±1 SD
(`rollingBand`, `ROLLING_DAYS = 14`) — defined, in the registry, already drawn.

### A. Buildable now — existing tokens, no behaviour change

| # | Change | Before | After (real tokens) |
|---|---|---|---|
| A1 | An absent value is words, never a dash | `NO_VALUE` (em dash) in `.hist-value[data-missing]` on the wellness, gym and tests lists; detail line "not submitted" | "Not submitted" (wellness, detail "No morning check-in"), "Not logged" (gym tonnage; the tests list's defensive no-result branch) in the value column; `.hist-value[data-missing]` `--fs-13` / 600 / `--faint`; `NO_VALUE` retired from this page |
| A2 | The wellness value column holds the word | `--hist-val-w: 54px` | `92px` (the tests column's width) — "Not submitted" at 13px/600 measures ~88px; the column stays fixed so its left edge still does not move |
| A3 | Hero figure at the board's size | `.rd-value` `--fs-38` | `--fs-48` (exists; `.brand .wm` is its one other reader) |
| A4 | Rows at the tap floor | `.hist-row` padding-only (a date-only row lands at 39px) | `min-height: 44px` |
| A5 | List captions | already "n = 24 of 28 days" (wellness), "tonnage from logged sets" (gym), "latest against your PB" (tests) | unchanged |
| A6 | "See all N →" as the last row, 44px | already `.hist-more` at 12+20+12 | unchanged |

A1 resolves 09 D1 / 10 D1 (deferred to this flow): the missing-value form on My data is a
word; the logger follows when C1 of 09 is built. The training table keeps the app-wide
table blank (`BLANK`, '·') until its own rebuild (C2) — a table cell is not a list row, and
that convention is product-wide.

### B

| # | Board | Ours | Note |
|---|---|---|---|
| B1 | `--chart-h: 84px`, `--chart-stroke: 2.5px` | no chart tokens; the readiness SVG is 880-unit viewBox scaled, the gym bars a fixed 72px | new tokens — flagged per §0.01, not built. **Recommend:** add both when the Sessions chart (C2) is built, one commit, `06-design-system.md` updated with it |
| B2 | `--blue-200` for prior values in every chart | no such token; the readiness line is `--chart-wellness`, gym bars `--chart-gym` | a new colour role. **Recommend:** map to `--wash-accent-strong` if the accent-and-neutrals rule is confirmed (D7 first) |
| B3 | `--t-body-2xs` segment labels (~11px) for five segments in 343px | `.md-seg` `--fs-14` | a value exists (`--fs-11`) but the segment count is D1's |
| B4 | `--hit-lg` 56px empty-state button | no such token | with C6 |
| B5 | `--pill-accent` / `--border-accent-w` for the corrected markers | `.pill-neutral` today; `--wash-accent` / `--border-accent` exist | **Recommend:** the existing neutral pill (§0v) stays; retint with 13's C3 |
| B6 | Eyebrow in `--faint` | `.eyebrow` is `--muted`, shared with Today's section titles | out of this flow's scope; **Recommend:** leave |

### C. Behaviour

- **C1 Five tabs** — also D1. **C2 Sessions and Nutrition as hero-card tabs** (RPE eleven-bar chart with this week solid, a Monday-week boundary, "n = 3 rated sessions this week"; nutrition weeks as question/answer rows). **Recommend:** their own brief after D1 is decided; the RPE week needs `docs/metrics.md` entries for "RPE this week" and "28-day RPE mean".
- **C3 The plain-English line** ("Readiness steady over 28 days, averaging 67.", "Two CMJ results is not enough to show a trend.") — needs a rule for "steady" and a minimum n. **Recommend:** state the rule in `metrics.md` first; facts only.
- **C4 Deltas against the 28-day average** ("↓ 0.1 vs your 28-day average") — the live delta is "on last week" (MET-001 against the prior week). A different comparison is a different metric. **Recommend:** decide with C3.
- **C5 Gym hero "Back squat best 102.5 kg, up 5 kg this block"** — the live hero is "12 sets done of 14 assigned"; a per-exercise best needs 09's C6 query and dated blocks. **Recommend:** after 09 C6.
- **C6 Empty period with older data** — "Nothing in the last 28 days." + "Your last gym session was Thu 13 Aug, 29 days ago…" + a "Show this season" button that does not widen the period on its own; "Nothing on record yet." for never. Needs a latest-date-per-domain query unbounded by the period. **Recommend:** `fetchMyLatestRecordByDomain`, then the three empty states; the button is a Link to `?period=season`.
- **C7 Tests lists only assigned tests, and an assigned test with no result reads "Not logged"** — today neither case is listed (see step 1, item 7). **Recommend:** a read of the athlete's assigned definitions joined to results, in `TestingTab`; own commit.
- **C8 Period on the title line as a menu** with the current option carrying the wash and a tick — `PeriodSelector` is a shared staff `<select>` (ten staff pages). A custom menu is a new component. **Recommend:** keep the select; if the menu is wanted, it is an athlete-only component, own brief.
- **C9 The five-segment row wraps at Larger Text** — moot at three segments; with D1.

### D. Collisions and spec conflicts

- **D1 Five segments** reverses the 8 September decision — `06-my-data.md` §3/§13 ("six segments to three") and `test-my-data-redesign.ts` ("Wellness, Gym and Tests are the three segments", "Training and Nutrition are not among them", the `md-more` footer card with its three routes). **Not built. Recommend:** accept the board's five — the objection that drove the footer card (three destinations orphaned) is answered by five tabs, and Leaderboards keeps its footer row; one commit rewrites `SEGMENTS`, the guard and §13.
- **D2 The active segment as a white card with a shadow** reverses `.md-seg[aria-selected='true']`'s recorded decision ("A SOLID ACCENT-FILLED PILL, not the card-coloured chip with a shadow that 23e drew") and the guard's "the live segment is an accent-filled pill". **Recommend:** with D1.
- **D3 Deltas never coloured** (`--muted`, figure `--text` bold, ↑ ↓ not ▲ ▼) reverses `.rd-delta[data-dir='up']` → `--good-text` (§13, guarded: "▲ on last week is green now") and the amber `down`/`off`. **Recommend:** accept the board — "a lower RPE and a lower readiness do not mean the same thing" is the better rule — one commit for `.rd-delta`, `.hist-delta`, the guard and §13.
- **D4 The tab bar drops the gold gym glyph** — `AthleteTabBar` records "the only coloured icon in the product — gold in both themes, inheriting nothing from the active state" (Spec §6), and 09 D2 kept the domain colour on the bar. The bar is on every athlete screen. **Recommend:** decide once for the shell, own commit.
- **D5 Readiness "3.8 of 5"** — MET-001 is 0–100 in `docs/metrics.md` and both apps; the prompt itself says the out-of-5 figure is a placeholder until the composite is confirmed. The composite IS defined. **Recommend:** keep 0–100; nothing to change.
- **D6 Nutrition history with two questions** — 08 D2: the live check-in has one. **Recommend:** as recorded there.
- **D7 The band in `--wash-accent` and the line in `--accent`** — `WellnessChart` is shared with staff pages (`--chart-wellness`). **Recommend:** if accepted, an athlete-only prop, not a change to the shared colours.
- **D8 Collisions in the queue:** `.rd-value`, `.hist-row` and `.hist-value` are edited here and by no other flow; 13 *reads* `.rd-value` and edits nothing shared, so 12 goes first and 13 is verified against the settled size. STAFF-SS-01 touches no athlete class.

**Filed defects for 12:** §0v — built (`6398493`). §0g (readiness area fill on short runs) — cosmetic, no direction. §0h (vertical rhythm) — needs a decision.

**Built:** A1–A4. **Not built:** B1–B6, C1–C9, D1–D7.

---

## ATH-ADULT-13 — One gym session from history

**Source.** Same board: frames "Session detail", "Session detail, one corrected set",
"Correcting a set from history", "Session detail · small phone". Screen:
`src/app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx` and `GymSessionSetsList.tsx`.

### A

| # | Change | Before | After |
|---|---|---|---|
| A1 | One way back, full width, named for its destination | a `.tiny` text link "Back to gym history" (15px hit area, §0w) beside the shell's Back button | a `.subm` footer with the same label as a full-width `.btn-ghost` (secondary — the board reserves the primary for Save correction); the shell's Back stands down on `/my-data/gym/` as it does on the sheets, so there is one way back. Label pinned by `test-back-consistency` — unchanged. Closes the third item of §0w |
| A2 | The summary line is the hero | one `.import-sub` line "6 sets logged · session RPE 5.8 · 4050 kg total" | a `.card` hero: "Total volume" `4050` (`.rd-value`, `--fs-48`) with "6 sets across 2 exercises" beneath, "Session RPE" `5.8` (or "Not rated"); the original line kept under it; the "kg" unit as `.rd-unit`. All from data the page already reads |
| A3 | Totals admit a correction | "6 sets logged · …" | "6 sets · recomputed after a correction" under the volume when any set has a prior revision (true: 0045 recomputes `total_volume_kg` from live sets, and this page sums live sets) |
| A4 | Absent set values are words | `'—'` in the reps/load cells and `dash()` in "What you reported" | "Not logged" in `--faint` |
| A5 | The footer note | "Correcting a set keeps the original, marks it superseded, and records a linked revision — nothing is overwritten." | the board's "A correction keeps the original. Corrections stay open on a finished session." |

### C

- **C1 The eyebrow "Gym · Lower A · complete"** — `fetchGymSessionLog` selects neither the programme session's name nor `status`. **Recommend:** extend the select (`status`, `programme_sessions(name)`); one commit with C3.
- **C2 Tap a row to correct; the footer swaps to Save correction (primary) and Cancel; no per-row "Correct" buttons; the logger's panel** — the panel today is inline in the table row with its own Save/Cancel. New interaction. **Recommend:** with 09's C1/11's C1, so the panel is one component.
- **C3 "Corrected · was 100 kg × 8" on the row, a "Corrected" pill on the history list row, "Set 1 was corrected on Fri 14 Aug. Both values are kept on record."** — the list has no per-session revised flag (a query), and the row marker needs a 3px bar the system has no pattern for (B5 of 12). **Recommend:** flag on `gym_session_logs_current` or a chained read; then the row marker.
- **C4 "4 of 6 shown"** on a small phone — a truncated set list. **Recommend:** don't: a session's sets are one list, and 667px is not the floor.
- **C5 No tab bar on this screen** — the shell draws the bar on every athlete route; hiding it per route is a shell change. **Recommend:** with D4 of 12 (the shell decision).

### D

- **D1 §0v's "What you reported" card** (built 2026-09-10, with its reasoning for no "by" line) stays as built; C3 moves the same fact onto the row. **Not touched here.**
- **D2 "Not logged" for a set value** — 09/10 D1, resolved by 12 A1: words.

**Filed defects for 13:** §0w third item (the 15px back link, "left open deliberately because the pair itself is ATH-ADULT-13's redundancy question") — closed by A1. §0v — built.

**Built:** A1–A5. **Not built:** C1–C5.

---

## STAFF-SS-01 — Staff dashboard and the phone shell — RECORDED, NOT BUILT

**Source.** `docs/designs/STAFF-SS-01 final/` — board "STAFF-SS-01 · FINAL" (8 desktop frames
at 1440×900, 6 phone frames at 375×812), `notes.md`, the Claude Code prompt. Screens:
`src/app/(staff)/dashboard/page.tsx`, `src/components/Sidebar/Sidebar.tsx`, the staff layout
and `base.css`'s `@media (max-width: 767px)` block. **Per the overnight instruction this
flow is recorded and not built: it is the staff phone shell and touches every staff screen.
It gets its own morning decision.** Nothing below was changed.

**The prompt's own gate.** "Before anything else: §0ae" — the last-admin guard is client-only
and the prompt asks for the database trigger first, proved by a refused direct call. Not
done overnight: a migration that changes who can remove a role is a permissions change, and
CLAUDE.md §5 makes its test-before-rule mandatory — the morning's, with the shell decision.

**Step 1 of the prompt, from the code (as far as a read goes).**
(1) Thresholds: `thresholds` (0006) is per org and per metric with `created_by` and
`updated_at` — the owner and date the footer line needs exist; no `set_by` display anywhere.
(2) Flag counting: `flags` (0006) is one row per athlete per metric per detection, with
`status` (`flag_status`, raised → acknowledged/resolved) and `resolved_at`; nothing closes a
flag by itself. "5 athletes" is a distinct count over open rows — a query change.
(3) Reasons: `availability_reason` gained `academic`, `representative`, `other` (0041) as
non-injury reasons; no clinical/non-clinical marker column — the enum value is the marker.
Whether the reason column is gated by role under RLS is a read of the availability policies
(`docs/access-matrix.md`) the morning should confirm, not a claim to make from a grep.
(4) The group filter reaches the dashboard's queries through `groupIds` (server side).
(5) The week strip starts `mondayOf(effectiveToday)` club-local and draws Monday–Saturday.
(6) Fixture range: `fetchNextFixture` reads from `kickoff_at >= now` with no upper bound;
"in range" is not a concept the dashboard has — the board's 14 days would be new.
(7) Role access: not enumerated here; `docs/access-matrix.md` is the source.
(8) "Send a reminder": no such action exists anywhere in `src/` — nothing sends push or
email (06-my-data.md §8).

### A. Composable from existing tokens — but still NOT built (shell scope)

| # | Board | Ours | Note |
|---|---|---|---|
| A1 | Tone-family cards for doubtful / ruled out (`--pill-warn` + `--warn` + `--on-warn`; bad likewise) | stripes | the same treatment ATH-ADULT-02 approved for the availability banner; dashboard-only |
| A2 | Summary cards as buttons with the written state ("Closed · opens a list" / "Open · showing the list") and `aria-expanded` | stat cards | copy + attribute; a real a11y gain |
| A3 | Attention rows name athletes, evidence line in `--faint` tabular | flag counts | needs (2)'s distinct count — C |
| A4 | "Not submitted" for missing check-ins, never 0 or 0% | — | data rule 1, same words 12 now uses |
| A5 | 44px everything on a phone (`--touch-min`) | 34px names, 17px Log out | §0af decided this is fixed once, at shell level |

### B

- **B1 The board says "Needs new token: nothing", and names eight that do not exist here.** Checked against `tokens.css`: `--r-sheet`, `--scrim`, `--touch-min`, `--tabbar-bg`, `--bar-blur`, `--tabbar-pad`, `--shadow-raised` and `--t-pill` are all absent (as are the `--t-*` type names and `--blue-100/200` throughout the board's captions — Claude Design's own naming, as with ATH-ADULT-01). Most of the ROLES exist: the athlete tab bar's own rules carry the bar background (no blur — `.athlete-tabbar`'s backdrop-filter was removed 2026-09-08, audit item 3, so `--bar-blur` has no role to map to), the sheets carry their radius and scrim, 44px is the raw floor every athlete control uses, and `--shadow` is the one shadow. **Recommend:** map by role onto the athlete tab bar and sheet rules when C1 is built; anything that maps to no existing value (a raised shadow, a second radius) is a new token and stops for a decision, per §0.01.

### C. Behaviour

- **C1 The phone shell** — bottom bar (Dashboard, Squad, Schedule, a role-driven fourth slot, More), the More sheet with the remaining sections and Log out at 52px rows, a 64px title bar with the page name and the active group chip. Every staff route. **Recommend:** its own commit, first, before any staff flow; a guard that the nine sections are reachable in exactly one place per role.
- **C2 The dashboard rebuild** — the matchday lead card, tone cards, disclosure summary cards, the attention list by athlete, the thresholds footer line, "Not checked in" ordered by run length, the week strip yielding on a heavy morning and for S&C, role versions (S&C four toggles, nutritionist two). **Recommend:** after C1, one commit per step as the prompt says.
- **C3 Flags badge** counting the same athletes as the attention card, absent at zero — needs (2).
- **C4 "Send a reminder"** — does not exist; nothing dispatches (no push or email provider). **Recommend:** leave the control off until a sender exists, as the prompt allows.
- **C5 §0ae trigger** — permissions; test first.

### D. Collisions and spec conflicts

- **D1 The shell shape reverses the decided direction.** §0af (Isabella, 2026-09-11): "below 768px, a compact top bar with the navigation behind a menu control" — the brief `docs/design-briefs/STAFF-SHELL - Phone layout below 768px.md` §2 calls that "the whole ask". The board draws a bottom bar of four plus More AND a 64px title bar. **Recommend:** decide which; the board's bottom bar mirrors the athlete shell (one idiom across both apps) and keeps content at y = 64 either way.
- **D2 The gym glyph goes neutral in the staff sidebar** — `Sidebar.tsx` draws it in `--gym` (the product's one coloured icon); 12 D4 records the same question for the athlete bar. **Recommend:** one decision for both shells.
- **D3 "Ready for {matchday}" with a 14-day range** — the dashboard has no fixture range; `docs/screens/` dashboard spec would change. **Recommend:** decide the range with C2.
- **D4 The reason line for the medic only** — data rule 6 and CLAUDE.md §2.3; the board's non-clinical reasons without the Medical label agree with 0041's intent. RLS confirmation first.
- **D5 Collisions with the queue:** none of this touches an athlete class. `base.css`'s `@media (max-width: 767px)` block and `.sidebar` are edited by no queued athlete flow. STAFF-SS-01 is the widest change in the queue and goes LAST by the collision rule, or first as a shell if the morning decides the shell precedes every staff flow (§0af says it does).

**Filed defects for STAFF-SS-01:** §0af (the stacked sidebar, decided; the 44px items pointed at the shell brief), §0ae (client-only last-admin guard — the prompt's gate), §0y first bullet (staff `.back-btn`, closed by the shell).

**Built:** nothing. **Recorded:** all of it.

---

## STAFF-SS-02 / SS-05 — Squad list and athlete profile

**Source.** `docs/designs/STAFF-SS-02-05 final/` — board "STAFF-SS-02-05 · FINAL" (12
artboards: 7 desktop, 5 phone), `notes.md`, the Claude Code prompt. Screens:
`src/app/(staff)/squad/page.tsx` (+ `RosterTable`), `src/app/(staff)/squad/[athleteId]/page.tsx`
and its panels (`InjuryCard`, `BodyWeightPanel`, `PlayerProfileFlags`, `EntryCorrectionPanel`,
`SetAvailabilityForm`, `SetAvailabilityFormCoach`). Landed on `athlete-spec-builder` 2026-09-12
(`63d9009`), recorded the same day under the standing rule (record, build A and B, append C
and D to `docs/design-decisions-outstanding.md`).

**The prompt's own gate.** Step 1 asks nine questions against the real permission model
"with a user holding exactly one role" before Step 2. Not answered tonight: the fixture
accounts on scratch hold one role each (Jane sport scientist, the medic and coach fixtures
exist), but a per-role, per-panel, per-write inventory is a review, not a build, and it is
what decides most of the C rows below. Recommended as the first morning step.

### A. Buildable now — existing tokens, copy, no behaviour change

| # | Change | Before | After |
|---|---|---|---|
| A1 | "Not recorded" is the only word for no status | `AVAILABILITY_STATUS.unknown.label` "Not set" — the roster, the profile header and every pill that reads the table | "Not recorded", neutral pill unchanged; matches the dashboard's "3 not recorded" |
| A2 | The coach-visible note says what may go in it | `SetAvailabilityForm`'s note label "Note (coach visible — not a clinical field)", no hint | the label "Note" and, under the field, "Coach visible. Describe the restriction, not the injury. Do not name a diagnosis or a protocol." (`.tiny`) |
| A3 | Corrections state what a correction does, once, at the top | the intro names never-overwritten and the dated revision; the window and the two non-correctable domains are unstated | the intro adds "The window is a fixed 28 days. Gym set logs and the weekly nutrition check-in are not correctable here." |
| A4 | The empty injury panel adds "This is not the same as being cleared." | "No current restrictions." | "No current restrictions. This is not the same as being cleared." |
| A5 | Missing clinical values are words | `ClinicalField` renders "—" | "Not recorded" (the medic's own fields, not a table cell) |
| A6 | An expected return the medic has not set is said | nothing rendered | "Expected return not known" (`.sub`, same place) |

### B — nearest existing token

| # | Board | Ours | Note |
|---|---|---|---|
| B1 | The status header as the one emphasised card (`--blue-100` / `--blue-200`) | `--wash-accent` / `--border-accent-soft`, the mapping ATH-ADULT-04 used | with C1 (the header absorbs the plan bar and the bio row — a layout change) |
| B2 | Phone jump bar on `--bar-bg` + `--bar-blur`, sheet `--r-sheet` over `--scrim` | the athlete bar's fill, `--r-card`, `--ink-rgb` at 0.35 (as SS-01) | with C3 |
| B3 | Read-only owner line in `--t-caption` uppercase at `--t-eyebrow-tracking` | `.eyebrow` | with C4 |
| B4 | Squad rows at 60px on a phone, restriction line on the row | 44px rows from the shell floor; the restriction is a column | a phone restructure of the roster table into rows — C2 |

### C. Behaviour, data, permissions

- **C1 The status header** — name, position, group, availability, restrictions, bio figures, development plan, one emphasised card; the coach's bio strip without body mass. Needs the club setting for body mass (Q1) and a per-role render. ⚠ permissions (what the coach sees).
- **C2 The squad list on a phone** — 60px rows, the name as the link, the pill right, the restriction line on the row. A responsive restructure of `RosterTable`.
- **C3 The phone profile's jump bar and "All panels" sheet** — a sticky 52px bar naming the current panel and its position, a sheet listing every panel in the role's order at 44px with a value each. A new component (the sheet pattern from SS-01 is the shape).
- **C4 Panels ordered by role from one library; withheld panels absent** — a per-role panel order and the absence rule; needs the Step 1 inventory. ⚠ permissions.
- **C5 Read-only panels name their owner** — "Read-only · set by medical staff · Ruth Callaghan · Fri 11 Sept": needs who-and-when on each panel's last write (the availability row has `created_by`; the nutrition plan and thresholds carry `updated_at`, not always a person). Data.
- **C6 The coach's injury card stops after expected return** — already true on the card (nothing renders below it for a non-medic; asserted in the component). No change; recorded as confirmed.
- **C7 The restriction line never names a protocol** — the strings are free text on the availability row (and the seed's "Return to play protocol, stage 3 of 6"); a rule, not a render. Seed and copy guidance (A2 is the guidance half).
- **C8 Empty panels state the requirement** — "a trend needs three weigh-ins", "no plan assigned, targets are per kilogram, so a plan needs a weigh-in": per-panel copy that depends on each panel's own empty condition; the body-weight and nutrition panels' empty branches need reading first. Medium.
- **C9 Body mass hidden from the coach** — a club setting, default off for the coach (Q1). ⚠ permissions ⚠ migration (a setting).

### D. Collisions and spec conflicts

- **D1** SS-01's shell (built) is the phone frame; C3 sits inside it — no class collision (`.ph-*` untouched).
- **D2** §0av's three disabled weight buttons ("+ Log weigh-in" etc.) — the board's rule 4 ("nothing at 45% opacity; disabled is for a control you could have used, not one that was never yours") says the same thing as Builder question 8's recommendation: `aria-disabled` and the reason shown, or the sentence printed once. One decision for the leaderboard chips, the weight trio and this board.
- **D3** PATTERN-S3 (same day) owns the injury and availability panels' content rules (site not coach-visible, the ladder, history); this board's A4–A6 touch only copy on the existing card and are compatible with S3's words.
- **D4** `docs/screens/03-athlete-profile.md` and `02-squad.md` describe the current panels; C1–C4 change the structure and are recorded, not built.

**Built:** A1–A6. **Recorded:** B1–B4 (with their C), C1–C9, D2 — appended to the decision sheet.

---

## PATTERN-S3 — Injuries and availability (both apps)

**Source.** `docs/designs/PATTERN-S3-final/` — board "PATTERN-S3 · FINAL" (4 parts), `notes.md`,
the Claude Code prompt. Screens named: the athlete's Today (one-time card) and a status
screen; the medic's injury record, advance screen and review; the coach's pitch-side form;
the S&C's proposal list; availability history; the absence form; the injury form
(`/injuries/new`, `NewInjuryForm`, `InjuryMedicalForm`, `InjuryCard`, `InjuryClinical`,
`SetAvailabilityForm`, `SetAvailabilityFormCoach`, `AvailabilityBanner`). A pattern board:
under CLAUDE.md §0.01 its named flows are one scope; serial implementation still applies.

**Most of the board is new data.** Its own "open against code" list says so: a per-athlete
read flag for the one-time card (Q6), an availability history with author, timestamp and
previous value (Q2 — "the single largest assumption on the board"), proposal states (Q3),
a club setting for site-visible-to-coach (Q8), academy return rules (Q9), stage names and
criteria (Q1). None exists today as described. What can be built from copy and tokens is
small and is A below; the rest is C and needs the data first.

### A. Buildable now

| # | Change | Before | After |
|---|---|---|---|
| A1 | The coach-visible hint travels with the boundary | the availability note field's label carries "(coach visible — not a clinical field)" | the sentence under the field, word for word (built with SS-02-05 A2 — same field) |
| A2 | Missing values are words on the injury card | "—" in the clinical fields; nothing for an unset expected return | "Not recorded"; "Expected return not known" (built with SS-02-05 A5/A6 — same card) |
| A3 | "This is not the same as being cleared" | absent | on the empty injury panel (SS-02-05 A4) |

### B

- **B1** none by the board's own account ("Needs new token: nothing"); the names it uses (`--blue-50`, `--blue-100`, `--blue-200`, `--on-tint-*`, `--t-subhead`, `--ring-action`, `--gap-chip`, `--line-dashed`) map by role onto the wash family, the accent ring and the existing dashed border, as before. No new token needed for A1–A3.

### C. Behaviour, data, permissions

- **C1 The one-time card on Today** ("told once, and the telling waits" until the status screen is opened) — needs a per-athlete read flag against the availability row. ⚠ migration. Also: the athlete's Today is ATH-ADULT-02's built screen; adding a card above To do is a change to a signed-off flow (collides with 02's record) — flag when scheduled.
- **C2 The athlete's status screen** — three cards (can I train today / what can I do / when am I back), the restriction list as rows, the ladder, the academy slot, "Not known yet". A new athlete route (no status screen exists; `/me` shows the line). Large.
- **C3 The stage ladder, the advance screen (one stage only, rewritten restriction line, criteria-reviewed confirmation), set-any-stage with a reason** — needs the protocol as data (Q1: a bare counter today, `stage n of 6` in a string). ⚠ migration.
- **C4 The confirmation that names who sees what** before a status change lands — a new step on the availability forms; the permission rule made visible. Medium; no data.
- **C5 The absence form** (illness, personal, academic, representative, other; Available not offered) — `availability_reason` has the non-injury values since 0041 and `SetAvailabilityFormCoach` exists; the board's form shape and the "no site, no diagnosis, no stage, no board row, no medical notification" well are copy and layout on it. Medium. ⚠ permissions (which roles).
- **C6 Proposals with three states (Proposed / Approved / Returned) and a required return reason** — proposal states beyond "proposed" do not exist (Q3). ⚠ migration.
- **C7 Availability history** — one row per change with author, timestamp, previous value; rows never edited. The availability table is append-only by date range today but carries no explicit previous value or author on every path (Q2). ⚠ migration (likely a view over `availability` + the audit log from 0097-style triggers).
- **C8 Body site not coach-visible** — the card renders `bodyAreaPhrase` to every staff role; the board withholds site and side from the coach behind a club setting defaulting to off. ⚠ permissions ⚠ migration (the setting; and RLS if the column is to be withheld at the database rather than in the render).
- **C9 The injury form split by permission** (left column for all injury roles, right column clinical) and the pitch-side four-field form at 44px — `NewInjuryForm` / `InjuryMedicalForm` restructure. Medium.
- **C10 "Not known" / "Not recorded" on the new screens** — with each screen.

### D

- **D1** The coach sees the protocol stage today (Q7: COACH-28's allocation screen renders "Return to play protocol, stage 3 of 6" to a coach) — either the seed string or an unenforced rule; C8 decides. ⚠ permissions.
- **D2** ATH-ADULT-02 (Today, built and signed off) — C1 adds a card above To do; the availability banner on Today is 02's and keeps its tone family ("one emphasised card per screen", so the new card would displace it). Collision to resolve when C1 is scheduled.
- **D3** STAFF-SS-02-05 (same day) touches the same injury card copy (A1–A3 shared, built once).

**Built:** A1–A3 (in the SS-02-05 commit, one card). **Recorded:** C1–C10, D1–D3 — appended to the decision sheet.

---

## PATTERN-S4 — Schedule and week grid

**Source.** `docs/designs/PATTERN-S4-final/` — board "PATTERN-S4 · FINAL" (14 artboards + 3
appendix frames), `notes.md`, the Claude Code prompt. Screens: `/schedule` (`ScheduleWorkspace`,
`TimeGrid`, `SelectedSessionPanel`, `WeekStatsPanel`), `/schedule/new` (`NewSessionForm`),
`/schedule/planner/*`, `/timetable`. Landed 2026-09-12 (`058123a`).

**The board's headline is a reversal.** "Sessions are live when they are created. No pending
queue, no Publish, no Discard." The live grid holds edits, drafts and removals until
**Publish to athletes** (`docs/screens/07-schedule.md` §6: "There is no per-session Save,
deliberately… one session published out of a week would put a half-updated schedule on
athletes' phones"); §0al built the held week's offline persistence on that model on
2026-09-12, and 0104 audits the publish. That is **D1**, and most of the board (the grid-click
popover that writes on Add, a drag that writes at once, the destructive confirmation's three
timeframes, "6 sessions live in the athlete app") depends on it. Recorded, not built.

### A. Buildable now — copy, a11y, existing tokens, no behaviour change

| # | Change | Before | After |
|---|---|---|---|
| A1 | The current view is a tab and says it is current | `role="tab" aria-selected="true"` | + `aria-current="page"` on the selected one |
| A2 | The legend carries all seven types | six | + Meeting, in its muted neutral |
| A3 | "session minutes", not "contact minutes" | "445 athlete contact minutes", "Contact time per group", "Contact time is within 40 minutes…" | "session minutes" / "Session minutes per group" / "Session time is within…" — the figure is session length, not length × attendees |
| A5 | The missing-group refusal states the consequence | "Choose at least one group." | + "Without a group, nobody is expected at this session, so it will not appear on any athlete's Today." |
| A6 | The primary says what it will make | "Add to Thursday" | "Add session · Thu 10, 16:00, 60 min" — a clause whose value is missing is dropped |
| A7 | Read-only names its editor in a well | a `.tiny` line | the same sentence in a `--surf2` well with a 1px `--border`, standing where Read/Edit sits |
| A8 | A removed block carries a "Removed" pill | strike-through at 0.65 | + `.pill.pill-neutral` "Removed", so the strike is not the only signal |

### B

| # | Board | Ours | Note |
|---|---|---|---|
| B1 | `--grid-hour-h: 40px` (14 hours = 560px) | `PXH = 66` | a new layout token; the grid fits a 900px viewport at 40 — with the popover (C2), decide then |
| B2 | `--ghost-removed: 0.55` | 0.65 in place | keep 0.65; the pill (A8) is the second signal |
| B3 | `--ring-invalid: 0 0 0 3px rgba(241,90,74,0.16)` | composable: `rgb(var(--bad-rgb) / 0.16)` | with the popover's refusal (C2) |
| B4 | phone sheet `--r-sheet` over a scrim | `--r-card`, `--ink-rgb` (as SS-01) | with C6 |

### C

- **C1 Live sessions** — D1. **C2 The grid-click popover** (320px, anchored, flips at the edges; a phone sheet) writing on "Add session" — depends on C1. **C3 A drag writes immediately** — C1. **C4 Read-only past/rated sessions with the reason** — needs the rule for editing a rated session (Q2). **C5 Distinct expected attendees** with denominators — a query (Q1). **C6 The phone: day-first with the dashboard's week strip, 44px rows** — a new phone layout for the grid (the shell is SS-01's). **C7 Template apply: offsets to dates, collision well** — `/schedule/planner/apply` restructure. **C8 "Nothing scheduled" as a dash per group** — the stats panel lists only groups with sessions; listing all needs the groups read. **C9 The destructive confirmation's three timeframes** — C1. **C10 "N sessions live in the athlete app" and the other denominators** — C1/C5.

### D

- **D1 Live-on-create reverses the held-until-publish model** (07-schedule.md §6, §0al, 0104). **Recommend:** decide once; if reversed, the publish machinery, the sessionStorage hold, the ghost/Restore and the banner all go, and the audit trigger records each write as its own act (already true).
- **D2** "Timetable" exists (`/timetable`, the Schedule row's Today tab) — the board's Q8 is answered; nothing to change. **D3** Fixture is a separate creation route by design (07-schedule.md). **D4** §0aj's "RPE due by 19:45" (Q4) is built as `expectsLabel` from `rpeDueAt` (5f68cb6) — the board printed the stale string.

**Built:** A1–A3, A5–A8. **Recorded:** B1–B4, C1–C10, D1 — appended to the decision sheet.

---

## PATTERN-S5 — Programme authoring

**Source.** `docs/designs/PATTERN-S5-final/` — board "PATTERN-S5 · FINAL" (10 artboards),
`notes.md`, the prompt. Screens: `/programmes/*` (`ProgrammeBuilder`, `ProgrammeForm`, the
assignment and override screens), the athlete profile's programme block, `/nutrition`
(`NutritionWorkspace`). Landed 2026-09-12 (`ed163fd`).

**The board's own dependency.** Q1 — "Is the prescription stored against the logged set, or
read from the programme?" — decides whether "a logged set keeps the prescription it was
logged against" is a display or a migration. Today `gym_set_logs` holds the actuals and the
programme exercise is joined live (`fetchGymSessionSetDetails`); editing a block rewrites
what a past set is compared against. That is **C1** and it is a migration.

### A

| # | Change | Before | After |
|---|---|---|---|
| A1 | A bodyweight exercise says what it logs, in words | a disabled load input | "logs reps only" as a plain value in the load slot; no disabled input on the row |
| A7 | The coach's detail link is the tell | "Change plan" / "Edit ›" for every role | "Edit this programme" for a role that may author (`PROGRAMME_AUTHOR`), "View full detail" otherwise; the header pill "Change plan" / "View plan" likewise |

### B

- none by the board's account; `--line-dashed` maps to the existing dashed `--border-strong` (the finish-early control's), `--blue-100/200` to the wash family, `--t-num-hero` to `--fs-48`.

### C

- **C1 The prescription snapshot on the logged set** (reps, load, step as at logging; "38 sets already logged keep the prescription they were logged against"). ⚠ migration. **C2 Effective dates on every prescription write** ("Sessions from Sat 12 Sept") — with C1. **C3 The adjustment screen** (one card with controls, parent rows in `--muted`, a required note, remove-override as a tertiary) — the override note required server side (Q5). **C4 Distinct athletes as an assignment's headline, with the arithmetic** — the same distinct-count query as S4 C5 / SS-01 A3. **C5 The mid-block confirmation screen** — with C1/C2. **C6 The primary carrying the number or date it commits** — with C2/C4. **C7 Nutrition rules authored per kilogram with the worked example, "not set" as a dashed frame, the squad mean with its n, the closing line** — `NutritionWorkspace` restructure; the rules exist as columns (Q7). **C8 "each side" for a unilateral exercise** — a flag the exercise record lacks (Q3). **C9 Weeks-down grid with "not reached"** — the block view. **C10 The phone adjust screen** — with C3.

### D

- **D1** PATTERN-S3's Approved pill for a rehab proposal appearing as an assignment — with S3 C6 (proposal states, ⚠ migration). **D2** ATH-ADULT-09's "Prescribed 100 kg · +2.5" reference line depends on C1 — the logger's rebuild (09 C1, approved) should read the snapshot when it exists.

**Built:** A1, A7. **Recorded:** C1–C10, D1–D2 — appended to the decision sheet.

---

## PATTERN-S6 — System states: offline, failed, empty, done

**Source.** `docs/designs/PATTERN-S6-final/` — board "PATTERN-S6 · FINAL" (12 artboards:
seven athlete phone, four staff desktop, one staff phone), `notes.md`, the prompt. Screens:
Today (`OutboxFlusher`), the entry forms, the gym logger, My data's empty states, the
schedule, the staff empty states, the permission-denied page. Landed 2026-09-12 (`00a3145`).

**The board's own frame.** Step 1 asks nine questions "before building". Answered here from
the code, so the record and the sheet carry the facts; nothing that needs a decision is built.

### Step 1, answered from the code

1. **Outbox retry:** on load of Today and on the browser's `online` event (`OutboxFlusher`),
   and since ATH-ADULT-09 C4 from the gym logger for its own session. No backoff, no
   schedule, no attempt count. **Nothing is ever abandoned** and the athlete is never told
   otherwise — see 2.
2. **Queue limits:** none — no cap, no expiry (`lib/outbox.ts`). A weekly check-in queued
   for a week whose three-week write window has since closed
   (`nutrition_checkins_athlete_insert`, 0012) is refused by the policy on every retry, for
   ever, silently: it counts as "1 entry saved on this phone" indefinitely. **A real gap** —
   the board's "too late to send" state needs a rule (C10).
3. **§0aa:** closed 2026-09-12 before this board landed (`75c6a6e`, and the shared
   `lib/gymOutboxFlush.ts` since `84b258e`): the gym branch performs the targeted lookup, a
   different-numbers collision is marked and shown on Today with "Use my numbers" / "Keep
   what is showing". The board's frame shows the gym item queued only, which matches.
4. **Session length:** the JWT expires after 30 minutes (`supabase/config.toml`
   `jwt_expiry = 1800`) with refresh-token rotation, so an open form is refreshed under the
   athlete and a mid-form expiry is the refresh failing (signal gone at the wrong moment).
   **Nothing preserves a part-filled entry form across re-authentication** — the gym logger
   keeps its per-exercise drafts in `localStorage` (`draftKey`), the three `.subm` forms
   keep nothing. Frames 5–6 are C3.
5. **Staff writes:** not queued, none of them. **Post-pilot by Isabella's decision
   2026-09-12** ("Staff app offline… accepted as a limitation for the pilot and stated
   plainly to the club"). Which are safe to queue (typed forms) and which are not (a drag)
   is the board's own split and is recorded with C4/C5 for then.
6. **Queued availability:** n/a today (5). The clinical-conflict question (a coach's held
   Unavailable meeting a medic's later value) goes with C4 as a decision.
7. **Permission denials:** not logged. `audit_log` records sign-ins, writes and reads of
   clinical rows; a route refusal (`requireStaff` / a role gate) redirects or 404s and writes
   nothing, so there is no reference an admin could look up (C7 needs a log — ⚠ migration).
8. **Live regions:** on the athlete surface `role="status"` appears in 19 files and
   `role="alert"` in 77 (`src/app/(athlete)` + `src/components`), one per banner or error
   rather than one per surface; Today alone renders one `status` (the waiting line) and one
   `alert` per conflict. The one-region-per-surface rule is a restructure (C9).
9. **Reconnect detection:** the `online` event and page load. There is no success message
   today, so nothing can fire twice; A1 below adds one and keys it to the flush that sent
   (state, not event), so a second `online` with nothing to send shows nothing.

### A

| # | Change | Before | After |
|---|---|---|---|
| A1 | A send that worked changes the count, in place, once | the waiting line disappears when the queue empties; nothing says the entries went | the same `role="status"` region reads "3 entries sent at 12:04. Nothing is waiting." after a flush that sent, as a plain `--surf` card with a tick; absent on the next load; not a toast, not dismissible |
| A2 | Success is never a toast on Today | `?submitted=` after each entry form showed a Toast ("Wellness submitted · queued, syncs on signal") over a to-do list that had already lost the row | the Toast is gone from Today; the list changing is the answer, the waiting line says what is held. The forms' redirects are unchanged (the protected queue-then-Today behaviour) |
| A3 | The failure sentence is the entry-form board's | "Couldn't save — check your signal and try again. Your answer is still here." | "That did not send — check your signal and try again. Your answer is still here." (ATH-ADULT-03's approved words, the instruction kept) |

### B

| # | Board token | Nearest existing | Used for |
|---|---|---|---|
| B1 | `--pill-good` fill / `--on-good` ink for the waiting line | `--wash-good` / `--border-good` / `--text` (the 01/02 banners' pair) | the waiting line as a good-tone card rather than a tiny grey line: held is a promise kept, not a warning |
| B2 | `role="alert"` on `--pill-bad` / `--on-bad` for a conflict | `--wash-bad` / `--border-bad`, `.g-bad` glyph | the conflict notice — a lost answer, not a caution — instead of the `--warn` border it had since §0aa |
| B3 | `--surf` card for the sent line | `.banner` on `--surf` | with A1 |
| — | `--blue-100` / `--blue-200` emphasised empty card | `--wash-accent` / `--border-accent-soft` (`.after-card`) | with 12 C6 and C8 |

### C

- **C1 The queue screen** ("Waiting to send": oldest first, each row what it is, its denominator, the local time it was saved; header "4 entries · 5 writes"; no spinners, no per-item retry; the conflict notice inside it; "Nothing is waiting" with the last send time) and **"See what is waiting" under the count on Today** — a new athlete route; the QueueRow shape (D3). Medium.
- **C2 Today's gym row carries its queued count** ("6 of 12 sets · 2 waiting to send") — the outbox read per session on Today; small, with C1.
- **C3 Session expiry mid-form** ("You have been signed out, so that did not send. Your six answers are still here." / "Sign in and send" / back to the same sheet, same scroll, every answer set, "Signed in as Conor…") — a form hold across re-authentication that nothing has today (Step 1 · 4), and a sign-in return path. Medium–large. ⚠ decision (where the hold lives).
- **C4 Staff typed writes queue** with "Saved on this phone · sends when you have signal. Nobody else can see this until you have signal.", the staff queue sorted time-critical first with a "When it sends" consequence line, raising a flag offline — **POST-PILOT by decision 2026-09-12** (staff offline). Recorded for then, with the clinical-conflict question (Step 1 · 6). ⚠ decision.
- **C5 A drag on the grid disabled offline** with the footer reason; "+ Session" / "+ Fixture" live and queued; Week templates disabled — with C4, post-pilot.
- **C6 A failed live write undoes itself** on the schedule: the block returns, the attempted slot stays as a dashed ghost "Did not save", the notice names both times and the athletes affected, Try again the one control. Online failure, not offline — in scope now; the schedule's move path. Medium.
- **C7 Permission denied** ("This is not available to you. It may not exist, or your role may not include it. Nothing more can be said about it here." + signed-in identity and what the role covers + a reference code + Back to dashboard) — the copy is small; the reference needs denials logged (Step 1 · 7). ⚠ migration for the log.
- **C8 Staff empty states to the one grammar** ("No check-ins from Academy in the last 7 days." / why / what would fill it / "Academy has 23 check-ins on record, the most recent on Fri 22 Aug." / "Nothing is missing from the record." / "Widen to last 28 days" + "Whole squad instead") — a sweep, each screen needing a most-recent-on-record read. Medium per screen. The athlete's My data version is **ATH-ADULT-12 C6** (approved, next).
- **C9 One `role="status"` and one `role="alert"` region per surface**, written on transition only, keyed by state — an audit (19 / 77 files today) then a restructure. Medium.
- **C10 Retry schedule, queue limits, "too late to send"** — decide: a check-in past its write window is refused for ever and counted as waiting for ever today (Step 1 · 2). ⚠ decision; recommend: an item refused by policy (42501 / a WITH CHECK) is marked "could not be sent — the week has closed" and shown once, like a conflict, with Discard.

### D

- **D1** `--pill-offline` / `--on-offline` — an offline tone that is not warn. New token; staff offline is post-pilot, so not now.
- **D2** `--line-dashed-failed` — a dashed ghost for a write that did not land, distinct from S4's "not yet" ghost. New token; with C6 (or C6 uses the existing dashed `--border-strong` and says so in words).
- **D3** `QueueRow` — a component with three slots (what, denominator, time saved) plus the staff consequence line. Composed from existing tokens; with C1.
- **D4** Today's "This morning is answered" card (frames 1 and 3) is ATH-ADULT-02's, not this board's; Today drops the row today. Not built here.
- **D5** Reduced motion — nothing in these states animates; nothing to build.

**Built:** A1–A3, B1–B2 (B3 with A1). **Recorded:** C1–C10, D1–D5 — appended to the decision sheet.
