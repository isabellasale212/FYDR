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
