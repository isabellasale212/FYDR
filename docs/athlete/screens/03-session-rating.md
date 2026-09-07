# Session rating, "How hard was it?"

## 1. Where it sits

Reached from a to-do item on Today, one per session. Route `/rpe/[sessionId]`.
File `src/app/(athlete)/rpe/[sessionId]/page.tsx`, 168 lines.

## 2. Who reaches it and when

An athlete who took part in a session, **once the session ended more than thirty
minutes ago**. `DUE_DELAY_MIN = 30`, and the reason is recorded in the file: an
RPE taken immediately after a session is biased by the final drill. **Not
configurable downwards.**

## 3. What you see

The session being rated, an RPE scale, a duration, and a submit button. If it is
already rated, a "Rated" card instead, which says who can fix a wrong rating.

## 4. What the athlete enters here

| Field | As worded | Type and range | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| RPE | UNVERIFIED exact wording | 1 to 10 | CHECK 1 to 10 | refused by the database | `training_entries.rpe` | **No** | staff, immediately |
| Duration | UNVERIFIED exact wording | 1 to 600 minutes | CHECK | refused | `training_entries.duration_min` | **No** | staff, immediately |
| Comment | UNVERIFIED whether offered | up to 1,000 characters | CHECK | refused | `training_entries.comment` | **No** | staff |

**Editing: no.** Same rule as the morning check in. `revise_training_entry` was
made coach and medical only by migration 0058, and the `?correct=1` parameter was
removed from the route signature entirely rather than accepted and ignored,
because an unread parameter is the kind of thing that gets quietly re-wired later.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-007 | Not labelled on this screen | Session load is RPE multiplied by duration, computed after save | One session | not applicable |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| RPE scale | Body | Sets 1 to 10 | stays | nothing yet | no | already rated |
| Duration | Body | Sets minutes | stays | nothing yet | no | already rated |
| Submit | Bottom | Saves | back to Today | one `training_entries` row | **No confirmation** | already rated |

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

`athlete.rpe.nudge`. **UNVERIFIED: copy, timing, timezone.**

## 9. Permissions

None.

## 10. States

Loading, not yet due (under thirty minutes since the session), already rated,
error, offline queued.

## 11. Accessibility and device

Stage A0 recorded the decision to translate this section for a web app rather
than drop it.

- **Text scaling.** UNVERIFIED: no test at 200 percent browser zoom.
- **Screen reader.** UNVERIFIED per element.
- **Supported browsers.** UNVERIFIED: no browser support policy found.
- **Thumb reach.** The primary action sits at the bottom of the screen on the
  entry forms, which is the reachable third on a phone.

## 12. Open issues

- **UNVERIFIED:** the exact wording of the RPE question and its scale labels. This
  matters as much as the wellness wording does, and it was not found.
