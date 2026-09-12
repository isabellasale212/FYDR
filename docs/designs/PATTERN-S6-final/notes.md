# PATTERN-S6 · FINAL: system states, notes

Twelve artboards: seven athlete phone (375×812), four staff desktop (1440×900), one staff phone (375×812). Board instant Thursday 10 September 2026, 12:04.

## What changed, and on which token

### Pattern

**One waiting count, on Today, in the status region the code already has.** The existing `role="status"` line from OutboxFlusher stays and keeps its sentence: "3 entries are saved on this phone and will send when you have signal." Added under it is "See what is waiting", the only route to the queue screen. With nothing waiting, the count and the route are both absent: the screen does not offer an empty list.
`--pill-good` fill with `--on-good` ink · `--t-body-sm` at `--w-bold` · route line `--t-body-xs` in `--accent` · 44px minimum row

**The queue names each item, what is in it, and when it was saved.** Oldest first. Each row is what the athlete did, its own denominator ("six answers of six", "2 sets of 12 logged"), and the local time it was saved. The header carries the count and its unit split, "4 entries · 5 writes", because a gym entry can hold several sets. No progress bars, no spinners, no per-item retry: the send is not the athlete's job.
`--surf` card, `--shadow`, rows on 1px `--border` · values `--font-num` tabular-nums

**Discard exists only for a genuine conflict, and only inside the notice.** Copy carried verbatim from code: "One saved entry could not be sent: you already have your check-in for the week of Mon 24 Aug from another tab or device, and that one is what is showing." "Discard this one" is a ghost control inside the notice and nowhere else. Nothing else in the queue can be edited or deleted, because the athlete has no second answer to prefer.
`role="alert"` on `--pill-bad` with `--on-bad` ink · ghost in `--accent` at 44px

**Success changes the count, in place, and then goes.** The waiting line becomes "3 entries sent at 12:04. Nothing is waiting." in the same region, as a `--surf` card rather than a tone: information, not a state. Announced once, not a toast, not dismissible, absent on the next load. Where a screen already shows the result, the screen is the success and nothing else appears.

**The success rule, written out.** A toast never. The screen changing is the default: a list gains a row, a footer pill changes word, a count drops. A line in the status region only when the change happened while the user was not looking at the thing that changed, which is the reconnect case. Nothing at all when they pressed the button and the screen already answered.

**A session that expires mid-form keeps the answers and says why.** "You have been signed out, so that did not send. Your six answers are still here." The primary becomes "Sign in and send". The footer states the hold: "Your answers stay on this phone while you sign in."
`role="alert"` `--pill-bad` / `--on-bad` · primary `--accent` with `--ring-action` · the 56px footer button from ATH-ADULT-03

**Coming back is a confirmation, not a fresh form.** Same sheet, same scroll position, every answer set, with the accent status line: "Signed in as Conor. Your six answers are as you left them, nothing was retyped." Footer returns to "Submit entry". No re-entry, no summary screen.

**Staff writes queue too, and say who cannot see them yet.** The same held-on-this-device promise as the athlete app, with the difference stated rather than hidden: "Saved on this phone · sends when you have signal. Nobody else can see this until you have signal." A staff write normally reaches 30 phones as it is made, so the athlete-facing consequence is what is withheld, and the copy names that. The banner also gives the time the read data was last current.
`--pill-good` / `--on-good` for a held write on both surfaces · `--pill-warn` / `--on-warn` reserved for capability genuinely lost

**Time-critical writes sort first and say what they will change.** The staff queue is not chronological. Availability and injury go to the top with a "When it sends" line naming the consequence in people: "he comes off Saturday's selection list, the squad count reads 29 of 30 available, and medical staff are notified." A new session names its athletes and its RPE task. Everything else follows in the order it was made.
`--border-accent-w` 3px on `--accent` · consequence line `--t-body-xs` in `--muted`

**A drag on the grid stays disabled offline, and says why.** A typed change can be held; a drag cannot, because it saves the moment it is dropped and the block has already moved on screen. "+ Session" and "+ Fixture" stay live and queue; Week templates is disabled because it reads the server; the grid footer replaces the drag hint with "read-only while offline · a block cannot be moved".

**A failed live write undoes itself and says where.** The block returns to the time the athletes still have, keeps its accent bar, and the attempted position stays as a dashed ghost reading "Did not save" until the staff member acts. The notice names both times and the count affected. Try again is the one control.
Card on 1px `--bad` with `--shadow`, ink in `--text` and `--muted`, never `--bad` as text

**Permission denied says what is true without saying what exists.** "This is not available to you. It may not exist, or your role may not include it. Nothing more can be said about it here." Then two things that help without leaking: who they are signed in as and what their role covers, and a reference code to quote to an admin. One primary, back to the dashboard.
`--surf` card on `--border`, no tone fill · `--font-mono` only for the reference

**One empty-state grammar: what, why, what would fill it, one action.** In order: what is empty with its denominator and window, why, what would fill it, and where the data actually is. The action changes the window or the filter. Never a zero, never an illustration.
Emphasised card `--blue-100` / `--blue-200` / `--on-tint-*`, one per screen

**"Not in this period" is never written as "never".** If data exists outside the window, the empty state names the most recent one and its date, and the action widens the window. Only when nothing exists on record does the copy say so, and then it says the record is not broken: "Nothing is missing."

**Every state change is announced once.** One aria-live region per surface, not one per banner: a single `role="status"` region under the page title and a single `role="alert"` region above the form. Announcements are written on transition only, keyed by state, so a re-render of the same state announces nothing. Counts are announced with their denominator.

**Reduced motion is already the default here.** Nothing in these states animates: no spinner, no shimmer, no slide-in banner, no tick. A state change is a repaint.

### Screen-specific

**Missing values stay words on every state here.** "Not submitted", "Not rated", "Did not save", "all sent". No zero, no dash standing in for a count that could read as a score. A count that exists carries its denominator.

**Raising a flag offline is allowed, and the primary stays live.** Raise a flag holds the flag on the phone and sends it first. The footer states the consequence and its limit together: "When it sends: Nash, Elliot reads Unavailable, he comes off Saturday's selection list, and medical staff are notified. Until then only you can see it." Nothing is disabled, because nothing is lost.

## Needs new token

Three candidates, none added:

- **An offline tone that is not warn.** The lost-capability banner borrows `--warn`, which the system also uses for "above normal" magnitude, so it reads as a problem rather than a condition. Candidate `--pill-offline` / `--on-offline`.
- **A dashed ghost for a write that did not land.** The failed slot uses `--line-dashed`, the same value as the add-session ghost. One means "not yet", one means "did not". Candidate `--line-dashed-failed`.
- **A queue row does not exist in the kit.** Built here from a `--surf` card with 1px `--border` dividers. If the queue ships it is one component with three slots (what, its denominator, the time it was saved) plus an optional consequence line for the staff variant. Candidate `components/patterns/QueueRow`.

## Open against code

1. **Retry timing and limits are not designed.** Silent retry is right, but nothing states how often, with what backoff, or what happens after many failures. The queue screen deliberately has no Send now. Needed: the schedule, whether an item is ever abandoned, and what the user is told if it is.
2. **Queue size and age limits.** No cap, no expiry, and nothing on an athlete offline for a week whose check-in window has closed. Decides whether the queue needs a "too late to send" state.
3. **Gym duplicates are still dequeued silently (§0aa).** The gym branch assumes every duplicate is a replay and skips the targeted lookup that wellness, RPE and nutrition get, so a genuine two-answers conflict on a set never surfaces.
4. **Session length, and whether sign-in returns to the form.** Nothing read in code preserves a part-filled form across re-authentication. Frames 5 and 6 describe what the pattern requires.
5. **Is a queued availability change re-checked before it lands?** A change written at 11:59 and sent at 13:20 may land on a row somebody else has since edited.
6. **What happens if medical has changed the same availability in the meantime?** A coach's held "Unavailable" meeting a medic's later "Available, restricted" is a clinical decision. Whether the medic's value wins, or the coach is shown both, is not designed here.
7. What is a staff queue visible as to other staff?
8. What does a failed live write do to other people looking at the same week?
9. Permission-denied reference codes assume a denial is logged and an admin can look it up.
10. The announcement region is not verified in code.
11. Reconnect detection: what counts as back online decides whether "3 entries sent at 12:04" can appear twice or appear late.
