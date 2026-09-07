Read the athlete app code against its specification and report differences. Change nothing.

Scope: `src/app/(athlete)/`, the athlete half of `src/components/`, and every
athlete-facing query in `src/lib/queries/`.

Check, in this order, because the first two are the ones that hurt people:

1. **Visibility.** For each thing an athlete can read about themselves or a
   teammate, does the code agree with `docs/athlete/visibility.md`? Pay particular
   attention to `injury_clinical_athlete_view`: an athlete sees their own
   diagnosis and not the physio's private notes, and that line must not move by
   accident.
2. **Under 18.** Leaderboards are opt in for minors, enforced in the board query.
   Three notifications are forced off for minors. `athlete_is_minor()` fails safe
   when there is no date of birth. Confirm all three still hold.
3. **Metric parity.** For every metric marked `Surfaces: both` in `docs/metrics.md`,
   confirm the athlete surface and the staff surface read the same definition,
   window, rounding and label. Report any difference as a parity break, not as a
   note.
4. **Wording.** The five wellness scales, the RPE question and the weekly
   nutrition question. Any change to the words changes what the data means, so a
   difference from the screen specification is a finding even if the code is
   "better".
5. **Screen by screen.** For each file in `docs/athlete/screens/`, confirm the
   controls, states and inputs still match.

Report as a list of differences, each naming the file and line and the spec file
it contradicts. **Say which side you think is wrong, and why, but do not change
either.** Where something cannot be traced, write UNVERIFIED and say where you
looked.
