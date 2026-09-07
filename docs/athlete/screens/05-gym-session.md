# Gym session

## 1. Where it sits

Reached from a to-do item on Today, and from the Gym tab. Route
`/gym/[sessionId]`. File `src/app/(athlete)/gym/[sessionId]/page.tsx`, 86 lines.

## 2. Who reaches it and when

An athlete with a gym session assigned to them.

## 3. What you see

The session's exercises, **already adjusted for this athlete**, and a way to log
each set.

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

**Two things are deliberately absent**, and the file says so: **no rest timer**
and **no comparison with previous performance**. Both need history queries a
fuller pass would add.

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

- **NOT BUILT:** rest timer, previous performance comparison.
- **UNVERIFIED:** the exact field labels and what happens on invalid input.
