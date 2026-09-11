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

**Built:** A1–A9 with B1–B4. **Not built:** C1–C3 (behaviour), D2.

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
