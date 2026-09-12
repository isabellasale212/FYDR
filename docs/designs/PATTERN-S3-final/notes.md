# PATTERN-S3 · FINAL: injuries and availability, notes

Spans both apps: medic, S&C, coach and athlete.

## What changed, and on which token

### Pattern

**The athlete is told once, and the telling waits.** A status change writes an emphasised card at the top of Today, above To do, carrying the status word, who set it, when, and one action. It is not a toast and has no timer: it renders on every Today until the status screen has been opened once. Only opening it clears it. After that, Today is the approved ATH-ADULT-02 screen with no residue.
`--blue-100 fill --blue-200 border · --on-tint-value / --on-tint-label / --on-tint-meta · one emphasised card per screen, so the availability card keeps its tone family`

**The status screen answers three questions, in order.** Can I train today, what can I do and not do, when am I back. One card each, in that order, on every status frame including the empty one. The answer is a sentence in the display size, not a pill: "Yes, with changes", "No, not today", "Yes. Everything is on." The pill stays in the header where the rest of the product puts it.
`--t-subhead / --w-black / -0.02em on the answer · --t-eyebrow question label · tone card --pill-warn / --warn / --on-warn and family`

**A restriction line renders as a list on the athlete's screen.** The same middot-joined string the coach reads ("No contact · No collision drills") splits into one row per restriction for the athlete, because they are acting on it rather than scanning it. The string is unchanged in the data and unchanged everywhere staff read it.
`rows at --t-body-sm / --w-bold, 1px --hair between`

**Stages are numbered. Criteria belong to the club's protocol.** The ladder renders stage numbers with a state word: Done, Now, Next, Later, Cleared. The current stage carries what is recorded against it. The next stage carries one sentence saying the criteria are in the club's protocol, not in Fydr. No stage is named on any frame, because no capture names one.
`now --pill-warn + --warn border + --on-warn · next --blue-50 + --blue-200 · later --surf + --hair · numerals --font-num tabular-nums in --r-round`

**Advancing moves one stage, and skipping costs more.** The advance screen advances to the next stage only, and asks for a rewritten restriction line and a confirmation that the protocol criteria were reviewed. Setting any other stage happens on the record and requires a reason. The short path and the correct path are the same path.
`primary --accent + --ring-action, exactly one per view · required confirm as a pressed segmented control at 40px`

**The confirmation states who sees what, by name.** Before the change lands, the screen lists the athlete, the named coach and everyone else, with what each will read. The permission rule is made visible at the moment it is exercised, rather than stated once in settings.

**An absence shares the words and none of the shape.** Illness, personal, academic, representative, other. Same four availability words, same tones, same squad-list column, and no site, no diagnosis, no stage, no injury board row, no medical notification. A well names each of those absences rather than leaving it to be inferred. Available is not offered as a status on the absence form.
`--surf2 well in --border with --muted text · pills reuse --pill-bad / --pill-warn`

**A proposal has three states and one row shape.** Proposed, Approved, Returned: the same row, three tones, in a list both the S&C and the medic can see without email. A returned proposal carries the medic's reason in full, because the reason is the instruction for the next version. Returning without one is not possible.
`Proposed --pill-warn · Approved --pill-good · Returned --pill-bad · returned reason on a --pill-bad card with --on-bad text`

**The coach-visible hint travels with the boundary, not the role.** The medic's restriction field carries "Coach visible. Describe the restriction, not the injury. Do not name a diagnosis or a protocol." The same sentence sits on the medic's return-to-S&C reason field. Any free-text field that leaves the clinical circle carries it.
`--t-caption in --muted directly under the --field`

**Every history row is a fact, and no row is a colour.** Availability history is one row per change: timestamp, status word, the restriction line as it read then, what changed, and the person with their role. Rows are never edited or removed; a correction adds a row. The status column carries no tone, because tinting seven rows would say the oldest matters least.
`table at --t-body-xs, --font-num tabular-nums on every column but the first · 1px --hair between rows · no --wash-*`

**Body site is not coach-visible.** A coach reads the status word, the restriction line and the expected return, and nothing else. Site and side ("Head", "Calf · Right") stay with medical staff, the sport scientist and the athlete, because a body area plus a restriction is a diagnosis in two pieces. The captures render site to the coach; this board does not, and the difference is a club setting defaulting to off.
`the coach's injury and allocation rows drop the site segment; the middot run starts at the restriction`

**Missing values stay words on every new screen.** "Not known" for an expected return the medic has not set, "Not recorded" for one nobody has, "Not known yet" on the athlete's screen, a dash in `--faint` in a table cell. No zeros, no blanks, and "This is not the same as being cleared" carried word for word from the approved board.

### Screen-specific

**The injury form is split by permission, not by importance.** Left column: athlete, date, site, availability, restrictions, expected return. Right column: diagnosis, mechanism, protocol, stage, for medical staff and the athlete only. Save works with the right column empty, and the well says what happens if you leave it that way.
`two-column grid at minmax(0, 1fr) each · --field fill · 40px primary`

**The pitch-side form is four fields at 44px.** Athlete, site, availability, restrictions: the four that change what anyone else sees. The availability control is a full-width row of three 44px buttons. The save button says what saving does rather than saying Save.
`--touch-min on every control · 48px primary · --gap-chip between the three status buttons`

**Approve is one press; return is a secondary under a required field.** The medic's review screen has one primary. Return sits beneath the reason field as a secondary, so the shape of the screen says which decision is routine without disabling the other.

**The academy slot is a place, not a policy.** A line on the injury form and on the athlete's status screen reads "If the club sets different return rules for academy athletes, they appear here. None are recorded." It makes no claim about age and states no rule.

## Needs new token

Nothing. No new colour, radius, spacing step, type size, shadow or duration. The stage ladder is the three card treatments already documented. The proposal states are the three existing pill families. The one-time card is the emphasised card, used once per screen. The history table is the existing table shell.

## Open against code

1. Do stage names and criteria exist in the data? The only stage data in any capture is "stage 3 of 6". Whether the protocol is a named list with criteria or a bare counter decides whether the ladder can carry names and whether the advance screen can show a checklist. The board assumes a bare counter.
2. **Does the availability row hold an author, a timestamp and a previous value?** The whole history screen depends on it. If a change overwrites the row, the table cannot be built and a disputed injury cannot be evidenced. The single largest assumption on the board.
3. What states does an injury programme proposal actually have? Only `INJURY_PROGRAMME_PROPOSER` on the S&C is established. Proposed, Approved and Returned are designed here.
4. Does approval assign the programme, or is assigning separate? The frame treats Approve as approve-and-assign.
5. Can a coach create an availability row at all, and with which reasons? Confirm the enum, and that Available is not a selectable outcome.
6. **Is there any notification mechanism for the athlete?** The one-time card needs a per-athlete read flag against the availability row. If none exists it has to be added: the gap is a data change, not only a screen.
7. **Does the coach genuinely see the protocol stage today?** COACH-28's allocation screen renders "Head · Return to play protocol, stage 3 of 6 · No contact +1 · back Sat 12 Sept" to a coach. Either the seed string is wrong or the rule is not enforced there.
8. Is there a club setting for "site visible to coach", and is it off? The board withholds site and side from the coach everywhere. The captures do the opposite. Confirm the default and the field name.
9. Is there a club policy setting for academy or under-18 return rules? The board reserves a slot and states that nothing is recorded.
10. Where does the injury form live, and can it be reached from an athlete profile with the athlete pre-filled?
11. Are expected return and days lost stored, or derived? The board treats expected back as stored and days lost as derived.
12. Which roles can see the availability history, and is the restriction column redacted for anyone?
