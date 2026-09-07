# Boards I am on

## 1. Where it sits

Reached from My data. Route `/my-data/boards`. File
`src/app/(athlete)/my-data/boards/page.tsx`, 94 lines.

## 2. Who reaches it and when

Any athlete who appears on at least one board.

## 3. What you see

A list of boards, **ordered by the athlete's own position ascending**. The
reasoning is recorded in the file: the board they are doing best on is first,
because that is the ordering least likely to open the app on a discouraging
number.

**A board this athlete does not appear on never appears here at all.** Excluded,
opted out, unqualified or simply not on it: there is no greyed or partial row.

## 4. What the athlete enters here

Nothing.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-037 | Position | Their rank on that board | Per board | the board is not listed |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| A board | The list | Opens it | `/my-data/boards/[id]` | nothing | no | not on it |

## 7. Offline and sync

Read only.

## 8. Notifications

`athlete.leaderboard.weekly`, push only, **off by default**, **minor floor off**.
**Nothing in this codebase sends a push or an email.** There is no Expo push
credential, no APNs or FCM key and no email provider account, anywhere. The
preferences are stored for real; nothing dispatches against them.

## 9. Permissions

None.

## 10. States

Loading, **on no boards at all**, error. The empty state is the common one for an
athlete who has opted out or is under 18 and has not opted in.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

None found.
