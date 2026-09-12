# Design brief — ATH-ADULT-02, Land on Today and read what is outstanding

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. What exists now

**`docs/walkthrough-screenshots/athlete-adult/ATH-ADULT-02 - Land on Today and read what is outstanding.pdf`**
— cover plus one frame, the populated screen.

Verified before writing this brief: the PDF exists and its record was repaired.
**27 of the 34 athlete-adult PDFs had no entry in `_report.json`** — lost to an
overwrite bug during capture, while the files themselves survived. Every record
was rebuilt from the PDFs' own page trees.

---

## 2. The flow, verbatim from the walkthrough document

## ATH-ADULT-02 — Land on Today and read what is outstanding

**Entry point.** Automatic after sign-in; the "Today" tab from anywhere.

**Steps.**

1. The screen loads. In order down the page:
   - Greeting heading: "{greeting}, {firstName}" — the greeting word is
     time-of-day aware **in the organisation's timezone**, not the device's.
   - Availability banner, when a current availability row exists (see
     ATH-ADULT-34).
   - Injury diagnosis and mechanism, when a clinical record exists and is
     linked to the availability row (see ATH-ADULT-34).
   - "Team this week: {team_name}." with "Set by your coach." — only when a
     rehab team allocation exists for this week.
   - Section "To do" with a count "{N} left" on the same line.
   - Section "Today" listing the day's sessions.
2. Press a to-do row to start that task.
   - Every to-do row is a full-width link with a three-letter domain glyph, a
     name, a subtitle, and a "›" chevron.

| Domain | Glyph | Row name | Subtitle | Goes to |
|---|---|---|---|---|
| Wellness | "WEL" | "Wellness" | "45 seconds" | `/check-in` |
| Session rating | "RPE" | the **session's own name** (e.g. "Team run"); "Training" if unnamed | "20 seconds" | `/rpe/{sessionId}` |
| Nutrition | "NUT" | "Weekly check-in" | "Did you hit your protein target most days? · about 10 seconds" | `/nutrition-check-in` |

**Branches.**

- IF nothing is outstanding THEN the to-do list is replaced entirely — see
  ATH-ADULT-32.
- IF no session is scheduled today THEN see ATH-ADULT-33.
- IF a session is cancelled THEN its row renders at 55% opacity and remains
  listed rather than disappearing.
- IF an entry is sitting in the offline queue THEN a queued-write notice appears
  — see ATH-ADULT-30.

**End state.** Stays on `/today`; pressing a row opens that task's sheet.

**Note.** The design's timing clause ("open since 07:00", "due by 19:45") is
deliberately **absent** from the subtitle: `compliance_expectations` holds no
such times, so it was left out rather than invented. A screenshot showing a
timing clause is not this build.

---

---

## 3. The screen, measured at 375×812

Read from the live DOM signed in as an athlete with **three** outstanding items.

| Element | Top | Height | |
|---|---|---|---|
| Header, date, greeting | 0 | 109 | |
| **"THIS WEEK" strip** | 137 | **285** | **35% of the viewport, zero interactive elements** |
| Availability banner | 450 | 83 | **133** when unavailable with a note |
| "To do" heading | **561** | 23 | |
| Row 1 — Wellness | 593 | 82 | visible |
| Row 2 — RPE | 676 | 82 | visible |
| Row 3 — Weekly check-in | 759 | 100 | **cut off at the fold** |
| "TODAY" sessions | 889 | 104 | below the fold |

Page **1,079px** — 1.33 screens. **Two of three rows fully visible.**

---

## 4. Tokens in play

| Element | Current |
|---|---|
| Page background | `--bg` `#e4ebf9` |
| Body text | `--text` `#13161c` |
| Secondary text | `--muted` `#484e57` |
| Accent | `--accent` `#1f6fea` |
| Card radius | `--r-card` `18px` |
| Control radius | `--r-control` `6px` |
| Body font | Roboto via `--font-sans` |
| State transition | `--t-state` `0.15s ease` |

Row name is `1.0625rem`/700 — 17px at the default root, in rem so it follows the
reader's text-size setting. Row subtitle uses `.tiny`. Domain glyphs are `WEL`,
`RPE`, `NUT`.

**The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`.** That file is the constraint list.

---

## 5. The constraint any proposal must satisfy

Frozen design (CLAUDE.md §0), scoped exception (§0.01) for the flow under active
review — this one. Implementation is serial (§0.02): one flow, verified against a
real render, committed, before the next is touched.

**Buildable without further approval:** anything composed from the existing
system — the 171 tokens, the radius scale, the spacing scale, the type scale, the
two motion timings.

**Flag and confirm before building:** anything needing a pattern the system does
not have — a new colour, easing curve, component shape, radius, spacing step,
type size or duration. The test is whether it can be expressed in tokens that
already exist.

---

## 6. Persona review

Run 2026-09-10 against the running screen with a populated list. Full text:
**`docs/walkthrough-reviews/ath-adult-02-review.md`**.

| # | Finding | Weight |
|---|---|---|
| 1 | **561px of an 812px screen** passes before the first actionable element. The 285px week strip contains **zero** links, buttons or handlers — verified, not inferred | **Highest** |
| 2 | With three outstanding, **only two rows are fully visible**. "3 left" is a count the person must reconcile against what they can see | **High** |
| 3 | RPE rows read **"How hard was it?"** — a fixed string in `compliance.ts:144`. Two sessions to rate produce two identical rows. The source comment claims the session's name is used; it is not | **High** — a defect |
| 4 | The availability banner is **50px taller when the news is bad** (133 vs 83), pushing the actions further from the person least able to hunt for them | Medium |
| 5 | The empty state changes the screen's shape rather than the list's content | Low |

**Protect in any redesign:** 82–100px row targets; the "45 seconds" / "20
seconds" subtitles, which are what make the tasks feel small enough to do; the
greeting's real time-of-day awareness in the **organisation's** timezone; and the
fact that the list is its own status, so nothing needs a separate confirmation.

**Four document claims were tested rather than trusted.** Three held. One was
false: an RPE row does **not** show the session's name. Finding 3 above.
