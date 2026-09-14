# Offline and queue states — a record of what is built

**A record, not new work. Written 16 September 2026 from the code and the
screens that carry it; nothing here was changed to write it.** PATTERN-S6
designed these states (13 September 2026); the athlete app has had the
mechanism since the entry screens were specified and the states since S6 was
built. They were written down nowhere in one place.

## The rule

An athlete standing in a gym with no bars must never be shown a network error
for something they have already done. An entry is **saved on the phone
first** and sent when there is signal. The send is not the athlete's job:
there is no "Send now", no per-item retry, and nothing to press.

## The mechanism (`src/lib/outbox.ts`, `src/components/OutboxFlusher/OutboxFlusher.tsx`)

- **One outbox per domain in `localStorage`**: the morning check-in
  (`fydr-outbox-wellness`), the session rating (`-training`), the weekly
  nutrition check-in (`-nutrition`), gym sets (`-gym-set`). Each queued item
  carries its input, the time it was queued, and — only when a flush has
  proved it — a `conflictAt`.
- **Only submissions queue.** They are plain idempotent inserts: the entry's
  id is generated before the write, so a retry after a crash inserts the same
  row, never a second. Corrections (the `revise_*` RPCs) never queue — a
  replayed correction cannot tell "my own first attempt landed" from
  "already corrected by someone else" — and go through the bounded online path
  in `src/lib/writeErrors.ts` instead.
- **The flush** (`OutboxFlusher`, mounted by the athlete shell): once on load
  and again on the browser's `online` event. A plain no-signal failure is
  never shown as an error; the item stays queued for the next attempt. The
  gym logger flushes its own sets the same way through `src/lib/gymOutboxFlush.ts`.
- **A slot conflict is the one queued outcome that is shown**, because
  retrying will never resolve it: a duplicate-key error whose targeted lookup
  finds a *different* id already live in this item's slot (one live entry per
  athlete per day, session or week). The item is marked `conflictAt`, left in
  the queue (CLAUDE.md rule 6: nothing is destroyed silently), excluded from
  automatic retry, and surfaced to the athlete with a Discard that is theirs
  alone to press.

## The states the athlete sees (PATTERN-S6, `docs/athlete/screens/19-waiting-to-send.md`)

- **Waiting.** Today carries the count as a status line — "2 entries waiting
  to send · See what is waiting" — and the gym logger's progress row carries
  its own: "6 of 12 sets · 2 waiting to send". Never a toast, never red.
- **The queue** (`/today/waiting`, `WaitingQueue`): reached only from that
  count, absent when nothing waits. A `--surf` card, "Saved on this phone",
  the count and its unit split ("4 entries · 5 writes", because a gym entry
  can hold several sets), then one row per entry, oldest first, each named as
  the athlete did it — "Morning check-in · Sun 13 Sept", "Session rating ·
  Sat 12 Sept", "Gym · Upper B · Sun 13 Sept" — with its own denominator and
  the time it was saved. No Send now; the sentence says the phone sends it
  the moment it has signal.
- **Sent.** A flush that sent something changes the count in place, once —
  "3 entries sent at 12:04. Nothing is waiting." — in the same status region,
  gone on the next load. Keyed to what landed, not to the `online` event, so
  a reconnect with nothing to send shows nothing and it can never appear
  twice for one send.
- **Conflict.** The visible banner above, with the entry named and the
  Discard that is the athlete's decision (ATH-ADULT-30).

## The staff side, which is different on purpose

The schedule holds a week's **unpublished** changes — edit overlays, staged
drafts, removals, the half-filled draft — in `sessionStorage` under a key per
organisation and week (`src/components/ScheduleGrid/pending.ts`, §0al, 11
September 2026), so a publish that fails on a pitch-side phone survives the
reload that used to destroy it. That is a held draft, not an outbox: a staff
write that fails is reported as failed ("Not published: …", `role="alert"`)
and the draft stays for the next attempt. Staff surfaces do not queue writes
behind the person's back; an athlete's entries do, because the athlete has
already done the thing.
