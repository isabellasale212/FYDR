# Pattern S3: build injuries and availability

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"PATTERN-S3 · FINAL"** in `docs/designs/pattern-s3-final/`, with `notes.md` and the board PNGs beside it. It supersedes every other injury or availability design, and it covers both apps.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Fix first: a live privacy defect

The coach's allocation screen (COACH-28) currently renders body site, protocol and stage to a coach: "Head · Return to play protocol, stage 3 of 6". The coach must see the status word, the restriction line and the expected return, and nothing else. Find every place a coach-visible string is assembled (allocation screen, coach injuries report, squad list, dashboard) and remove site, protocol and stage. Report where they were.

## Step 1. Report before building

Answer each from the code, with single-role users. Wait for my reply before Step 2.

1. **Availability history:** does the availability row keep an author, a timestamp and the previous value, or does a change overwrite it? If it overwrites, propose the smallest append-only change that preserves history.
2. **Athlete read flag:** is there anything recording that an athlete has seen their current status? If not, propose adding one on the availability row.
3. **Injury programme proposals:** what states exist, and is there a return reason? `INJURY_PROGRAMME_PROPOSER` is on the S&C. Does approval also assign the programme?
4. **Availability reasons:** list the enum. Can a coach create a row? Is "Available" selectable as an absence outcome? Is the restriction on non-injury reasons enforced at the database?
5. **Protocol stages:** is a stage a named list with criteria, or a bare counter?
6. **Site visibility:** is site stored per injury with a side? Can visibility be a club setting for the coach role, defaulting to off?
7. **Expected return and days lost:** stored or derived?
8. **Availability history visibility:** which roles could read it under RLS?
9. **Injury form:** where does it live, and can it be reached from a profile with the athlete pre-filled?

## Step 2. Staff build

- **Injury form (desktop):** two columns split by permission. Left, what a coach reads: athlete, date, site, availability, restrictions, expected return. Right, medical staff and the athlete only: diagnosis, mechanism, protocol, stage. Save works with the right column empty, and the well says what that means.
- **Injury form (phone, pitch-side):** four fields at 44px, three full-width status buttons, and a save button that says what saving does.
- **The restriction field** carries the hint "Coach visible. Describe the restriction, not the injury. Do not name a diagnosis or a protocol." The same hint sits on the medic's return-to-S&C reason field.
- **Stage ladder:** numbered stages with Done, Now, Next, Later, Cleared. No invented stage names. The next stage says its criteria live in the club's protocol.
- **Advance a stage:** advances one stage only, requires a rewritten restriction line and a confirmation that criteria were reviewed. Setting any other stage happens on the record and requires a reason. Only the medic can advance.
- **Confirmation before the change lands:** list the athlete, the named coach and everyone else, with what each will read.
- **Non-injury absence (coach):** the four availability words, a reason from the enum, no site, no stage, no clinical record and no medical notification. "Available" is not an absence outcome.
- **Proposals:** Proposed, Approved, Returned, one row shape, visible to both the S&C and the medic. Returning requires a reason, shown in full.
- **Availability history:** append-only, one row per change, with the restriction line as it read at the time, what changed, and who did it. No tone on the status column. A correction adds a row.

## Step 3. Athlete build

- **Today:** when the athlete's status changes, show an emphasised card above To do, with the status word, who set it, when, and one action. No timer. It stays on every visit until they open the status screen once.
- **Status screen:** three cards in order. Can I train today. What can I do and not do. When am I back. Answers as sentences, not pills. Restrictions as one row each. Rehab stages where they exist. Medical detail lower, labelled for them and their medical team.
- **Empty and cleared states:** "Not known yet" where the medic has set nothing, and the cleared state after an injury.

## Everywhere

- The coach never sees site, protocol or stage.
- Missing values are words, never zeros.
- Every tap target at least 44px on a phone.
- No new tokens.

## Verify

- Screenshots of every board frame, desktop and phone.
- Signed in as a single-role coach: show that site, protocol and stage appear nowhere, including the allocation screen, the report and the squad list.
- A database-level check that a coach cannot read the clinical record or the site field.
- An athlete marked unavailable: show the card on Today, then show it gone after the status screen is opened once.
- An availability history with at least three changes by two different people.

Commit one step at a time.
