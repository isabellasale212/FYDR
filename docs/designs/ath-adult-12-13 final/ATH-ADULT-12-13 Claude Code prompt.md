# ATH-ADULT-12, 13: build My data and history

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"ATH-ADULT-12-13 · FINAL"** in `docs/designs/ath-adult-12-13-final/`, with `notes.md` beside it. It supersedes every other design for these flows.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Prerequisites

- The new design system and kit components are in code.
- The gym logger (ATH-ADULT-09-10-11) is built. Correcting from history reuses its correction panel.

If either is missing, stop and tell me.

## Step 1. Report before building

Answer each from the code. Wait for my reply before Step 2.

1. **Readiness:** is there a 0 to 100 readiness score in the code? If so, how is it calculated? Until I confirm the formula, the hero shows the average wellness score out of 5.
2. **Programme blocks:** are blocks stored with dates? If not, gym headlines use "since {date}" instead of "this block".
3. **Last entry per domain:** can you get the date of the athlete's most recent wellness entry, gym session, RPE, nutrition check-in and test, regardless of the chosen period?
4. **Corrections:** is there a per-session flag saying a set was revised? Are session totals stored or calculated? If stored, how are they updated after a correction?
5. **Week boundary:** what defines "this week" for RPE and for the nutrition check-in? They must use the same Monday week.
6. **Nutrition questions:** confirm the check-in has exactly two fixed questions for every club, and that the live build has the fuelling question.
7. **Tests:** can you tell "never assigned" from "assigned but no result"?
8. **Usual-range band:** is there an agreed way to calculate it (window, statistic, minimum number of entries)? If not, leave the band off and tell me.

## Step 2. My data (flow 12)

- **Five tabs:** Wellness, Gym, Sessions, Nutrition, Tests, on the existing segmented track. One row at default text size. At larger text sizes the row wraps to two rows. Never scroll sideways, never cut labels off.
- **Period control** on the title line, in the accent with a chevron. Default "Last 28 days". Keep the option "Today: one day cannot show your usual range".
- **Hero card per tab:** eyebrow, big figure at `--t-num-hero`, delta, one factual line, then the chart (Wellness, Gym, Sessions only).
- **Deltas never judge.** An arrow, a signed figure in bold, and what it's compared with, in `--muted`. Never the warn colour.
- **Headlines are facts only.** If there's too little data, say so ("Two CMJ results is not enough to show a trend").
- **History list card:** title, count caption ("n = 24 of 28 days"), date over detail, value on the right, "See all … →" as the last row.
- **Missing values are words:** "Not submitted", "Not rated", "Not answered", "Not logged". Never a dash, never a zero.
- **Nutrition history** shows the same two questions and answer wording as the check-in form.
- **Tests** lists only tests assigned to the athlete.
- **Empty period with older data:** "Nothing in the last 28 days." plus when the last entry was, and a "Show this season" button. Never change the period automatically.
- **Brand-new athlete:** "Nothing on record yet." No button.
- **Tab bar icons:** all neutral, active in the accent. No gold.

## Step 3. Session detail (flow 13)

- Date as the heading, "Gym · Lower A · complete" as eyebrow.
- Total volume and session RPE at `--t-num-hero`, with the original summary line beneath.
- One way back: "Back to gym history", full width in the footer. Remove the second back button. No tab bar on this screen.
- **Tapping a set row** opens the gym logger's correction panel. The footer becomes Save correction and Cancel. Remove the per-row "Correct" buttons.
- **After a correction:** the set row shows "Corrected · was 100 kg × 8", the session shows a "Corrected" pill in the history list, and totals show "recomputed after a correction".

## New tokens

- `--chart-h: 84px`
- `--chart-stroke: 2.5px`

Add them to the design system doc in the same commit.

## Everywhere

- Every tap target at least 44px.
- Tabular figures for all numbers.
- Charts use the accent and neutrals only, with axes labelled in words.

## Verify

- Screenshots of every board frame on the real build at 375×812, plus session detail at 375×667.
- The tab row at default text size and at iOS Larger Text one step up.
- An athlete whose last gym session is 29 days old, on the default period.
- A brand-new athlete.
- A corrected set, shown on the session and in the history list.
- Nutrition history for a week with both answers, and for a week with none.

Commit one step at a time.
