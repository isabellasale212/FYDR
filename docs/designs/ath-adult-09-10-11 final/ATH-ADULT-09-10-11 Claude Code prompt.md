# ATH-ADULT-09, 10, 11: build the athlete gym logger

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"ATH-ADULT-09-10-11 · FINAL"** (13 artboards) in `docs/designs/ath-adult-09-10-11-final/`, with `notes.md` beside it. It supersedes every other design for these flows.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Prerequisites

- The new design system and kit components are in code.
- The ATH-ADULT-03 entry-form pattern is built (the offline Banner and footer come from it).

If either is missing, stop and tell me.

## Step 1. Report before building

Answer each one from the code. Wait for my reply before Step 2.

1. **`--t-num-hero`:** list every current use. Show each at 48px instead of 34px. If any breaks, tell me. Don't change the token globally until I confirm.
2. **Prescription data:** where do the prescribed sets, weight and reps come from? Does each exercise record hold a weight step (2.5 kg, 1.25 kg, 2 kg) and whether it has a weight at all (bodyweight exercises log reps only)? If not, what's missing?
3. **Offline queue:** confirm queued sets currently only send on a visit to Today. What's needed to send them on the `online` event and from the gym screen, without navigation?
4. **Correcting a set (flow 11):** what are the rules in the code? Any limit on how many times, or how long after? Is the original kept?
5. **Personal bests:** is there a query that can say "best before today" per exercise, with the date? If not, how would you compute it?
6. **Wake Lock:** confirm support in iPhone Safari and Android Chrome. What happens where it isn't supported?
7. **Haptics:** confirm whether any haptic is possible in iPhone Safari. I expect not. On iPhone the chip fill must carry the feedback alone.

## Step 2. Build the logger (flow 09)

- **The two numbers are the screen.** Weight and reps at `--t-num-hero` (48px), tabular figures, centred between the steppers. Unit beside the number at `--t-num-row` in `--muted`. "102.5 kg" must fit at 375×667.
- **One tap logs the prescribed set.** Full-width button at `--hit-lg` (56px), labelled with what it writes: "Log set 2 · 100 kg × 8". The only primary on screen.
- **Steppers, never a keypad.** Two `--hit-md` (52px) squares per value. Increment comes from the exercise record. Bodyweight exercises show reps only.
- **Deviation is neutral.** After adjusting, show "Prescribed 100 kg · **+2.5**" in `--muted`, difference in bold. Use a real minus sign, not a hyphen. No warn colour.
- **Header never scrolls away.** Programme, session name, "Set 2 of 3 · Rest 90s", running count. Above the fold at 812 and 667. What's next is always visible.
- **Rest is plain text.** No timer, countdown, clock icon, ring or accent.
- **Set chips (48px):** logged = accent with tick, current = accent tint with ring, not reached = `--faint` on `--surf2`. No disabled controls.
- **Logged moment:** the chip fills from the left and the tick lands over `--dur-move` on `--ease-ring`. Light haptic where supported. Nothing else animates. Reduced motion: instant fill.
- **No borders for structure.** White surfaces on the tinted page. Hairlines only on the pinned header and footer. One accent colour only.
- **Offline:** same Banner and sentence as the entry forms. Count shows its total: "6 of 12 sets · 2 waiting to send". Queued sets send as soon as signal returns.
- **Footer note:** "Sets save as you log them." No "can't change" line.
- **Wake Lock:** take it when the session opens. Release on finish or exit. Re-acquire on `visibilitychange`.

## Step 3. Finish early (flow 10)

- "Finish early" sits in the header: dashed outline, no fill, `--muted`, 44px. Never in the footer, never accent.
- Confirmation states what's saved, that unlogged sets are not zero, where the session goes, and that corrections stay open. "Keep logging" is primary. "Finish early" is the destructive secondary and shows the count ("4 sets short").
- The early summary must not look complete: different title, dashed neutral bar, short counts, rows reading "Not logged", and no totals block.

## Step 4. Session complete

- The one celebratory screen. Total volume first, then sets done, both at `--t-num-hero`, each with its derivation underneath ("Weight × reps across 12 sets").
- Personal bests in the accent, with what they beat and when: "Best before today 100 kg × 8 · 21 Aug".
- No gradient, glass, confetti, new colour or praise copy.

## Step 5. Correcting a set (flow 11)

- Reached by tapping a logged set chip.
- While the correction panel is open, "Save correction" and "Cancel" replace the logging button, so a set can't be logged by accident.
- After saving: the chip keeps its ring, the summary row shows the old value, and the strip reads "Set 1 corrected · was 100 kg × 8".
- Follow the correction rules you reported in Step 1.

## New tokens

- `--hit-lg: 56px` (logging action, dialog actions)
- `--hit-md: 52px` (stepper squares)
- `--t-num-hero: 48px` (was 34px), only after I confirm Step 1 point 1

Add them to the design system doc in the same commit.

## Everywhere

- Missing values read "Not logged". Never a dash, never a zero.
- Every tap target at least 44px.

## Verify

- Screenshots of all 13 board frames on the real build, at 375×812 and 375×667.
- "102.5 kg" at 375×667.
- Offline: log two sets with the network off, turn it back on without leaving the screen, and show the count clearing.
- The phone stays awake through a 2-minute rest.
- A bodyweight exercise (reps only) and a 1.25 kg step exercise.
- Test on a real iPhone and an Android phone.

Commit one step at a time.
