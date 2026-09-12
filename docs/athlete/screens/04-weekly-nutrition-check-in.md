# Weekly nutrition check-in

## 1. Where it sits

Reached from a to-do item on Today, weekly (`today/page.tsx:139`). Route
`/nutrition-check-in`. File `src/app/(athlete)/nutrition-check-in/page.tsx`,
97 lines.

## 2. Who reaches it and when

Every athlete, once a week. **It defaults to the week that just ended, not the one
in progress**, even though the server's insert policy would allow the current
week. The interface never offers the current week.

**This is the whole nutrition commitment.** `CLAUDE.md` rule 8: athletes do not
log nutrition daily. There is no per meal entry, no macro logging and no nutrition
compliance domain. One question, once a week.

## 3. What you see

One question, three answers, and an optional note.

**The question names its week** (§0u, decided 10 September 2026, built 12 September):
"Did you hit your protein target most days **last week (24 to 30 Aug)**?" for the
default — the last completed week, which is the only week the question can honestly be
asked about and is unchanged — and "…most days **in the week of 10 to 16 Aug**?" when a
correction opens an older week, where "last week" alone would be wrong and the dates
carry the meaning. It never says "this week". The correction banner names the same dates.

## 4. What the athlete enters here

| Field | As worded | Type and range | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| The weekly answer | UNVERIFIED exact wording. Three options | one of three | enum | refused | `nutrition_checkins` | **No** | the nutritionist |
| Note | UNVERIFIED whether labelled | up to 280 characters | CHECK 280 | refused | `nutrition_checkins.note` | **No** | the nutritionist |

The week itself is constrained hard in the database: `week_start` must be a real
week start, and `iso_year` and `iso_week` must both agree with it. Three CHECK
constraints.

**Missing it is not non-compliance.** `CLAUDE.md` rule 8 says so explicitly.

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| One of three answers | Body | Selects | stays | nothing yet | no | already answered |
| Note | Below | Free text, 280 characters | stays | nothing yet | no | already answered |
| Done | Footer, pinned to the bottom of the screen | Saves. The footer's own line reads `0 of 1 answered · 1 to go` until an answer is chosen, then `Answered` as a green chip; until then the button is `aria-disabled` in the secondary style — never dimmed — and a tap does nothing (ATH-ADULT-03, 2026-09-11). The line beneath the button is unchanged pending the ATH-ADULT-3b board | back to Today | one `nutrition_checkins` row | **No confirmation** | already answered |
| Already answered card | Body, when the week is answered (ATH-ADULT-08, 12 September 2026) | One emphasised card: "Already answered", then "You answered Yes." (Yes / Roughly / No — the spec's words), "Sent {date} at {time}.", and the sentence that this is the one entry you can change yourself. The week ("Mon 31 Aug to Sun 6 Sept") is the subhead | stays | nothing | no | not yet answered, or correcting |
| Back to Today | Footer, primary, when answered | Leaves | Today | nothing | no | not yet answered, or correcting |
| Correct this answer | Footer, secondary beneath Back to Today | Opens the correction with the original pre-selected. The banner names the real week ("Correcting your answer for Mon 31 Aug to Sun 6 Sept.") and keeps the revision sentence; once a different answer is chosen the original keeps a "Your answer" tag | stays, `?correct=1` | nothing until saved | no | not yet answered, or correcting |
| Save correction | Footer, in the correction | Creates a revision; the original is kept. **Not limited to once today** — `revise_nutrition_checkin` enforces no once-only rule; recorded for decision | My data, nutrition tab | one revision row | no | not correcting |
| Keep the original | Footer, secondary, in the correction | Leaves the correction without saving | the answered state | nothing | no | not correcting |

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

**UNVERIFIED: whether a weekly nudge exists.**

## 9. Permissions

None.

## 10. States

Loading, already answered, error, offline queued.

## 11. Accessibility and device

Stage A0 recorded the decision to translate this section for a web app rather
than drop it.

- **Text scaling.** UNVERIFIED: no test at 200 percent browser zoom.
- **Screen reader.** UNVERIFIED per element.
- **Supported browsers.** UNVERIFIED: no browser support policy found.
- **Thumb reach.** The primary action sits at the bottom of the screen on the
  entry forms, which is the reachable third on a phone.

## 12. Open issues

- The exact wording of the question is now in §3; the three answers are "Yes /
  Roughly / No" (the `nutrition_checkin_answer` enum). Whether those are the final
  words is still a product question (ATH-ADULT-08 D1).
