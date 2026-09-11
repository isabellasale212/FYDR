# ATH-ADULT-09-10-11 · FINAL: notes

Thirteen artboards. Two new frames: "The moment a set is logged · chip filling" and the rebuilt "Session complete · summary". Values are 48px throughout, including "102.5 kg" at 375×667.

## ATH-ADULT-09-10-11 · FINAL: the athlete gym logger pattern

## The rules

### Pattern

**The two numbers are the screen, at 48px.** Weight and reps in tabular figures, centred between their steppers, nothing competing. The unit rides alongside at `--t-num-row` in `--muted` rather than inside the big figure, which is what makes a four-digit value fit: "102.5 kg" measures 163px against the 187px the card leaves between two 52px steppers at 375, so it holds at 667 as well as 812.
`values --font-num / --t-num-hero at the proposed 48px / --w-num-strong / tabular-nums / -0.025em · unit --t-num-row / --w-semi / --muted`

**Logging a set is one fill and one tap of haptic.** On log, the current chip fills with the accent from the left and the tick lands, over `--dur-move`. The phone gives one light impact at the same moment: the feedback that reaches an athlete who is not looking at the screen. Nothing else animates: no count roll, no card transition, no row entrance. Under `prefers-reduced-motion` the fill is instant and the haptic stays, because it is not motion.
`chip fill --pill-accent → --accent over --dur-move 300ms on --ease-ring · light impact, once, on write to the local queue`

**Structure comes from spacing, not from borders.** White surfaces on the tinted page with no outline. Only two hairlines survive, on the pinned header and footer, where one surface really does scroll under another. Rows sit 2px apart rather than boxed.

**One accent, and no second hue.** Logged sets `--accent`, current set `--pill-accent` with the selection ring, completed exercise keeps the 3px accent bar, shortfall is a dashed neutral outline. Amber and teal are gone from the logger. The one exception is the destructive action in the finish-early dialog.

**One tap logs the prescribed set, and the tap says what it will write.** "Log set 2 · 100 kg × 8", `--hit-lg`, the only primary on the screen.

**The header states position and never scrolls away.** Programme eyebrow, session name, set position, running count, all above the fold at 812 and 667. What is next is always stated, never behind a disclosure.

**Adjusting is steppers, never a keypad.** Two `--hit-md` squares flanking the value, no border, no input field. The prescribed value stays underneath as reference.

**Going off the prescription is information, not an error.** "Prescribed 100 kg · +2.5" in `--muted` with the difference in bold. No warn colour, no error treatment.

**Set chips are the state display and the correction target.** 48px; logged accent + ✓, current accent tint with the ring, not-yet-reached `--faint` on `--surf2`. No disabled control anywhere.

**An absent value reads "Not logged".** Never a dash, never a zero, with the denominator beside it.

**Offline reads exactly as it does on the entry forms.** Same Banner, same sentence, and the count carries its denominator: "6 of 12 sets · 2 waiting to send".

**Nothing says the athlete cannot change it.** No irreversibility line, no recourse link.

### Screen-specific

**Rest is reference text, and nothing else.** "Set 2 of 3 · Rest 90s" in `--muted`, same size and weight as the position it follows. No timer, no countdown, no clock glyph, no ring, no accent. None of those are things the athlete acts on.

**Session complete is the one screen allowed to be pleased.** Total volume and sets done at the same 48px as the logging values, total volume first because it is the number that grows over a block, each with its derivation underneath ("Weight × reps across 12 sets"). Personal bests follow in the accent with what they beat and when ("Best before today 100 kg × 8 · 21 Aug"), so the claim is checkable rather than a compliment. No gradient, glass, confetti, new colour or praise copy.

**Finishing early is not shaped like logging a set.** Dashed outline on no fill, `--muted`, 44px, in the header.

**Finishing early confirms, with the consequence stated.** What is saved, that unlogged sets are not zero, where the session goes, that corrections stay open. Keep logging is primary.

**The early summary cannot be mistaken for a complete one.** Different title, a dashed neutral bar on the head, short counts, rows reading "Not logged", and no totals block at all, which only the complete screen gets.

**Correction is reached from the chip, and the panel says only what is true.** §0v resolved by surfacing: corrected chip keeps its ring, the row shows the superseded value, the strip reads "Set 1 corrected · was 100 kg × 8".

**Correcting suspends the footer action.** Save correction / Cancel replace the logging action.

## Approved new tokens

**`--t-num-hero` moves from 34px to 48px.** A value change on the existing token, not a second one. 34px was sized for a dial centre read at a desk; this is the only screen where a numeral is the primary content. The two other uses should be checked at the new value; units are set separately at `--t-num-row`, so nothing that pairs a number with a unit grows by 14px. This board sets `--t-num-hero: 48px` on its root and every value reads `var(--t-num-hero)`, so the frames exercise the proposed value rather than a literal.

**`--hit-lg` 56px and `--hit-md` 52px.** The logging action and dialog actions; the stepper square. The 44px floor is unchanged; the 48px set chip stays literal.

## Code dependencies

**Queued sets must send as soon as signal returns, not only on a visit to Today.** Flush on the `online` event and on the gym screen, without navigation. Until then the pattern displays a count it cannot honour. §0u.

**Stepper increments come from the exercise record.** 2.5 kg squat and 1.25 kg bench are both on the board; dumbbells step 2 kg; a bodyweight exercise logs reps only.

**Keep the screen awake while a session is in progress.** Wake Lock on open, released on finish or exit, re-acquired on `visibilitychange`.

**Nothing else is new.** The set-logged fill runs on the existing `--dur-move` and `--ease-ring`.

## Revision log

Edited ATH-ADULT-09-10-11 Gym logger pattern.dc.html. Found issues, fixed:

- Intro now says thirteen.
- The ATH-ADULT-11 blurb says 48px chip.
- Every value span reads `var(--t-num-hero)`, with the board root setting it to the proposed 48px, so the frames exercise the token, and the approved-token card says so.

Two lines amended (already applied above):

- The two numbers are the screen, at 48px: tokens line now reads `--font-num / --t-num-hero at the proposed 48px / --w-num-strong / tabular-nums / -0.025em`.
- `--t-num-hero` moves from 34px to 48px: adds that this board sets `--t-num-hero: 48px` on its root and every value reads `var(--t-num-hero)`.
