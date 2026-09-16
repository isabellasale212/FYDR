# Gym session

## 1. Where it sits

Reached from a to-do item on Today, and from the Gym tab. Route
`/gym/[sessionId]`. File `src/app/(athlete)/gym/[sessionId]/page.tsx`. Since 13
September 2026 (ATH-ADULT-13 C2) it also opens a **past** log of the session by
id — `?log=[logId]` — read, never created (a log not on the athlete's record is
"That session is not on your record."), and `?correct=[setId]` opens that set's
correction with the logged sets revealed beneath the summary; a stale set id
opens nothing. "Best before today" on a past log reads before that log's own
day. This is how My data's session detail corrects a set: one correction
component.

**Redrawn 8 September 2026** from the redesign reference (screens 09/10). §13
records what changed — less than the changelog suggests, because most of the
amber it describes as new was already built.

## 2. Who reaches it and when

An athlete with a gym session assigned to them.

## 3. What you see

**Rebuilt set by set on 12 September 2026** (ATH-ADULT-09 C1, approved with the
two target-size tokens `--hit-lg` 56px and `--hit-md` 52px; 10 C1 and 11 C1 with
it). The header is pinned and never scrolls away: one eyebrow line
("PRE-SEASON STRENGTH · ACCUMULATION · WEEK 1 · DAY 1"), the session name with
**"Finish early"** beside it — a dashed neutral outline, 44px, only while sets
remain — and the accent progress bar with its running count and the clock
("3 of 12 sets · 00:12:40", "· 2 waiting to send" when the outbox holds sets).

**"View plan", 16 September 2026** (Isabella's evening queue, 1.6 —
appearance only): above the card, a ghost pill — "View plan · 4 exercises" —
that opens the whole session in place (a disclosure, not a dialog): every
exercise as a row, its position, name and prescription, and its state in
words — **Now**, **Done**, or the count ("0 of 3"). Tapping a row starts the
logger at that exercise (the rack is busy, do the next thing): the card
swaps, the footer's label follows, and the exercises still to do — the
skipped ones included — are listed under Then. The jump is screen state
only: nothing is written and the coach's order is untouched; once the chosen
exercise is complete the logger returns to the first exercise with sets left.
A finished exercise's row is disabled and greyed; the current one carries the
accent wash and the word. Not built, and on `docs/after-friday.md`: the timer
pausing when the app is backgrounded, and an edit-restricted-to-current-day
rule.

Then **one exercise at a time**, a white card with no border on the tinted page:
its name and position ("Set 2 of 3 · Rest 90s" — rest is reference text, no
timer, no glyph), its **set chips** at 48px as the state display (logged = the
accent with a ✓, and the correction target; current = the accent tint with the
ring; not reached = `--faint` on `--surf2`; the last two are not controls, so
nothing on the screen is disabled), then **the two numbers** — Weight and Reps at
`--fs-48` in tabular figures, each between two 52px steppers, the unit beside
the figure in `--muted`, the prescription beneath as reference ("Prescribed 100
kg"; "Prescribed 100 kg · **+2.5**" once the athlete moves off it — information,
not a warning, a real minus sign). The weight steps by the exercise's own
increment (`exercises.weight_step_kg`), reps by one; a bodyweight exercise logs
reps only; a lift whose load cannot resolve says why in the weight's place.
There is no keypad.

Beneath the card, **what is next**: "THEN Romanian deadlift · 3 × 8 @ 80 kg" as
one line when one exercise remains, rows with the prescription and "0 of 3"
otherwise — never behind a disclosure. Then the optional session RPE field.

The **footer** is docked on the tab bar — one fixed block, the action on the
tabs with the bar's hairline between (Isabella, 15 September 2026) — and holds
the one primary, labelled with what it writes: **"Log set 2 · 100 kg × 8"** at
56px. The caption beneath it — "Sets save as you log them." — was
Isabella's cited example of helper prose and went under the text rule on
16 September 2026 (the evening queue, category 1), as did the correction
footer's "The original is kept. My data marks the session corrected…".
Measured at 390×844 before the caption went: the docked action was 110px
(caption, the 56px primary, its padding), the bar 78px, the block 189px
before the home-indicator inset; without the caption the block is smaller
by the caption's line.
Once every set is logged the footer reads **"Finish session"**. After a set
lands, a strip above the card reads "Back squat set 2 logged · 102.5 kg × 8 ·
Correct it". Tapping a logged chip (or Correct it) opens the correction in
place: the card reads "Correcting set 2 · was 100 kg × 8", the two numbers edit
the correction, and the footer swaps to **"Save correction · 102.5 kg × 8"** /
**"Cancel"** (ATH-ADULT-11 C1) — no set can be logged by accident while one is
open. Corrections are online only; a minus on a value that was never logged
leaves it "Not set".

The session's exercises are **already adjusted for this athlete**, and each
carries a way to log every set.

**The prescription is personal, not the group's** (migration 0043).
`fetchSessionExercises` is called with the athlete's id, so:

- an exercise this athlete is exempt from **does not appear at all**
- a substitute or a volume override applies
- a load cap binds
- a percent of 1RM prescription resolves against this athlete's own latest 1RM
  result, **or says plainly that it cannot**

## 4. What the athlete enters here

| Field | As worded | Type and range | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| Set logs | "Weight" and "Reps", each a 48px figure between two steppers; "Log set N · {weight} kg × {reps}" writes them | weight and repetitions per set, prefilled from the prescription and moved by the steppers (the exercise's own kg step; one rep) | client validator in `src/lib/validation/gym.ts` | "Something on this set did not check out. Try again." | `gym_set_logs` | Once logged, only through a correction (a revision row) | staff, immediately |

`gym_set_logs` carries `revision_of` and `superseded_by` with check constraints
stopping a row pointing at itself, so the correction pattern exists at the table
level.

**A logged set keeps the prescription it was logged against** (PATTERN-S5 C1,
13 September 2026, migration 0111). "Log set N" writes, beside the two numbers,
the reference line's own numbers as they stood — `prescribed_reps`,
`prescribed_load_kg` (absolute, or the percent-of-1RM already resolved for this
athlete) and `prescribed_step_kg` — kept with it on the row. A block edited
later, a new override or a new 1RM changes what the next set is asked for and
nothing about a set already logged; a correction's reference line reads the
set's own snapshot, and the correction row carries it. A set with no kilogram
to state (bodyweight, percent of bodyweight, an RPE target) writes null there,
never zero. An item queued on the phone before the migration lands without a
snapshot.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-030 | The prescription | What to lift, resolved for this athlete. The exercise head reads "3 × 8 @ 100 kg · 90s rest"; when there is no load value the "@ …" clause is omitted (§0u, 12 September 2026) and the weight row says why — "No 1RM test linked to this exercise yet." / "No one rep max on file. Log the load you lift." / "Load not set" | This session | says plainly it cannot resolve, in the weight row, never inside the prescription line |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Log a set | Per exercise | Records weight and reps | stays | a `gym_set_logs` row | UNVERIFIED | the exercise is exempt for this athlete |
| − / + on the weight and on the reps | The two number blocks, `--hit-md` squares | Moves the weight by the exercise's own step — `exercises.weight_step_kg` (migration 0108, ATH-ADULT-09 C3, 12 September 2026): 2.5 kg a plate a side by default, 2 for a dumbbell, 1.25 microloaded, as set on the library's create form; a substitute override steps by the substitute's value — and the reps by one. Never below zero. Bodyweight (load basis none) has no weight block: reps only. The adjustment is kept on the phone until the session is finished | stays | nothing until the set is logged | no | no load to set (the weight block) |
| Log set N · … | The footer, `--hit-lg`, the one primary | Writes the set with the two numbers shown — queued on the phone first, sent at once | stays; the next chip lights, the strip names what landed | one `gym_set_logs` row | no | every set logged (the footer reads Finish session); a correction is open (Save correction / Cancel) |
| View plan · N exercises / Hide plan | Above the strip, a ghost pill (16 September 2026, 1.6) | Opens or closes the whole session plan in place | stays | nothing | no | the session is complete |
| An exercise row in the plan | The plan, one 44px button a row | Starts the logger at that exercise; closes the plan | stays | nothing — screen state | no | the exercise is complete (the row is disabled, "Done") |
| A logged chip · Correct it | The set chips; the strip above the card | Opens the correction in place: the numbers edit it, the footer swaps | stays | nothing until saved | no | never (a logged set is always the correction target) |
| Save correction · … / Cancel | The footer while a correction is open (ATH-ADULT-11 C1) | Writes the revision — the original is kept — or closes the correction | stays | one revision row (`revise_gym_set_log`) | no | no correction open |
| Start session | On open | `startOrGetSessionLog` creates or resumes the session log | stays | a `gym_session_logs` row | no | never |
| N more · … | After the last shown exercise | Expands the rest of the session | stays | nothing | no | nothing is folded |
| Finish early (header) / Finish session (footer) | Finish early beside the title, dashed and neutral, while sets remain (ATH-ADULT-10 C1); Finish session as the footer's primary once every set is logged | `completeSessionLog` closes the session log and the screen becomes its summary (below) | stays | `gym_session_logs` | no | the session is already complete |
| Session complete summary | In place of the set list, once every set is logged (ATH-ADULT-09 C6, 12 September 2026) | "Session complete · 12 of 12 sets" / "Every prescribed set is logged and saved."; then Total volume (MET-041, "Weight × reps across 12 sets") and Sets done ("4 exercises · 52 min"), both at `--fs-48`; then "Best you have logged" — each exercise whose best set today beats its best before today (MET-040), in the accent, with "Best before today 100 kg × 8 · 21 Aug" so the claim is checkable; then "All 4 exercises" with each lift's load ("no load logged" / "bodyweight" where none); the caption that the session is in My data set by set. Nothing celebratory beyond the numbers | stays | nothing | no | not complete, or finished early |
| Finished early summary | In place of the set list, once the session is closed with sets outstanding (ATH-ADULT-10 C3) | A dashed card: "Finished early · 8 of 12 sets" / "Everything you logged is saved. The 4 sets you did not log are recorded as not logged, not as zero."; one row per exercise with its sets ("102.5 kg × 8, 8, 8", "× 10, 10" for bodyweight, "Not logged") and a count pill — accent when complete, dashed when short; no totals block. The head reads "8 of 12 sets logged · 4 not logged" | stays | nothing | no | not complete, or every set logged |
| Corrected strip | Beneath an exercise's set keys, for each set that has been corrected (ATH-ADULT-11 C2, 12 September 2026) | Reads "Set 1 corrected · was 100 kg × 8" — the superseded values, read from the revision chain the way My data reads them; the logged key's label says "corrected" too. A neutral line in `--muted`; no bar, no second colour | stays | nothing | no | no set on the exercise has been corrected |
| Back to today / Correct a set | The summary's footer ("Sent to My data.") | Leaves; or reveals the logged sets beneath the summary so a set can be corrected in place | Today; stays | nothing | no | the session is open |

**Three things are deliberately absent.** **No rest timer** and **no comparison
with previous performance**, both needing history queries a fuller pass would
add — and, since 8 September, **no elapsed-session clock** (§13).

**The screen stays on for the session** (ATH-ADULT-09 C5, 12 September 2026): the
logger asks for a screen Wake Lock on open, again when the tab comes back into
view, and releases it on leaving. Where the browser has no Wake Lock, or refuses
one, the screen dims as before. A logged set gives a 10 ms vibration where the
browser has `navigator.vibrate` (Android Chrome); iPhone Safari has none and
nothing else changes.

## 7. Offline and sync

The entry is saved on the phone first and sent when there is signal
(`src/lib/outbox.ts`). Its own header states the rule: an athlete standing in a
gym with no bars must never be shown a network error for something they have
already done.

- **Queued in `localStorage`**, one key per domain.
- **Retried from the logger itself** (ATH-ADULT-09 C4, 12 September 2026): the
  screen retries its own session's queued sets when it opens and the moment
  the browser fires `online`, and refreshes so they appear as logged rows.
  Today's flusher keeps retrying everything, including a session the athlete
  closed. One function, `lib/gymOutboxFlush.ts`, does both.
- **Retried on the next load** of the app.
- **If the app is closed before sync completes**, the entry is still in the queue
  and goes on the next open.

- **A queued set whose slot was filled by a different set is a visible
  conflict, not a silent drop** (§0aa, 12 September 2026). On a duplicate-key
  error the flusher looks the slot up in `gym_set_logs_current`
  (`fetchGymSetForSlot`): the athlete's own row live, or another row with the
  same numbers, means the set landed and the item goes; a different row with
  different numbers is flagged with what is live (`lib/gymSetConflict.ts`).
  Today then shows "One saved set could not be sent: set 2 of Back squat on
  Wed 2 Sept is already logged as 8 reps at 100 kg from another tab or device,
  and that one is what is showing. Your queued numbers were 8 reps at 105 kg."
  with two ways out — **Use my numbers** (a correction of the live set through
  `revise_gym_set_log`, so the other row is kept as superseded and My data
  marks the session corrected) or **Keep what is showing** (drops the queued
  item). Nothing is guessed: a collision the lookup cannot explain is also
  surfaced.

- **A complete session refuses a new set at the database** (§0bc, migration
  0110, 13 September 2026). `gym_set_logs_guard_insert` reads the parent log's
  status before every insert: a set for a session already marked complete is
  refused with `session_log_closed`; a correction (`revision_of` set — the
  `revise_gym_set_log` path) is never refused, so a logged set in a finished
  session stays correctable, as decided. In the logger the refusal reads
  "This session was finished before this set was sent — correct a logged set
  instead." A queued set the retry meets this on is **flagged, not retried**
  (`isClosedLogError` / `flagClosedGymSet` in `lib/gymOutboxFlush.ts`;
  `closedLog` on the outbox item) — the next flush would only be refused
  again. Today shows it once: "One saved set could not be sent: the session
  was finished before this set was sent, so the database refused set 3 of
  Back squat on Wed 2 Sept. Your queued numbers were 8 reps at 100 kg —
  correct a logged set from My data if they belong there." with **Discard
  this one** as the only control (there is no live row these numbers can
  correct, so no "Use my numbers"). Not silently dropped, not counted as
  waiting.

**What the athlete sees while a set is queued** (C4): the progress row reads
"6 of 12 sets · 2 waiting to send" — the count of this session's sets that
have not reached the server, beside the count that has. A set that fails to
send still shows its error and the tick is still the fast retry; the count is
what stays on screen after the error is gone. A flagged conflict is not
counted as waiting — it is Today's to show.

## 8. Notifications

**UNVERIFIED: none found for this screen.**

## 9. Permissions

None.

## 10. States

Loading, session already complete, error, offline queued, an exercise whose
percent of 1RM cannot resolve because the athlete has no 1RM result.

## 11. Accessibility and device

Stage A0 recorded the decision to translate this section for a web app rather
than drop it.

- **Text scaling.** UNVERIFIED: no test at 200 percent browser zoom.
- **Screen reader.** UNVERIFIED per element.
- **Supported browsers.** UNVERIFIED: no browser support policy found.
- **Thumb reach.** The primary action sits at the bottom of the screen on the
  entry forms, which is the reachable third on a phone.
- **Target size.** The set chips are 48px (44px for the morning of 12
  September 2026 — B4 — then 48 with the rebuild the same afternoon); the
  steppers are `--hit-md` 52px squares and the one primary is `--hit-lg` 56px
  (the two tokens Isabella approved with the rebuild). The 44px floor is
  unchanged for everything else.

## 12. Open issues

- **NOT BUILT:** rest timer, previous performance comparison, elapsed-session
  clock (removed 8 September, §13).
- **UNVERIFIED:** the exact field labels and what happens on invalid input.
- **The elapsed clock's `mm:ss` has unbounded minutes**, so a session left open
  for three hours reads "177:19". Pre-existing and restored verbatim; filed as
  0g in the architecture to-do list.
- **The exercise card's rows do not share one inset.** Measured at 375px:
  `.gym-ex-head` pads 14px horizontally so the exercise name sits 15px from the
  card's left edge, while `.gym-set-keys` and `.gym-weight` pad 0 and sit at 1px.
  The reference draws them aligned. **Pre-existing and untouched** — it predates
  this redesign and the changelog does not raise it, so per CLAUDE.md §0 it is
  reported rather than quietly corrected. A one-line fix whenever it is wanted.

## 13. What the 8 September redesign changed — and the colour reversed on 12 September

**REVERSED 12 September 2026 (Isabella, ATH-ADULT-09 D4): inside the logger there is
one accent.** The progress fill is `--accent`; a logged set key is the accent with
`--on-accent` ink and a ✓; the current key is `--wash-accent` with `--ring-accent`; a
not-reached key is `--faint` on `--surf2`, undimmed; the live exercise head is the
accent wash; the weight row's deviation sub-line reads "prescribed 100 kg · +2.5" (a
real minus sign for a drop) in `--muted` — a fact, not a warning. The gold stays on
the tab bar's dumbbell and the domain chips, where it names the domain rather than a
state (12 D4 / SS-01 D2 declined). The part-done `pill-warn` badge stays: a status.
`scripts/test-gym-logger-redesign.ts` now pins this. The paragraphs below record the
8 September state it replaced.


**MOST OF THE AMBER THE CHANGELOG CALLS NEW WAS ALREADY BUILT**, which is worth
recording so it is not "rebuilt" a second time. Already on screen before this
pass, and now pinned by `scripts/test-gym-logger-redesign.ts` as regression
guards: the progress fill in `--gym` rather than the accent every other bar in
the product uses; completed set keys drawn as a checkmark in a gym-tinted box
with `--gym-on-tint` ink (the gold itself reads about 1.9:1 on its own tint);
the live exercise card's gym-tinted head; the part-done `pill-warn` badge; and
the weight row relabelling itself to **"Your weight"** with an amber
"recommended 142 kg" sub-line the moment an athlete moves off the prescription.

**Three things actually changed:**

**1. The header lost its Close/timer line.** This file's own code comment
defended it until today — "leaving a session and knowing how long you have been
in it are both real, and a picture cannot show that they are missing". Half of
that survives. Close was redundant: the athlete tab bar renders on this route
and **measured visible at 375×812** (top 735 of an 812px viewport), so there was
always a way out one row below it. The running clock is a real loss, recorded as
one; the eyebrow's planned duration is the session's shape, not elapsed time in
it. The once-a-second `setInterval` that drove it went with it.

**2. Exercises past the next one fold into one disclosure row.** The rule is not
"unstarted exercises collapse" — the reference shows an unstarted Romanian
deadlift in full — it is the exercise you are **on** and the one you are going
**to**, then everything after folded. It is a disclosure, not a truncation: one
tap shows the whole session, because an athlete asking how heavy the last lift
will be is asking a fair question. Once nothing is left to log the list opens
fully, since at that point it is a record of the work rather than a queue.

**3. The floating finish bar went — but not the finish button.** The changelog
removes the bar entirely. That bar held the **only** call to `completeMutation`
on the screen: delete it as drawn and an athlete can start a session and never
finish one, every session they open stays open for ever, and `alreadyComplete`
never becomes true for any of them. So the bar stops being sticky and the same
button renders inline at the end of the list, where someone who has just
finished their last set arrives anyway. "Finish early · N of M" keeps its
wording; finishing early is a real thing athletes do and naming it plainly is
what stops it reading as an error.
