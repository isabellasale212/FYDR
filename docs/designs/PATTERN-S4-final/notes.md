# PATTERN-S4 · FINAL: schedule and week grid, notes

Fourteen artboards: ten desktop at 1440×900, four phone at 375×812, plus three deferred frames in an appendix. One club-local instant: Thursday 10 September 2026, 13:30 Europe/London, week of Mon 7 to Sun 13 September, match Saturday 12 at Colthorne RFC, squad of 30.

**Decision: sessions are live when they are created. No pending queue, no Publish, no Discard.** The queued-publish frames are kept in the appendix (A1 to A3) in case the pilot asks for them.

## Artboards

1 week grid, read mode · 2 click an empty slot, popover open · 3 popover refused, no group and no duration · 4 popover in edit mode with unsaved changes · 5 popover anchored at the right-hand edge · 6 nutritionist read-only · 7 new session, empty form · 8 new session refused · 9 remove a session, confirmation · 10 week templates, applying one · 11 phone day view with the week strip · 12 phone session detail · 13 phone sheet (the popover's mobile form) · 14 phone new session, full form. Appendix A1 to A3: the queued-publish frames, unedited.

## What changed, and on which token

### Pattern

**Sessions are live when they are created.** Creating, editing, moving or removing a session reaches the athletes in its groups at once. Every screen that writes something an athlete reads carries the Athlete app card, and every confirmation says "right away" rather than "when you publish".
`week header line --surf with a 3px --accent2 left bar`

**Clicking the grid creates where you clicked.** An empty slot opens a 320px popover anchored at the point, date and start time pre-filled and snapped to 15 minutes; dragging down a column sets the duration. A ghost block holds the slot while the popover is open. Nothing exists until Add session; Escape or a click away discards it, with no confirmation until something has been typed.
`ghost --wash-accent with 1px dashed --accent · popover --surf, --accent border, --ring-select before --shadow · 320px fixed, 40px minimum margin from the frame edge`

**The primary says what it will make.** "Add session · Thu 10, 16:00, 60 min" rather than Add. "Save changes · time and groups" once more than one field has been edited. A clause whose value is missing is dropped, never printed empty.
`--accent fill + --ring-action, one per view · --touch-min height · --t-body-xs at --w-semi to fit 320px`

**An edit is held; a drag is not.** Typed edits are held until Save changes, which is disabled until something has actually changed, with Cancel beside it, both 44px. Dragging a block writes the move immediately: a drag is its own confirmation and the position is already visible. The two are never mixed in one gesture.
`Save --accent + --ring-action, disabled at 45% with the halo dropped · Cancel --surf / --border · both --touch-min`

**A session that cannot be edited says why, and offers nothing.** A session in the past, or one already rated, opens the popover read-only with a line naming the reason rather than a form full of disabled controls. No rule is invented about what editing a rated session would do to the rating.
`--surf2 well, 1px --border, --t-body-sm --text · no footer buttons rendered at all`

**Expected attendees are distinct athletes.** Counts are never printed by adding group sizes. Where the distinct number is unknown the copy names the groups ("every athlete in Backs and Forwards"); where stated it carries its denominator, as "0 of 30 athletes are expected".

**The current view is a tab, and says it is current.** "Week plan" was a plain span beside a link; now `role="tab"` in a `role="tablist"` with `aria-selected="true"` and `aria-current="page"`, Today as its sibling. Same visual treatment.
`--pill-accent fill · --accent at --w-bold selected, --muted at --w-semi unselected`

**Groups and duration are required, and the message is the consequence.** Five of nine inputs required: name, date, time, duration, groups, each label saying so. "Without a group, nobody is expected at this session, so it will not appear on any athlete's Today." Type, location and MD offset stay optional because each is readable as absent.
`summary --pill-bad / --bad border / --on-bad · field border --bad · per-field line --t-caption in --on-bad`

**A type carries a colour. A group carries a count.** Rehab is a type and a group; neither is renamed. Type chips carry a 4px bar in the grid colour, group chips carry their athlete count, and the rows are separated by a rule with a caption each.

**A destructive confirmation answers three timeframes, in order:** right away, for the athletes, ratings given. The third row is answerable flatly only because Remove is withheld for a session in the past. "Yes, remove" is the accent primary: no destructive fill in this product.

**Cancelled sessions stay listed, struck through at 55%,** plus a Removed pill so the strike-through is not the only signal, and the day header's minutes dropping to 0m. The pill's text is exempt from the strike.

**Read-only names its editor, in the place the control was.** The captured sentence kept word for word, promoted to a bordered well standing where Read/Edit sits for an editor. Nothing disabled: controls are absent.

**The editor carries the athlete's card.** Every screen that writes something an athlete reads shows the athlete's version of it, labelled Athlete app, including the RPE due line.

**Nothing scheduled is a dash, not 0m.** A group with no session reads a dash with "5 athletes · nothing scheduled". A day still reads 0m: a day is a real container that is genuinely empty.

**Every count states its denominator.** "0 of 30 athletes are expected", "6 sessions live in the athlete app", "8 sessions across 6 days", "505 session minutes planned". The grid footer says what is excluded and over what window.

### Screen-specific

**A popover flips rather than shrinks.** Right-hand columns open leftward, last hours upward, always 320px with a 40px margin from the frame edge. On a phone there is nothing to anchor to, so the same content is a bottom sheet.
`320px fixed · sheet corners --r-sheet with 30px bottom padding · scrim rgba(23,40,80,0.28)`

**The week is 40px an hour.** Fourteen hours is 560px, so the week, its legend and the top of the panel fit a 900px viewport. Gutter 44px, blocks inset 3px, smallest block 30px.
`hour row 40px · gutter 44px = --s-15 · hour lines --hair · today --blue-50 · MD header --pill-bad / --on-bad`

**The legend carries all seven types.** The captured legend shows six; Meeting is added in the muted neutral it already carries in the summary table.

**The phone is day-first, and the strip is the dashboard's.** No grid at 375px. The dashboard's strip carries the week at 74px a tile: day, date, MD offset, minutes. Five fit, seven scroll. The day below is a list of 44px rows.

**Applying a template states where the offsets land, and what it will not do.** Apply maps each offset to a date and counts sessions per day; the collision well says what happens to what is there. Applying creates all 8 at once, live for their groups.

**"445 athlete contact minutes" is now "445 session minutes".** The captured total is the sum of the day headers: session length, not length times attendees.

## Needs new token

No new hue, radius, shadow, type size or duration. Three values, all layout or state:

- `--grid-hour-h: 40px`, the week grid's hour row (14 hours = 560px).
- `--ghost-removed: 0.55`, the struck-through removed block. The product's existing value, never named. Distinct from disabled at 0.45 and gated at 0.62.
- `--ring-invalid: 0 0 0 3px rgba(241,90,74,0.16)`, the field at fault, matching `--ring-select`'s geometry on the `--bad` triplet.

## Open against code

1. **Expected attendees must be counted distinctly.** Adding group sizes assumes no athlete is in two groups, and some are. Two decisions: count distinct athletes across the selected groups, and decide whether an athlete marked unavailable is excluded from the expectation and its RPE task, or stays expected and shows as absent.
2. **Can a past or already-rated session be edited at all?** If a rated session's time changes, does the rating follow, detach, or become a revision? Until answered, the popover opens read-only with the reason stated.
3. **Does the grid accept a drag onto an occupied slot?** A drag saves immediately, so an overlap is written with no confirmation. Whether two sessions may share a time within one group is unobserved, as is what an athlete's Today does with two sessions at 09:30.
4. Where does "RPE due by 19:45" come from? Club setting, fixed local time, or derived? The board prints the captured string.
5. Does Apply merge or replace, and what does a template row hold? Where does "load 2,910" come from when the grid reports minutes?
6. Are the Rehab type and the Rehab group the same entity? Are group names seeded or club-defined?
7. Fixture is a type and a separate creation route. What does a session of type Fixture create?
8. What is "Timetable"? No such destination exists in the nine-item sidebar.
9. Who can edit, and is any of it gated separately? A coach who can edit but not remove is untested.
10. **Does removing a session remove its RPE task, or orphan it?** Artboard 9 promises the task leaves the To do. "Session not found" suggests tasks can outlive their session.
11. Is the chip row present in Read mode for an editor?
12. Are the step and range enforced elsewhere (15-minute steps, 07:00 to 21:00; 5-minute steps, 15 to 180)?
13. Which week is the seed? The dashboard strip and the schedule captures disagree. One is stale.
14. Is the day header's minute figure session length or athlete minutes? Per-day figures sum to 445, so session length, yet Contact time per group reports 0m for every group in the same week.
