# One logged gym session

## 1. Where it sits

Reached from the gym region of My data. Route
`/my-data/gym/[gymSessionLogId]`. File 56 lines.

## 2. Who reaches it and when

An athlete looking at a session they logged. Added to fill a gap My data's own
header comment named as missing.

## 3. What you see

The sets logged in that session.

## 4. What the athlete enters here

Nothing. Read only.

## 5. Every number shown

Weights and repetitions as logged. **No metric ID: these are the raw entries, not
a computed metric.**

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Back | Top | Returns | `/my-data` | nothing | no | never |

## 7. Offline and sync

Read only.

## 8. Notifications

None.

## 9. Permissions

None.

## 10. States

Loading, **not found**, error.

**The not found state is a security decision, not an oversight.**
`fetchGymSessionLog` reads `gym_session_logs_current`, which is RLS self only, so
another athlete's id produces exactly the same "not found" as a missing row
**rather than a 403**. A 403 would confirm the row exists.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

None found.
