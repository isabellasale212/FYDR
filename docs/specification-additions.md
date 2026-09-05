# Proposed additions to the specification

What is missing from the specification set, why each gap matters, and what it
would cost to close.

**Status, 4 September 2026. Six of the seven are done.** Only item 6, the athlete
app, remains, and it is a separate commission rather than an appendix. The
completed sections are left in place rather than deleted, because they record what
each was expected to cost, which is worth comparing against what it actually
turned up.

| # | What | Status |
|---|---|---|
| 1 | Retire the old spec set | **Done.** 38 files moved to `docs/screens/legacy/` with a banner and a README |
| 2 | Server route specifications | **Done.** `docs/server-routes.md`, all 27 verified |
| 3 | State machine appendix | **Done.** `docs/state-machines.md`, 15 machines |
| 4 | First run and empty club | **Done.** `docs/first-run.md` |
| 5 | Journeys across screens | **Done.** `docs/journeys.md`, five journeys |
| 6 | The athlete app | **Not started.** Separate commission |
| 7 | A verification standard | **Done.** `docs/verification-standard.md` |

### One loose end, deliberately left for you

**`docs/first-run.md` and `docs/journeys.md` are on disk but are not yet in the
Word document.** Adding them is two lines in `scripts/build-spec-docx.py`, but it
shifts the appendix lettering again, and that is your call rather than mine. Run
`/spec-export` after adding them.

### What items 4 and 5 turned up that the proposal did not predict

**Decision D-39 needed correcting, and I have amended rather than withdrawn it.**
The proposal treated "a club with no thresholds looks like a calm squad" as an
unmitigated gap. It is not: the thresholds screen detects a club with no rules and
**offers five sensible defaults in one click**, with the fifth deliberately
switched off because it would flag the whole squad on day one
(`src/components/SeedDefaultThresholds/SeedDefaultThresholds.tsx`,
`src/lib/queries/thresholds.ts:206`).

The narrower finding stands: that prompt lives on a settings screen nobody has a
reason to open in their first week, and a club that cleared its rules on purpose
never gets it at all, deliberately. **The dashboard is where the silence needs
breaking.** See `docs/first-run.md` §5.

**The journeys made three defects visible that no screen specification could.**
Each one is a case where every screen involved is correct and the connection
between them is not:

- **The medic's triage queue has no route to it.** Every screen is right; nothing
  navigates there (D-34).
- **Nutrition targets stop following the athlete.** Both screens are right; the
  recompute between them is missing (D-28).
- **A club cannot be started.** Six of the eight onboarding steps work, and the
  second does not (D-16).

**That is the argument for keeping journeys in the set.** A screen specification
guarantees each part is right. It cannot tell you the parts do not join up.

**What items 4 and 5 did not turn up.** No new decisions. Everything they found
was already numbered, which is a reasonable sign that the earlier passes were
thorough.

### What is left, honestly

**Item 6, the athlete app**, and it should be scoped as its own piece of work
rather than bolted on. It is where wellness, rating of perceived exertion, gym
logging and the nutrition check-in are actually created: every number the staff
specification describes reading.

**And 24 open decisions**, which remain the thing that would improve the
specification most. Adding more material now has diminishing returns against
answering those.

Written 4 September 2026, after the specification's own verification pass. Two of
these seven items are hazards created by that work rather than pre-existing gaps,
and they are listed first for that reason.

**Where I could produce the content now rather than describe it, I have.**
Sections 2 and 3 contain finished work you can lift straight into the
specification: the full server route inventory with every guard verified, and the
state machine appendix. The rest are proposals with a scope and an estimate.

**Same conventions as the rest of the set.** Plain English, no jargon without
expansion, every claim carrying the file and line it came from, and UNVERIFIED
wherever I could not establish something.

---

## Summary, so you can choose without reading it all

| # | What | Why it matters | Size | My view |
|---|---|---|---|---|
| **1** | **Retire the old spec set** | Two contradictory files per screen sit in one folder today | Very small | **Do this first.** It is a hazard I created |
| **2** | **Server route specifications** | 27 doors with their own locks. The one real breach in this app's history was here | Small, and the content is already written below | **Do this second** |
| **3** | **State machine appendix** | Five enums whose transitions are scattered. I got two wrong while writing the specification | Small, content written below | Do it |
| **4** | **First-run and empty-club states** | Every club passes through it. One instance is already a medium-risk gap | Medium | Worth it |
| **5** | **Journeys across screens** | Everything is specified alone; nothing describes a coach's Monday | Medium to large | Only if the specification is for people, not just for me |
| **6** | **The athlete app** | Where every number the staff app reads is actually created | Large | Separate commission |
| **7** | **A verification standard** | The specification claims things are checked. It should say what checking means | Small | Do it with 1 |

---

## 1. Retire the old specification set

**This is a hazard I introduced and it should be closed before anything else.**

### The problem

`docs/screens/` currently holds **two overlapping specification sets**:

- 38 files under the old names: `dashboard.md`, `schedule.md`, `reports.md`,
  `settings.md`, `flags.md`, `testing.md`, `leaderboards.md` and others
- 62 files under the new numbered names: `01-dashboard.md`, `07-schedule.md`,
  `17-reports-hub.md` and so on

**They contradict each other.** `docs/screens/dashboard.md` still describes the
Squad state card, which was removed from the app on 4 September 2026 and folded
into Ready for Saturday. Anyone reading it would rebuild a card that was
deliberately deleted.

**And CLAUDE.md does not say which to read.** Section 0 says "read the relevant
file in `docs/screens/` before changing any screen", which now names two files
for most screens.

### What to do

Move the old set to `docs/screens/legacy/` and add a one paragraph note at the
top of each explaining that it predates the build specification and is kept for
its reasoning, not its instructions. Then make CLAUDE.md §0 name the numbered
files specifically.

**Move rather than delete**, for two reasons. Several old files carry reasoning
the new ones do not repeat, particularly around decisions that were made and
reversed. And the new specifications cite them: `training-report.md` is named in
the training report's own source as the origin of its scoring model.

### Size

Twenty minutes, and it is mechanical.

---

## 2. Server route specifications

### Why this matters more than it looks

The staff app has **27 server routes**: 14 report downloads, 3 testing downloads,
and 10 actions. They are not screens, so Stage B3 did not specify them. They got
one summary paragraph.

**The one real access breach in this app's history was in exactly this gap.** The
training report's two download routes once answered a plain request with the
complete GPS board while the screen above them was correctly gated, because the
buttons were never drawn on the Base package. The lesson is recorded in the code
itself: a hidden button is not a gate
(`src/lib/session.ts:126`).

The specification states the rule "a download carries the same permission as the
screen it belongs to, without exception" and does not verify it route by route.

### The verification, done

I have now checked all 27. **Every route has a guard, and none is weaker than its
screen.** That is a clean result and worth having on the record.

**Report downloads.** All fourteen call `requireReportAccess`, matching their
screens.

| Route | Guard | Package |
|---|---|---|
| `/reports/athlete/[athleteId]/export` | `requireReportAccess` | Base |
| `/reports/athlete/[athleteId]/pdf` | `requireReportAccess` | Base, GPS regions gated |
| `/reports/compliance/export` and `/pdf` | `requireReportAccess` | Base |
| `/reports/injuries/export` and `/pdf` | `requireReportAccess` | Base |
| `/reports/squad/export` and `/pdf` | `requireReportAccess` | Base |
| `/reports/testing/export` and `/pdf` | `requireReportAccess` | Base |
| `/reports/training/export` and `/pdf` | `requireReportAccess` **and a package check** | **Premium** |

**The training report's two routes now carry the package check on the server**,
which is the fix for the breach described above. Verified present on both.

**Testing and leaderboard downloads.**

| Route | Guard | Package |
|---|---|---|
| `/testing/[testDefId]/[athleteId]/export` and `/pdf` | `requireReportAccess` | Base |
| `/leaderboards/[leaderboardId]/export` and `/pdf` | `requireStaff` plus a coach or medical check, plus a package check | Base, Premium for a GPS board |

**Action routes.**

| Route | Guard | What it does |
|---|---|---|
| `/settings/users/create` | admin | Creates an account, grants roles, audits |
| `/settings/users/bulk-invite/send` | admin | Creates accounts in bulk, returns temporary passwords |
| `/settings/users/[userId]/mfa` | admin | Removes somebody's second factor |
| `/settings/retention/preview` | admin | Reads only. Changes nothing |
| `/settings/retention/run` | admin | **Permanently deletes athlete data** |
| `/settings/subject-access/[requestId]/release` | admin | Hands an athlete their data pack |
| `/squad/[athleteId]/subject-access` | admin | Opens a subject access request |
| `/settings/exports/generate` | `requireReportAccess` | Produces an export file |
| `/settings/imports/upload` | `requireStaff`, coach or medical, **and Premium** | Writes GPS records |
| `/settings/imports/template` and `/[batchId]/export` | Same | Reads only |

**Every admin route above moves to the sport scientist** under the agreed role
model. That is part of gap G-02 and is the reason this table is worth having: it
is the checklist for that work.

### What a route specification would add beyond this table

Four sections rather than nine, because a route has no layout:

1. What it produces, and whether it reads or writes
2. Who can call it, and where that is enforced
3. What it does when refused: status code and wording
4. What it records in the audit log

**One question this would settle that the table cannot.** Whether each download
respects the group filter and period of the screen it came from. This was checked
for the athlete report, where it had been a real defect and was fixed, and **not**
for the other twelve. Files searched: the athlete report's own route, which
resolves the period through the same function as its screen
(`src/app/(staff)/reports/athlete/[athleteId]/export/route.ts:31`).

### Size

Half a day. The access half is already done above.

---

## 3. State machine appendix

### Why

Fydr has **fifteen enumerated states** that a record moves through, and the
allowed transitions are described in whichever screen happens to perform them. No
single place says what the states are or which moves are legal.

**I got this wrong twice while writing the specification**, which is the best
argument for the appendix. I wrote that a fixture could be deleted, when the
action does not exist and three status changes take its place. And I described an
injury as deletable when it can only be closed.

### The appendix, drafted

**Injury status** (`injury_status`). Four states: **open, rehab, return to play,
closed**.

An injury is **never deleted**. Closing it is the end state, and deletion exists
only for the audited erasure process, which is not a physio action
(`supabase/migrations/0005_injuries_and_availability.sql:43`).
**UNVERIFIED: whether the four states must be traversed in order**, or whether an
injury can go straight from open to closed. Files searched:
`src/lib/queries/injuries.ts`, `supabase/migrations/0005_injuries_and_availability.sql`.

**Availability status** (`availability_status`). Three states: **available,
modified, unavailable**, plus a fourth condition that is not a state at all.

An athlete with **no availability record** reads as **unknown**
(`src/lib/queries/availability.ts:151`). Unknown is not in the enum: it is the
absence of a row. Screens must not fold it into available, and the injury report
correctly counts it separately.

Changing availability **closes the previous record and opens a new one** rather
than editing in place, so an athlete has a history rather than a current value.

**Fixture status** (`fixture_status`). Four states: **scheduled, played,
postponed, cancelled**.

**There is no delete.** The three status changes are the whole vocabulary, and
the reason is recorded: a fixture anchors the matchday label on every session
around it, and no rule was ever agreed for what deleting should do to them
(`src/components/FixtureActions/FixtureActions.tsx:20`). This is decision D-29.

**Session status** (`session_status`). Three states: **planned, completed,
cancelled**.

Cancelling is reversible and fires immediately. **Deleting is refused** when the
session has recorded data, or when it is in the past
(`src/lib/queries/schedule.ts:1294`, `:1297`). Four further tables reference a
session and the database refuses those deletions too, with a message that does
not help, which is decision D-27.

**Flag status** (`flag_status`). **Seven** states: **raised, notified,
acknowledged, actioned, monitoring, resolved, dismissed**
(`supabase/migrations/0001_extensions_and_enums.sql:190`).

**Only four count as open**: raised, notified, acknowledged and monitoring
(`src/lib/queries/flags.ts:102`). A flag escalates 24 hours after being raised
without acknowledgement (`:108`), which is decision D-12.

**UNVERIFIED: what puts a flag into `actioned` or `resolved`.** The flag card
offers acknowledge and dismiss, and neither of those names appears on it. Files
searched: `src/components/FlagCard/FlagCard.tsx`, `src/lib/queries/flags.ts`.
**Two of seven states may be unreachable from the interface**, which would be
worth knowing.

**Team allocation status** (`team_allocation_status`). Three states: **draft,
published, withdrawn**.

Publishing discloses a whole week to the squad at once and cannot be
un-disclosed. Withdrawn exists, so a publication can be retracted, but **the
athletes have already seen it**. This is decision D-36.

**Subject access request status.** Three states, held as a constrained text
column rather than an enum: **pending review, reviewed, released**
(`supabase/migrations/0032_subject_access_pack.sql:57`).

A request cannot be released until a medic has reviewed the clinical part, which
is what makes this a two role process.

**Programme assignment status** (`assignment_status`). Four states: **active,
suspended, completed, cancelled**.

**Programme status** (`programme_status`). Three: **draft, active, archived**.

**Gym log status** (`gym_log_status`). Three: **in progress, complete,
abandoned**.

**Problem report status** (`problem_report_status`). Three: **open, acknowledged,
closed**. This is the queue only a medic can work, and nothing links to it, which
is decision D-34.

**User status** (`user_status`). Four: **invited, active, suspended,
deactivated**.

**UNVERIFIED: whether the interface can move a user out of `invited`**, given
that bulk invite marks email addresses confirmed at creation. Files searched:
`src/app/(staff)/settings/users/create/route.ts`.

**Athlete status** (`athlete_status`). Three: **active, injured long term, left
club**. The roster excludes `left_club` and soft deleted athletes
(`src/lib/queries/squad.ts:96`).

**Attendance status** (`attendance_status`). Four: **full, modified, absent,
excused**. **Only full and modified count as attended**
(`supabase/migrations/0016_leaderboards.sql:397`), which is MET-011.

### What this appendix would prevent

Three things, each of which already happened:

- A screen specification describing an action that does not exist
- A screen offering a transition the database refuses, producing an unhelpful
  error
- Two states existing in the schema that no interface can reach

### Size

The draft above is most of it. Half a day to resolve the three UNVERIFIED items
and draw the transition diagrams.

---

## 4. First run, and the empty club

### Why

**Every club passes through this state and no specification treats it as real.**
Each screen has an "empty" line in section 8, but they were written as edge cases.
For a club in its first fortnight, empty is the whole experience.

One instance is already a medium risk gap: **a club with no thresholds raises no
flags, and a dashboard showing zero open flags looks exactly like a well behaved
squad** (decision D-39). The club most likely to hit it is a new one, which is
also the one least able to tell.

### What it would cover

The state of the app at each stage of a club's first fortnight, and what the app
should say at each:

**Nothing at all.** No athletes, no groups, no sessions, no thresholds. Today the
squad cannot even be created: there is no screen that adds a player, which is gap
G-14. So the honest first-run specification has to describe a step that does not
exist.

**Athletes but no data.** Every chart empty, every compliance figure empty rather
than zero, every trend absent. The distinction between "empty" and "zero" is
already carefully drawn in the code and should be stated once here rather than
per screen.

**A week of data.** Bands cannot be drawn: the wellness trend needs 14 days
(MET-006), the acute to chronic ratio needs 21 of 28 days (MET-010), and a
leaderboard needs its minimum population (MET-038). **Three different silences,
for three different reasons**, and a coach cannot currently tell them apart.

**A month.** Most things work. The training report still cannot score a session
whose title has not repeated.

### The one rule I would propose

**An absence should always say which kind it is.** There are four, and they mean
completely different things:

- Nothing was expected
- Something was expected and did not arrive
- Enough arrived but not enough to compute this
- Nothing is configured to watch for it

The fourth is the dangerous one, and it is D-39.

### Size

One to two days, and it needs product decisions rather than code reading.

---

## 5. Journeys across screens

### Why

Every screen is specified alone. Nothing describes what a person actually does,
which is the thing a specification is usually for.

`docs/03-flows.md` exists and predates all of this. It has not been reconciled
with anything and I have not read it against the code.

### The five I would write

**A coach's Monday morning.** Open the dashboard, read the attention list, open
two athletes, check who is fit for Saturday, adjust the week. This is the
journey the dashboard was designed around and the only one with a stated success
criterion: three athletes identified in under fifteen seconds without applying a
filter.

**An injury, end to end.** An athlete reports a problem in their own app. It
lands in the medic's triage queue, which **nothing links to** (D-34). A medic
turns it into an injury record, which a coach cannot do (D-35). Availability
changes, which a coach currently can. The athlete appears on the injury report in
the limited view, joins a rehab group, and eventually returns.

**Writing and applying a training week.** A template becomes real sessions, and
compliance expectations lag by up to a day (D-30).

**A nutrition plan.** A rule is set per kilogram, applied, and **stops following
the athlete's weight** (D-28). This journey is the clearest demonstration of that
defect and would make the case better than the decision entry does.

**Onboarding a club.** Which stops immediately, because no screen adds a player.

### What makes these worth writing

**Four of the five run into an open decision**, and in each case the journey shows
why it matters better than the decision entry does. A specification that only
describes screens cannot show that the injury journey has a queue nobody can
navigate to.

### Size

Two to three days. Most of the material exists; the work is the walking through.

---

## 6. The athlete app

### Why it is missing, and whether that is right

Your brief said the staff app, so its absence is correct. It is listed because it
is the largest thing outside the boundary and the boundary is a choice.

**Every number the staff app reads is created here.** Wellness, rating of
perceived exertion, gym logging and the nutrition check-in are all athlete
entries. The staff specification describes what happens to them and not where
they come from.

**What exists.** A full experience at `src/app/(athlete)/`: sign in, a four tab
shell, wellness and rating entry, gym logging, My Data, Programme and Me. It is
responsive web, not the native app the older documents describe.

**Three things that would need saying and are not said anywhere.**

The **athlete's own view of their injury** excludes the clinical notes, through a
restricted view rather than by the app choosing not to show it
(`supabase/migrations/0005_injuries_and_availability.sql:83`).

**Consent** is the athlete's, not the club's: an under 18 does not appear on a
leaderboard without it (`src/lib/leaderboardVisibility.ts:9`).

**Entries are immutable once submitted.** A correction creates a new record and
supersedes the old one. The athlete app is where that rule is felt.

### Size

Comparable to what has just been done. A separate commission, not an appendix.

---

## 7. A verification standard

### Why

The specification says things like "verified access, from the code" and marks
others UNVERIFIED. **It does not say what verified means**, and during this work
that meaning changed.

Three findings were withdrawn as wrong, all from the same cause: inferring
behaviour from the shape of a file rather than reading the lines that mattered. A
scan that found which guard function a page called was treated as sufficient, and
it was not.

### What it would say

**Three levels, named on each claim.**

**Read.** Somebody read the code that does this and can quote the line. This is
what "verified access" now means on all 62 screens.

**Run.** Somebody made the app do it and saw the result. **Almost nothing in the
specification is verified at this level**, and it is the only level that would
have caught a control that looks interactive and is not.

**Inferred.** Reasoned from the shape of the code without confirming. **This
level should not appear in a specification at all**, and the three withdrawn
findings were all of this kind.

### The rule I would add

**A finding that something is broken must be verified at the Run level before it
is reported.** A false finding costs more than a missing one: it sends somebody
to fix working code, and it makes every other finding less believable.

That rule would have prevented all three withdrawals, at the cost of some effort
on each.

### Size

An hour to write. It belongs beside the "how to read this document" page, and
`/spec-drift` already carries a version of the lesson.

---

## What I would actually do, if it were my call

**Now, because it is a hazard:** item 1. Twenty minutes.

**Next, because there is a breach in its history:** item 2. The content is
written above.

**Then item 3**, mostly drafted, and **item 7**, an hour.

**Items 4 and 5 when somebody other than me needs to use the specification**,
because they are what turn a reference into something a person can read.

**Item 6 is a separate commission** and should be scoped as one.

**One thing I would not do.** Keep adding decisions. There are 22 open, and the
specification is more useful once those are answered than it is with more
material stacked on top.
