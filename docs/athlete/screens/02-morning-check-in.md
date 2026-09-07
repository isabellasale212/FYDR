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

The five scales, one under another, each with both end labels always visible. A
sleep hours stepper above them. A submit button at the bottom.

**If today is already submitted, you see an "Already submitted" card instead of a
form**, telling you what to do if it is wrong.

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
| Sleep | "Sleep", with "hours last night" beside it | 0 to 14, half hour steps | CHECK 0 to 14 | refused | `.sleep_hours` | **No** | staff, immediately |
| Comment | UNVERIFIED whether this screen offers one | up to 1,000 characters | CHECK | refused | `.comment` | **No** | staff |

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
| Sleep stepper | Above the scales | Plus or minus half an hour, 0 to 14 | stays | nothing yet | no | already submitted |
| Submit | Bottom | Saves the entry | back to Today | one `wellness_entries` row | **No confirmation step** | already submitted |

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
- **UNVERIFIED:** whether a comment field is offered here.
