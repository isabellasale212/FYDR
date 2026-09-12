# STAFF-SS-02, SS-05: build the squad list and athlete profile

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"STAFF-SS-02-05 · FINAL"** (12 artboards) in `docs/designs/staff-ss-02-05-final/`, with `notes.md` beside it. It supersedes every other squad or profile design.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Prerequisites

- The design system and kit components are in code.
- STAFF-SS-01 is built: this board uses its phone shell and bottom bar.

## Step 1. Report before building

Answer each from the code, against the real permission model (not a seed user holding every role). Wait for my reply before Step 2.

1. **Per role, list every panel the profile renders and every write action allowed**, for sport scientist, coach, medic, S&C and nutritionist. Test with a user holding exactly one role.
2. **Body mass:** is it visible to the coach today? Can visibility be a club setting? Recommend the smallest change that hides it from the coach by default.
3. **Availability:** can a coach set it? Is a coach limited to non-injury reasons? Is that enforced at the database?
4. **Clinical record:** which fields exist and what are they called? Is access restricted by RLS, not only in the UI?
5. **Flags:** which roles can acknowledge or add a note?
6. **Subject access request panel:** who can see it?
7. **The ACWR and wellness-rating card** renders on the profile but isn't in the inventoried ten panels. What is it, and does it stay?
8. **Period control:** is it per user or per role? What is the default?
9. **"Log injury"** on the sport scientist's profile: what does it open, and what may that role write?

## Step 2. Squad list (SS-02)

- Desktop: the five current columns, both row washes, group chips and count line.
- Phone: 60px rows, the athlete name as the link, availability pill right, restriction line on the row.
- "Not recorded" replaces "Not set" everywhere, with a neutral pill.
- Restriction text never names a protocol or a diagnosis.

## Step 3. Athlete profile (SS-05)

- **Status header** on every role's profile: name, position, group, availability status, restrictions, bio figures, development plan. Same words and tones as the dashboard. Coach sees five bio figures, without body mass.
- **Panel order follows the role**, from one panel library. Panels a role can't see are absent: no heading, placeholder, lock or count.
- **Read-only panels** keep their content and end with an owner line: "Read-only · set by medical staff · Ruth Callaghan · Fri 11 Sept". Never use 45% opacity or disabled controls.
- **The coach's injury card stops after expected return.**
- **The medic's coach-visible note field** carries the hint: "Coach visible. Describe the restriction, not the injury. Do not name a diagnosis or a protocol."
- **Empty panels** state the requirement, never a zero. The empty injury panel says "This is not the same as being cleared."
- **Corrections panel** states the rules once at the top: entries are never overwritten, a correction records a new dated revision against your name, the window is a fixed 28 days, gym set logs and the weekly nutrition check-in are not correctable here.
- **Phone:** status header, then a sticky 52px jump bar naming the current panel and its position ("Flags · panel 1 of 10"), with "All panels" opening a sheet listing every panel in the role's order at 44px a row, each with a value beside it.

## Data

- One weight figure per athlete, used in the header, the body weight panel and the nutrition plan's per-kilogram targets.
- Missing values in words, never 0 or 0%.

## Verify

- Screenshots of every board frame at 1440×900 and 375×812.
- The profile signed in as each of the five roles, with single-role users, showing what each sees and can do.
- A database-level check that a coach cannot read the clinical record, whatever the UI shows.
- An athlete with no data, and an athlete with an injury.

Commit one step at a time.
