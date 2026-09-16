# Boards I am on

## 1. Where it sits

Reached from My data. Route `/my-data/boards`. File
`src/app/(athlete)/my-data/boards/page.tsx`, 94 lines.

## 2. Who reaches it and when

Any athlete who appears on at least one board.

## 3. What you see

**One board, and a dropdown to switch** (16 September 2026, Isabella's
overnight queue, 1.3: "a simple board, with a dropdown to switch between
leaderboards"). The dropdown names every board the athlete is on — the name,
with its metric beside it when the two differ — and `?board=` holds the
choice; the chosen board is drawn in place, the same top-N-plus-you table the
board's own page draws (`AthleteBoardTable`, shared by both), with "Leave this
leaderboard" beneath it. With no choice the first board is shown: the boards
are **ordered by the athlete's own position ascending**, the reasoning
recorded in the file — the board they are doing best on is first, because that
is the ordering least likely to open the app on a discouraging number. Until
16 September this was a list of cards, one per board, each opening its page;
that page (`/my-data/boards/[id]`) still answers.

**A board this athlete does not appear on never appears here at all.** Excluded,
opted out, unqualified or simply not on it: there is no greyed or partial row.

**The table's header, 16 September 2026 (Isabella's evening queue, 1.3):**
the column labels — Pos, Athlete, the metric — sit in a filled band (the
accent wash, `--accent-on-wash` ink) with the same padding above, below and
beside each word, at `--fs-13` (a step bigger than the report tables); the
cells match the band's side padding so words and figures stay in line.
`table.tbl.lb-table th` in `base.css`, shared with the staff phone
leaderboard. The caption beneath the table — "28 athletes ranked. Athletes who
are not shown either opted out or have no qualifying result — which one is
never shown here" — is gone under the text rule (the athlete app drops the
figure with the sentence); the opt-out stays unsaid by design as well
(`docs/athlete/visibility.md`). The scope line above the table ("Whole squad ·
all time") stays.

## 4. What the athlete enters here

Nothing.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-037 | Position | Their rank on that board | Per board | the board is not listed |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| The Board dropdown | Above the table | Shows that board in place | stays here, `?board=` in the address | nothing | no | not on it (a board the athlete is not on is not an option) |
| Leave this leaderboard | Below the table | Leaves the shown board | stays here | the athlete's board opt-out | yes | — |

## 7. Offline and sync

Read only.

## 8. Notifications

`athlete.leaderboard.weekly`, push only, **off by default**, **minor floor off**.
**Nothing in this codebase sends a push or an email yet** (push is web push, PATTERN-S9 — `docs/platform-decision.md`, 13 September 2026; there is no native app and no Expo push). There is no Expo push
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
