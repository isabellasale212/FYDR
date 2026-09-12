# Gym session

## 1. Where it sits

Reached from a to-do item on Today, and from the Gym tab. Route
`/gym/[sessionId]`. File `src/app/(athlete)/gym/[sessionId]/page.tsx`.

**Redrawn 8 September 2026** from the redesign reference (screens 09/10). §13
records what changed — less than the changelog suggests, because most of the
amber it describes as new was already built.

## 2. Who reaches it and when

An athlete with a gym session assigned to them.

## 3. What you see

One eyebrow line ("PRE-SEASON STRENGTH · ACCUMULATION · WEEK 1 · DAY 1"), the
session name, and a gold progress bar with its set count — this header is pinned
and never scrolls away (ATH-ADULT-09, 12 September 2026), so what is next is
always stated. Then the exercise you are on and the one after it, each a white
card with no border on the tinted page (structure from spacing; the active card
is marked by its tinted head), a **"2 more · Split squat, Nordic curl"** disclosure
row folding the rest, the optional session RPE field, and the finish control —
a dashed neutral outline reading "Finish early · N of M" while sets are
outstanding (ATH-ADULT-10, 12 September 2026: it is not shaped like logging a
set), and the primary "Finish session" once every set is logged.

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
| Set logs | UNVERIFIED exact labels | weight and repetitions per set | client validator in `src/lib/validation/gym.ts` | UNVERIFIED | `gym_set_logs` | **No** | staff, immediately |

`gym_set_logs` carries `revision_of` and `superseded_by` with check constraints
stopping a row pointing at itself, so the correction pattern exists at the table
level.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-030 | The prescription | What to lift, resolved for this athlete | This session | says plainly it cannot resolve |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Log a set | Per exercise | Records weight and reps | stays | a `gym_set_logs` row | UNVERIFIED | the exercise is exempt for this athlete |
| Start session | On open | `startOrGetSessionLog` creates or resumes the session log | stays | a `gym_session_logs` row | no | never |
| N more · … | After the last shown exercise | Expands the rest of the session | stays | nothing | no | nothing is folded |
| Finish session / Finish early · N of M | End of the list | `completeMutation` closes the session log | stays | `gym_session_logs` | no | the session is already complete |

**Three things are deliberately absent.** **No rest timer** and **no comparison
with previous performance**, both needing history queries a fuller pass would
add — and, since 8 September, **no elapsed-session clock** (§13).

## 7. Offline and sync

The entry is saved on the phone first and sent when there is signal
(`src/lib/outbox.ts`). Its own header states the rule: an athlete standing in a
gym with no bars must never be shown a network error for something they have
already done.

- **Queued in `localStorage`**, one key per domain.
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

**UNVERIFIED: what the athlete sees while an entry is queued.** Looked in
`src/lib/outbox.ts` and the screen's own component.

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

## 13. What the 8 September redesign changed

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
