# Report a problem

## 1. Where it sits

**Two entrances**: Today's "Something not right?" card, and a row on Me. Route
`/report-problem`. File 101 lines.

**Two entrances is deliberate.** Telling somebody you are hurt should not require
finding a settings screen.

## 2. Who reaches it and when

Any athlete, any time.

## 3. What you see

A form, and **the athlete's own previous reports below it**.

## 4. What the athlete enters here

| Field | As worded | Type | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| The problem | UNVERIFIED exact wording | text | `src/lib/validation/problemReport.ts` | UNVERIFIED | `problem_reports` (migration 0040) | **UNVERIFIED whether retractable** | **the medic, in their triage queue** |

**Where it goes.** Straight into the medic's triage queue on the staff Injuries
screen (`ProblemReportsTriage`). This is the clearest cross app flow in the
product and Stage B4 traces it.

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Send to staff | Bottom of the card, pinned to the bottom of the screen while the card is taller than it | Files the report. `aria-disabled` in the secondary style — never dimmed — while the body is empty or over 1,000 characters, and a tap then does nothing (ATH-ADULT-03, 2026-09-11) | stays, then shows it below | a `problem_reports` row | UNVERIFIED | never |
| Close, the X | Top right | Leaves | **`/today` unconditionally** | nothing | no | never |

**The close button always goes to `/today`**, regardless of which entrance was
used, matching every other sheet styled athlete page rather than trying to
remember which tab sent the athlete here.

## 7. Offline and sync

**Not in the outbox**, unlike wellness, training, nutrition and gym. **This is
the one an athlete is most likely to submit pitch side with no signal.**
DECISION 11.

## 8. Notifications

`athlete.flag.shared` fires when staff acknowledge a flag raised about the
athlete. Push, off by default, **forced off for minors**. **Nothing in this codebase sends a push or an email.** No Expo push credential,
no APNs or FCM key, no email provider account. Preferences are stored for real;
nothing dispatches against them.

**UNVERIFIED: whether the athlete is told a medic has seen their report.**

## 9. Permissions

None. **No camera or photo permission**: there is no attachment.

## 10. States

Loading, submitted, previous reports listed, none yet, error.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy.

## 12. Open issues

- **DECISION 11:** not queued offline, and it is the likeliest offline submission.
- **UNVERIFIED:** whether a report can be retracted, and whether the athlete
  learns it was read.
