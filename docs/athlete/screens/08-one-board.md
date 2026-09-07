# One leaderboard

## 1. Where it sits

Reached from Boards I am on. Route `/my-data/boards/[leaderboardId]`. File 186
lines.

## 2. Who reaches it and when

An athlete who qualifies for that board. **`compute_leaderboard` refuses to
return the board at all unless the athlete qualifies**, so an unqualified or
unpublished board is simply "nothing came back", handled uninformatively on
purpose.

## 3. What you see

The top N, plus the athlete's own row if they fall outside it.

## 4. What the athlete enters here

Nothing.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-037 | Position | Rank | Per board | board not returned |
| MET-038 | Why a board is hidden | A minimum population floor, so a board of two does not identify anybody | Per board | board not returned |

**MET-039: readiness is deliberately not rankable.** No board ranks a wellness
score.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Back | Top | Returns | `/my-data/boards` | nothing | no | never |

## 7. Offline and sync

Read only.

## 8. Notifications

See Boards I am on.

## 9. Permissions

None.

## 10. States

Loading, nothing came back (unqualified, unpublished, or below the population
floor, and the screen does not distinguish them), error.

**Not distinguishing them is deliberate.** Telling an athlete which of the three
applies would leak the board's population and membership.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

None found.
