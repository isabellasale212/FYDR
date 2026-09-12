# Metrics registry

Stage B1. Every number that appears anywhere in the staff app gets one entry
here. Screen specifications point at these by ID and never restate a formula, so
there is exactly one place to change a calculation.

**Written for a coach, not a developer.** Each entry says in ordinary words what
the number means before it shows the arithmetic. If a sentence here does not
make sense to you, that is a fault in this document and worth telling me about.

**The rule this registry exists to enforce.** If two screens need the same
quantity but calculate it differently, they are **two metrics with two IDs and
two names**, and each entry must say how it differs from its twin. MET-001 and
MET-002 below are a live example, and finding them is the reason this stage
comes before the screen specifications.

**Status.** Batch 1 of 3. This batch covers wellness, training load, compliance
and the dashboard. Batch 2 covers GPS and the training report. Batch 3 covers
testing, gym, nutrition and leaderboards.

**Jargon, expanded once.** A *trigger* is a rule inside the database that fills
a column in automatically the moment a row is saved. A *view* is a saved
question, not a table: `wellness_entries_current` is the live wellness rows with
superseded corrections filtered out. *Timezone* matters because a day boundary
in the club's local time is not the same instant as a day boundary in UTC, and
every window below is measured in the club's own local days.

---

## MET-001. Readiness score

**Name on screen.** Readiness score. Sometimes just Readiness.

**Surfaces.** Both, staff app and athlete app.

**What it means, in plain English.** How ready an athlete says they feel today,
on a scale of 0 to 100. It comes entirely from the athlete's own morning
check-in. It is not a medical judgement and it is not measured by any device: it
is five self-ratings turned into one number so that days can be compared.

**Exact calculation.** The athlete rates five things from 1 to 5: sleep quality,
fatigue, soreness, stress and mood. On all five, **5 is the best answer**, so
nothing is reversed. Add up whichever of the five were actually answered, divide
by five times the number answered, then multiply by 100. Round to two decimal
places.

```
readiness = (sum of answered scales) / (5 x number answered) x 100
```

So an athlete who answers all five with 4s scores (20 / 25) x 100 = 80. An
athlete who answers only four of them, all 4s, scores (16 / 20) x 100 = 80 as
well. **Skipping a slider does not push the score down.**

**Inputs.** `wellness_entries.sleep_quality`, `.fatigue`, `.soreness`,
`.stress`, `.mood`. All five are entered by the athlete on the daily check-in.
No device or vendor feed is involved.

**Time window.** A single day. The athlete's own entry for that date.

**Timezone.** The entry is filed against the date in the club's timezone.

**Rounding and units.** Two decimal places as stored. Displayed with no decimal
places (`src/lib/metrics.ts:15`).

**When data is missing.** If the athlete answered **none** of the five, the
score is empty, never zero (`supabase/migrations/0010_helper_functions_and_triggers.sql:278`).
An empty readiness and a readiness of zero mean different things and the app
never confuses them. A brand new athlete has no score until their first
check-in.

**Screens that display it.** Dashboard, athlete profile, wellness detail,
flags, squad weekly report, athlete report, leaderboards.

**Roles and tier.** All staff. Base package.

**Where it is built.** `supabase/migrations/0010_helper_functions_and_triggers.sql:253`,
a database trigger that fills `wellness_entries.readiness_score` when the row is
saved. Registered for display at `src/lib/metrics.ts:15`.

**Difference from MET-002.** MET-002 is the same idea calculated a different
way, and only Analytics uses it. See below.

---

## MET-002. Readiness score, analytics version

**Name on screen.** Readiness. It is **not** labelled differently anywhere,
which is the problem this entry records.

**Surfaces.** Staff app only.

**What it means, in plain English.** The same five self-ratings as MET-001, but
with one strict difference: **if the athlete skipped even one of the five, this
version reports nothing at all for that day.** MET-001 would have given a score.

**Exact calculation.** If any of the five is missing, the answer is empty.
Otherwise add all five and divide by 25, then multiply by 100.

```
readiness (analytics) = (sum of all five) / 25 x 100, or empty if any is missing
```

**How this differs from MET-001, stated plainly.** For an athlete who answered
four sliders out of five with 4s: MET-001 shows **80**, MET-002 shows
**nothing**. Every screen except Analytics shows the first. Analytics shows the
second.

**Inputs.** Identical to MET-001.

**Time window, timezone, units.** Identical to MET-001.

**When data is missing.** Any missing scale makes the whole day empty
(`src/lib/stats.ts:38`).

**Screens that display it.** Analytics only, and the view builder behind it.

**Roles and tier.** Currently all staff. Premium only. Under the agreed role
model this becomes sport scientist only, decision D-02.

**Where it is built.** `src/lib/stats.ts:25`, used at
`src/lib/queries/analytics.ts:561`.

**Open issue, raised as a decision.** The description shown to the person
building an analytics view says this version matches the database function
(`src/lib/analyticsBuilder.ts:120`). **It does not.** The same note then
correctly describes the strict behaviour, so the note contradicts itself in one
sentence. Two questions for you: is the strict version deliberate for analytics,
and if so should it be given its own name on screen so nobody compares the two
numbers and concludes one is broken? Recorded as **decision D-22**.

---

## MET-003. Sleep hours

**Name on screen.** Sleep hours.

**Surfaces.** Both, staff app and athlete app.

**What it means.** How many hours the athlete says they slept, from the same
morning check-in. Their own estimate, not a device reading.

**Exact calculation.** None. It is recorded and displayed as entered.

**Inputs.** `wellness_entries.sleep_hours`.

**Time window.** One day.

**Rounding and units.** One decimal place, displayed with an "h"
(`src/lib/metrics.ts:21`).

**When data is missing.** Optional on the check-in form, so an athlete can have
a readiness score for a day and no sleep figure at all
(`src/lib/analyticsBuilder.ts:187`). Shown blank, never zero.

**Screens.** Wellness detail, athlete profile, flags, analytics.

**Roles and tier.** All staff. Base.

**Where it is built.** Stored directly. Display registered at
`src/lib/metrics.ts:21`.

---

## MET-004. Soreness

**Name on screen.** Soreness.

**Surfaces.** Both, staff app and athlete app.

**What it means.** How sore the athlete reports feeling, from 1 to 5. **5 means
least sore**, in common with the other four scales, so a high number is always
good anywhere in Fydr.

**Exact calculation.** None, recorded as entered. The direction is fixed at
entry rather than reversed later, so that "readiness_score is a simple sum and
every chart points one way" (`supabase/migrations/0004_athlete_entries.sql:25`).

**Inputs.** `wellness_entries.soreness`.

**Rounding and units.** No decimals, displayed as "of 5"
(`src/lib/metrics.ts:22`).

**When data is missing.** Blank.

**Screens.** Wellness detail, flags, analytics, athlete profile.

**Roles and tier.** All staff. Base.

---

## MET-005. Body mass

**Name on screen.** Body mass, or Weight.

**Surfaces.** Both, staff app and athlete app.

**What it means.** The athlete's weight in kilograms, recorded on the check-in.

**Exact calculation.** None, recorded as entered.

**Inputs.** `wellness_entries.body_mass_kg`.

**Screens.** Athlete profile, nutrition, body composition, leaderboards,
analytics.

**Roles and tier.** All staff. Base. Under the agreed model this is a focus area
for medic, S&C, nutritionist and sport scientist, which is a display emphasis
rather than an access rule.

**Where it is built.** Stored directly. Seeded as a rankable metric at
`supabase/migrations/0016_leaderboards.sql`.

**Related.** MET-006 is the trend line drawn from it.

---

## MET-006. Wellness trend band

**Name on screen.** Usually unlabelled: it is the shaded band behind a wellness
chart.

**Surfaces.** Both, staff app and athlete app.

**What it means.** The athlete's own normal range, drawn behind their daily
figures, so a coach can see whether today is unusual **for that athlete** rather
than unusual compared to the squad.

**Exact calculation.** For each day, take the 14 days up to and including it,
compute the average and the spread (standard deviation) of the values in that
window, and shade the area between them.

```
band on day D = average and spread of the 14 days ending on D
```

**Why 14.** It is the window the profile and the athlete report both use, and
each file says it matches the other (`src/lib/queries/playerProfile.ts:136`,
`src/lib/queries/athleteReport.ts:136`).

**Inputs.** Whichever wellness measure the chart is showing, most often
readiness (MET-001).

**Time window.** 14 days, rolling.

**When data is missing.** The chart needs 14 days of history before the first
band can be drawn, so the days before that are deliberately fetched as a
lead-in. Without that lead-in the opening stretch of every chart drew no band,
which reads as "this athlete has no normal" when the truth was "we did not ask
for the days that would show one" (`src/lib/queries/analytics.ts:505`).

**Screens.** Athlete profile, wellness detail, athlete report, analytics.

**Roles and tier.** All staff. Base, except inside Analytics.

**Where it is built.** `src/lib/stats.ts:67`.

**Open issue.** The 14 is written out separately in two files rather than shared.
Both are currently 14. Recorded as **decision D-13**.

---

## MET-007. Session load

**Name on screen.** Session load. Sometimes just Load.

**Surfaces.** Both, staff app and athlete app. **UNVERIFIED which athlete screen renders it; the inputs are read by athlete screens.**

**What it means.** How hard a single session was for one athlete, as one number.
It combines how hard the athlete said it felt with how long it lasted, so an
easy long session and a hard short one can be compared.

**Exact calculation.** Multiply the athlete's rating of perceived exertion by
the number of minutes, and round to one decimal place.

```
session load = rating of perceived exertion x duration in minutes
```

An athlete who rates a 60 minute session at 7 has a session load of 420.

**Inputs.** `training_entries.rpe`, `training_entries.duration_min`. Both are
entered by the athlete after the session.

**Time window.** One session.

**Rounding and units.** One decimal place. The units are conventionally called
"arbitrary units": the number is only meaningful compared to the same athlete's
other sessions.

**When data is missing.** No rating or no duration means no session load, so the
session contributes nothing to the totals below rather than counting as zero.

**Screens.** Schedule, session detail, athlete profile, squad weekly report,
training report, analytics.

**Roles and tier.** All staff. Base.

**Where it is built.** `supabase/migrations/0010_helper_functions_and_triggers.sql:292`,
a database trigger.

---

## MET-008. Acute load

**Name on screen.** Acute load, or "this week".

**Surfaces.** Staff app only.

**What it means.** How much work an athlete has done in the last seven days,
added up.

**Exact calculation.** Add every session load (MET-007) with a date in the
trailing 7 days, including today.

**Inputs.** MET-007, grouped by date.

**Time window.** 7 days (`src/lib/acwr.ts:34`).

**When data is missing.** See the suppression rule in MET-010, which governs
whether this is shown at all.

**Screens.** Squad weekly report, athlete profile, analytics.

**Roles and tier.** All staff. Base.

**Where it is built.** `src/lib/acwr.ts:60`.

---

## MET-009. Chronic load

**Name on screen.** Chronic load, or "typical week".

**Surfaces.** Staff app only.

**What it means.** What a normal week looks like for this athlete, worked out
from the last four weeks. It is the yardstick the current week gets measured
against.

**Exact calculation.** Add every session load in the trailing 28 days, then
divide by 4 to express it as a per week figure.

```
chronic load = (total load over 28 days) / 4
```

**Inputs.** MET-007, grouped by date.

**Time window.** 28 days (`src/lib/acwr.ts:35`).

**When data is missing.** See MET-010.

**Screens.** Squad weekly report, athlete profile, analytics.

**Roles and tier.** All staff. Base.

**Where it is built.** `src/lib/acwr.ts:66`.

---

## MET-010. Acute to chronic load ratio

**Name on screen.** Acute:chronic load ratio. Often shortened to ACWR.

**Surfaces.** Staff app only.

**What it means.** This week's work divided by a typical week's work. Around 1.0
means this week is normal for that athlete. Well above 1.0 means a sudden jump
in workload, which is the pattern coaches watch for.

**Exact calculation.** Divide acute load by chronic load.

```
ratio = MET-008 / MET-009
```

**The suppression rule, which matters more than the formula.** If the athlete
has training entries on **fewer than 21 of the trailing 28 days**, no ratio is
calculated anywhere in the app. The number is withheld rather than estimated,
because a ratio built on patchy data is worse than no ratio
(`src/lib/acwr.ts:39`, applied at `src/lib/acwr.ts:63`).

**Time window.** 7 days over 28 days.

**Rounding and units.** Two decimal places, no unit (`src/lib/metrics.ts:23`).

**When data is missing.** Empty if fewer than 21 days have data, or if the
chronic figure is zero.

**The band shown alongside it.** 0.8 to 1.5 is drawn as the comfortable range.
**This is a display convention, not the alert rule.** The rule that actually
raises a flag lives in the club's own `thresholds` table and may be different
(`src/lib/acwr.ts:41` and `:46`). Any screen quoting a cutoff must read it from
that table rather than assume 0.8 to 1.5.

**Screens.** Squad weekly report, athlete profile, flags, analytics.

**Roles and tier.** All staff. Base.

**Where it is built.** `src/lib/acwr.ts:60`.

---

## MET-011. Sessions attended

**Name on screen.** Sessions attended.

**Surfaces.** Staff app only.

**What it means.** How many sessions the athlete was actually present for.

**Exact calculation.** A count of attendance rows for the athlete in the chosen
period.

**Inputs.** `session_attendance`.

**Screens.** Squad weekly report, athlete profile, leaderboards.

**Roles and tier.** All staff. Base.

**The filter, resolved in batch 3.** Only two attendance states count: **full**
and **modified**. An athlete who trained with a restriction still counts as
having attended. Every other state, including absence for any reason, does not
(`supabase/migrations/0016_leaderboards.sql:397`).

**Where it is built.** `supabase/migrations/0016_leaderboards.sql:394`, seeded as
a rankable metric at `:72`.

---

## MET-012. Wellness compliance

**Name on screen.** Wellness in. Also "Wellness, today" on the outstanding
entries card.

**Surfaces.** Staff app only.

**What it means.** What share of the athletes who were expected to complete a
check-in actually did. It answers "how much of today's picture do I actually
have", not "how well is the squad".

**Exact calculation.** Count the athletes expected to submit, count those who
did, divide, multiply by 100, round to a whole number.

```
compliance = submitted / expected x 100
```

**Where "expected" comes from.** It is not every athlete. The database generates
one expectation row per athlete per day
(`supabase/migrations/0044_generate_compliance_expectations.sql:159`), so an
athlete who is not expected to check in does not count against the figure.

**Time window.** One day for the headline figure. Seven days for the flag
version (`src/lib/metrics.ts:25`).

**Rounding and units.** Whole percent.

**When data is missing.** If nobody was expected, the figure is empty rather
than 0 percent or 100 percent (`src/lib/queries/dashboard.ts:342`). This
distinction matters: no expectations is not the same as total non compliance.

**Screens.** Dashboard, compliance report, squad weekly report, flags.

**Roles and tier.** All staff. Base.

**Where it is built.** `src/lib/queries/dashboard.ts:342` for the headline,
`src/lib/queries/compliance.ts` for the report.

**Note.** The list of names behind the figure is computed from the identical
expected and submitted pair rather than by a second query, so the count and the
names can never disagree (`src/lib/queries/dashboard.ts:255`).

**The RPE domain on the compliance report has a cutoff** (§0ad, decided
2026-09-12). A session rating counts as submitted only if the athlete's original
submission was before `rpeClosesAt` — the end of the following club-local day,
the same instant the RPE screen refuses one (`src/lib/rpeDue.ts`,
`rpeSubmittedInTime`). Later is a miss. Matched per session, judged on the
original row's `submitted_at`, never a correction's. Wellness has no cutoff
beyond its own day. Where it is built: `src/lib/complianceRpe.ts`, read by
`fetchComplianceReport`. **Not yet applied** on the athlete report's own
compliance figure (`athleteReport.ts`) or the dashboard's "RPE, yesterday"
track — the track only ever looks inside the window, so it cannot disagree; the
athlete report can, and is filed as a question.

---

## MET-013. Squad availability split

**Name on screen.** Fit and available, Doubtful, Ruled out. Shown as three rows
and a single stacked bar.

**Surfaces.** Staff app only.

**What it means.** How many of the squad can train and play fully, how many are
carrying a restriction, and how many cannot be selected.

**Exact calculation.** Three counts of the athletes in the current group filter:

- **Fit and available**: athletes whose current availability status is
  `available`
- **Doubtful**: status `modified`
- **Ruled out**: status `unavailable`

**Inputs.** `availability.status`, taking only the row with no end date, which
is the one currently in force. Names, restrictions and reasons come from the
same rows.

**Time window.** Right now. Not a period.

**When data is missing.** An athlete with no availability row at all is recorded
as `unknown` and is **not** counted in any of the three
(`src/lib/queries/availability.ts:151`).

**Screens.** Dashboard, squad overview, injury and availability report.

**Roles and tier.** All staff. Base. Under the agreed model the reason and
restriction detail is injury information, so it is hidden from the nutritionist:
decision D-01.

**Where it is built.** `src/lib/queries/dashboard.ts` inside
`fetchSaturdayReadiness`, from `src/lib/queries/availability.ts:56` and `:125`.

---

## MET-014. Named for selection

**Name on screen.** Named. Shown as a ring reading, for example, 25/28.

**Surfaces.** Staff app only.

**What it means.** How many of the squad you could pick for the next match. It
is the squad size minus the players who are ruled out. **Doubtful players are
counted as available**, because they can be selected.

**Exact calculation.**

```
named = squad size - ruled out count
```

**Inputs.** MET-013.

**Time window.** Right now.

**When data is missing.** If the squad size is zero the ring shows no
percentage.

**Screens.** Dashboard only.

**Roles and tier.** All staff. Base.

**Where it is built.** `src/lib/queries/dashboard.ts`, `fetchSaturdayReadiness`.

---

## MET-015. Week load so far

**Name on screen.** Week load so far, shown as a percentage against a marker.

**Surfaces.** Staff app only.

**What it means.** How much running the squad has done this week compared with a
normal week. 100 percent means a normal week's work by this point.

**Exact calculation.** Four steps.

1. For each session this week up to today, take every athlete's total distance
   and **average them**, giving one figure per session.
2. Add those session averages together. That is this week's total.
3. Do exactly the same for each earlier week, then average those weekly totals.
   That is the typical week.
4. Divide this week by the typical week and multiply by 100.

```
week load = (this week's total) / (average of earlier weeks' totals) x 100
```

**Why an average per session and not a sum.** A session with more athletes
recorded would otherwise look like a harder session.

**Inputs.** `gps_records.total_distance_m`, joined to `sessions`.

**Time window.** Monday to today for the current figure. Every earlier week on
record for the comparison, excluding this week so it is not compared with
itself.

**Rounding and units.** Whole percent.

**When data is missing.** If no earlier week has any GPS data the figure is
empty rather than misleading.

**Colour bands.** Above 112 percent reads as high, below 88 percent reads as
low (`src/lib/queries/dashboard.ts:814`). These are the same two numbers the
training report uses, see MET-026 in batch 2.

**Screens.** Dashboard.

**Roles and tier.** All staff. **UNVERIFIED: whether this region is tier gated.**
It is built from GPS data, which is the Premium package, but the dashboard is a
Base screen. Files searched: `src/app/(staff)/dashboard/page.tsx`,
`src/lib/queries/dashboard.ts`. **This is a real question, raised as decision
D-23: what does this card show on the Base package?**

**Where it is built.** `src/lib/queries/dashboard.ts:811`.

---

## MET-016. Open flags

**Name on screen.** Open flags.

**Surfaces.** Staff app only.

**What it means.** How many automatic alerts are currently unresolved.

**Exact calculation.** A count of flags whose status is one of `raised`,
`notified`, `acknowledged` or `monitoring` (`src/lib/queries/flags.ts:102`).

**A flag counts as escalated** once 24 hours have passed since it was raised
without anyone acknowledging it (`src/lib/queries/flags.ts:108`).

**Inputs.** `flags.status`, `flags.raised_at`, `flags.acknowledged_at`.

**Screens.** Dashboard, flags.

**Roles and tier.** All staff. Base.

**Open issue.** Nothing explains why 24 hours, and it is fixed for every club
even though a `thresholds` table exists for club specific rules. Recorded as
**decision D-12**.

---

## Batch 1 summary

16 metrics. Two of them, MET-001 and MET-002, are **the same number on screen
calculated two different ways**, which is exactly the collision this registry
exists to surface.

Three new decisions were raised while writing this batch and have been added to
`docs/decisions-required.md`: **D-22** on the two readiness versions, **D-23** on
what the dashboard's week load card shows on the Base package, and the
confirmation of D-12 and D-13 from live formulas.

Two items are marked UNVERIFIED and carried forward: the attendance filter in
MET-011, and the tier behaviour in MET-015.

---

# Batch 2: GPS and the training report

Everything in this batch is **Premium package only**. A club on Base has no GPS
data at all, so every metric here is either absent or shows an upsell, depending
on the rule settled in decision D-20.

**How GPS data gets in, once, because every metric below depends on it.** Fydr
does not talk to a GPS vendor directly. Somebody exports a file from the vendor's
own software and uploads it at Settings, Import GPS. There is deliberately **no
vendor detection and no column mapping**: the file must have a fixed set of
column headings, and anyone whose export does not match is expected to re-head
the file in a spreadsheet before uploading
(`src/lib/queries/gpsImport.ts:9`).

The ten accepted column headings are, exactly:

```
Player Name, Date, Total Distance (m), High Speed Distance (m),
Sprint Distance (m), Max Speed (m/s), Accelerations, Decelerations,
Player Load, Duration (min)
```
`src/lib/queries/gpsImport.ts:40`

Only three are compulsory: Player Name, Date and Total Distance
(`src/lib/queries/gpsImport.ts:52`).

**Measurement units are never converted.** The heading names the unit and the
number is taken at face value. A file in kilometres per hour is not quietly
turned into metres per second: it fails a plausibility check instead, and the
coach is told which column to look at (`src/lib/queries/gpsImport.ts:29`). Today
there is exactly one such check, on max speed, described in MET-020.

The one thing that **is** converted is time: the file gives minutes and the
database stores seconds, so the import multiplies by 60
(`src/lib/queries/gpsImport.ts:216`). That is a change of scale, not a change of
measurement, and it is applied on the way in and reversed on the way out.

---

## MET-017. Total distance

**Name on screen.** Total distance. Sometimes Distance.

**Surfaces.** Staff app only.

**What it means.** How far an athlete travelled in a session, in metres. Every
step counts, walking included.

**Exact calculation.** None. It is whatever the GPS vendor reported, taken from
the file as uploaded.

**Inputs.** `gps_records.total_distance_m`, from the "Total Distance (m)" column
of the uploaded file.

**Time window.** One session. Totals over a week or a period are sums of these.

**Rounding and units.** Metres, one decimal place as stored
(`supabase/migrations/0023_gps_records.sql:47`).

**When data is missing.** This is one of the three compulsory columns, so a row
without it is rejected at upload with the row number, and the coach sees which
rows failed and why. An athlete with no GPS row for a session simply has no
figure, never a zero.

**Screens.** Training report, dashboard week load (MET-015), leaderboards,
analytics, athlete report, squad weekly report.

**Roles and tier.** All staff. **Premium.**

**Where it is built.** Stored on import at `src/lib/queries/gpsImport.ts:168`.

---

## MET-018. High speed distance

**Name on screen.** High speed distance.

**Surfaces.** Staff app only.

**What it means.** How far the athlete ran above a speed the vendor treats as
"high speed". It is a measure of how much fast running a session contained,
rather than how much running in total.

**Important caveat, in plain English.** **The threshold that counts as high
speed is the vendor's, not Fydr's.** Fydr stores whatever number the file
contains and does not know what speed was used to produce it. Two clubs using
different vendors, or one club changing a vendor setting, will produce numbers
that are not comparable, and nothing in the app can detect that.

**Exact calculation.** None. Taken from the file.

**Inputs.** `gps_records.high_speed_distance_m`, from "High Speed Distance (m)".

**Time window.** One session.

**Rounding and units.** Metres, one decimal place.

**When data is missing.** Optional. Blank if the column was empty.

**Screens.** Training report, leaderboards, analytics, athlete report.

**Roles and tier.** All staff. **Premium.**

**Where it is built.** `src/lib/queries/gpsImport.ts:186`.

---

## MET-019. Sprint distance

**Name on screen.** Sprint distance.

**Surfaces.** Staff app only.

**What it means.** How far the athlete ran at sprinting speed. The same caveat as
MET-018 applies in full: **the definition of a sprint is the vendor's**, and Fydr
records the result without knowing the threshold behind it.

**Exact calculation.** None. Taken from the file.

**Inputs.** `gps_records.sprint_distance_m`, from "Sprint Distance (m)".

**Rounding and units.** Metres, one decimal place.

**When data is missing.** Optional, blank.

**Screens.** Training report, leaderboards, analytics.

**Roles and tier.** All staff. **Premium.**

**Where it is built.** `src/lib/queries/gpsImport.ts:187`.

---

## MET-020. Maximum speed

**Name on screen.** Max speed.

**Surfaces.** Staff app only.

**What it means.** The fastest the athlete travelled at any point in the session,
in metres per second.

**Exact calculation.** None. Taken from the file.

**The one plausibility check in the whole import.** A value below 0 or above
**12.5** metres per second is rejected, and the coach is told the likely cause in
those words: check the column is really metres per second and not kilometres per
hour or miles per hour (`src/lib/queries/gpsImport.ts:181`).

12.5 metres per second is about 45 kilometres per hour, which is faster than
almost any recorded human sprint, so a number above it is a unit mistake rather
than an athlete.

**Inputs.** `gps_records.max_speed_ms`, from "Max Speed (m/s)".

**Rounding and units.** Metres per second, two decimal places.

**When data is missing.** Optional. A rejected row is reported by row number,
counting the header as row 1 so it matches what the coach sees in their
spreadsheet (`src/lib/queries/gpsImport.ts:63`).

**Screens.** Training report, leaderboards, analytics, personal bests.

**Roles and tier.** All staff. **Premium.**

**Where it is built.** `src/lib/queries/gpsImport.ts:174`.

---

## MET-021. Player load

**Name on screen.** Player load.

**Surfaces.** Staff app only.

**What it means.** The vendor's own summary of how much physical work the session
involved, built from the movement the unit measured. Unlike session load
(MET-007), which comes from the athlete's own rating, this comes from the device.

**A caveat worth stating.** Player load is **not a standard measure**. Each
vendor calculates it their own way and the number has no agreed unit. It is only
meaningful compared with other sessions recorded by the same vendor.

**Exact calculation.** None. Taken from the file.

**Inputs.** `gps_records.player_load`, from "Player Load".

**Rounding and units.** Two decimal places, no unit.

**When data is missing.** Optional, blank.

**Screens.** Training report, leaderboards, analytics.

**Roles and tier.** All staff. **Premium.**

**Where it is built.** `src/lib/queries/gpsImport.ts:190`.

---

## MET-022. Accelerations, and MET-023. Decelerations

**Surfaces.** Staff app only.

**Names on screen.** Accelerations. Decelerations.

**What they mean.** How many times the athlete sped up sharply, and how many
times they slowed down sharply. Coaches watch these because the braking and
changing of direction is often harder on the body than the running itself.

**The same vendor caveat, and it is sharper here.** What counts as "sharp" is a
threshold set in the vendor's software. Fydr counts what the file says. Two
clubs' numbers are not comparable, and neither are one club's numbers across a
change of vendor setting.

**Exact calculation.** None. Taken from the file.

**Inputs.** `gps_records.accelerations` and `.decelerations`, from the
"Accelerations" and "Decelerations" columns.

**Rounding and units.** Whole counts.

**When data is missing.** Optional, blank.

**Screens.** Training report, leaderboards, analytics.

**Roles and tier.** All staff. **Premium.**

**Where they are built.** `src/lib/queries/gpsImport.ts:188` and `:189`.

---

## MET-024. Session duration

**Name on screen.** Duration.

**Surfaces.** Both, staff app and athlete app.

**What it means.** How long the athlete's GPS unit recorded for, in minutes.

**Not the same as the session's scheduled length**, and not the same as the
duration an athlete enters with their own rating in MET-007. This one comes from
the device.

**Exact calculation.** None. Taken from the file.

**Inputs.** `gps_records.duration_s`, from the "Duration (min)" column.

**Screens.** Training report, analytics.

**Roles and tier.** All staff. **Premium.**

**The minutes to seconds conversion, confirmed.** The uploaded column is headed
"Duration (min)" and the database column is `duration_s`, in seconds. The import
multiplies by 60 and rounds (`src/lib/queries/gpsImport.ts:216`), and the export
converts back at the file boundary rather than in the middle of the app
(`src/lib/queries/gpsImport.ts:414`). Recorded because the mismatch of names
looks like a bug and is not one, so nobody needs to check it twice.

**Where it is built.** `src/lib/queries/gpsImport.ts:191`, stored at `:216`.

---

## MET-025. Running distance and high intensity efforts

**Surfaces.** Staff app only.

**Names on screen.** Running distance. High intensity efforts.

**What they mean.** How far the athlete ran above a walking pace, and how many
bursts of hard work the unit counted. Both carry the same vendor caveat as
MET-018: the thresholds behind them are the vendor's, not Fydr's.

**Where they come from, and this is the important part.** Both columns exist on
the GPS table, both are offered as rankable leaderboard metrics
(`supabase/migrations/0056_gps_leaderboard_metrics.sql:95` and `:101`), and both
are populated in the club's existing data: that migration records 512 of 597 rows
carrying a value for each, running distance ranging 1,261 to 3,655 metres
(`supabase/migrations/0056_gps_leaderboard_metrics.sql:63`).

**But neither column is among the ten headings the upload accepts.** So the
figures that exist arrived by direct database insert, and **every future upload
through the app will leave them empty**. A leaderboard built on either will work
today and quietly stop gaining new entries.

Two further columns, `impacts` and `metabolic_power_avg`, exist on the table,
are not accepted by the import, and are not offered as leaderboard metrics
either. They are simply unused.

**Status.** Partly built: readable, rankable, not collectable.

**Raised as decision D-24**: either add these two columns to the accepted import
headings, or mark them ineligible for leaderboards so a coach cannot build a
board that will silently stop updating.

---

## MET-026. Session score

**Name on screen.** Shown as a percentage on a dial, with a sentence beneath it
such as "A typical session" or "Much harder than usual".

**Surfaces.** Staff app only.

**What it means, in plain English.** How hard this session was compared with a
typical session **of the same kind** for **this athlete**. 100 percent means
completely normal for them. It is deliberately not a comparison against the rest
of the squad, so a smaller athlete is not permanently at the bottom of every
board.

**Exact calculation.** For a chosen measure, most often total distance:

1. Find this athlete's earlier sessions **with the same title**, for example
   every "Conditioning" session.
2. Average that measure across them. That is the typical session.
3. Divide this session's figure by the typical figure and multiply by 100.

```
session score = this session / typical session of the same title x 100
```

**Why the session title is the grouping.** The database has no column for a
session subtype: it only knows training, match and a few others. But real
sessions repeat weekly by name, Conditioning, Unit skills, Team run, Captain's
run, so the title is what the club already uses to mean "the same kind of
session" (`src/lib/queries/trainingReport.ts:12`).

**The session being scored is always excluded from its own reference**, applied
everywhere a reference is computed, not just the headline
(`src/lib/queries/trainingReport.ts:36`).

**Time window.** All of the athlete's earlier sessions with that title, within
the report's chosen period.

**Rounding and units.** Whole percent, **not capped**, so a genuinely enormous
session can read well above 100.

**When data is missing.** If the athlete has no earlier sessions of that title,
the dial cannot be scored and the report says so in words rather than showing a
number: "Not enough data to read this session yet"
(`src/lib/queries/trainingReport.ts:186`).

**The five verdicts.**

| Percentage | Sentence shown |
|---|---|
| 122 and above | Much harder than usual |
| 110 to 121 | Harder than usual |
| 92 to 109 | A typical session |
| 82 to 91 | Lighter than usual |
| Below 82 | Much lighter than usual |

`src/lib/queries/trainingReport.ts:165` to `:169`.

**Open issue, and it matters.** **Nothing explains where 122, 110, 92 and 82 come
from.** The code records that they were copied from a specification section
word for word, which is where they came from, not why they are right. Three
further numbers just below them, 112, 88 and 6, are equally unexplained
(`:172` to `:174`). Recorded as **decision D-11**, and until it is answered this
entry is **UNVERIFIED on its thresholds**, though the arithmetic above is
confirmed.

**Screens.** Training report.

**Roles and tier.** Coach or medical today. **Premium.** Under the agreed model
this is a coach and sport scientist screen.

**Where it is built.** `src/lib/queries/trainingReport.ts:164`.

---

## MET-027. Halves split

**Surfaces.** Staff app only.

**Status: NOT BUILT, deliberately, and labelled as absent on screen.**

**What it would mean.** How an athlete's output in the first half of a match
compared with the second.

**Why it is not built.** Nothing in the database records who started, who came on
and when. The weekly squad selection table is exactly that, a weekly selection,
not in-match timing. There is one cumulative GPS row per athlete per session, so
**there is no honest way to split it in two**. The report therefore renders an
explicit, labelled absence rather than inventing numbers
(`src/lib/queries/trainingReport.ts:26`).

**Recorded here rather than omitted** so that nobody rebuilds it without first
adding the substitution data it needs.

---

## Batch 2 summary

11 further metrics, MET-017 to MET-027. Every one is Premium.

**The recurring theme worth your attention.** Six of them, MET-018 through
MET-023, are numbers Fydr **stores but does not define**. The thresholds that
decide what counts as high speed, a sprint, or a sharp acceleration live in the
GPS vendor's software, not in Fydr. This is not a fault, it is how these systems
work, but it means two clubs' figures are not comparable and a change to a vendor
setting will move a club's own numbers with nothing in the app to flag it. Every
screen specification that shows these will carry that sentence.

**One new decision raised.** **D-24**: running distance and high intensity
efforts can be ranked on a leaderboard and are populated in existing data, but
no upload through the app can ever add to them, so such a board will quietly
stop updating.

**One suspected fault checked and dismissed.** The GPS duration column is headed
in minutes and stored in a column named in seconds. That looks like a sixty fold
error and is not one: the import converts, and the export converts back. Recorded
in MET-024 so the question is not re-opened.

---

# Batch 3: testing, gym, nutrition and leaderboards

---

## MET-028. Test result

**Name on screen.** Whatever the test is called: Bench press, 10 metre sprint,
Yo-yo, and so on. Each club defines its own.

**Surfaces.** Both, staff app and athlete app.

**What it means.** One recorded measurement of one athlete on one day, for one
standardised test.

**Exact calculation.** None. It is the number that was measured and entered.

**Inputs.** `test_results.value`, `test_results.test_date`, against a test the
club has defined in `test_definitions`.

**Units.** Whatever the test definition says. Fydr does not assume kilograms or
seconds: the definition carries the unit.

**When data is missing.** An athlete simply has no result for a test they have
not done. A new athlete has none at all.

**Corrections.** A correction creates a new row and marks the old one superseded,
rather than editing in place, because performance data that can be silently
changed is worthless for showing a trend
(`supabase/migrations/0024_testing.sql:98`).

**Screens.** Testing, test history, athlete profile, testing report,
leaderboards.

**Roles and tier.** All staff. Base.

---

## MET-029. Best attempt on a test day

**Name on screen.** Best. Often labelled Personal best, **which is misleading and
is the subject of decision D-40**.

**Surfaces.** Both, staff app and athlete app.

**What it actually means.** The best of the attempts an athlete made **on one
day**. It is **not** their best ever result.

**Exact calculation.** Among that athlete's results for one test, on **one test
date**, on one side of the body, excluding deleted rows and any marked by hand,
the best one is flagged. Which counts as best depends on the test: for a sprint
the lowest time, for a lift the highest weight. The test definition records which.

The scope is the important part, and it is explicit in the rule that sets the
flag: athlete, test, **test date**, and side
(`supabase/migrations/0024_testing.sql:152`).

**So an athlete has one flagged result per test per day**, not one overall. A
sprinter who ran 11.2 in March and 11.4 in June has **two** flagged results, not
one. Anything wanting a true lifetime best has to take the best of the flagged
ones itself.

**How the app actually uses it.** Two ways, both correct for their purpose,
neither of them "best ever":

- **Prescribed gym weights (MET-030)** take the **most recent** flagged result,
  not the highest (`supabase/migrations/0043_exercise_overrides_and_one_rm.sql:355`).
  That is right for a one repetition maximum: you want what the athlete can lift
  now, not what they lifted three years ago.
- **Leaderboard improvement** compares an athlete's latest flagged result against
  their earliest, which is only meaningful because the flag is per day
  (`src/lib/queries/leaderboardWall.ts:410`).

**A hazard.** Changing a test's direction does **not** re-flag anything. The rule
runs when a result is written, not when a definition changes
(`supabase/migrations/0024_testing.sql:163`). A test switched from "higher is
better" to "lower is better" keeps every existing flag pointing at the wrong
attempt until a new result is entered for that athlete on that day. Decision
D-41.

**One important exception.** A member of staff can mark a result as the best by
hand, and when they do, the automatic rule **stops overriding it**
(`supabase/migrations/0024_testing.sql:31`). This exists so that a known bad
reading, a mistimed sprint for instance, does not permanently sit as an athlete's
personal best.

**Inputs.** `test_results.is_best`, set by a database trigger
(`supabase/migrations/0024_testing.sql:139`), and `test_results.is_best_manual`
for the override.

**Time window.** All time, not a period.

**When data is missing.** No results means no personal best. Shown blank.

**Screens.** Testing, test history, athlete profile, leaderboards, gym
programmes, where it feeds MET-030.

**Roles and tier.** All staff. Base.

---

## MET-030. Prescribed gym load

**Name on screen.** The weight shown against an exercise in a programme, in
kilograms.

**Surfaces.** Both, staff app and athlete app. **UNVERIFIED which athlete screen renders it; the inputs are read by athlete screens.**

**What it means.** How much an athlete should lift for this exercise today. When
a programme is written as a percentage rather than a fixed weight, this is that
percentage turned into a real number using **that athlete's own** best lift.

**Exact calculation.** When the exercise is prescribed as a percentage of a one
repetition maximum:

```
weight in kg = percentage x the athlete's best result for the linked test / 100
```

rounded to one decimal place
(`supabase/migrations/0043_exercise_overrides_and_one_rm.sql:342`).

So an exercise written as 80 percent, for an athlete whose best back squat is
140 kg, resolves to 112.0 kg. A different athlete on the same programme sees a
different number.

**Which test is used, and which result.** Each exercise can name the test that
measures its one repetition maximum
(`supabase/migrations/0043_exercise_overrides_and_one_rm.sql:96`). The result used
is the athlete's **most recent flagged attempt**, taken by ordering on test date
and taking the first (`:355`).

**Most recent, not highest.** An athlete whose best ever squat was 150 kg two
years ago and who last tested at 130 kg is prescribed against 130. That is the
right behaviour for a one repetition maximum, and it is worth stating plainly
because the flag it reads is named `is_best`.

**When data is missing, and this is handled explicitly.** If the exercise names
no test, or the athlete has no result for it, the programme records the exercise
as **unresolvable** rather than guessing a weight
(`supabase/migrations/0043_exercise_overrides_and_one_rm.sql:344`). The screen
can then say the athlete needs testing before this exercise has a number, which is
the honest answer.

**The date is carried too.** The date of the test behind the number is available
alongside it (`:227`), so a coach can see that a weight is being derived from a
six month old test.

**Screens.** Gym programme, programme detail, the athlete's own view of a
programme.

**Roles and tier.** All staff today. Base. Under the agreed model, S&C and sport
scientist edit, everyone views.

---

## MET-031. Protein target

**Name on screen.** Protein, in grams per day.

**Surfaces.** Both, staff app and athlete app.

**What it means.** How much protein an athlete should aim for in a day.

**Exact calculation.** A rate per kilogram of body weight, multiplied by the
athlete's body weight.

```
protein grams = protein per kg x body mass in kg
```

**Where the rate comes from.** A `nutrition_rules` row, which can be set for the
whole club, for a group, or for one athlete, with the most specific winning. The
point of the design is that a nutritionist changes one number, say 1.9 to 2.0
grams per kilogram, and it applies everywhere it should
(`supabase/migrations/0039_nutrition_rules.sql:10`).

**Two systems, and which one you are looking at depends on the screen.** The rate
above is the *rule*. What most screens actually display is a stored *absolute*
number in `nutrition_targets`, worked out from the rule once and written down
(`src/lib/queries/nutritionRules.ts:296`).

- The **Nutrition section** shows and edits the rule.
- The **athlete's nutrition page**, and the athlete's own app, show the stored
  absolute number.

**When the stored number is worked out, and this matters.** Only when a
nutritionist assigns or changes a plan (`src/lib/queries/nutritionRules.ts:387`).
**A new weigh-in does not recompute it.** An athlete who gains four kilograms
keeps yesterday's protein target until somebody re-applies the plan. The design
intended the target to recompute on the next weigh-in
(`supabase/migrations/0039_nutrition_rules.sql:11`) and that part is not built.
Decision D-28.

**How to tell what a number was computed from.** Every auto-computed target
carries its own explanation, for example "Auto-computed from Squad default
(training day) at 96.4 kg" (`src/lib/queries/nutritionRules.ts:259`). If the
weight in that sentence is not the athlete's current weight, the target is
stale.

**Sanity limits.** The rate must be between 0.5 and 4 grams per kilogram; the
database refuses anything outside that
(`supabase/migrations/0039_nutrition_rules.sql:99`).

**Inputs.** `nutrition_rules.protein_g_per_kg`, and MET-005 for body mass.

**When data is missing.** No recorded body weight means no target can be
calculated.

**Screens.** Nutrition, nutrition targets, the athlete's own nutrition guidance.

**Roles and tier.** All staff today. Base. Under the agreed model this section
is the nutritionist's, decision D-03.

---

## MET-032. Carbohydrate target

**Name on screen.** Carbohydrate, or Carbs, in grams per day.

**Surfaces.** Both, staff app and athlete app.

**What it means.** How much carbohydrate an athlete should aim for **today
specifically**. Unlike protein, this one changes with what the athlete is doing
that day.

**Exact calculation.** The rate per kilogram, times body weight, times a
multiplier for the kind of day.

```
carbohydrate grams = carb per kg x body mass in kg x day multiplier
```

**The three day multipliers**, which are fixed and not editable anywhere in the
app (`src/lib/nutritionRules.ts:54`):

| Kind of day | Multiplier | What a 6.0 g/kg rule becomes |
|---|---|---|
| Training day | 1 | 6.0 g/kg |
| Match day | 1.25 | 7.5 g/kg |
| Rest day | 0.58 | 3.5 g/kg |

**Worth knowing.** The nutritionist can change the underlying rate but **cannot
change these three multipliers**, and the code records that this is deliberate,
because no screen in the design offers a way to edit them
(`supabase/migrations/0039_nutrition_rules.sql:31`). What a nutritionist can
change is which of the three applies on a given day.

**Sanity limits.** Between 1 and 14 grams per kilogram
(`supabase/migrations/0039_nutrition_rules.sql:100`).

**Screens and tier.** As MET-031.

---

## MET-033. Fat target

**Name on screen.** Fat, in grams per day.

**Surfaces.** Both, staff app and athlete app.

**Exact calculation.** Rate per kilogram times body weight, with no day
multiplier.

**Sanity limits.** Between 0.2 and 3 grams per kilogram
(`supabase/migrations/0039_nutrition_rules.sql:101`).

**Screens and tier.** As MET-031.

---

## MET-034. Energy target

**Name on screen.** Energy, or Calories, in kilocalories per day.

**Surfaces.** Both, staff app and athlete app.

**What it means.** How much food energy the day's targets add up to.

**This one is important to understand correctly: energy is never set, it is
always worked out.** A nutritionist does not type a calorie figure. They set the
three macronutrient rates above, and the energy total follows from them.

**Exact calculation.** The standard conversion: protein and carbohydrate give 4
kilocalories per gram, fat gives 9.

```
energy = (protein grams x 4) + (carbohydrate grams x 4) + (fat grams x 9)
```
`src/lib/nutritionRules.ts:41`

**The one exception, a cap.** A nutritionist can set an upper limit, which
**clamps the total but never sets it**
(`supabase/migrations/0039_nutrition_rules.sql:76`). If the macronutrients add up
to 4,100 kilocalories and the cap is 3,600, the athlete sees 3,600. The cap must
be between 800 and 10,000 (`:103`).

**A consequence worth stating.** Because energy follows the macronutrients, a
capped total will **not** equal the three macronutrient figures shown beside it.
That is by design, not an error, but any screen showing both must be able to
explain it.

**Screens and tier.** As MET-031.

---

## MET-035. Fluid target

**Name on screen.** Fluid, in millilitres per day.

**Surfaces.** Both, staff app and athlete app.

**Exact calculation.** A rate per kilogram times body weight.

**Inputs.** `nutrition_rules.fluid_ml_per_kg`, and MET-005.

**Screens and tier.** As MET-031.

---

## MET-036. Body mass target range

**Name on screen.** Target range, shown as a band around an athlete's weight.

**Surfaces.** Both, staff app and athlete app.

**What it means.** The weight range agreed for this athlete, so their current
weight can be read against it rather than in isolation.

**Exact calculation.** None. It is entered by staff.

**A design point worth recording.** The range is allowed to **move across a
season**, because that is a real thing a nutritionist wants
(`supabase/migrations/0060_body_mass_target_ranges.sql:86`). Retracted rows are
excluded from what is shown (`src/lib/queries/bodyMassTargetRange.ts:79`).

**Screens.** Athlete profile, nutrition, body composition.

**Roles and tier.** All staff. Base.

---

## MET-037. Leaderboard rank

**Name on screen.** The position number on a board.

**Surfaces.** Both, staff app and athlete app.

**What it means.** Where an athlete sits against the others on one measure, over
a chosen period.

**Exact calculation.** Three steps.

1. Gather each athlete's figure for the measure over the board's date range,
   using whichever summary the measure allows: a total, an average, or a count.
   Which of these are permitted is fixed per measure
   (`supabase/migrations/0016_leaderboards.sql:66`).
2. Sort. **Which direction wins is a property of the measure, not the board**:
   each one records whether higher is better
   (`supabase/migrations/0016_leaderboards.sql:46`). A sprint time and a distance
   sort opposite ways and neither is a special case.
3. Number the sorted list.

**Who is excluded.** Any athlete who has opted out
(`supabase/migrations/0016_leaderboards.sql:159`). An opt out can come from the
athlete themselves, from medical staff, or from an administrator, and **the
source and the reason are never shown on the board**
(`supabase/migrations/0016_leaderboards.sql:174`). A board cannot be configured
to refuse opt outs: the database enforces that with a constraint that can only
ever be true (`:142`).

**Under 18 athletes** appear only if consent has been recorded
(`src/lib/leaderboardVisibility.ts:9`).

**When data is missing.** An athlete with no figure for the period does not
appear, rather than appearing last.

**Screens.** Leaderboard, board detail.

**Roles and tier.** All staff view. Base, except a board built on a GPS measure,
which refuses on Base (`src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:95`).
Under the agreed model, S&C and sport scientist edit boards.

---

## MET-038. Leaderboard minimum population

**Name on screen.** Not shown as a number. It is the reason a board sometimes
says it cannot be shown.

**Surfaces.** Both, staff app and athlete app.

**What it means.** A board will not display unless enough athletes qualify. With
two or three people on a board, a rank is not really a rank, it is a public
comparison of named individuals.

**Exact rule.** Each measure carries its own minimum, defaulting to 3, and the
database will not accept a minimum below 2
(`supabase/migrations/0016_leaderboards.sql:51`).

**When it bites.** Under a narrow group filter, a board that works for the whole
squad can fall below its minimum and stop displaying. Any screen specification
covering leaderboards must state what the coach sees at that moment.

**Screens.** Leaderboard, board detail.

**Roles and tier.** All staff. Base.

---

## MET-039. Wellness readiness is deliberately not rankable

**Surfaces.** Both, staff app and athlete app.

**Status: excluded by design, recorded so nobody adds it.**

Readiness (MET-001) is marked as not eligible for leaderboards, with the reason
stored alongside the exclusion
(`src/lib/queries/positionalContext.ts:28`).

**Why this is right, in plain English.** Readiness is how an athlete says they
feel. Ranking it publicly would teach athletes that honest answers put them at
the bottom of a board, which destroys the only thing that makes the measure
useful.

Any request to make readiness rankable should be refused with that sentence.

---

## Batch 3 summary, and the registry total

**39 metrics.** Batch 1 covered wellness, load, compliance and the dashboard.
Batch 2 covered GPS and the training report. Batch 3 covered testing, gym,
nutrition and leaderboards.

**The UNVERIFIED item carried from batch 1 is now resolved.** Sessions attended
counts only the attendance states **full** and **modified**, so an athlete who
trained with a restriction still counts as present.

**Two things in this batch are worth your attention as product decisions rather
than faults.**

First, **the three carbohydrate day multipliers cannot be edited by anyone**.
Training, match and rest are fixed at 1, 1.25 and 0.58. The nutritionist controls
the underlying rate and which day type applies, not the multipliers themselves.
If a nutritionist ever asks to change a match day figure, that is a build, not a
setting.

Second, **energy is derived and can disagree with the macronutrients beside it**
whenever a cap is in force. That is intended, but a screen showing both without
explaining it will look broken.

**No new decisions were raised in batch 3.** The registry stands at 24 decisions
in `docs/decisions-required.md`.

**Stage B1 is complete. Next: Stage B2, the access matrix.**
