# Fydr Staff App — Build Handoff

## Source of truth

Read and build against **`FydrStaffAppSpecification_-_CLEAN_for_ClaudeCode.docx`** only.

Do not use any version with tracked changes, redlines, or a summary page listing edits. If you find one, stop and ask which document to use rather than guessing.

Also read **`Fydr - Architecture To-Do List.md`** before starting. It has the build order, known live bugs, and items decided but not yet built. It is not restated in full here.

## Verification standard — non-negotiable

This project has already had one fabricated finding (a false claim that no ERD existed) and three withdrawn findings from an earlier review, all from the same failure: reasoning from the shape of the code instead of reading or running it.

Three levels. State which one applies to every claim you make about your own work:

- **Read** — you read the code that does this and can quote the line.
- **Run** — you executed the app and watched the result.
- **Inferred** — you reasoned from the shape of the code without confirming.

**Rule: nothing gets reported as "done," "fixed," or "built" at less than Run level.** If you can't run it, say so, don't report it as done. A false "done" costs more than an honest "not verified yet."

## Build order — do not reorder, do not parallelize the first two

1. **Role model migration**, together with the **GPS duplicate-row bug fix**. Do these two together, not sequentially, per the to-do list's own reasoning: the injury-gate fix and several other pending items depend on the role model existing first, and the GPS bug is corrupting live data right now.
   - Five roles in the `app_role` enum: sport scientist, coach, medic, S&C, nutritionist. No `admin` value.
   - Every RLS policy, guard function, and sidebar tag naming a role needs updating together, not screen by screen. This is one migration, not eleven small ones.
   - GPS re-upload must stop duplicating rows: add the unique constraint (athlete/date/session), change import from insert-only to replace-on-conflict.

2. **Credential handling.** Remove temporary passwords from both single and bulk account creation. Replace with an invite-link flow: the person sets their own password and confirms their address in one step. No password is ever generated, emailed, or shown on screen, on either path.

3. **Screen 63, Add athlete.** This is new construction, not a bug fix. No code exists for it today, no screen, no route, no insert into the athletes table. Build it exactly as specified: sport-scientist-only, full name / date of birth / position / squad number / optional invite email, squad number checked for uniqueness within the club.
   - Do not confuse this with modifying an existing "add athlete" flow. There isn't one.
   - One open product question is flagged inside the screen's own spec (multi-club athlete transfers). Stop and ask rather than deciding it yourself.

4. **Everything else**, in whatever order makes engineering sense, except:
   - **Remove `SeedDefaultThresholds`** (or whatever it's now called) as part of the Thresholds screen work. It's redundant under the fixed-list model in the spec and should not be reconciled with the new design, just removed.
   - **Do not build a billing screen or surface of any kind.** Out of scope permanently, not "not yet."

## Correction, 2026-09-05: the table below was wrong and has been removed

An earlier version of this handoff listed D-01, D-28, D-30, D-33, D-34, D-35, and D-36 as open decisions requiring you to stop and ask. **That was a mistake.** All seven are already resolved in the clean spec, most of them since 2026-09-04, before this handoff was even written. Do not stop and ask about any of them, build to what the spec already says:

| ID | Where it's resolved, and what to build |
|---|---|
| D-01 | Nutritionist excluded from all injury/availability data, everywhere. Real build work tied to the role migration in step 1, not a separate decision. Highest-risk item, get it right. |
| D-28 | Nutrition screen (31): a weigh-in now auto-recomputes the current target against the assigned rate. Build exactly that, not a manual-only recompute. |
| D-30 | Apply-a-week-template screen (15): a sync button forces immediate compliance-expectation generation, an alternative to waiting for the nightly run. Build the button. |
| D-33 | Training report (23): a warning is added when a session's title changes, naming that it detaches from its own history. Build the warning, not a rebuild of the scoring model. |
| D-34 | Injuries screen (25): stays deliberately out of the sidebar by design, reached only through the injury report and direct links. This is not a bug to fix, it's confirmed intentional. |
| D-35 | Injury record screen (26): only a medic may set availability or close an injury. Enforce this, coaches currently can and shouldn't be able to. |
| D-36 | Team allocation screen (29): a real confirmation step is added to Publish this week, naming what's about to become visible, not just a draft count. Build the confirmation. |

**If you encounter any of these seven and the spec's resolution seems ambiguous or contradicted by the code, that's a Run-verification task, not a decision for you to make. Report what you find rather than picking an interpretation.**

## One more standing rule, already on the to-do list, repeated because it matters here

**Do not batch-approve or auto-apply changes that mix cosmetic fixes with access-control changes.** Anything touching who can see medical or injury data (D-01, D-07, D-35 in particular) gets reviewed on its own, not bundled with unrelated cleanup.
