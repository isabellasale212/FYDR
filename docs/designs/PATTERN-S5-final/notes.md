# PATTERN-S5 · FINAL: programme authoring, notes

Ten artboards: eight desktop, two phone, with athlete-app frames beside 4 and 7.

## What changed, and on which token

### Pattern

**A logged set keeps the prescription it was logged against.** Every screen that writes a prescription states the effective date, and every screen that changes one states what is left alone. The words are fixed: "Sessions from Sat 12 Sept" and "38 sets already logged keep the prescription they were logged against". No screen offers to apply a change to sessions already logged, and the athlete's "Prescribed 100 kg" reference line is never recomputed.
`reference line carried from ATH-ADULT-09 at --t-caption / --muted · effective date on the primary label`

**Six fields are written here; two are read from the exercise.** Order, exercise, sets, reps, load and rest render as fields; weight step and Override render as plain values. The row says which numbers this screen owns, and there is no disabled input anywhere on it. None of the six can be saved blank.
`fields --field fill + --border · read values --t-num-cell / --muted with no frame`

**A bodyweight exercise says what it logs, in words.** The Nordic curl's load cell reads "logs reps only" and its step is a dash. No empty field, no 0 kg, no weight stepper in the logger. A unilateral exercise carries "each side" beside its name rather than doubling the rep count.

**An adjustment screen has one card with controls, and it is not the club's.** The club programme is plain values closed by a read-only well naming its author; the athlete's assignment is the selected card and every field lives inside it. Rows the athlete does not override are printed from the parent in `--muted` rather than copied, so an untouched row cannot drift. The note is required, and removing the override is a tertiary beside the primary, never a destructive tone.
`club panel --surf2 well in --border · assignment --accent border + --ring-select · one override pill at --pill-accent`

**Distinct athletes is the headline of an assignment.** The emphasised card carries the count and shows its arithmetic in the schedule's words: athletes in the selected groups, plus named athletes, minus those counted twice, then the count against the squad. It names the athletes it moves off another block and the one it leaves alone. The global group filter governs the pickers, so the bar and the card agree.
`--blue-100 / --blue-200 emphasised card, one per screen · --t-num-hero count · --on-tint-meta for the arithmetic`

**The mid-block confirmation is a screen in two halves, and neither is a warning.** What changes is the emphasised card with the effective date; what does not change is a default card carrying the logged counts with their denominators. Editing a running block is ordinary work, so no warn or bad tone appears, and the screen states that a per-athlete override survives the edit, the case an author will assume wrongly. Same shape as the medic's stage advance on PATTERN-S3: a whole screen, not a modal.
`--blue-100 changes / --surf unchanged · no --pill-warn, no --pill-bad · arrows between old and new values`

**The primary carries the number or the date it commits.** "Assign to 17 athletes", "Save from Sat 12 Sept", "Save Max's adjustment". The consequence is confirmed at the point of action rather than in a dialog afterwards, and there is exactly one haloed primary per view.

**A nutrition plan is authored in rules, and the worked example is part of it.** Four tiles in g or ml per kilogram, then one sentence resolving them for a round 100 kg athlete, then the squad mean with its own n. Carbohydrate names the day type it is showing because it is the only periodised rule. The card closes with "Coach-set guidance, not a clinical prescription".

**An unset rule is a dashed frame when authored and a dash when resolved.** Fat and energy are not set on Adam's plan, so they read "not set" in a dashed frame in the authored column and a dash on every resolved surface including the athlete's own. An athlete with no weigh-in reads four dashes and a sentence saying why, and is excluded from the squad mean rather than counted low.
`1px dashed --line-dashed for an unset rule · --faint dash when resolved · denominator drops, never a zero`

**Read-only panels keep their content and name their editor.** The coach's two panels carry every value the author wrote and close with an uppercase owner line naming the person and the date. No greyed stepper, no lock glyph, no control at 45% opacity. Carried unchanged from STAFF-SS-02-05.

### Screen-specific

**Weeks run down, sessions run across, and only the logged column is live.** Each week states its own set count, so a deload week reads as fewer sets rather than missing data, and the current week takes the row wash. A week that has not happened reads "not reached", never 0 of 24.
`grid 120px + minmax(0,1fr) × 2 + 160px · --wash-accent on the current row`

**The percentage option is drawn in its unresolved state.** A load written as "70%" exists in SC-24a, and e1RM renders as a dash on the profile board, so the option exists and cannot resolve for these athletes. The third segment is rendered in `--faint` with a caption saying it would reach the logger as a dash.

**The author sees the athlete's card, labelled "Athlete app".** On the session editor it sits beside the row; on the adjust and resolve artboards beside the frame as a cropped phone. It is a render of the row, not a second design.

**An approved rehab proposal appears as an assignment, not as a decision.** One card names the proposal, who approved it and when, using PATTERN-S3's Approved pill unchanged. No action: approval is the assignment. Rehab assignments have no block end date and are excluded from the distinct-athlete count, which the card says.

**The coach's detail link is the tell, and the label is the only change.** "Edit this programme" where the role may edit, "View full detail" where it may not.

**A phone reads a session and adjusts one athlete; it never authors a block.** Each exercise is one 44px row carrying sets, reps, load, rest and step, with the override count on its own row. The adjust screen keeps the desktop's two-part shape stacked and uses the logger's steppers at 44px.

## Needs new token

Nothing. Two came close. The dashed frame for an unset plan rule wanted a new empty-state border; `--line-dashed` already does that job. The old-to-new pair on the confirmation wanted a diff treatment and instead uses two values and an arrow, because a two-value change is a sentence, not a diff.

## Open against code

1. **Is the prescription stored against the logged set, or read from the programme?** The board depends on this. "Prescribed 100 kg · +2.5" needs the prescribed weight, reps and step as at the moment of logging. If the set row holds only actuals and joins the reference live, editing a block rewrites history. If it does, that is a migration, not a design change.
2. Can a load be a percentage of a 1RM, and what does it resolve against? Confirm resolution from e1RM, whether a tested 1RM can be entered, and what the logger shows with no reference.
3. What does the exercise record hold? `weight_increment`, unit and `has_load` are named on the logger board; "10 each" implies a unilateral flag. No capture shows the library itself.
4. Does an assignment carry a start and an end date, or does the programme? Decides whether two groups can run one programme on different dates.
5. What can an override change, and is its note required server side?
6. Does editing a session write a revision, and can the previous version be read?
7. Which nutrition rules exist, and at what precision? 167 g and 387 g at 104.2 kg imply 1.60 and 3.72 g/kg and an energy rule that can be empty rather than derived.
8. Which day type does the athlete's screen use, and who sets it?
9. Is fluid a plan rule that reaches the athlete? Authored in ml/kg, absent from the profile's four resolved tiles.
10. For a coach, is Assign absent or inert? The caption says absent; the capture renders it dimmed.
11. **Who holds `PROGRAMME_EDIT`, and is the S&C among them?** SS-24 is captured as the sport scientist. If the S&C does not hold it, the frames are right and the permission is wrong.
12. Does approval create the assignment, and does a rehab block end on a date or a clearance?
13. Is there an assignment count, and how are groups and named athletes deduplicated?
