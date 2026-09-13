# Pattern S8: build settings, users and club setup

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"PATTERN-S8 · FINAL"** (14 artboards, 0 to 13) in `docs/designs/pattern-s8-final/`, with `notes.md` beside it. It supersedes every other settings, users or integrations design.

- `notes.md` carries the exact tokens and the full "Open against code" list. Work through that list as part of Step 1.
- This prompt sets the behaviour. Where they conflict, stop and ask me.

## Step 1. Report before building

Answer from the code, plus every item in the notes' "Open against code" list. Wait for my reply before Step 2.

1. **§0ae, the last-admin guard.** Confirm the database trigger is in place, so the last sport scientist cannot remove their own role at any layer. The screen must state why the control is unavailable, not fail silently.
2. **Permission names.** List the real permission constants behind each role toggle, and what each one actually gates.
3. **Thresholds.** Where are they stored today, per club? Is the owner and the date recorded? Can a rule be previewed against the last 28 days without writing anything?
4. **Groups.** Can a group be renamed or deleted while a programme or a session uses it? What happens if it is?
5. **Audit log.** List the event kinds it records. Confirm whether exports are among them (PATTERN-S7 found they were not).
6. **Subject access.** Is there anything today, or is the athlete report from PATTERN-S7 the whole answer?
7. **Retention.** What happens to an athlete's data on deactivation today? Nothing should be deleted without a rule you and I have agreed.
8. **Integrations.** Catapult: is there a connection record, and what does a failed import do? Apple Health cannot work without a native iOS app, so it must be visibly unavailable, not merely unconnected.

## Step 2. Club setup and the hub

- **Setup checklist (artboard 0):** add athletes, make groups, set thresholds, invite staff, assign roles, in that order, each with a count and a done or outstanding state. It is a list of remaining defaults, not a gate: a club can use the app with steps outstanding.
- **Settings hub in four groups**, replacing the 5,089px single list. Log out is a real 44px button.

## Step 3. Users, roles and groups

- Users list with **search by name or email, and filters by role and status**. No sideways tables at 375px.
- Role toggles stay additive. Where a role cannot be removed, the control says why.
- Groups: create, rename, assign, with athlete counts and a warning when a group is in use.

## Step 4. Thresholds

- Rules in plain English, with the owner and date shown, exactly as the dashboard quotes them.
- A preview before saving: how many athletes this rule would have flagged in the last 28 days. The preview writes nothing.

## Step 5. Audit, exports, retention, subject access

- Audit log readable by a person: who, what, to whom, when, filterable by person and kind. On a phone the filter is a sheet.
- Export copy is role-correct, and every export writes an audit row (with PATTERN-S7).
- Retention and deactivation state consequences before they happen. Nothing is deleted without an agreed rule.
- Subject access: staff side and athlete side, reusing the athlete report where it fits.

## Step 6. Integrations and athlete settings

- Catapult connected, GPS imports open, **Apple Health shown as "Not available yet · needs the Fydr iOS app" with no control**.
- Athlete settings: notification preferences, password, and the plain-English page saying what staff can see.

## Everywhere

- Every control at least 44px on a phone.
- Missing values in words. Counts with denominators.
- No new tokens unless the notes approve one.

## Verify

- Screenshots of all 14 frames on the real build.
- A database-level attempt to remove the last sport scientist's role: refused.
- The users list at 37 users, searched and filtered, on desktop and phone.
- A threshold preview that writes nothing, then the saved rule quoted on the dashboard with its owner and date.
- An audit log filtered by person, and an export writing its audit row.
- The setup checklist on a club with two steps outstanding.

Commit one step at a time.
