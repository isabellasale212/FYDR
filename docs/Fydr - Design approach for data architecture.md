# Fydr design approach: a briefing for data architecture

11 Sept 2026. From Isabella.

## The short version

- We are **not designing every page**. The athlete app has 34 flows and the staff app about 45. Designing each one would take weeks before a club sees anything.
- Instead we design **patterns**: one board per group of screens that share the same layout and components. Each board uses a **pilot-critical flow** as its main example and gets the full treatment.
- Every other screen in that group **inherits** the pattern when it's built. Screens outside any pattern inherit the design system and kit components, then go through **one automated sweep**.
- For you, this means the designs define **reusable data needs**, not one-off screens. Each pattern board ends with an **"Open against code"** list. Those lists are the data questions. They're collected at the end of this doc.

## How it works

| Step | What happens |
|---|---|
| 1 | A persona review measures the current screen (Claude Code) |
| 2 | Claude Design produces a static review board for the pattern |
| 3 | Isabella and the advisory chat review and approve it |
| 4 | The approved board, its notes and a Claude Code prompt go into `docs/designs/<flow>-final/` |
| 5 | Claude Code answers the "report before building" questions, then builds |

**Rules that affect you:**

- The design system is the existing 171-token `tokens.css`. Nothing from Claude Design's own kit or token system is imported. Any value not in `tokens.css` is flagged as a proposed new token and needs my approval.
- A design may not invent data. Anything a board needs that the database may not hold is listed under "Open against code", not drawn as if it exists.
- Missing values are shown as words ("Not submitted", "Not logged"), never 0 or 0%. The data must distinguish **missing** from **zero**.
- Role gates must hold **at the database (RLS)**, not only in the UI.
- Pattern boards change several screens at once. `CLAUDE.md` §0.01 currently permits design changes only inside the one flow under active review, so it needs updating to allow a pattern's whole group; the wording is proposed to me, not changed yet.

## Pattern status

### Athlete app

| Pattern | Flows covered | Status |
|---|---|---|
| Auth | 01 sign in (24, 31 inherit) | Built and live |
| Home list (Today) | 02 (32, 33 inherit) | Built and live |
| Entry form | 03 wellness, 05 RPE, 07 nutrition | Design final, without the bottom sheet: forms stay pages (declined 11 Sept) |
| After submit | 04, 06, 08 | Design final |
| Gym logger | 09, 10, 11 | Design final |
| My data and history | 12, 13 | Design final |
| Status and detail | 34 | Later |
| Leaderboards, settings, system states | 14 to 30 | Sweep |

### Staff app

| Pattern | Flows covered | Status |
|---|---|---|
| Dashboard and phone shell | SS-01 plus coach, medic, S&C, nutritionist versions | Design final |
| Squad and athlete profile | SS-02, SS-05, SS-06, role versions | In design |
| Injuries and availability | SS-28, COACH-28, MEDIC-19, 24, 28, SC-24a, athlete 34 | Next |
| Schedule and week grid | SS-07 to 15, NUT-07 | Next |
| Programme authoring | SS-23, SS-24, COACH-23 | Next |
| Onboarding, reports, leaderboards, settings | The rest | Later or sweep |

## Decisions already made that touch data

- **Correction rules:** wellness and RPE are immutable for the athlete (staff can correct, shown as "Corrected"). Nutrition can be corrected **once** by the athlete, creating a revision. Gym sets can be corrected from history; the original is kept.
- **Wellness:** six questions. Sleep hours starts empty (no default). 5 is always best, including soreness. Heart rate and body mass are entered only inside wellness.
- **Weekly nutrition check-in:** two fixed questions (protein target; fuelling around training, 1 to 5).
- **Gym:** coach prescribes sets, weight and reps. Athlete logs weight and reps only. Weight step comes from the exercise record (2.5, 1.25, 2 kg; bodyweight exercises have no weight).
- **Clinical data:** only the medic sees diagnosis and mechanism. Every other role sees status and restrictions only.
- **Flag thresholds are club-owned**, with who set them and when. No metric is high priority by default.
- **Readiness:** shown to athletes as the wellness average out of 5 until the 0 to 100 formula is documented.

## Open against code: the data questions

Collected from every approved board. Claude Code answers these in its "report before building" step.

### Security (do first)

1. **RESOLVED.** §0ae: the last-admin guard is client-only. A sport scientist can delete their own role at the database. A trigger is needed. → Migrations 0101 (last admin) and 0102 (no self-grant of medic), live on production 11 Sept.
2. Is the role gate on availability **reasons** enforced by RLS?

### Flags and thresholds

3. What makes a flag "above a threshold"? Are thresholds stored per club, with owner and date?
4. Is an open flag one per athlete, or one per athlete per metric per day?
5. When does a flag close?
6. Do flag counts and the availability denominator recompute server side when a group filter is applied?

### Availability

7. Is an unavailability reason marked clinical or non-clinical? ("Academic" is a reason, not medical detail.)
8. What is the denominator when an athlete has no status? One agreed word for it ("Not set" vs "not recorded").
9. Who can change an athlete's availability status?

### Entries and corrections

10. **RESOLVED.** Can an RPE task appear before its session ends? (`compliance.ts`) → No: `lib/rpeDue.ts` states the rule once (thirty minutes after the session ends, gone at the end of the following day) and both Today and the RPE screen read it. Built in 02.
11. A per-session **has_revisions** flag for the "Corrected" marker in history.
12. Session totals after a correction: stored or derived? If stored, recompute on revise.
13. Nutrition: a revisable flag so a spent correction shows as a state, not an `entry_not_revisable` error.
14. Is the name of the staff member who corrected an entry visible to the athlete under RLS?

### Time and periods

15. One week boundary (Monday, club-local) shared by RPE "this week" and the nutrition check-in.
16. The date of the athlete's last entry per domain, regardless of the selected period.
17. Does the dashboard week strip start Monday club-local or roll from today?
18. How far ahead is a fixture "in range"? (Design assumes 14 days.)
19. Are programme blocks stored with dates? (Otherwise "up 5 kg since 18 Aug".)

### Metrics

20. The 0 to 100 readiness formula, weighting and window.
21. The usual-range band: statistic, window and minimum number of entries.
22. Personal bests: "best before today" per exercise, with date.
23. Tests: distinguish "never assigned" from "assigned but no result".

### Gym and offline

24. Queued offline sets must send on reconnect, not only on a visit to Today.
25. Exercise record fields: weight step, unit, and whether a weight exists.

### Open product decisions (Isabella)

26. RPE is stored 1 to 10. The standard session-RPE scale (CR-10) is 0 to 10. Decide before real data.
27. **RESOLVED 2026-09-12.** Which staff roles see body mass (confirmed: medic, S&C, nutritionist; coach undecided). → The coach does **not** see body mass — the profile section as well as its buttons. Queued on the builder as STAFF-SS-02-05 C9 (the rule covers the whole section).

## Where things live

- Approved designs: `docs/designs/<flow>-final/` (board export, `notes.md`, Claude Code prompt).
- The plan and its status: **Fydr - Design Plan to Pilot** in the project.
