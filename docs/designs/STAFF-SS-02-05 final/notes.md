# STAFF-SS-02-05 · FINAL: squad and athlete profile, notes

Twelve artboards: 7 desktop (squad list as sport scientist; profile as sport scientist, medic, coach, S&C, nutritionist; brand-new athlete) and 5 phone (squad list; profile top; jumped to Availability; medic top; All panels sheet open).

**Phone navigation, final form:** the sliding chip bar was rejected. In its place, a sticky 52px jump bar naming the current panel and its position ("Flags · panel 1 of 10"), with an "All panels" button that opens the full list as a sheet: every panel in the role's order, 44px a row, each with a value beside it so an empty panel is visible before it costs a tap.

## What changed, and on which token

### Pattern rules

1. **Every profile opens with the same status header.** Name, position, group, availability status and restrictions, in the dashboard's words and tones: Available `--pill-good`, Modified `--pill-warn`, Unavailable `--pill-bad`, Not recorded neutral. It is the one emphasised card on the screen and absorbs the development-plan bar and the bio row.
`--blue-100 / --blue-200 / --on-tint-value / --on-tint-label / --on-tint-meta`
2. **"Not recorded" is the only word for no status.** "Not set" is retired. The pill is neutral, not a tone, because no status is not a state of availability. It matches the dashboard's "3 not recorded".
`--surf2`, `--border`, `--muted`, no semantic pair
3. **Panels are ordered by role, not by page.** One panel library, one design each: sport scientist Flags plus Athleticism; medic Injury plus Availability; coach Availability then Injury; S&C gym plus Body weight; nutritionist Body weight plus nutrition plan. Only sequence changes.
4. **Read-only panels keep their content and name their owner.** "Read-only · set by medical staff", "Read-only · edited by the nutritionist", plus person and date. Nothing at 45% opacity: disabled is for a control you could have used, not one that was never yours.
`--surf2` in `--border`, `--muted`, `--t-caption` uppercase at `--t-eyebrow-tracking`
5. **Withheld panels are absent, and nothing counts them.** No heading, placeholder, lock or "hidden" row, and no count changes shape when a panel is missing. The nutritionist's profile is six panels and never says so.
6. **The coach's injury card stops after expected return.** No disabled row, because a disabled row implies a diagnosis exists.
7. **The restriction line never names a protocol.** "Return to play protocol, stage 3 of 6" is a clinical fact and appears only in the medic's clinical record, as the Stage row. Everywhere else (squad list, every status header, every injury and availability panel) it reads "No contact, no collision drills", which is what a coach acts on.
8. **The coach-visible note says what may go in it.** The medic's note field carries "Coach visible. Describe the restriction, not the injury. Do not name a diagnosis or a protocol." It is the one place a clinical detail can leak into a coach-visible field by hand, so the rule sits on the field.
`--t-caption` in `--muted` under `--field`
9. **The phone profile is a status header plus a jump bar.** 132px header, then a sticky 52px bar naming the current panel and its position, with "All panels" opening the list as a sheet. Availability moves from y=2706 to one tap; entries and corrections from y=5102 to one tap.
`--bar-bg` with `--bar-blur`, rows and controls at `--touch-min`, `--r`, sheet `--r-sheet` over `--scrim`
10. **Squad rows are 60px on a phone and the name is the link** (against 34px measured). Pill right, restriction line on the row. Desktop keeps the five measured columns and both washes.
`--wash-warn`, `--wash-bad`, `--accent`
11. **Empty panels state the requirement, never a zero.** "n = 0", "a trend needs three weigh-ins", "no plan assigned, targets are per kilogram, so a plan needs a weigh-in". The empty injury panel adds "This is not the same as being cleared."
`--line-dashed`, `--faint` dashes, no `--bad`

### Screen-specific

12. **Flags stays beside Athleticism for the sport scientist.** Athleticism left, Flags right. This role, this screen.
13. **The coach's status header carries five bio figures, not six.** Body mass is removed for the coach and kept for sport scientist, medic, S&C and nutritionist. Nothing marks the gap. Logged as a club setting rather than a fixed permission.
14. **"Lower is better on this test"** stays under 10m sprint, 40m sprint and the Bronco test, beside the percentile rather than in a legend.
15. **The availability form keeps its reason field and its coach-visible note:** three status buttons, a reason, and the note field with its hint.
16. **Corrections state what a correction does once**, at the top of the panel: entries are never overwritten, a correction records a new dated revision against your name, the window is a fixed 28 days, gym set logs and the weekly nutrition check-in are not correctable here.

**Kept unchanged:** group filter chips and count line, the squad list's availability and restrictions columns, Mark best's confirm and cancel, the phone shell and bottom bar from SS-01.

## Needs new token

Nothing. The phone jump bar is the existing sticky-bar pair (`--bar-bg` with `--bar-blur`), its sheet `--r-sheet` over `--scrim`. The read-only owner line wanted a fifth pill family and did not get one: `--surf2` in `--border` with `--muted` text, the well treatment the nutrition and gym wells already use.

## Open against code

1. Is body mass hidden from the coach by role, or by a club setting? The captures show the bio strip with weight for every role, so this is a change rather than an observation. Treat it as a club-level setting for the coach role and confirm the default.
2. Does the coach actually see Nutrition plan, Body weight, Entries and corrections and the S&C history log? The coach capture shows all of them, with Edit and Correct check-in, but on an uninjured athlete, so it cannot separate permission from a seed user holding every role.
3. What does the S&C gym panel list per athlete? No capture shows it at profile level. The frame shows assigned block, week position, session counts and an adjust action; rows, sets and adherence are not established.
4. Which fields does the medic's clinical record hold, and what are they called? Diagnosis / Mechanism / Stage / Reviewed are illustrative.
5. Is "Log injury" available to the sport scientist? It renders in that capture; what it opens is not observable from a still.
6. Does the profile's availability control exist for the coach, and is it limited to non-injury reasons? The frame renders it read-only for the coach on an injury-linked status.
7. Is the period control per-role or per-user? Three roles show "This season · 2026/27", the medic "Last 28 days".
8. What is the ACWR and wellness-rating card, and is it one of the ten panels? It renders in all four captures but is not in the inventoried ten, so it is not drawn rather than guessed at.
9. Which roles can raise or acknowledge a flag? Sport scientist, coach and medic show Acknowledge and Add note. S&C and nutritionist are unestablished.
10. Who can see the subject access request panel? Whether it belongs to the sport scientist as admin decides whether it appears on the other four profiles.

## Subjects used

Dan Okonkwo where a "Not recorded" status makes the language rule; Adam Selby (modified, injury-linked) wherever an injury and a restriction must be visible, at 104.2 kg in the header, the body-weight panel and the nutrition plan's per-kilogram targets; Kai Mercer for the new-athlete frame.
