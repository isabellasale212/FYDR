# Pattern S4: build the schedule and week grid

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"PATTERN-S4 · FINAL"** (14 artboards plus an appendix) in `docs/designs/pattern-s4-final/`, with `notes.md` and the board PNGs beside it. It supersedes every other schedule design.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.
- **Appendix A1 to A3 is deferred. Do not build the publish queue.**

## Product decision carried in

**Sessions are live when created, edited, moved or removed.** There is no publish step. Remove any "Published" or pending-changes wording from the schedule, and make every confirmation say "right away".

## Step 1. Report before building

Answer each from the code. Wait for my reply before Step 2.

1. **Expected attendees:** is a count stored on a session? Build it as a count of distinct athletes across the selected groups, and tell me whether athletes marked unavailable are currently excluded. Report where else this count feeds (dashboard, compliance, RPE tasks).
2. **Removing a session:** does it remove the athletes' RPE tasks, or orphan them? If it orphans them, what is the smallest change that cleans them up?
3. **Past and rated sessions:** can they be edited? Does a rating hang off the session id or the date? If a rated session's time changes, what happens to the rating?
4. **Overlaps:** may two sessions share a time for the same group? What does an athlete's Today show for two sessions at the same time?
5. **"RPE due by 19:45":** where does that time come from?
6. **Templates:** what does a template row hold, does Apply merge or replace, and what is "load 2,910"?
7. **Fixture:** it is both a session type and a separate creation route. What does a session of type Fixture create?
8. **"Timetable":** the session panel says "See Timetable for who", and no such screen exists. What should it link to?
9. **Permissions:** who can edit, and is removing gated separately from editing?
10. **Seed drift:** the dashboard week strip and the schedule captures show different sessions for Mon 7. One is stale.
11. **Contact time per group** reports 0m for every group in a week that has sessions with groups. Check that query.

## Step 2. The week grid

- 40px an hour, 14 hours, 44px gutter. The grid, legend and panel fit a 900px viewport.
- Read mode and Edit mode. Dashed blocks are draggable, solid are not. Read mode for an editor looks like the read-only role's grid.
- The current view is a real tab (`role="tab"`, `aria-selected`, `aria-current="page"`).
- All seven types in the legend, each with its colour. Type carries a colour, group carries a count.
- Removed sessions stay listed, struck through at `--ghost-removed`, with a Removed pill, and the day's minutes drop to 0m.
- Read-only roles see a bordered well naming who edits, in place of the Read/Edit control. No disabled controls.
- Counts state their denominators. "Nothing scheduled" for a group is a dash; an empty day is 0m.

## Step 3. Click to create, and edit in place

- Clicking an empty slot opens a 320px popover anchored there, with date and start time snapped to 15 minutes. Dragging down a column sets the duration.
- A ghost block holds the slot while the popover is open. **Nothing is written until "Add session" is pressed.** Escape or clicking away discards, with a confirmation only if something has been typed.
- Popover fields: name, start, duration, type, groups, plus "More options" opening the full form and carrying what has been typed.
- The primary names what it will make: "Add session · Thu 10, 16:00, 60 min".
- Clicking an existing session opens the same popover populated, in edit mode. Changes are held until "Save changes", which is disabled until something changes, with Cancel beside it. Both at least 44px.
- Dragging a block saves the move immediately.
- A past or already-rated session opens read-only with the reason stated, and no footer buttons.
- The popover flips rather than shrinks near the frame edges, and keeps a 40px margin.
- On a phone the same content is a bottom sheet, matching the athlete app's sheet.

## Step 4. Forms and confirmations

- Required: name, date, time, duration, groups. Each label says so. The group error reads "Without a group, nobody is expected at this session, so it will not appear on any athlete's Today."
- Type, location and MD offset stay optional.
- Remove confirmation answers three timeframes in order: right away, for the athletes, ratings given. "Yes, remove" is the accent primary. Remove is withheld for a session in the past.
- Templates: Apply maps offsets to dates, counts sessions per day, states what happens to what is already there, and creates them live.

## Everywhere

- Every screen that writes something an athlete reads shows the athlete's card, labelled "Athlete app".
- Missing values in words, never zeros.
- Three new tokens: `--grid-hour-h`, `--ghost-removed`, `--ring-invalid`. Add them to the design system doc in the same commit.

## Verify

- Screenshots of all 14 frames on the real build.
- Create a session by clicking the grid, and show that nothing is written until Save.
- Create one with no group: show the refusal.
- Drag a session and show the move saved immediately.
- Remove a session that has an outstanding RPE task, and show the task gone from that athlete's Today.
- The nutritionist's read-only grid.
- The phone day view and the phone sheet.

Commit one step at a time.
