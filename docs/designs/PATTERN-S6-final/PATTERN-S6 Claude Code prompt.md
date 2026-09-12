# Pattern S6: build the system states

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"PATTERN-S6 · FINAL"** (12 artboards) in `docs/designs/pattern-s6-final/`, with `notes.md` and the board PNGs beside it. It governs offline, error, empty and success states across **both** apps, and it supersedes ad hoc states on any screen.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Step 1. Report before building

Answer each from the code. Wait for my reply before Step 2.

1. **Outbox:** what is the retry schedule and backoff? Is an item ever abandoned? What is the user told if it is?
2. **Queue limits:** is there a cap or an expiry? What happens to an entry whose window has closed (a weekly check-in queued for a week that has ended)?
3. **§0aa, the gym duplicate:** confirm the gym branch skips the targeted lookup that wellness, RPE and nutrition perform, so a real conflict on a set is dequeued silently. Propose the fix.
4. **Session length**, and whether anything currently preserves a part-filled form across re-authentication.
5. **Staff writes:** can they be queued? Which writes are safe to queue (typed forms) and which are not (a drag that has already moved on screen)?
6. **Queued availability:** is a held change re-checked against the server before it lands? What happens if the medic changed the same row in the meantime?
7. **Permission denials:** are they logged with a reference an admin can look up?
8. **Live regions:** how many `role="status"` and `role="alert"` regions exist per surface today?
9. **Reconnect detection:** what triggers a flush, and can a success message fire twice?

## Step 2. The athlete states

- **Waiting count** stays in the existing status region, with its sentence unchanged, plus "See what is waiting" as the only route to the queue. Both absent when nothing is waiting.
- **The queue screen:** oldest first, each row naming what it is, its denominator and the local time it was saved. Header shows entries and writes. No spinners, no progress bars, no per-item retry.
- **Conflicts:** the existing conflict copy, with "Discard this one" as a ghost control inside the notice only.
- **Success:** the count changes in place, then goes. Never a toast. Where the screen already shows the result, nothing else appears.
- **Session expiry mid-form:** answers held on the device, "Sign in and send" as the primary, and after signing in the same sheet at the same scroll position with every answer set and nothing retyped.
- **Failure:** the approved copy, with Try again.

## Step 3. The staff states

- **Typed staff writes queue**, with the honest line: "Saved on this phone · sends when you have signal. Nobody else can see this until you have signal."
- **The staff queue sorts time-critical writes first** (availability, injury), each with a "When it sends" line naming the consequence in people.
- **Raising a flag offline is allowed** and nothing is disabled.
- **Dragging a block on the grid is disabled offline**, with the reason stated in the grid footer. "+ Session" and "+ Fixture" stay live and queue. Week templates is disabled because it reads the server.
- **A failed live write undoes itself:** the block returns to the time athletes still have, the attempted slot stays as a dashed ghost reading "Did not save", and the notice names both times and the athletes affected.
- **Permission denied:** the approved copy, the signed-in identity and role, a reference code if denials are logged, and one primary back to the dashboard.

## Step 4. Grammar applied everywhere

- **Empty states:** what is empty with its denominator and window, why, what would fill it, where the data actually is, and one action that changes the window or filter. Never a zero, never an illustration. Never say "never" when the truth is "not in this period".
- **Missing values in words.** Counts always carry denominators.
- **Announcements:** one `role="status"` and one `role="alert"` region per surface, written on transition only, keyed by state.
- **No animation in any of these states.**

## New tokens

None approved. Three candidates are named in the notes (`--pill-offline`, `--line-dashed-failed`, `QueueRow`). If you need one while building, propose it rather than adding it.

## Verify

- Screenshots of all 12 frames on the real build.
- Turn the network off, submit a wellness entry, log two gym sets, then turn it back on without leaving the screen: show the queue, then the sent state.
- Expire a session mid-form, sign in again, and show every answer still set.
- Queue a staff availability change offline and show the "when it sends" consequence line.
- Attempt a drag offline: it must be refused, not queued.
- A failed live write: the block returns and the ghost appears.
- A permission denial as a single-role coach.
- One empty state per app, following the grammar.

Commit one step at a time.
