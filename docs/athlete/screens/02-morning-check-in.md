# Morning check-in

## 1. Where it sits

Reached from a to-do item on Today. Route `/check-in`. File
`src/app/(athlete)/check-in/page.tsx`, 134 lines. Form component
`src/components/CheckInForm/CheckInForm.tsx`.

## 2. Who reaches it and when

Every athlete, once a day, when the check in is owed. Also reachable as
`/check-in?date=...` from My data to look at a past day. **A date with no entry
does not open a backdated form**: the parameter only narrows which existing entry
is shown.

## 3. What you see

The five scales, one under another, each with both end labels always visible as
small chips carrying their numeral (`1 · Very sore`, `5 · No soreness`). An
unanswered scale reads **Not answered** in neutral grey; an answered one shows
nothing beside its name — the raised key is the answer. A sleep hours stepper
above them, which **starts empty** (`–`) and counts as a question. Below the
scales, a collapsed disclosure, **Add heart rate or weight**, holding the two
optional numbers, then an optional comment.

**The footer is pinned to the bottom of the screen** while the page scrolls
(ATH-ADULT-03, 2026-09-11), so the count and the action are on screen from the
first question. It reads, on its own line, `0 of 6 answered · 6 to go`, counting
down to `All six answered`, which is shown as a green chip. Under the count,
one line — *You can't change this after you submit.* — with **Why can't I edit
it?** beside it, a disclosure that opens the explanation (tell your coach; they
record a correction; My data shows both versions). Then the submit button,
**Submit entry**. While anything is outstanding the button is shown in the
secondary style and is `aria-disabled` — announced, focusable, but a tap does
nothing; it is never dimmed. Once every question is answered it becomes the
primary button.

**If today is already submitted, you see an "Already submitted" card instead of a
form** (ATH-ADULT-04, 12 September 2026): one emphasised card — the accent wash —
with "Already submitted" as the heading, the time you sent it beneath at full
size, then who can correct it ("Tell your coach or medical staff…") and that the
original stays visible in My data. The "45 seconds" subhead is not shown, since
there is nothing to start. The only exit is a full-width button in the footer at
the bottom of the screen, labelled after where it goes: **Back to Today** for
today's entry, **Back to My data** for a past day. A past day with no entry shows
"Nothing submitted" in the same shape.

## 4. What the athlete enters here

**This is the most important table in the athlete specification.** Wording is
taken verbatim from `src/lib/validation/wellness.ts:44`.

**All five scales run 1 to 5 with 5 as the best answer, including soreness, where
5 means no soreness.** Nothing is reversed. Both ends are always labelled, because
the code's own comment says "5 = no soreness" is counter intuitive and an
unlabelled scale is a guess.

| Field | As worded on screen | Type and range | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| Sleep quality | Very poor / Poor / All right / Good / Very good | 1 to 5 | CHECK 1 to 5 | refused by the database | `wellness_entries.sleep_quality` | **No** | staff, immediately |
| Fatigue | Exhausted / Tired / All right / Fresh / Very fresh | 1 to 5 | CHECK 1 to 5 | refused | `.fatigue` | **No** | staff, immediately |
| Soreness | Very sore / Sore / A bit sore / Almost none / No soreness | 1 to 5 | CHECK 1 to 5 | refused | `.soreness` | **No** | staff, immediately |
| Stress | Very stressed / Stressed / All right / Relaxed / Very relaxed | 1 to 5 | CHECK 1 to 5 | refused | `.stress` | **No** | staff, immediately |
| Mood | Very low / Low / All right / Good / Very good | 1 to 5 | CHECK 1 to 5 | refused | `.mood` | **No** | staff, immediately |
| Sleep | "Sleep", with "hours last night" beside it; **starts empty** (`–`) and is counted as a question — the first tap on + or − sets 7.0, then half-hour steps | 0 to 14, half hour steps | CHECK 0 to 14; the form cannot be submitted until it is set | refused | `.sleep_hours` | **No** | staff, immediately |
| Resting heart rate | "Resting heart rate (bpm)", inside **Add heart rate or weight**; helper text under the field: **Usually 25 to 120 bpm** | whole number, 25 to 120, optional | `validation/wellness.ts` `RESTING_HR_RANGE`, checked as typed | the field is marked invalid with *Check this. Resting heart rate is usually between 25 and 120 bpm.* beside it, and the footer reads **Fix one field to submit** until it is corrected or cleared | `.resting_hr` | **No** | staff, immediately |
| Body mass | "Body mass (kg)", inside the same disclosure; helper text: **Usually 30 to 200 kg** | one decimal place, 30 to 200, optional | `BODY_MASS_RANGE`, checked as typed | as above: *Check this. Body mass is usually between 30 and 200 kg.* | `.body_mass_kg` | **No** | staff, immediately |
| Comment | "Comment or injury issue (optional)", a textarea on the sheet | up to 500 characters | `max(500)` | not reachable — the field stops at 500 | `.comment` | **No** | staff |

The helper text and the inline check read the same two range constants the Zod
schema reads, so the copy cannot state one range while the validator refuses
another. Changing a range is a data decision made in `validation/wellness.ts`,
not a copy edit.

**Editing: no, and deliberately.** `CLAUDE.md` rule 6 makes wellness entries
immutable once submitted. A correction creates a new revision row and marks the
old one superseded. **The athlete cannot make that correction themselves**:
migration 0058 made `revise_wellness_entry` coach and medical only at the club's
request, and the `?correct=1` route was removed rather than left to collect six
answers and then refuse them.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-001 | Not shown on this screen | Readiness is computed from these five answers by a database trigger on save | The day | not applicable |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Five scales | Body | Sets a value 1 to 5 | stays | nothing yet | no | already submitted |
| Sleep stepper | Above the scales | First tap sets 7.0 from empty; then plus or minus half an hour, 0 to 14 | stays | nothing yet | no | already submitted |
| Add heart rate or weight | Below the scales | Opens the two optional fields | stays | nothing yet | no | already submitted |
| Why can't I edit it? | Footer, beside the irreversibility line | Opens the explanation of who corrects a wrong entry | stays | nothing | no | already submitted |
| Submit entry | Footer, pinned to the bottom of the screen | Saves the entry. `aria-disabled` (secondary style, not dimmed) while any of the six is unanswered or a field is out of range; the count line above it says which | back to Today | one `wellness_entries` row | **No confirmation step** | already submitted |

## 7. Offline and sync

The entry is saved on the phone first and sent when there is signal
(`src/lib/outbox.ts`). Its own header states the rule: an athlete standing in a
gym with no bars must never be shown a network error for something they have
already done.

- **Queued in `localStorage`**, one key per domain.
- **Retried on the next load** of the app.
- **If the app is closed before sync completes**, the entry is still in the queue
  and goes on the next open.

**UNVERIFIED: what the athlete sees while an entry is queued**, and what happens
if the same day is submitted twice from two devices. Looked in
`src/lib/outbox.ts` and the screen's own component.

## 8. Notifications

`athlete.wellness.nudge`. Constrained as described on the Today screen.
**UNVERIFIED: copy, timing, timezone.**

## 9. Permissions

None.

## 10. States

Loading, already submitted, error, offline queued, first run. **The already
submitted state is designed and carries its own copy**, which is more than most
of these screens.

## 11. Accessibility and device

Stage A0 recorded the decision to translate this section for a web app rather
than drop it.

- **Text scaling.** UNVERIFIED: no test at 200 percent browser zoom.
- **Screen reader.** UNVERIFIED per element.
- **Supported browsers.** UNVERIFIED: no browser support policy found.
- **Thumb reach.** The primary action sits at the bottom of the screen on the
  entry forms, which is the reachable third on a phone.

## 12. Open issues

- Immutability is correct and the athlete cannot correct their own mistake.
  Whether that is the intended end state is worth a decision.
- A decimal heart rate (52.5) within range is refused by the schema (`int()`)
  and shown the range sentence, which is the wrong reason. Rare — the input's
  step is 1 — but the copy does not name it.
