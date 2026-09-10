# Walkthrough capture — report

**Captured 2026-09-10 against SCRATCH** (`http://localhost:3000`, database
`stfgzkuvczbpxyevxkak`), not production. Every documented flow writes something,
and several are athlete-facing: creating a fixture reaches every athlete's Today
screen, publishing pushes a week to real phones, and a wellness entry is
immutable once written. Scratch runs identical code — verified byte-for-byte
against the deployed bundle earlier the same day — with the same 46 accounts.

**142 PDFs**, one per flow, in seven folders named by role. Each is named exactly
as the flow appears in its walkthrough document, e.g.
`ATH-ADULT-05 - Rate a session (RPE).pdf`. Every page is captioned with the
control pressed, quoting the document's own wording, and each PDF opens with a
cover carrying the flow ID, name, entry point and capture count.

| Folder | Account | PDFs |
|---|---|---|
| `athlete-adult/` | Alex Grant, and Ben Sullivan for the one-shot flows | 33 |
| `athlete-minor/` | Kai Mercer — the only minor on either database | 13 |
| `staff-sport-scientist/` | Jane Pemberton | 38 |
| `staff-coach/` | Kate Doyle | 23 |
| `staff-medic/` | Ruth Callaghan | 14 |
| `staff-sc/` | Owen Hartnell | 11 |
| `staff-nutritionist/` | Sana Mirza | 10 |

## Not captured, per flow

Listed rather than left as gaps.

| Flow | Why |
|---|---|
| `ATH-ADULT-24` Change my password | Not attempted. Passwords are never typed by me, and changing this account's would have locked the remaining batches out of it. |
| `ATH-ADULT-30` Discard a queued entry | Needs an offline write **conflict**, not merely a queued write. A plain queued write is deliberately invisible and retries silently, so the notice cannot be produced on demand. |
| `ATH-ADULT-33` Today with no sessions | Neither adult athlete used had a clear day: both were named in a session on the capture date. |
| `ATH-ADULT-09`, `ATH-ADULT-10` Gym logging | Not captured. **The stated reason was wrong** (corrected 2026-09-10): Ben Sullivan *did* have a programme, assigned to his group rather than to him directly, so the session was reachable at the time. Only Alex Grant genuinely had none. The check behind the original note looked at `programme_assignments.athlete_id` alone and missed every group-based assignment. |
| `ATH-ADULT-13`, `ATH-ADULT-11` Gym history | Captured for the minor (`ATH-MINOR-13`, `ATH-MINOR-11`) but not the adult: the session ended before the retry. The cause of the original failure is recorded below and is app behaviour worth knowing. |
| `ATH-ADULT-03w` Submit wellness | 5 of 6 steps. The opening pre-answer frame was lost to a sign-in detection bug; the write itself succeeded. One-shot per athlete per day, so it could not be re-taken. |
| `ATH-ADULT-01` Sign in | **Was missing from this table as well as from the capture** — an unrecorded gap rather than a declared one, found on 2026-09-10 when the flow was needed. Now captured, 5 of 5 steps, including the refusal branch. |
| `STAFF-SS-33` Print | Opens the operating system's print dialog, which is not part of the page and cannot be screenshotted by any in-page capture. |

## Things the capture found that the documents did not say

1. **`/my-data` gym history is empty at the default period.** The list is
   genuinely empty rather than broken, and the period must be widened to see
   older sessions. **The stated cause was wrong** (corrected 2026-09-10): the
   control defaults to **"Last 28 days"**, not "Today" — measured, the `<select>`
   value is `month`. The effect is the same but the boundary is different, and a
   28-day window is exactly the kind that hides a session logged 29 days ago
   while looking like a full history.
2. **`/nutrition-check-in` always targets the PREVIOUS completed week.** This was
   first reported as a bug and withdrawn after reading the code: you cannot
   answer "did you hit your protein target most days" about a week still
   running. Now recorded in `ATH-ADULT-07`, including that a screenshot dated a
   week behind is correct rather than stale.
3. **The injury boundary is structural, not a hidden column.** Observed side by
   side: a coach and S&C see the injury list; a medic additionally gets a
   "PROBLEM REPORTS" section carrying athletes' own words, and a "+ Injury"
   control. Recorded in the staff document with the measured page lengths.

## A correction to the staff document, made during the capture

`/injuries` was documented as `CLINICAL_ONLY` and closed to the sport scientist,
coach and S&C. **That was wrong in three role sections.** Every `/injuries/*`
route is gated by `requireInjuryAccess()` → `INJURY_ACCESS`, which admits four
roles; only the nutritionist is excluded, and `/injuries/team-allocation` is the
same gate rather than `SESSION_EDIT`.

The cause is worth more than the fix: the gate map was built by grepping each
page for `hasAnyRole(claims.roles, X)`, which on `/injuries` matched the
`isMedical` computation instead of the `requireInjuryAccess()` call guarding the
door. The same mistake had already put `CLINICAL_ONLY` on `/reports/injuries` in
the first draft — the instance was fixed and the method was not, so it recurred.
Reading the `require*` helper is the reliable method.

Verified afterwards by measurement rather than assertion: S&C and coach both
render `/injuries` at ~815 characters, the medic at ~1,778.

## Limits of this report

- **The per-section `_report.json` for `athlete-adult` and
  `staff-sport-scientist` was badly incomplete, and has been repaired.** A
  `--only` re-run originally *overwrote* that file rather than merging. Measured
  when the ATH-ADULT-02 brief was built: **27 of 34** athlete-adult records and
  **36 of 38** sport-scientist records were missing — far worse than the
  "incomplete" this section first claimed. The PDFs survived throughout.
  Every lost record was rebuilt from the PDFs' own page trees (each file opens
  with a cover page, so pages − 1 is the step count) and is marked
  `recordRebuilt`. Both sections now reconcile: 34 records/122 images and 38
  records/123 images.
- **Six harness faults were found and fixed during the run**, each by the app
  disagreeing with an assertion: navigate-only steps reporting success whatever
  was on screen; clicking server-rendered elements before React had hydrated
  them; using a precondition where a postcondition was meant; a quoting error
  that made every postcondition throw; sign-in detection that accepted
  `about:blank`; and a failed step not stopping the rest of its flow.
- **Nothing here was captured on production.** Any screenshot showing
  `fydr.app` in the address bar is not from this set.
