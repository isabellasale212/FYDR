# Decisions required

Stage A2. Generated 4 September 2026. Every entry is a question for you, not a
change I have made. Nothing in the code has been touched.

**How to use this file.** Read the recommendation, then either accept it or
overrule it. Once you have answered, the answers become the specification and
the differences become the work queue in `docs/spec-gaps.md`.

**Method, stated so you can judge the coverage.** I checked the whole app for
five of the nine categories mechanically, so those are complete: row level
security across all 58 tables, every role gate on every page and server route,
every named numeric constant in the query layer, every marker the code itself
leaves saying something is unbuilt, and every client component that branches on
role. The other four categories, dead controls, metric name collisions, under 18
behaviour and wrong tier behaviour, are sampled rather than exhausted, because
proving them needs the per screen and per metric passes in Stage B1 and Stage
B3. Those stages will add numbered entries to this file rather than replace it.

**One scope note.** Stage A2 asks for a working draft per screen before this
file. I did the analysis screen by screen but did not write 62 draft prose
files, because Stage B3 produces those as the real, binding deliverable and
writing them twice before the role model is settled would mean writing them
against a role model you have just replaced. If you want the drafts as a
separate artefact, say so and I will produce them.

---

## Group 1: the code differs from the agreed role model

These all follow from your Stage A0 decision: five roles, no admin, sport
scientist has everything, nutritionist sees no injury or medical information.

### D-01. Four of the five injury screens have no role gate. HIGHEST RISK

**Corrected 4 September 2026.** This entry originally said all five. `/injuries/new`
is in fact restricted to the medical role
(`src/app/(staff)/injuries/new/page.tsx:13`). The other four are as described.

**Screens with no gate.** `/injuries`, `/injuries/[injuryId]`,
`/injuries/rehab-groups`, `/injuries/team-allocation`.

**Screen already gated.** `/injuries/new`, medical only. Note that this also
answers half of decision D-35: a coach **cannot** currently record an injury.

**What the agreed model says.** Injury information is limited on every page and
visible to coach, medic, S&C and sport scientist. The nutritionist sees none of
it.

**What the code does.** The four call only `requireStaff`, which admits any
staff member (`src/lib/session.ts:69`). The medical distinction is drawn inside
the page while rendering, not at the door. Today that is harmless because a
nutritionist holds the `coach` role and coaches are meant to see the limited
view anyway. The moment `nutritionist` becomes a real role, these five screens
admit them with no gate to stop it.

**Files involved.** `src/app/(staff)/injuries/page.tsx`,
`.../injuries/[injuryId]/page.tsx`, `.../injuries/rehab-groups/page.tsx`,
`.../injuries/team-allocation/page.tsx`.

**Why they differ.** The four role model had no role that was meant to be kept
out of injury screens, so no gate was ever needed.

**Recommendation.** Add a shared guard, in the shape of the one that already
exists for the athlete domain screens (`src/lib/athleteDomain.server.ts:93`), and
apply it to all five, including the one already gated so that the rule lives in
one place. One guard, not five copies, because the next injury screen
should inherit it. **Reason: this is the only entry in this file where the agreed
model makes something visible today that must not be visible tomorrow.**

### D-02. Analytics admits any staff member

**What the agreed model says.** Analytics is sport scientist only.

**What the code does.** `/analytics` and `/analytics/build` call `requireStaff`
and then gate on product tier only (`src/app/(staff)/analytics/page.tsx:220`).
Any coach or medic on the Premium package opens them.

**Recommendation.** Gate to sport scientist. **Reason: it is the clearest single
role statement in your model and the code contradicts it directly.**

### D-03. Nutrition admits any staff member

**What the agreed model says.** Nutrition is nutritionist only, and viewable by
all staff inside the player profile.

**What the code does.** `/nutrition` and `/nutrition/new` call `requireStaff`.

**Note on a real subtlety.** The model draws a distinction the code does not:
the nutrition **section** is the nutritionist's, but nutrition **shown inside a
player profile** is everyone's. The code has both surfaces already
(`/nutrition` and `/squad/[athleteId]/nutrition`), so the distinction is
implementable without new screens.

**Recommendation.** Gate `/nutrition` and `/nutrition/new` to nutritionist and
sport scientist. Leave `/squad/[athleteId]/nutrition` open to all staff.
**Reason: it matches the two surfaces the code already has.**

### D-04. Gym programmes are editable by any staff member

**What the agreed model says.** S&C owns and edits. All staff view it inside the
player profile.

**What the code does.** All five programme screens call `requireStaff`, with no
separation between viewing and editing.

**Recommendation.** Same shape as D-03: edit gated to S&C and sport scientist,
view left open. **Reason: consistent with the nutrition answer, and the same two
surfaces already exist.**

### D-05. Leaderboards are editable by any staff member

**Agreed model.** All staff view. S&C and sport scientist edit.

**Code.** `/leaderboards/new` and `/leaderboards/manage` call `requireStaff`.

**Recommendation.** Gate the two editing screens to S&C and sport scientist.

### D-06. Schedule is editable by any staff member

**Agreed model.** All staff view. Coach edits.

**Code.** All ten schedule and planner screens call `requireStaff`.

**Recommendation.** Gate creating and editing to coach and sport scientist,
leave viewing open. **Reason: matches the model, and a medic needing to move a
session is a workflow question worth raising separately rather than assumed
here.**

### D-07. Admin must be removed, and eleven capabilities need their new owner recorded

**Your decision.** Remove admin; the sport scientist takes it.

**What this actually involves**, so the size is visible before it is scheduled:

- The database enum itself (`supabase/migrations/0001_extensions_and_enums.sql:77`)
- The accepted role list in the login layer (`src/lib/supabase/claims.ts:22`)
- The staff test (`src/lib/supabase/claims.ts:94`) and the landing route
  (`src/lib/supabase/claims.ts:124`)
- Two guards (`src/lib/session.ts:120`, `src/lib/session.ts:159`)
- Eleven page and route checks, listed in `docs/generated/00-role-model.md` §4.1
- Every row level security policy that names a role
- Three sidebar rows tagged with admin (`src/components/Sidebar/Sidebar.tsx:111`,
  `:163`, `:188`)
- Existing role rows in the live database, which need a migration, not a code
  change

**Recommendation.** Treat this as one piece of work with tests written first,
because it touches access control. The standing rule in `CLAUDE.md` §5 already
requires a test before a permission rule. **Reason: this is the single largest
item in the queue and the only one that can silently open access if done in
pieces.**

### D-08. The reports hub does not use the report guard its own children use

**Code.** Every page under `/reports` calls `requireReportAccess`
(`src/lib/session.ts:120`), except the hub itself, which calls plain
`requireStaff` (`src/app/(staff)/reports/page.tsx`).

**Effect today.** An admin who holds no other role opens the reports hub and is
then refused at every single link on it.

**Recommendation.** Use the same guard on the hub. **Reason: a page whose every
link refuses you is a worse answer than a clean refusal at the door.** Note that
this becomes moot if D-07 removes admin, so sequence it after that decision
rather than fixing it twice.

### D-09. WITHDRAWN. The clinical review screen is correctly gated

**This entry was wrong and is retained rather than deleted, so that anyone who
read the earlier version can see it was corrected.**

**What it claimed.** That `/settings/subject-access/[requestId]/review` called only
the staff guard, letting any staff member open a clinical review directly.

**What is actually true.** The page redirects anyone who does not hold the medical
role, before reading anything
(`src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx:19`).
Beneath that, the database refuses the clinical record to non-medics. Two
independent protections, the same as everywhere else clinical data appears.

**How the error arose.** The Stage A1 scan counted mentions of each role per file
and read this page as mentioning `medical` without guarding on it. A count of
mentions cannot tell a guard from a comment. Every other page flagged the same way
was re-checked by hand after this was found, and no other case was mis-read.

**No action required.**

---

## Group 2: formulas with constants that are not explained

I checked every named numeric constant in `src/lib` and `src/lib/queries`. Most
are explained well, several with the reasoning written out at length. These are
the ones that are not.

### D-10. A 110 kg reference athlete is hard coded into nutrition, with no note

`export const REFERENCE_MASS_KG = 110;` (`src/lib/nutritionMeals.ts:59`). No
comment. The constants either side of it are commented.

**Why it matters to a coach.** Meal portions appear to be sized for a 110 kg
athlete and scaled from there. A club whose squad averages 85 kg would want to
know that.

**Recommendation.** Have the nutritionist confirm the figure, then write the
reasoning into the code and into the metrics registry.

### D-11. The training report's five session bands are bare numbers

`scoreTone` returns five verdicts from the cutoffs 122, 110, 92 and 82
(`src/lib/queries/trainingReport.ts:165` to `:169`), with no explanation of why
those four numbers. Directly below, `OUT_HI = 112`, `OUT_LO = 88` and `GAP = 6`
(`:172` to `:174`) are also unexplained. The comment beneath them records that
they were ported verbatim from a specification section, which is where they came
from, not why they are right.

**Why it matters.** These decide whether a coach is told a session was "Much
harder than usual" or "A typical session".

**Recommendation.** Trace them to their source and record the reasoning, or
agree them afresh. Until then the metrics registry entry says UNVERIFIED.

### D-12. Flag escalation is 24 hours, with no note

`const ESCALATION_MS = 24 * 60 * 60 * 1000;` (`src/lib/queries/flags.ts:108`).
An unacknowledged flag escalates after a day. Nothing says why a day.

**Recommendation.** Confirm 24 hours, and consider whether it should be a club
setting rather than a constant, since a thresholds table already exists for
exactly this kind of club specific rule.

### D-13. Two files hold their own copy of the same wellness window

`WELLNESS_ROLLING_WINDOW = 14` appears in `src/lib/queries/playerProfile.ts:136`
and again in `src/lib/queries/athleteReport.ts:136`. Both comments say they match
each other, which is a promise rather than a mechanism.

**This is not currently a bug.** Both are 14. It is on this list because it is
exactly how one screen quietly starts disagreeing with another.

**Recommendation.** One exported constant, used twice. **Reason: the same
argument that produced the shared name formatter on the dashboard earlier
today.**

### Constants I checked and found properly explained

Recorded so the next reader does not repeat the work: `BAND_RUNWAY_DAYS`
(`analytics.ts:512`), `GPS_WINDOW_DAYS` (`leaderboardWall.ts:53`),
`WELLNESS_MEAN_WINDOW` (`playerProfile.ts:147`), the file size limits in
`avatar.ts:21` and `orgLogo.ts:11`, and all five ACWR constants
(`src/lib/acwr.ts:34` to `:44`), which additionally record that the display band
is a convention and the real rule lives in the thresholds table.

---

## Group 3: permissions checked in the browser but not on the server

### D-14. No instance found. The pattern is clean

I checked every client component that mentions roles. Every one uses roles to
**render** something, never to authorise it: the sidebar hides rows
(`src/components/Sidebar/Sidebar.tsx:33`), a user panel summarises what a role
can do (`src/components/UserDetailPanel/UserDetailPanel.tsx:43`), a threshold row
prints which roles get notified (`src/components/ThresholdRow/ThresholdRow.tsx:74`).

Every one has a server side gate behind it.

**No decision needed. Recorded so the appendix in Stage C can say this was
tested rather than assumed.**

The related risk is different and is covered by D-01, D-08 and D-09: not a
browser check without a server check, but a **server check that is weaker than
the sidebar suggests**. The sidebar tags nine destinations with roles, while
most pages only test staff versus not staff.

---

## Group 4: tables without row level security

### D-15. No instance found. All 58 tables are covered

Every table created in `supabase/migrations/` has row level security enabled and
at least one policy. Most are enabled in bulk loops rather than one at a time,
for example `supabase/migrations/0012_rls_policies.sql:61`, with more in
`0021_programmes.sql:226` and `0023_gps_records.sql:109`.

**Limitation of the method, stated plainly.** This proves every table has a
policy. It does **not** prove the policies are correct, and it reads the
migration files rather than the live database, so a table created outside a
migration would not appear. Checking policy correctness is a separate exercise
and is not in the scope you set.

**No decision needed.**

---

## Group 5: things the code says are not built

The codebase marks its own gaps, which is unusually helpful. These are the ones
that touch the staff app.

### D-16. There is no way to add a player to the squad

Covered in `docs/generated/00-role-model.md` §5.4. No screen, no server route,
no insert into the athletes table anywhere in `src/`. The squad arrives from the
seed file or from direct database access.

**Recommendation.** Specify it as a required screen owned by the sport
scientist, and rank it high in the gap queue. **Reason: a club that signs a
player in October cannot record them.**

### D-17. There is no billing surface

Covered in §5.3. The Plan card is read only and the app says plan changes are a
sales conversation (`src/app/(staff)/settings/page.tsx:254`).

**Recommendation.** Decide whether the specification describes billing as out of
scope permanently or as not yet built. These are different documents.

### D-18. Other unbuilt items the code names

Each needs a decision on whether the specification requires it. Listed with
their own citation so you can see the code's own words.

- Quiet hours for notifications: the columns exist, no screen sets them
  (`src/lib/queries/notificationPreferences.ts:20`)
- Programme change events (`src/lib/queries/programmes.ts:22`)
- An ACWR column on the squad weekly report
  (`src/lib/queries/squadWeeklyReport.ts:37`)
- At least one analytics preset whose data exists but which is not built
  (`src/lib/queries/analytics.ts:17`)
- Meal images and their delivery (`src/lib/nutritionMeals.ts:8`)
- A flags surface described as "noted, not built" (`src/lib/queries/flags.ts:22`)
- Two leaderboard Habits constants described as placeholders
  (`src/lib/queries/leaderboardWall.ts:37`)

**UNVERIFIED: whether each of these is in the existing specification set.** That
comparison is Stage B3, screen by screen.

---

## Group 6: under 18 academy players

### D-19. Under 18 handling exists in three places and is undefined everywhere else

**Where it is handled.** Leaderboard visibility is an opt in consent for under
18s (`src/lib/leaderboardVisibility.ts:9`, with the consent read at
`src/lib/queries/leaderboards.ts:393`). Data retention extends the injury
retention period for a minor (`src/lib/retention/compute.ts:82`). The database
has an `athlete_is_minor` function and an `is_minor` column
(`src/lib/types/database.ts:4363`, `:4164`).

**Where it is not.** The helper that computes an athlete's age exists
(`src/lib/format.ts:455`) and its own comment says it is for under 18 gates, but
it is called in exactly **one** place in the whole app
(`src/lib/queries/playerProfile.ts:820`), and there it displays an age rather
than gating anything.

**So the honest answer is that under 18 behaviour is defined for leaderboards
and retention, and undefined on every other screen.** That includes wellness,
gym logging, nutrition targets, testing, GPS and every report.

**Recommendation.** Decide the rule once, at the level of the whole app, rather
than screen by screen. My question back to you: is there any category of data
beyond leaderboards that a club may not show about an under 18 without consent?
If the answer is no, that is a one line statement in the specification and this
entry closes. If yes, it is a real piece of work.

---

## Group 7: behaviour on the wrong product tier

### D-20. Four pages refuse on Base. The rest is undefined

**Whole pages that refuse on Base.** `/analytics`, `/analytics/build`,
`/reports/training`, `/settings/imports`.

**Pages that open on Base with parts withheld.** `/reports`,
`/reports/athlete/[athleteId]`, `/leaderboards/new`,
`/leaderboards/[leaderboardId]` (which refuses only a GPS board, at
`src/app/(staff)/leaderboards/[leaderboardId]/page.tsx:95`), and `/settings`.

**What is undefined.** The specification you are commissioning asks each screen
to state whether a wrong tier user sees the page hidden, greyed out, or an
upsell. The code has at least three different answers already: a whole page
refusal, a card in place of a region, and a sidebar row that vanishes
(`src/components/Sidebar/Sidebar.tsx:64`). Nothing states which is correct when.

**Recommendation.** Pick one rule. Mine would be: a whole destination that is
entirely Premium disappears from the sidebar and refuses at the URL; a Premium
region inside a Base page shows an upsell card rather than vanishing.
**Reason: it is what the code already mostly does, and a vanishing region leaves
a coach unable to tell whether a feature is missing or unbought, which the code
itself complains about at `src/lib/session.ts:126`.**

---

## Group 8: controls that do nothing

### D-21. Sampled, not exhausted. One candidate found and already fixed today

The readiness rows on the dashboard drew a chevron and a pointer cursor while
being plain non interactive elements. That was found and fixed earlier today in
commit `4b40f5b`, and the reasoning is recorded there.

**This category cannot be completed by searching.** A dead control is a button
whose handler does nothing useful, which reads as working code. It is found by
opening each screen and pressing things. That is Stage B3, section 6 of each
screen spec, which is why that section exists.

**No decision needed yet.** Entries will be added here as Stage B3 proceeds.

---

## Group 9: raised during Stage B1, the metrics registry

### D-22. Readiness is calculated two different ways, under one name

**What it means for a coach.** An athlete who fills in four of the five morning
sliders shows a readiness of, say, 80 on the dashboard, the profile and every
report, and **nothing at all** in Analytics. Same athlete, same day, same word on
screen.

**Why.** The database fills the score in by averaging whichever sliders were
answered (`supabase/migrations/0010_helper_functions_and_triggers.sql:280`).
Analytics uses a separate calculation in the app that refuses to produce a
number unless all five were answered (`src/lib/stats.ts:38`, used at
`src/lib/queries/analytics.ts:561`).

**There is also a wrong note in the code.** The description shown to whoever
builds an analytics view claims this version matches the database function
(`src/lib/analyticsBuilder.ts:120`). It does not, and the very next sentence of
the same note correctly describes the stricter behaviour, so the note
contradicts itself.

**Recommendation.** Keep both, because the strict one is defensible for analysis
where a partial day would skew a trend, but **give the analytics one its own name
on screen**, and fix the note. They are registered as MET-001 and MET-002.
**Reason: two numbers under one name is how a coach ends up believing the app is
broken.**

### D-23. It is not defined what the dashboard's week load card shows on Base

**What it means for a coach.** The Week load so far card is built entirely from
GPS data, which is the Premium package. The dashboard itself is a Base screen.
Nothing in the code says what a Base club sees there.

**Files involved.** `src/app/(staff)/dashboard/page.tsx`,
`src/lib/queries/dashboard.ts:811`.

**Recommendation.** Apply the general rule proposed in D-20: a Premium region
inside a Base page shows an upsell card rather than vanishing. **Reason: a card
that silently disappears leaves a coach unable to tell whether it is broken or
unbought.**

### D-24. Two leaderboard metrics can be ranked but can never be updated

**What it means for a coach.** You can build a leaderboard on Running distance or
High intensity efforts. It will show real figures today. It will then quietly
stop gaining new entries, because no file you upload can add to those two
columns, and nothing on screen will tell you.

**Why.** Both are offered as rankable metrics
(`supabase/migrations/0056_gps_leaderboard_metrics.sql:95` and `:101`) and both
are populated in the club's existing data, 512 rows of 597
(`supabase/migrations/0056_gps_leaderboard_metrics.sql:63`). Those figures
arrived by direct database insert. Neither column is among the ten headings the
GPS upload accepts (`src/lib/queries/gpsImport.ts:40`).

**Recommendation.** Add both columns to the accepted upload headings.
**Reason: the data clearly exists in vendor exports, since the club already has
it, and removing two useful metrics is a worse answer than accepting two more
columns.** If that is not possible, mark them ineligible for leaderboards so no
coach can build a board that will silently stale.

---

## Group 10: raised during Stage B2, the access matrix

### D-25. Nothing warns whoever grants roles that permissions add up

**What it means in plain English.** The rule that a nutritionist sees no injury
information holds only while that person holds the nutritionist role **and
nothing else**. Give them the coach role as well, for any reason, and they see
everything a coach sees, injury information included.

**Why this cannot be fixed in code.** Permissions are a union by design, and that
is correct: a person who genuinely coaches and does nutrition needs both sets.
There is no sensible rule that subtracts access because a second role is held.

**Where it bites.** The screen that grants roles
(`src/app/(staff)/settings/users/create/route.ts:107`) presents roles as a set of
independent switches with nothing said about what combining them does.

**Recommendation.** Put the warning at the point of granting: when the
nutritionist role is selected together with any other role, say in plain words
that the injury restriction will no longer apply. **Reason: the restriction you
asked for is real, and the only place it can be lost is here, so this is the only
place a warning helps.**

---

## Group 11: raised during Stage B3, the screen specifications

### D-26. Only a coach may edit an athlete's biographical details, medics included in the exclusion

**What it means in plain English.** On the athlete profile, changing a player's
position, squad number and similar facts is available to a coach and to nobody
else. A medic cannot do it. Under the agreed model a sport scientist would be
able to, since they have everything, but a medic still could not.

**Where.** `src/app/(staff)/squad/[athleteId]/page.tsx:363`. Every other control
on that page, setting availability, logging a weigh in, correcting an entry, is
coach **or** medic (`:339`, `:356`, `:384`), so the bio edit is the odd one out.

**Why it may be deliberate.** Squad numbers and positions are a coaching matter,
and letting medical staff change them invites disagreement over who owns the team
sheet.

**Why it may be an oversight.** A medic correcting a wrong date of birth is
entirely plausible, and today they cannot.

**Recommendation.** Leave it as coach only, and add the sport scientist.
**Reason: the asymmetry looks deliberate and nothing suggests medics have asked
for it.** Flagged rather than silently adopted because it is the only control on
that page with a different rule from its neighbours.

### D-27. Deleting a session can fail with a message that does not help

**What it means for a coach.** You try to delete a session. Fydr tells you
something went wrong. It does not tell you why, or that cancelling would work.

**Why.** Six tables record a link to a session: attendance, training entries, GPS
records, injuries, test results and compliance expectations. The check that
produces the helpful message, "This session has recorded data. Cancel it
instead", looks at only the first two
(`src/lib/queries/schedule.ts:1273`). The other four are protected by the
database, which refuses the deletion with a foreign key error. Nothing translates
that error: the message humaniser has cases for permissions, expired sessions,
duplicates and connection failures, but **no case for a foreign key refusal**
(`src/lib/writeErrors.ts:129` onward), so it falls through to the generic
sentence.

**How often it bites, honestly.** Less often than it sounds, because the second
check refuses any session in the past, and GPS records, injuries and test results
almost always belong to a past session. The realistic path is a **future** session
that compliance expectations have already been generated for.

**Recommendation.** Add a foreign key case to the message humaniser that produces
the same "Cancel it instead" wording, rather than extending the guard to six
separate queries. **Reason: the guard would then need updating every time a new
table references a session, and the database already knows the answer.** This
also fixes the same class of error everywhere else in the app at once.

### D-28. Nutrition targets do not follow an athlete's weight

**What it means for a nutritionist.** You set a plan as a rate per kilogram, for
example 2.0 grams of protein per kilogram. Fydr works out the athlete's target
once, from the weight they were on that day, and writes it down. **If the athlete
gains or loses weight, the target does not move.** It stays where it was until
somebody opens the Nutrition section and applies the plan again.

**Why this is worth raising rather than filing as a bug.** The design says
otherwise in its own words: the target should recompute "again on their next
weigh-in" (`supabase/migrations/0039_nutrition_rules.sql:11`). That is the whole
argument for storing a rule rather than a list of numbers. Only the first half is
built.

**What is built.** Assigning or changing a plan recomputes every affected
athlete's target from their latest recorded weight
(`src/lib/queries/nutritionRules.ts:387`), expires the old target and writes a new
one. That part works.

**What is not.** Nothing runs when a weight is recorded. `syncComputedTarget` has
exactly one caller (`src/lib/queries/nutritionRules.ts:387`), reached only from
the plan assignment screen.

**One thing already right, which limits the harm.** Every auto-computed target
carries its own explanation naming the weight it used, for example "Auto-computed
from Squad default (training day) at 96.4 kg"
(`src/lib/queries/nutritionRules.ts:259`). A nutritionist who reads it can see the
staleness. Nothing points it out to them.

**Recommendation.** Recompute when a weight is recorded, for that athlete only.
**Reason: it is the mechanic the design promises, the function to do it already
exists and is tested by the plan assignment path, and the alternative is asking
nutritionists to remember to re-apply plans after every weigh-in.** If that is too
large for now, the cheaper half is to show the staleness on screen: compare the
weight in the reason text with the athlete's current weight and say so.

### D-29. A fixture cannot be deleted, only cancelled

**What it means for a coach.** Enter a match by mistake and you cannot remove it.
You can mark it cancelled, and it stays on the schedule looking like a cancelled
match rather than a mistake.

**Why it is this way, and the reasoning is sound.** A fixture anchors the
matchday label on every session around it. Deleting one either takes the week's
training with it or leaves a week labelled against a match that no longer exists.
No rule was ever agreed for which, so rather than invent one, the action was left
out (`src/components/FixtureActions/FixtureActions.tsx:20`).

**Recommendation.** Allow deletion only when no session in that week is anchored
to the fixture, and refuse otherwise with the reason, in the same shape as the
session delete rule. **Reason: it removes the genuine mistake case, which is
entering a fixture on the wrong date, without needing an answer to the hard
case.**

### D-30. Applying a week template leaves compliance blank until the next day

**What it means for a coach.** Build next week from a template on Sunday evening,
and the compliance figures for that week may show nothing expected until the
following day.

**Why.** Applying a template creates the sessions but does not regenerate the
expectation records that compliance is measured against. Those are generated on a
nightly run instead (`src/lib/queries/weekTemplates.ts:22`). The design's own
confirmation wording promises the regeneration happens; the generator exists and
is safe to call more than once; only the call is missing.

**Recommendation.** Call the generator at the end of applying a template.
**Reason: it is described in the code as a small follow-up now that the generator
exists, and the alternative is a coach seeing a week that looks unmeasured.**

### D-31. Nothing links to the Timetable screen

**What it means.** `/timetable` exists, works, and is reachable only by typing the
address. It is not in the sidebar and not linked from the schedule.

**What it does.** Shows one day's sessions as a list, where the schedule grid
shows a week as a grid.

**Recommendation.** Retire it, and add a day view to the schedule grid if one is
wanted. **Reason: two screens answering "what is on today" is a maintenance cost
and a source of disagreement, and the grid is the one people can find.** If you
would rather keep it, it needs a sidebar row or a link from the schedule, because
an unreachable screen is not a feature.

### D-32. The fifty percent line on the compliance report is unexplained

**What it means for a coach.** The report names the athletes who have fallen
"under half". Nothing says why half is the line, and no club can change it.

**Where.** `src/app/(staff)/reports/compliance/page.tsx`.

**Why it matters.** A club training four days a week and a club training six will
not agree on what a worrying submission rate looks like, and the app already has a
`thresholds` table built for exactly this kind of club specific rule.

**Recommendation.** Confirm fifty percent as the default and record the reasoning,
rather than making it configurable now. **Reason: one more setting is a real cost,
and no club has yet asked for a different line.** Revisit if one does.

### D-33. Renaming a session silently detaches it from its own history

**What it means for a coach.** The training report works out whether a session was
harder than usual by comparing it with earlier sessions **of the same title**.
Rename Tuesday's "Conditioning" to "Conditioning (heavy)" and it becomes, as far
as the report is concerned, a kind of session that has never happened before. It
can no longer be scored, and the screen says there is not enough data to read it.

**Why it works this way, and the reasoning is sound.** The database has no column
for a session subtype. Real sessions repeat weekly by name, so the title is what
the club already uses to mean "the same kind of session"
(`src/lib/queries/trainingReport.ts:12`). Using it was the honest choice.

**Why it still needs a decision.** Nothing warns a coach. A title is the most
casually edited field on the session screen, and editing it quietly costs that
session its history.

**Recommendation.** Warn on the session edit screen when a title is changed and
earlier sessions share the old one, naming how many. **Reason: it costs one
sentence, and the alternative is a coach losing comparability without ever being
told.**

### D-34. The injuries area is not in the sidebar

**What it means.** `/injuries` and its four sibling screens are reachable only
through the injury report or a direct link. A medic signing in has no navigation
route to the working list of injuries, or to the problem reports awaiting their
triage.

**Recommendation.** Give the injuries area a sidebar row visible to coach, medic,
S&C and sport scientist, and not to the nutritionist. **Reason: the triage panel
is work only a medic can do, and a queue nobody can navigate to is a queue that
does not get worked.** This also becomes the natural place to enforce decision
D-01.

### D-35. It is not settled whether a coach may set availability or record an injury

**What it means.** Today a coach can set an athlete's availability and close an
injury. A coach **cannot** create an injury record: that screen is already medical
only (`src/app/(staff)/injuries/new/page.tsx:13`). So the code half enforces the
seed data's claim that the physio is "the only person who can set availability or
read clinical notes" (`supabase/seed.sql:90`): the recording is restricted, the
availability is not.

**Recommendation.** Restrict setting availability to medic and sport scientist,
matching what injury recording already does. **Reason: the code has already made
this choice once, on the screen where it matters most, and leaving the other half
open is an inconsistency rather than a policy.** A coach who notices a problem at
training has the problem reports mechanism, which is designed for exactly that and
routes to a medic.

### D-36. Publishing a week's selection has no confirmation

**What it means.** The publish button on team allocation discloses the whole
week's selection to every athlete at once, and cannot be un-disclosed. The only
warning is the draft count in the button's own label.

**Recommendation.** Add a confirmation naming what is about to become visible and
to whom. **Reason: it is the one action in the app that reveals information to the
squad, and it cannot be taken back.**

### D-37. Editing a programme changes it immediately for everyone on it

**What it means.** Programmes are not versioned and change history is deliberately
not recorded (`src/lib/queries/programmes.ts:22`). Editing a programme mid-block
changes what every assigned athlete sees, with no warning and no way to see what
it used to say.

**Recommendation.** Warn when editing a programme with athletes currently
assigned, naming how many. **Reason: versioning is a large build and the warning
is a sentence; the risk is a coach changing a block without realising twenty
athletes are mid-way through it.**

### D-38. "Invite athletes" sends nothing, and hands out temporary passwords

**What it means in plain English.** The bulk invite screen does not email anybody.
It creates each account with a **temporary password**, marks the email address as
already confirmed, and returns the passwords on screen. Whoever ran it is then
holding working credentials for members of the squad and has to get each one to
the right person by some means Fydr does not provide.

**Where.** `src/app/(staff)/settings/users/bulk-invite/send/route.ts:105`.

**Why this needs a decision rather than a bug report.** It works, and for a club
handing out logins in a room together it may be exactly what is wanted. But the
screen is called "invite", which sets a different expectation, and squad
credentials will in practice travel by group message or spreadsheet.

**Recommendation.** Send a real invitation link instead, so the athlete sets their
own password and proves they own the address, and stop returning passwords on
screen. **Reason: it removes a set of live credentials from circulation entirely,
and the authentication service already provides the mechanism.** If temporary
passwords are kept for a good reason, then at minimum force a change on first sign
in and rename the screen to say what it does.

### D-39. An empty thresholds list looks exactly like a well behaved squad

**What it means for a coach.** Flags are raised by rules the club sets on the
Thresholds screen. If no rules have been set, no flags are ever raised, and the
dashboard shows zero open flags, zero athletes needing attention, and a calm
squad. **There is no way to tell that apart from a genuinely calm squad.**

**Why it matters most for a new club.** A club that has just started using Fydr
has no thresholds until somebody writes them. Their first month will look
reassuring for the wrong reason.

**Recommendation.** Say it on the dashboard: when a club has no thresholds
configured, replace the open flags figure with a line saying nothing is being
watched yet, linking to the Thresholds screen. **Reason: a zero that means "no
rules" and a zero that means "no problems" are opposite messages, and the app
currently shows the same thing for both.**

---

## Corrections to this file

Recorded so that a reader can trust the rest of it.

**The Stage A1 role scan under-reported guards, and every affected document has
been corrected.** That scan detected a page's guard by looking for calls to the
four named guard functions, and counted how often each role was mentioned. It
could not see two other real patterns: an inline `redirect` on a role test, and a
`hasAccess` variable used to render a refusal. Seven pages were therefore recorded
as open to any staff member when they are not, and one screen specification
described a medical-only screen as open. A full re-scan for all three patterns has
been run, the results are in `docs/generated/01-route-inventory.md` section 3, and
D-01 has been narrowed from five screens to four as a result.

**D-09 was wrong and has been withdrawn.** It claimed a clinical review screen was
reachable by any staff member. The page guards correctly. The mistake came from a
scan that counted role mentions per file and could not tell a guard from a
comment. Corrected in `docs/access-matrix.md`, `docs/generated/01-route-inventory.md`
and the two subject access screen specifications.

**A suspected sixty fold error in GPS durations was raised and then withdrawn.**
The upload column is headed "Duration (min)" and the database column is named
`duration_s`, in seconds, which looks like a unit mistake. It is not: the import
multiplies by 60 (`src/lib/queries/gpsImport.ts:216`) and the export converts
back at the file boundary (`:414`). Checked and dismissed before it reached you
as a decision.

---

## Summary

| Group | Entries | Needs your answer |
|---|---|---|
| 1. Differs from the agreed role model | D-01 to D-09 | Yes, eight. D-09 withdrawn |
| 2. Unexplained constants | D-10 to D-13 | Yes, all four |
| 3. Browser only permissions | D-14 | No, none found |
| 4. Tables without row level security | D-15 | No, none found |
| 5. Not built | D-16 to D-18 | Yes, all three |
| 6. Under 18 | D-19 | Yes, one question |
| 7. Wrong tier | D-20 | Yes, one rule to pick |
| 8. Dead controls | D-21 | Not yet |
| 9. Raised in Stage B1 | D-22, D-23, D-24 | Yes, all three |
| 10. Raised in Stage B2 | D-25 | Yes |
| 11. Raised in Stage B3 | D-26 to D-39 | Yes, all fourteen |

**39 entries, one of them withdrawn. 35 need an answer from you.**

**All recommendations were accepted by you on 4 September 2026 ("go ahead with
all your recommendations"). D-22 and D-23 were raised afterwards, during the
metrics registry, and are the two still genuinely open.**

The one I would answer first is **D-01**, because it is the only entry where
your agreed model makes something visible today that must stop being visible,
and the fix is a single shared guard rather than a rewrite.

---

**STOP. Stage A2 is complete. Waiting on your answers before Stage B1, the
metrics registry.**
