# Pattern S5: build programme authoring (gym and nutrition)

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"PATTERN-S5 · FINAL"** (10 artboards) in `docs/designs/pattern-s5-final/`, with `notes.md` and the board PNGs beside it. It supersedes every other programme or nutrition plan design.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Prerequisites

- The athlete gym logger (ATH-ADULT-09-10-11) is built or in build. This pattern produces what it consumes.

## Step 1. Report before building. This one may be a migration.

Answer each from the code. Wait for my reply before Step 2.

1. **The big one: is the prescription stored on the logged set, or joined live from the programme?** The logger shows "Prescribed 100 kg · +2.5" beside what the athlete lifted. If the set row holds only actuals, editing a block rewrites history, and every past week's adherence becomes wrong. If that is the case, propose the migration: store prescribed weight, reps and step on the set row at the moment of logging.
2. **The exercise record:** which fields exist? `weight_increment`, unit, `has_load`, and anything marking a unilateral exercise ("10 each side").
3. **Load as a percentage:** can a load be a percentage of a one-rep max? What does it resolve against, can a tested 1RM be entered, and what does the logger show when there is no reference?
4. **Assignment:** does the assignment or the programme carry the start and end dates? Is there an assignment record at all, and how are groups plus named athletes deduplicated?
5. **Overrides:** what can a per-athlete override change, and is its note required at the database?
6. **Revisions:** does editing a programme session write a revision, and can a previous version be read?
7. **Nutrition rules:** which rules exist and at what precision? Is energy a stored rule that can be empty, or derived? Does fluid reach the athlete?
8. **Day type:** which day type does the athlete's nutrition screen use, and who sets it?
9. **Permissions:** who holds `PROGRAMME_EDIT`? Is the S&C among them? For a coach, is Assign absent or inert?
10. **Rehab:** does approving an S&C proposal create the assignment? Does a rehab block end on a date or on clearance?

## Step 2. Gym programme

- **Block overview:** weeks down, sessions across. Each week states its own set count. The current week takes the row wash. A week not yet reached reads "not reached", never 0 of 24.
- **Session editor:** six editable fields per exercise row (order, exercise, sets, reps, load, rest), with weight step and override shown as read values. None of the six can be saved blank. No disabled inputs.
- **Bodyweight exercises** read "logs reps only" with a dash for the step. Unilateral exercises carry "each side" rather than doubled reps.
- **Every write shows the athlete's card**, labelled "Athlete app", rendered from the row itself.
- **Mid-block edits are allowed.** The confirmation is a screen in two halves: what changes, with its effective date, and what does not, with the logged counts. No warn or bad tones. It states that per-athlete overrides survive the edit.
- **Sets already logged keep the prescription they were logged against.** Never offer to apply a change retrospectively.

## Step 3. Assignment and adjustment

- **Assignment** shows distinct athletes as the headline, with the arithmetic in the schedule's words, athletes moved off another block named, and the squad denominator.
- **Adjust for this athlete:** one card carries the controls, and it is the athlete's assignment, never the club programme. Unoverridden rows are printed from the parent, not copied. The note is required. Removing an override is a tertiary action with no destructive tone.
- **An approved rehab proposal appears as an assignment**, with PATTERN-S3's Approved pill, no action, no block end date, excluded from the distinct count and saying so.

## Step 4. Nutrition plan

- Authored as rules per kilogram, with a worked example at 100 kg and the squad mean with its n.
- Resolved against the athlete's latest weigh-in. No weigh-in means dashes and a sentence saying why, and exclusion from the squad mean.
- Unset rules are a dashed frame when authored and a dash when resolved. Never zeros.
- The card closes with "Coach-set guidance, not a clinical prescription".

## Step 5. Read-only

- The coach's panels keep every value and close with an owner line naming the person and the date. No disabled controls, no lock glyphs. The link reads "Edit this programme" or "View full detail" by permission.

## Verify

- Screenshots of all 10 frames on the real build.
- Edit a block mid-week, then show a previously logged set still displaying its original prescription in the athlete's logger.
- A bodyweight exercise in the logger: reps only, no weight stepper.
- An exercise with a 1.25 kg step reaching the logger correctly.
- An assignment where an athlete is in two selected groups: the count must not double.
- A nutrition plan resolved for an athlete with no weigh-in.
- The coach's read-only view of both.

Commit one step at a time.
