> **This file is not the specification.**
>
> It predates the build specification written on 4 September 2026 and is kept for
> its reasoning, not its instructions. Parts of it describe behaviour that has
> since been deliberately changed, and following it would rebuild things that were
> removed on purpose.
>
> **The binding specification for this screen is in `docs/screens/`, in the
> numbered files.** See `docs/screens/legacy/README.md` for how the two relate.

# Screen: Reports

> **Layout status**: provisional. Awaiting client design photographs.

Screen 28 in the inventory (`02-information-architecture.md` §5). Reached from
`More → Reports`. The whiteboard drew `Reports` as a top-level destination and, separately,
`Left / right reports` hanging off the Testing branch. Per the interpretation note in
`02-information-architecture.md` §1, "left/right reports" is horizontal swipe navigation
between report views within a domain, and it is specified here.

---

## Purpose

Turn the data into a formatted, shareable, scheduled document.

Analytics answers a question interactively. A report answers the same question the same way
every week, in a shape a coach can hand to a head coach, a physio can hand to a doctor, and a
club secretary can attach to an email. Four jobs:

1. **Five report types** covering the recurring questions: athlete report, squad weekly report,
   compliance report, injury and availability report, testing report.
2. **Horizontal swipe between views within a domain**, per the drawing, so a coach moves
   between the pages of a report without returning to a menu.
3. **Export to PDF, CSV and XLSX**, with provenance preserved in every format.
4. **Scheduled delivery**, so the Monday morning squad report arrives without anybody
   remembering to generate it.

**What this screen is not.** It is not `analytics.md`, which is exploratory and statistically
guarded. It is not `exports.md`, which is bulk data extraction for migration, GDPR and external
analysis. A report is a formatted document for a human reader; an export is a file of rows for
a machine or a spreadsheet.

The three overlap at the edges and the division is: **Analytics builds the question, Reports
formats the answer on a schedule, Exports ships the raw rows.**

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | All five report types at squad and athlete level. Create, run, schedule, export. Injury report at availability level only |
| Medical / Physio | All five, plus the clinical version of the injury report. Medical reports are never delivered to a coach distribution list |
| Athlete | Own athlete report only, from `my-data.md`. Per the permission matrix, `Generate reports` is `S` for athletes. No squad reports of any kind |
| Admin | Aggregate compliance and usage only, per the matrix `A`. Named athlete data is not in an admin's report set |

Every report run writes to `audit_log`, per `04-data-model.md` §13, because a report is a data
disclosure that leaves the system.

---

## Entry points

| From | Lands on | Context carried |
|---|---|---|
| `More → Reports` | Report library | Group filter, period |
| `athlete-profile.md`, "Generate report" | Athlete report for that athlete, current period | `athlete_id`, period |
| `squad-status.md`, "Weekly report" | Squad weekly report for the current week | Week, group filter |
| `injury-dashboard.md`, "Availability report" | Injury and availability report | Group filter, period |
| `testing.md`, a completed session, "View results" then swipe | Testing report, session view | `session_id` |
| `analytics.md`, "Add to report" | New report from that saved view definition | `saved_view_id` |
| Scheduled delivery email or push | That report run, rendered | `report_run_id` |
| Deep link `fydr://reports/run/<id>` | That run | `report_run_id` |

---

## Layout

### Web, 1280 pt design target

Library, then a report with a horizontal pager.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Fydr  [Group filter: All squad ▾]  [Period: This week ▾]                     Alex R  ▾   │
├────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Dashboard  │  Reports                                    [Schedules (3)]  [+ New report] │
│ ...        │                                                                             │
│ More       │  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐│
│  ▸ Analyt  │  │ Athlete report       │ │ Squad weekly         │ │ Compliance           ││
│  ▸ Reports │  │ One athlete, every   │ │ The week in one      │ │ Who is submitting,   ││
│  ▸ Leader  │  │ domain, one period   │ │ document             │ │ and who is not       ││
│            │  │ 4 pages              │ │ 5 pages              │ │ 3 pages              ││
│            │  │ [Run] [Schedule]     │ │ [Run] [Schedule] ⏱   │ │ [Run] [Schedule] ⏱   ││
│            │  └──────────────────────┘ └──────────────────────┘ └──────────────────────┘│
│            │  ┌──────────────────────┐ ┌──────────────────────┐                          │
│            │  │ Injury & availability│ │ Testing              │                          │
│            │  │ Who is out, for how  │ │ A testing session or │                          │
│            │  │ long, and the burden │ │ a test over time     │                          │
│            │  │ 3 pages · 4 medical  │ │ 4 pages              │                          │
│            │  │ [Run] [Schedule]     │ │ [Run] [Schedule]     │                          │
│            │  └──────────────────────┘ └──────────────────────┘                          │
│            │                                                                             │
│            │  Recent runs                                                                │
│            │  Squad weekly · week of 28 Jul · run 4 Aug 09:00 · scheduled  [Open] [PDF]  │
│            │  Athlete report · J. Okafor · 28 days to 1 Aug · run 1 Aug   [Open] [PDF]  │
│            │  Compliance · July · run 1 Aug 09:00 · scheduled              [Open] [XLSX] │
└────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

A report open, with the pager:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Squad weekly report · week of 3 Aug 2026 · Forwards          [Export ▾] [Schedule] [⋯] │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  ◄  ● ○ ○ ○ ○   1 of 5 · Overview                                                     ►  │
│     Overview │ Wellness │ Load │ Gym & testing   │ Availability                          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   Week of 3 to 9 August 2026 · MD-5 to MD+1 · v Harlequins (H), Sat 8 Aug                │
│   Forwards · 18 athletes                                                                 │
│                                                                                          │
│   ┌────────────────┬────────────────┬────────────────┬────────────────┐                 │
│   │ Compliance     │ Readiness      │ Weekly load    │ Available      │                 │
│   │ 87%            │ 71             │ 2,410 AU       │ 15 of 18       │                 │
│   │ ▲ 4 pts        │ ▼ 3            │ ▲ 8%           │ ▼ 1            │                 │
│   │ vs prev week   │ squad median   │ squad mean     │                │                 │
│   └────────────────┴────────────────┴────────────────┴────────────────┘                 │
│                                                                                          │
│   Needing attention this week                                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐│
│   │ T. Bennett    readiness 54, 1.8 SD below his 28-day norm, 3 days running   [high]  ││
│   │ M. Price      gym adherence 41%, 3 of 8 sessions logged                    [med]   ││
│   │ D. Rahman     wellness missing 4 of 7 days, compliance 43%                 [med]   ││
│   └────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                          │
│   Load by MD-n, planned against actual                                                   │
│   700┤        ▓░                                                                         │
│      │   ▓░   ▓░   ▓░                                                                    │
│   350┤   ▓░   ▓░   ▓░   ▓░   ▓░        ▓░       ▓ actual   ░ planned                     │
│      │   ▓░   ▓░   ▓░   ▓░   ▓░   ▓▓   ▓░                                                │
│     0└──MD-5─MD-4─MD-3─MD-2─MD-1──MD──MD+1                                               │
│                                                                                          │
│   n = 18 athletes · 3 to 9 Aug 2026 · 109 of 126 entries · Sources: self-report 96%,     │
│   staff entered 4% · Generated 10 Aug 2026 09:00 by scheduled delivery                   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile, 390 pt

The pager is the primary interaction on mobile, which is where the "left/right reports"
instruction actually lives: swipe.

```
┌─────────────────────────────┐
│ ← Squad weekly       [⋯]    │
│ Week of 3 Aug · Forwards    │
├─────────────────────────────┤
│  ● ○ ○ ○ ○     Overview     │
├─────────────────────────────┤
│ ┌───────────┬─────────────┐ │
│ │Compliance │ Readiness   │ │
│ │ 87%  ▲4   │ 71   ▼3     │ │
│ ├───────────┼─────────────┤ │
│ │Weekly load│ Available   │ │
│ │2410  ▲8%  │ 15 of 18 ▼1 │ │
│ └───────────┴─────────────┘ │
│                             │
│ Needing attention           │
│ ┌─────────────────────────┐ │
│ │ T. Bennett       [high] │ │
│ │ readiness 54, 1.8 SD    │ │
│ │ below norm, 3 days      │ │
│ ├─────────────────────────┤ │
│ │ M. Price          [med] │ │
│ │ gym adherence 41%       │ │
│ ├─────────────────────────┤ │
│ │ D. Rahman         [med] │ │
│ │ wellness 3 of 7 days    │ │
│ └─────────────────────────┘ │
│                             │
│ Load by MD-n                │
│ ▁▃▅▆▄▂▃                     │
│                             │
│ n = 18 · 3 to 9 Aug ·       │
│ 109 of 126 entries          │
├─────────────────────────────┤
│   swipe for Wellness  →     │
└─────────────────────────────┘
```

Swipe left and right moves between pages. The dot indicator and the page name are always
visible. Vertical scroll within a page, horizontal swipe between pages, and the gesture handler
resolves the axis on the first 10 pt of movement so a diagonal drag does not fight the reader.

---

## The five reports

Each is a fixed sequence of pages. The pages are the pager positions, and the swipe moves
between them.

### 1. Athlete report

**Question**: how is this athlete, across everything, over this period?

| Page | Contents |
|---|---|
| 1. Summary | Identity, position, availability, groups. Compliance ring. Readiness against personal baseline. Current programmes. Open flags. Key changes since the previous period |
| 2. Wellness and recovery | Readiness line with the athlete's own baseline band. Component sliders as small multiples: sleep, fatigue, soreness, stress, mood. Sleep hours with source split. Body mass if recorded |
| 3. Load | Session load by day with MD-n markers. Acute, chronic and ACWR with the 21-of-28-day guard. GPS totals if the tier allows. Attendance |
| 4. Gym and testing | Programme adherence with tailoring listed. Volume by exercise category. Latest test results against PB and squad percentile. **No nutrition section**: nothing is logged, so there is nothing to report against target (`nutrition-guidance.md`). The athlete's current targets are reference content on their Programme tab, not a report page. |

Athlete-visible version: identical minus flags that are unacknowledged, minus squad percentile,
minus staff notes. Per `01-roles-and-permissions.md` §3 carve-out 2, an unacknowledged flag is
not visible to the athlete, and a report is not a way round that rule.

### 2. Squad weekly report

**Question**: what happened this week and who needs attention?

| Page | Contents |
|---|---|
| 1. Overview | Four headline tiles with week-on-week change. "Needing attention" list, ranked by severity. Load by MD-n, planned against actual |
| 2. Wellness | Squad median readiness with interquartile band. Athletes more than 1.5 SD below their own norm, named. Component breakdown. Compliance by day |
| 3. Load | Weekly load per athlete, sorted. ACWR distribution with the 0.8 and 1.5 reference lines. Monotony and strain. Session-by-session summary |
| 4. Gym and testing | Gym adherence by athlete. Volume by category. Test results moved this week. **No nutrition section**, for the reason given under the athlete report above |
| 5. Availability | Availability board. Changes this week. Days lost. Return-to-play dates. Rehab group allocation |

The fixture context is on every page header: which fixture the week ran to, the result if
played, and the MD-n span.

### 3. Compliance report

**Question**: who is submitting what, and who is not?

| Page | Contents |
|---|---|
| 1. Summary | Overall rate, by domain, with the trend over the last 8 weeks. Expected against submitted, with waivers separated |
| 2. By athlete | Sorted table, worst first. Per domain columns. Streak of consecutive missed days. Last submission date |
| 3. By day and domain | Heatmap, athletes down, days across. Domain selector. Waived cells shown distinctly from missed cells |

The denominator is `compliance_expectations`, never a flat expectation. Waivers are excluded
from both numerator and denominator and are reported separately with their reasons, so a coach
can see the difference between "did not submit" and "was not asked".

**As built**: the window is `?period=` (`week`, `month`, `season`, `year`, `all`; default
`week`), widened from the old `?days=` chip row's 7/14/28. It composes with the separate
`?to=` day anchor. See "The period control, as built" below.

### 4. Injury and availability report

**Question**: who is out, for how long, and what is it costing?

| Page | Coach version | Medical version |
|---|---|---|
| 1. Current | Availability board, restrictions, expected return dates | Same, plus severity and phase |
| 2. Period summary | New injuries as a count, days lost, availability percentage, incidence per 1000 hours | Plus body area, mechanism, tissue type, recurrence |
| 3. Burden | Days lost by week, availability trend, sessions missed | Plus time-loss by diagnosis category and by mechanism |
| 4 to 7. Clinical | Not available | Injury detail per athlete, treatment record, rehabilitation progress, return-to-play milestones |

**The coach version and the medical version are two different report definitions**, not one
report with hidden fields. They are generated by different queries against different tables,
per `01-roles-and-permissions.md` §4: clinical fields live in `injury_clinical` with a distinct
RLS policy, and the coach report's query has no join to it. A single report with column
filtering in the rendering layer is one careless change away from a breach.

Medical reports carry a visible "Medical in confidence" banner on every page and in the PDF
header and footer, and their file name states it.

### 5. Testing report

**Question**: what did the testing session show, and how has this test moved?

| Page | Contents |
|---|---|
| 1. Session summary | Battery, date, participation, completion. Squad distribution per test with median and quartiles |
| 2. By athlete | Every athlete, every test in the battery, best attempt, change against previous, PB marker |
| 3. By test | One test in depth: distribution, ranking, change distribution, asymmetry where the test is per-side |
| 4. Longitudinal | Squad median per test over the season, with each testing date marked. Individual trajectories on request |

This is the report the "left / right reports" annotation was drawn against, so the pager is the
primary navigation and the pages are ordered from the most-asked question to the least.

**As built**: the window is `?period=` (`month`, `season`, `year`, `all`; default `season`).
Before this it had **no window at all** — no `days`, no `from`, no `todayIso` anywhere in the
route, and all three queries dateless — so page 4's longitudinal series plotted the club's
entire history and page 2's "best attempt" was an all-time read. Page 2's heading and the
export captions now name the window rather than saying "personal best". See "The period
control, as built" below. `lib/queries/testingReport.ts`'s header, which used to claim there
was no `seasons` table to bound against, was already corrected before this pass and is
corrected again for the unboundedness itself.

---

## The period control, as built

`PeriodSelector` (`src/components/PeriodSelector/PeriodSelector.tsx`, wrapping
`ReportSelectNav`) is live on the **athlete report**, the **injury and availability report**,
the **compliance report** and the **testing report**. It writes `?period=<key>`, one of the
six `RangeKey`s in `src/lib/period.ts` (`day | week | month | season | year | all`), and it
replaced a hand-rolled chip row on each screen that wrote `?days=<n>` from a per-screen
allow-list — except on the testing report, which had no window control and no window at all.

Each report resolves the period once, in a module colocated with its routes
(`reports/injuries/period.ts`, `reports/athlete/[athleteId]/period.ts`,
`reports/compliance/period.ts`, `reports/testing/period.ts`), which the page, the CSV export
and the PDF all import. That is the point of it: `?days=` was duplicated across nine files,
and a page that started writing `?period=season` while its own PDF handler still read
`?days=` would have produced a document silently covering 28 days.

The compliance and testing modules take their four resolution steps (read the param, look up
the season, clamp server-side, resolve the range) from `src/lib/reportPeriod.server.ts`
rather than spelling them out again — by the fourth report the steps were plainly identical
and only the allow-list, the fallback and the anchors differed. The injuries and athlete
modules still spell them out inline; they are correct, their public shape would not change,
and moving them is a separate pass.

**The compliance report is the worked example of why the three surfaces must share a
module.** It carried the allow-list three times: `PERIODS = [7, 14, 28]` in `page.tsx`, the
same constant in `pdf/route.tsx`, and — in `export/route.ts` — the array *inlined as a
literal*, `[7, 14, 28].includes(…)`, with no constant to grep for. That inline copy and
`injuries/export/route.ts` are the two of the nine files a `PERIODS` search does not find, so
a migration trusting such a grep would have left this report's CSV falling back to seven days
while the screen showed a season.

**Legacy `?days=` bookmarks still render.** `readPeriodParam` translates them, widening
rather than narrowing when there is no exact key (`?days=90` and `?days=180` both become
`year`), and the screen prints a caption saying it approximated rather than substituting
silently.

### Which keys each report offers, and why

| Report | Offered | Disabled, with the reason shown in the option label |
|---|---|---|
| Athlete report | `week`, `month`, `season`, `year`, `all` | `day` — readiness is drawn against the athlete's own 14-day rolling band, and one day is one point with no band to read it against |
| Injury and availability | `month`, `season`, `year`, `all` | `day`, `week` — days lost and availability % are inherently multi-week, and burden is bucketed by week, so a seven-day injury report is a chart of the control rather than of the squad |
| Compliance | `week`, `month`, `season`, `year`, `all` | `day` — a one-day compliance percentage is just "did they submit today", which is `/dashboard`'s job and which it answers with names rather than a rate |
| Testing | `month`, `season`, `year`, `all` | `day`, `week` — testing is *episodic*; a seven-day window on a test battery is usually a single session, which is `/testing/[testDefId]`, and the squad-median trend degenerates to one point |

**Defaults are per report and are not all `DEFAULT_RANGE`.** Compliance defaults to `week`,
the 7 days its old chip row defaulted to: widening the window is the coach's call, and
silently quadrupling it during a migration would change what every bookmark-free open shows.
Testing defaults to **`season`**, deliberately wider than `DEFAULT_RANGE`'s 28 days, because
28 days is under most clubs' retest interval and a `month` default would open that report
empty for a squad that tests every six weeks. A club with no season row falls back to `year`
there, not `month`, for the same reason. (`season` is also the window `fetchCurrentSeason`
was added to the codebase for — its own header names "the testing report's season's best
tile".)

Illegal keys are **disabled with the reason, never hidden** (the rule `analytics.md` already
sets). `season` is the one exception and a different fact: when the org has no current season
row it is **absent**, because that is true of the organisation on every screen and there is
nothing a coach can act on from inside a period control. Both are also coerced server-side
(`clampPeriod`), because the control alone does not stop a hand-typed URL.

### What the period does not reach

**ACWR is pinned to trailing 7:28 on the athlete report, whatever the period says.** The
ratio is *defined* as a trailing 7-day acute load over a trailing 28-day chronic load
(`ACWR_ACUTE_WINDOW_DAYS` / `ACWR_CHRONIC_WINDOW_DAYS`, `src/lib/acwr.ts`); there is no
season-long or all-time ACWR to show. `fetchAthleteReport` derives both window starts from
today alone and never from the period's `from`, and the three load tiles carry their fixed
windows in their own labels plus a caption spelling it out — on the page, in the PDF, and as
a comment line in the CSV. Everything else on that tab (GPS totals, session load by day) is
genuinely period-scoped and is captioned "this period".

**The injury report's Current tab is not windowed either.** `fetchNotFullyAvailable` answers
"who cannot train today" from the live availability row with no date bound anywhere in it,
which is exactly what stops a longer period from appearing to change who is injured — an
athlete whose injury started before `from` is still unavailable and still listed. Only the
period summary and burden figures are windowed, and all three surfaces say so. Date-bounding
that list would hide genuinely unavailable people, the same false-reassurance class as the
group-filter case the empty state already guards against.

**The compliance report's `?to=` day anchor is a second, orthogonal control and stays one.**
`?to=` picks which day the window ends on; `?period=` picks how far back from it. They
compose and neither resets the other. The anchor still defaults to the most recent day the
org actually has expectations for rather than real today (audit finding 14), and — this is
the part that would silently reintroduce that bug — the period is resolved *against the
anchor*, not against `todayIso(timezone)`. Resolving against the wall clock while querying
against the anchor would end the window on a day with no data and put "0 of 0" back one layer
down.

**"Personal best" on the testing report is now "best in the window".** Bounding that report
changes what its grid means, so the copy changed with it: the heading reads "Best per test —
*this season*" and names the dates, on the page, in the PDF and in the CSV caption. At
`?period=all` it reads "All on record", which is the old, unbounded behaviour said out loud.
The empty states changed for the same reason — "no result recorded for this test **yet**" was
true of an all-time read and is a lie about a bounded one, so they now name the window and
point at the widest one available.

### Widening multiplies rows

Every query on all four reports whose window can now grow pages through `fetchAllPaged`
(`src/lib/queries/paged.ts`) with a total order ending in `id`. PostgREST caps an
unpaginated read at 1000 rows and does not error. Two reads on the athlete report were
replaced outright rather than paged in place: the squad-wide compliance report it used to
call for one athlete's percentage, and the org-wide session fan-out with its hard 200-row
slice. Both replacements live at the foot of `src/lib/queries/athleteReport.ts`.

One fix fell out of this: the athlete report's load query was bounded to the ACWR window
while its day list was built over the whole period, so `?days=90` already rendered 62
permanently-empty days and exported 62 empty CSV rows. The read now spans whichever window is
longer and ACWR takes its 28-day slice out of the result.

Availability % on the injury report is measured against **today's** squad, so over a season
or longer it counts days for athletes who joined part-way through. The page says so once the
window passes 90 days.

**Compliance was the most exposed read in the tree and was never paged.** Its four
window-scaled queries — `compliance_expectations` plus the three submission sources
(`wellness_entries_current`, `training_entries_current`, `gym_session_logs`) — all now page.
The expectations read is `athletes × days × domains`: a 40-athlete squad with three domains
is 120 rows a day, over the 1000-row ceiling before the **ninth** day and roughly 44,000 rows
over a season. Truncating the three submission reads without truncating the denominator does
not merely lose rows, it *invents non-compliance*. `fetchComplianceReport` is also called by
the athlete and squad-weekly reports, so both got the fix for free.

**The testing report's three reads were unbounded from the start**, which is the defect this
pass exists to close rather than a consequence of it. `fetchTestingByAthlete`,
`fetchTestByTest` and `fetchTestLongitudinal` took no dates at all, and the longitudinal one
simply `.order('test_date')` — so "squad median over time" plotted every result the club had
ever recorded (a squad three seasons deep saw a trend dominated by athletes who have left)
and, past 1000 rows, was truncated at an arbitrary date with no error. All three now take the
resolved window and page. Two of them also had their group scope moved *into* the query from
a post-filter, which is wrong the moment a read is paged: the 1000-row ceiling would be spent
on out-of-scope athletes and the in-scope ones silently truncated behind them.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Scopes squad reports. Recorded into the run so an exported file states the filter |
| `PeriodSelector` | §6.8 | Report period. **Built and live** on the athlete, injury, compliance and testing reports — see "The period control, as built" above for the offered keys per report and what the period deliberately does not reach |
| `MetricTile` | §6.2 | Headline tiles |
| `TrendSparkline` | §6.3 | Inline trends in tables |
| `ComplianceRing` | §6.6 | Compliance summary |
| `AvailabilityPill` | §6.5 | Availability board |
| `FlagBadge` | §6.4 | Severity in the attention list |
| `AthleteCard` | §6.1 | Athlete report header, attention list rows |
| `EmptyState` | §6.16 | All kinds |
| `ConfirmSheet` | §6.18 | Delete a schedule, remove a recipient |
| `BottomSheet` | §6.19 | Export format picker, schedule editor on mobile |
| `ReportPager` | New, this screen | The horizontal pager: swipe, dots, page names, keyboard arrows |
| `ReportPage` | New, this screen | One page with its header, body and provenance footer |
| `ReportCard` | New, this screen | Library entry with page count and schedule indicator |
| `ScheduleEditor` | New, this screen | Cadence, time, recipients, format, scope |
| `RunHistoryList` | New, this screen | Previous runs with their parameters and files |
| `ExportMenu` | New, this screen | PDF, CSV, XLSX with the scope and size stated before committing |
| `AttentionList` | New, this screen | Ranked exceptions with the reason in one sentence each |

---

## Data requirements

Reports read the same metric layer as `analytics.md`: `metric_series` and the materialised
views. Nothing on this screen computes a metric a different way, because two definitions of
"weekly load" is how a coach ends up with two numbers and no trust in either.

### Reads

| Field | Source | Transformation |
|---|---|---|
| Report definitions | `saved_views` where `view_type = 'report'` | System reports are org-scoped copies seeded at setup |
| Run history | `report_runs.parameters`, `.file_url`, `.format`, `.created_at`, `.run_by` | Ordered by `created_at` descending |
| Headline metrics | `mv_squad_daily`, `mv_daily_athlete_summary` | Aggregated to the period |
| Compliance | `mv_compliance_rates`, `compliance_expectations` | Waivers separated |
| Load and ACWR | `mv_acute_chronic_load` | ACWR suppressed below 21 of 28 chronic days |
| Wellness baselines | `mv_wellness_baselines` | z-scores suppressed below 10 prior observations |
| Availability | `availability` where `effective_to is null` for current, full history for the period | Event log, so the period view is a reconstruction, not a snapshot |
| Injuries, coach level | `injuries.body_area`, `.onset_date`, `.status`, `.expected_return` | No join to `injury_clinical` |
| Injuries, medical level | `injury_clinical.*` | Medical report definitions only |
| Gym adherence | `mv_programme_adherence` | Defined in `gym-programmes.md` |
| ~~Nutrition~~ | **Not a report source.** `mv_nutrition_daily` aggregates `nutrition_entries`, which is dormant and empty | Do not build the view. See `nutrition-guidance.md` §9 |
| Testing | `test_results` where `is_best` | Direction from `test_definitions.higher_is_better` |
| Fixture context | `fixtures.opponent`, `.kickoff_at`, `.home_away`, `.result` | Header on every page of a weekly report |
| Provenance | `source` on every contributing table | Footer per §8.3 |

### Schema changes required

| Change | Table | Why |
|---|---|---|
| New table `report_schedules` | new | Cadence, recipients, format, scope, next run |
| Add `status`, `error`, `completed_at`, `expires_at`, `byte_size`, `page_count` | `report_runs` | The table has no state and no expiry, and generation is asynchronous |
| Add `schedule_id uuid` | `report_runs` | Link a run to the schedule that produced it |
| Add `report_type text` | `report_runs` | So a run is identifiable without resolving `saved_view_id` |

```sql
create table report_schedules (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id),
  saved_view_id uuid not null references saved_views(id) on delete cascade,
  name          text not null,
  cadence       text not null,               -- 'weekly' | 'fortnightly' | 'monthly' | 'after_fixture'
  day_of_week   int,                         -- 1 = Monday, for weekly
  day_of_month  int,
  send_at_local time not null default '09:00',
  formats       text[] not null default '{pdf}',
  scope         jsonb not null,              -- group ids, athlete ids, period rule
  recipients    jsonb not null,              -- [{type:'user'|'email'|'role', value:'...'}]
  is_active     boolean not null default true,
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  created_by    uuid not null references users(id),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

alter table report_runs
  add column schedule_id  uuid references report_schedules(id) on delete set null,
  add column report_type  text,
  add column status       text not null default 'queued',  -- queued|running|complete|failed|expired
  add column error        text,
  add column completed_at timestamptz,
  add column expires_at   timestamptz,
  add column byte_size    bigint,
  add column page_count   int;

create index on report_runs (org_id, created_at desc);
create index on report_runs (schedule_id, created_at desc);
create index on report_schedules (next_run_at) where is_active and deleted_at is null;
```

### Query: the squad weekly overview page

```sql
with period as (
  select $2::date as from_date, $3::date as to_date
),
population as (
  select a.id as athlete_id
  from athletes a
  where a.org_id = auth_org_id()
    and a.deleted_at is null
    and a.status <> 'left_club'
    and ($1::uuid[] is null or exists (
          select 1 from group_memberships gm
          where gm.athlete_id = a.id and gm.group_id = any($1::uuid[])
            and gm.removed_at is null))
),
compliance as (
  select
    round(100.0 * sum(submitted) / nullif(sum(expected), 0), 0) as pct,
    sum(expected) as expected, sum(submitted) as submitted, sum(waived) as waived
  from mv_compliance_rates c
  join population p on p.athlete_id = c.athlete_id
  cross join period
  where c.day between period.from_date and period.to_date
),
readiness as (
  select
    percentile_cont(0.5) within group (order by d.readiness_score) as median,
    count(*) filter (where d.readiness_score is not null) as n
  from mv_daily_athlete_summary d
  join population p on p.athlete_id = d.athlete_id
  cross join period
  where d.day between period.from_date and period.to_date
),
load as (
  select avg(weekly) as mean_weekly_load, count(*) as n
  from (
    select d.athlete_id, sum(d.session_load) as weekly
    from mv_daily_athlete_summary d
    join population p on p.athlete_id = d.athlete_id
    cross join period
    where d.day between period.from_date and period.to_date
    group by d.athlete_id
  ) x
),
avail as (
  select
    count(*) filter (where av.status = 'available')   as available,
    count(*) filter (where av.status = 'modified')    as modified,
    count(*) filter (where av.status = 'unavailable') as unavailable,
    count(*) as total
  from population p
  left join lateral (
    select status from availability
    where athlete_id = p.athlete_id and effective_to is null
    order by effective_from desc limit 1
  ) av on true
),
attention as (
  select
    f.athlete_id, a.first_name, a.last_name, f.domain, f.metric,
    f.observed_value, f.expected_value, f.severity, f.flag_date
  from flags f
  join population p on p.athlete_id = f.athlete_id
  join athletes a on a.id = f.athlete_id
  cross join period
  where f.org_id = auth_org_id()
    and f.flag_date between period.from_date and period.to_date
    and f.status in ('raised','notified','acknowledged','actioned','monitoring')
  order by
    case f.severity when 'high' then 1 when 'medium' then 2 else 3 end,
    f.flag_date desc
  limit 10
)
select
  (select row_to_json(compliance) from compliance) as compliance,
  (select row_to_json(readiness)  from readiness)  as readiness,
  (select row_to_json(load)       from load)       as load,
  (select row_to_json(avail)      from avail)      as availability,
  (select json_agg(attention)     from attention)  as attention;
```

### Writes

| Action | Write | Audit |
|---|---|---|
| Run a report | Insert `report_runs` with `status = 'queued'` | `report.run` |
| Generation completes | Update `status`, `file_url`, `completed_at`, `byte_size`, `page_count`, `expires_at` | none |
| Export a format | Insert a `report_runs` row per format requested | `report.export` |
| Create a schedule | Insert `report_schedules`, compute `next_run_at` | `report.schedule_create` |
| Edit or pause a schedule | Update | `report.schedule_update` |
| Delete a schedule | Soft delete | `report.schedule_delete` |
| Delivery sent | Insert `notification_deliveries` per `08-notifications.md` §8.4 | `report.delivered` |

Every one of these audit entries carries `athlete_id` when the report is athlete-scoped, and the
group scope in `metadata` when it is squad-scoped, because a subject access request must be able
to answer "what reports included me and who received them".

---

## States

### Default

Report library, five report cards, recent runs below. Scheduled reports carry a ⏱ indicator with
the next run time.

### Loading

Report generation is asynchronous above a threshold. Below it, a report renders inline.

| Condition | Behaviour |
|---|---|
| Athlete report, one athlete, period up to 90 days | Rendered inline, page by page, first page in under 1.5 s |
| Athlete report at `season`, `year` or `all` (capped at `MAX_WINDOW_DAYS`, 730) | Slower by the paging: the load, GPS, gym, compliance and session reads each cross the 1000-row page boundary at that length. Correctness before latency — a short read here is a wrong ACWR, not a slow one |
| Squad report, up to 40 athletes, one week | Rendered inline, first page in under 2 s |
| Anything larger, or any PDF or XLSX export | Queued, generated by an Edge Function, notification when ready |

Inline rendering loads **page 1 first and prefetches page 2**, so the swipe is instant. Pages 3
onward load on demand. A five-page report that blocks on page 5 before showing page 1 is the
obvious wrong implementation.

Queued generation shows the run in the recent list with a progress state and returns the user to
the library. They are notified per `08-notifications.md` when it is ready. The screen does not
hold them on a spinner.

### Empty

| Kind | Trigger | Copy | Action |
|---|---|---|---|
| `notStarted` | No runs yet | "No reports generated yet." | "Run the squad weekly report" |
| `noData` | Period contains no data | "No data for Forwards between 3 and 9 August." | "Change period" |
| `noResults` | Group filter excludes everyone | "No athletes in Academy." | "Clear filter" |
| `allClear` | Attention list is empty | "Nobody needs attention this week. All athletes within thresholds." | none |
| `insufficientData` | A page's chart below its guard | Per-chart, per §8.5. The page renders, the chart does not | none |
| `noPermission` | Coach opening a medical report link | "This report is available to medical staff only." | none |

A report page whose chart is suppressed still renders. The page does not vanish because one
figure lacked data, and the suppression is stated in place so a reader knows something was
omitted rather than absent.

### Error

Per §11.3. A failed page renders its own error and the pager still moves. A failed generation
sets `report_runs.status = 'failed'` with the error, shows "Could not generate the squad weekly
report" in the run list, and offers retry. The correlation ID is behind "Details".

An export that exceeds the size ceiling fails before generation with "This export covers 60
athletes over 2 years and would be about 240 MB. Narrow the scope, or use Exports for a raw data
extract." routing the user to `exports.md`, which is built for that.

### Offline

The library and recent runs render from cache. Already-downloaded PDFs are readable offline.
Generation is disabled with the standard copy. Inline rendering of a cached report run is
permitted and states its generation time prominently, because a week-old report read as if it
were current is worse than no report.

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | Five reports, coach version of the injury report, squad and athlete scope |
| Medical | Same, plus the medical injury report with its clinical pages and the confidence banner. Medical reports cannot be added to a schedule whose recipients include a non-medical user, and the editor refuses with the reason |
| Athlete | Own athlete report only, from `my-data.md`. Athlete-visible variant as specified. No scheduling |
| Admin | Compliance report at aggregate level: rates by group and domain, no athlete names. Usage statistics. Delivered as its own definition, not a filtered version of the coach report |

---

## Interactions

### The pager

The "left / right reports" instruction, made concrete.

| Input | Action |
|---|---|
| Swipe left / right | Next / previous page |
| `←` / `→` on web | Same |
| Tap a dot | Jump to that page |
| Tap a page name in the strip | Jump |
| Swipe past the last page | Rubber-band, no wrap. Wrapping from page 5 to page 1 disorients |
| Pull down on page 1 | Refresh the whole report |

Page state is preserved when navigating away and back. Deep links address a page:
`fydr://reports/run/<id>?page=3`.

Vertical scroll position is preserved per page, so returning to page 2 lands where the reader
left it.

### Scoping a run

Before running, the scope panel states exactly what will be included:

```
Squad weekly report

Population   Forwards · 18 athletes         [Change]
Period       Week of 3 Aug 2026 · MD-5 to MD+1 · v Harlequins (H)   [Change]
Pages        5
Includes     Named athletes, wellness, load, gym, testing, availability
Excludes     Clinical injury detail (coaching version)

                                        [Cancel]  [Run report]
```

The Includes and Excludes lines are not decoration. A coach forwarding a report needs to know
what is in it before they send it, and stating the exclusions makes the clinical boundary
visible rather than implicit.

### Export

`[Export ▾]` offers PDF, CSV and XLSX. Each states what it produces:

| Format | Produces | Use |
|---|---|---|
| PDF | The report exactly as rendered, paginated, with the provenance footer on every page and a cover page carrying scope, period, generation time and generator | Sending to someone |
| CSV | One file per report page that has tabular content, zipped when more than one. Charts are omitted; their underlying data is included as a table | Loading into a spreadsheet |
| XLSX | One workbook, one sheet per page, with formatting, a metadata sheet carrying scope and provenance, and charts rendered as native Excel charts where the shape allows | Working with the numbers |

Rules that hold in every format:

1. **Provenance travels.** n, window, coverage and sources appear on every PDF page, in the CSV
   as a header block, and in the XLSX metadata sheet. A number that leaves Fydr without its
   sample size is a number that will be misquoted.
2. **The group filter is stated.** A report of the forwards that does not say so will be read as
   the squad.
3. **Suppressed statistics stay suppressed.** A correlation below its guard is not "unlocked" by
   exporting to CSV. The CSV contains the component series and a note, exactly as the screen
   does.
4. **Medical exports are watermarked** "Medical in confidence" and the file name carries it.
5. **Every export is audited**, per `04-data-model.md` §13, with format, scope and recipient
   where delivery is involved.
6. **Files expire.** `report_runs.expires_at` defaults to 30 days, configurable per
   organisation, after which the file is deleted from storage and the run row is retained with
   `status = 'expired'`. Signed URLs are short-lived, per `09-security-and-compliance.md` §8.3.

### Scheduling

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Schedule: Squad weekly report                                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│ When      (•) Weekly on [ Monday ▾ ] at [ 09:00 ] Europe/London                │
│           ( ) Fortnightly   ( ) Monthly on day [  ]                            │
│           ( ) After every fixture, [ 2 ] days later                            │
│                                                                                │
│ Period    (•) The week just ended    ( ) Last 28 days    ( ) Since last run    │
│                                                                                │
│ Scope     Group [ Forwards ▾ ]   [ ] Also send a whole-squad version           │
│                                                                                │
│ Format    [x] PDF   [ ] CSV   [ ] XLSX                                         │
│                                                                                │
│ Send to   [x] Alex Rowe (coach)          [x] Sam Rees (coach)                  │
│           [ ] Dr Nia Hughes (medical)                                          │
│           [x] head.coach@club.example  (external)  ⚠ outside the organisation  │
│           [+ Add recipient]                                                    │
│                                                                                │
│ Delivery  (•) Link in an email, sign-in required                               │
│           ( ) PDF attached to the email       ⚠ see note                       │
│                                                                                │
│  ⚠ Attaching a PDF sends athlete data outside Fydr's access controls. Anyone   │
│    who receives or forwards the email can read it. A link requires sign-in.    │
│                                                                                │
│                                                     [Cancel]  [Save schedule]  │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Link by default, attachment by exception.** A PDF of a squad's wellness data in an email
inbox is outside every access control the product has. The link option requires sign-in and
respects the recipient's role, so a medical report link opened by a coach resolves to
`noPermission` rather than rendering. Attachments are available because a head coach who does
not use the product will not sign in, and refusing outright means the coach exports manually
and emails it anyway, which is the same exposure with no audit trail. The warning is
non-dismissible and the choice is recorded in the audit log.

**External recipients** are flagged. An email address that is not a `users` row in the
organisation gets a warning and, for medical reports, is refused outright.

**Cadence options** include "after every fixture", which is the one the schedule spine makes
natural: a report two days after each match, generated from that fixture's week. It computes
`next_run_at` from `fixtures.kickoff_at` and recomputes on postponement.

Scheduled runs are executed by a `pg_cron` job, `dispatch_scheduled_reports`, running every 15
minutes and picking up `report_schedules` whose `next_run_at` has passed, in the organisation's
timezone. It calls an Edge Function that generates the file, writes `report_runs`, and enqueues
the notification. This follows the pattern in `05-architecture.md` §7.

### Delivery notification

Per `08-notifications.md`, a completed report produces:

- **Push** to staff recipients: "Squad weekly report for 3 to 9 August is ready." Deep link to
  the run.
- **Email** with the link or attachment as configured, using the templates in §9.2 of that
  document.
- **No notification to athletes** when a squad report runs, and no notification at all for an
  athlete report generated by staff. An athlete learning that a report was written about them
  through a push notification is not the conversation the coach intended to have.

---

## Validation rules

| Rule | Severity | Message |
|---|---|---|
| Report definition selects at least one page | Block | "A report needs at least one page." |
| Period 1 to 730 days | Block | "The period must be between 1 day and 2 years." |
| Custom period `to` after `from` | Block | "The end date must be after the start date." |
| Population resolves to at least 1 athlete | Block | "No athletes in this population." |
| Athlete report requires exactly one athlete | Block | "Pick one athlete." |
| Estimated output above the size ceiling | Block, with a route | "About 240 MB. Narrow the scope, or use Exports." |
| Schedule requires at least one recipient | Block | "Add at least one recipient." |
| Schedule requires at least one format | Block | "Pick at least one format." |
| Medical report with a non-medical recipient | Block | "This report contains clinical detail and can only be sent to medical staff." |
| Medical report with an external recipient | Block | "Clinical reports cannot be sent outside the organisation from here." |
| External recipient on any report | Warn, non-dismissible, audited | "head.coach@club.example is outside your organisation." |
| Attachment delivery selected | Warn, non-dismissible, audited | The exposure note above |
| `send_at_local` inside the organisation's quiet hours | Warn | "09:00 is inside quiet hours. Delivery will be held until 07:00." |
| Weekly cadence with no `day_of_week` | Block | "Pick a day." |
| "After every fixture" with no fixtures scheduled | Warn | "No fixtures are scheduled. This will not run until one is." |
| Schedule name unique per org | Block | "A schedule with that name already exists." |
| Recipient is a deactivated user | Block | "Sam Rees's account is deactivated." |

---

## Edge cases

1. **A week with no fixture.** The weekly report's MD-n header falls back to training-week
   position, per `03-flows.md` §8, and the load-by-MD-n chart is replaced by load-by-weekday
   with a note. The report does not fail.
2. **Two fixtures in one week.** Both are named in the header. The MD-n chart uses the stored
   `sessions.md_offset`, which handles the double labelling.
3. **A fixture postponed after a scheduled report ran.** The run is a historical document and is
   not regenerated. Future runs use the recomputed labels. The run's cover page states the
   generation time, which is how a reader reconciles the two.
4. **An athlete who leaves the club mid-period.** Included in the period's data up to their
   leave date, excluded from current-state pages, and named in the exclusion note: "1 athlete
   left the club during this period."
5. **An athlete who joins mid-period.** Included, with coverage reflecting their partial period.
6. **An athlete who objects to a domain** under Article 21. Their data in that domain is
   excluded from squad reports, their expectations are waived, and the exclusion is counted in
   the footnote without naming them or the domain, because the report may be forwarded.
7. **A report scheduled to a recipient who loses the role that grants access.** The link
   resolves to `noPermission` for them. The schedule flags the recipient at the next run and
   notifies the schedule's owner: "Sam Rees no longer has access to this report."
8. **A schedule whose saved view is deleted.** The schedule is paused, not deleted, and the
   owner is notified. Silently continuing against a missing definition, or silently deleting the
   schedule, are both worse.
9. **Generation that exceeds the Edge Function timeout.** The run is chunked page by page, each
   page a separate invocation writing into a partial file, and the run completes when the last
   page lands. A single 5-page report is not one long-running function.
10. **Two identical scheduled runs firing after a job backlog.** `report_runs` is deduplicated on
    `(schedule_id, period_from, period_to)` so a replayed job does not produce two files and two
    emails.
11. **A report run whose file has expired.** The run row remains with `status = 'expired'` and
    the UI offers "Regenerate", which produces a new run with the same parameters. The
    regenerated figures may differ if data changed, and the run states both timestamps.
12. **A CSV export of a page containing a suppressed statistic.** The CSV includes a row
    `correlation,suppressed,n=9,minimum=20` rather than an empty cell, so the absence is
    explicit in the data as well as on the screen.
13. **XLSX export of a report with more than 31 characters in a page name.** Sheet names are
    truncated with a numeric suffix and the full name is in the metadata sheet, because Excel's
    limit is 31 characters and a silent collision loses a sheet.
14. **A medical report opened by a coach through a forwarded link.** RLS refuses the underlying
    query, the screen renders `noPermission`, and the access attempt is logged. The forwarded
    link is not a leak.
15. **An organisation in a timezone where 09:00 local crosses a UTC day boundary.** Schedules
    store local time and the dispatcher resolves against `organisations.timezone`, per
    `CLAUDE.md` rule 5.

---

## Performance notes

| Path | Budget |
|---|---|
| Report library | 200 ms p95 server |
| First page of an inline squad report, 40 athletes, 1 week | 2 s p95 |
| Page transition, prefetched | 100 ms p95 |
| Queued PDF generation, 5 pages, 40 athletes | 20 s p95, 60 s hard ceiling |
| XLSX generation, same | 30 s p95 |

Rules:

1. **Reports read materialised views**, never raw entry tables for multi-athlete aggregates. The
   same rule as `analytics.md` and for the same reason.
2. **One query per page**, not one per component. A page with four tiles and two charts is one
   round trip returning a JSON document, as in the overview query above.
3. **Page 1 renders, page 2 prefetches.** Pages 3 onward are lazy. Prefetch is cancelled on
   navigation away.
4. **Generation runs server-side.** The PDF is produced by an Edge Function using the same React
   components rendered to static markup, not by a client-side print stylesheet, so a scheduled
   report and an interactive one are the same document.
5. **Chunked generation** page by page, with a partial file assembled in storage, so no single
   invocation approaches the function timeout.
6. **Query keys**: `qk.reports.library(orgId)`, `qk.reports.run(orgId, runId)`,
   `qk.reports.page(orgId, runId, pageIndex)`, `qk.reports.schedules(orgId)`,
   `qk.reports.history(orgId, reportType)`.
7. **Freshness**: a completed run is immutable, so `staleTime` is `Infinity` and `gcTime` 24
   hours. The library is 5 minutes. Immutable runs are the easiest cache in the product and
   should be treated as such.
8. **Files live in Supabase Storage** with signed URLs, short expiry, and a lifecycle rule that
   deletes objects past `report_runs.expires_at`. A storage bucket that accumulates every PDF a
   club ever generated is a compliance liability as well as a cost.
9. **Indexes**: those added above, plus the existing flag and compliance indexes.

---

## Accessibility

1. **The pager is a tab set.** `role="tablist"` with the page names, `role="tabpanel"` per page,
   arrow-key navigation, and the current page announced on change: "Page 2 of 5, Wellness".
   Swipe is an addition to keyboard navigation, never the only way.
2. **Page names are always visible**, not only dots. A dot indicator alone gives a screen reader
   user no idea what page 3 contains.
3. **Every chart** carries the one-sentence summary label and the table alternative, per §8.6.
4. **The provenance footer is part of each page's accessible description**, so a screen reader
   user hears the sample size with the figures.
5. **The attention list** announces severity as text, not colour: "High severity. T. Bennett.
   Readiness 54, 1.8 standard deviations below his 28-day norm, 3 days running."
6. **Tables in reports are real tables** with captions, scoped headers and a summary row
   announced as such.
7. **PDFs are tagged**, with a document title, a logical reading order, table structure and
   alternative text on every chart image. An untagged PDF is unreadable to a screen reader and
   this is the format most likely to be forwarded to somebody outside the club.
8. **XLSX exports carry column headers in the first row** with no merged cells in data ranges,
   because merged cells break screen reader navigation in Excel.
9. **Dynamic type** to 200%. Report pages reflow; tables become stacked rows above 150%.
10. **Reduced motion** removes the page-transition animation. Pages change instantly.
11. **Focus moves to the page heading** on page change, so keyboard users land at the top of the
    new content rather than in the middle of the old.

---

## Open questions

- **O-341**: Should PDF attachment delivery exist at all? It is the single largest data-exposure
  surface in the product: a squad's wellness data in an unmanaged inbox. I have specified it with
  a non-dismissible warning and an audit entry, because refusing it means coaches export and
  email manually with no audit at all. A club's DPO may take a different view.
- **O-342**: Athlete reports: should an athlete be able to generate their own, and should staff
  be able to send one to an athlete? Currently athletes generate their own from `my-data.md` and
  staff-generated athlete reports are not delivered to the athlete. A staff-initiated
  athlete-facing report is a genuinely useful review-meeting artefact and it needs a rule about
  unacknowledged flags.
- **O-343**: Report file retention defaults to 30 days. `09-security-and-compliance.md` §7 sets
  a retention schedule for source data but not for generated documents. A generated report is a
  copy of athlete data sitting in object storage and it needs its own line in that schedule.
- **O-344**: Should reports be versioned, so that a definition change does not alter how a past
  run is interpreted? A run's file is immutable, but "regenerate" against a changed definition
  produces a different document under the same name. Versioning the definition on the run row is
  cheap and I have not specified it.
- **O-345**: Is "after every fixture" the right third cadence, or is "before every fixture", for
  example MD-2, more useful? The MD-2 selection meeting is arguably where a squad report gets
  read.
- **O-346**: Should the squad weekly report include a free-text coach's note that carries into
  the PDF? It makes the report a communication artefact rather than a data artefact, which is
  probably what clubs want and is also a new content type with its own permissions.
- **O-347**: Should admins receive an aggregate compliance report automatically? They have the
  access, they are the people who care about usage, and it is also an unsolicited weekly email
  about staff performance.
- **O-348**: Confirms `02-information-architecture.md` O-7 from this side: Reports and Analytics
  stay separate in this specification. If they merge, the pager becomes Analytics' presentation
  mode and scheduling becomes a property of a saved view.
