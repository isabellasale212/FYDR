# Waiting to send

## 1. Where it sits

Reached only from Today, from "See what is waiting" under the waiting count
(PATTERN-S6 C1, 13 September 2026). Route `/today/waiting`. Back returns to
Today. It is not in the tab bar and has no other entry: with nothing waiting,
Today does not offer it.

## 2. Who reaches it and when

Every athlete, when Today says something is saved on this phone and has not yet
sent — usually between sessions with no signal, or after a submit that timed
out. It answers one question: what exactly is being held.

## 3. What you see

A `--surf` card, "Saved on this phone", with the count and its unit split in
the header — "4 entries · 5 writes" — because a gym entry can hold several sets.
Then one row per entry, oldest first, on the app's own list row (`.hist-row`):

- **What the athlete did**, named — "Morning check-in · Sun 13 Sept", "Session
  rating · Sat 12 Sept", "Weekly nutrition check-in · week of Mon 7 Sept",
  "Gym · Upper B · Sun 13 Sept".
- **Its own denominator** — "seven answers of seven" (the six the check-in
  always carries plus each optional answer given), "rated 7 of 10 · 75 min",
  "one answer of one", "2 sets of 12 logged". A gym set queued before the
  logger began recording its session's name and total reads "Gym session ·
  1 set logged".
- **The local time it was saved** — "07:42" for today, "Sat 12 Sept 20:05"
  for any other day — in the value slot, tabular figures.

Under the rows: "Oldest first. Each sends by itself when you have signal — there
is nothing to press." No progress bars, no spinners, no per-item retry, no Send
now: the send is not the athlete's job (`OutboxFlusher` on Today does it).

A flagged conflict is not "waiting". It stays on Today's notice with its
Discard, and is left out of this list and its count, so the count here is the
count Today shows.

**Empty.** "Nothing is waiting." with when this phone last sent — "Last sent at
12:04 today — 3 entries." / "Last sent Fri 11 Sept 12:04 — 1 entry." — or
"Nothing has been sent from this phone yet." The last send is written by the
flusher beside the queues (`fydr-outbox-last-sent`).

## 4. What the athlete enters here

Nothing. Nothing on this screen can be edited or deleted.

## 5. Every number shown

The entry count, the write count, each row's denominator and saved time, and
the last send's time and count. All from the phone's own storage
(`lib/outbox.ts`), through `lib/outboxQueue.ts`; nothing is fetched.

## 6. Every thing you can act on

| Control | Where | Does | Then |
|---|---|---|---|
| ← Today | Under the heading | Back to Today | — |

## 7. Offline and sync

This is the offline screen. It reads storage on open and again when the phone
comes back online or another tab changes the queue. The flusher on Today is
what sends; when it does, the rows go and the empty state names the send.

## 8. Notifications

None.

## 9. Permissions

The athlete's own phone, the athlete's own queue. `requireAthlete`.

## 10. States

Rows, or the empty state. Nothing loads: the read is synchronous on mount.

## 11. Accessibility and device

One list, headed; the count in the header; every value in words or figures,
never a bar. Nothing animates.

## 12. Open issues

Retry timing, queue limits and a "too late to send" state are PATTERN-S6 C10
on the decision sheet.
