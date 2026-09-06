# Spec gaps: the work queue

Stage B4. Where the code now differs from the agreed specification, ordered by
risk, highest first. **No code has been changed.** This is a list of work, not a
record of work done.

**How risk is ranked here.** Security and data exposure first, then things that
lose or corrupt data, then things that mislead a coach into a wrong decision, then
things that are missing, then cosmetic. Within a band, the cheaper fix comes
first, because clearing it costs less than leaving it.

**Every row names its decision.** The reasoning lives in
`docs/decisions-required.md`; this file is the queue.

---

## Band 1: data exposure

### G-01. Injury information is visible to a role that must not see it

**Risk: HIGH.** The agreed model says the nutritionist sees no injury or medical
information anywhere. Today a nutritionist holds the `coach` role and sees all of
it.

**What the spec requires.** Nutritionist is X on every injury screen, and the
injury derived regions are withheld on the dashboard, squad overview, flags, squad
weekly report and reports hub.

**What exists.** Four of the five injury screens call only the staff guard. The
shared regions have no role condition at all.

**Files.** `src/app/(staff)/injuries/page.tsx`,
`.../injuries/[injuryId]/page.tsx`, `.../injuries/rehab-groups/page.tsx`,
`.../injuries/team-allocation/page.tsx`, plus the shared regions named in
`docs/access-matrix.md` §4.2.

**Note.** `/injuries/new` is already medical only and needs no change beyond
moving its rule into the shared guard.

**Decision D-01.** **This cannot be done before G-02**, because the role it must
exclude does not exist yet.

### G-02. The role model itself

**Risk: HIGH**, because every other access gap depends on it and because a partial
implementation can silently open access.

**What the spec requires.** Five roles, no admin, sport scientist with everything.

**What exists.** Four roles: athlete, coach, medical, admin.

**Files.** `supabase/migrations/0001_extensions_and_enums.sql:77`,
`src/lib/supabase/claims.ts:22`, `:94`, `:124`, `src/lib/session.ts:120`, `:159`,
eleven page and route checks, every row level security policy naming a role,
`src/components/Sidebar/Sidebar.tsx:111`, `:163`, `:188`, every threshold's notify
list, and the existing role rows in the live database, which need a migration.

**Decision D-07.** **Write the tests first.** This is the one item that can open
access if done in pieces.

### G-03. Bulk invite hands out live credentials

**Risk: HIGH.** Accounts are created with temporary passwords returned on screen,
email addresses pre-confirmed, no forced change and no expiry. Squad credentials
then travel by whatever channel is to hand.

**What the spec requires.** An invitation the athlete acts on themselves.

**Files.** `src/app/(staff)/settings/users/bulk-invite/send/route.ts:105`.

**Decision D-38.** Cheaper interim: force a password change on first sign in.

### G-25. Re-uploading a GPS file duplicates every row

**Risk: HIGH.** Silent data corruption on the data that feeds the whole GPS half
of the app, invisible to the coach who caused it.

**What the spec requires.** Re-uploading a corrected file replaces what it
replaces.

**What exists.** The import always inserts
(`src/lib/queries/gpsImport.ts:234`). There is no replace and **no unique
constraint** to catch it: the three indexes on the records table are ordinary
(`supabase/migrations/0023_gps_records.sql:99`). Upload twice and every distance
doubles.

**Decision D-42.** The fix is a unique constraint on athlete, date and session,
plus an upsert. Found in the verification pass, not the first pass.

---

## Band 2: loss or corruption of data

### G-04. Nutrition targets do not follow an athlete's weight

**Risk: MEDIUM-HIGH.** Not a loss of data, but a silently wrong number in front of
a nutritionist, which is worse than a blank.

**What the spec requires.** A target recomputes when the athlete next weighs in.

**What exists.** It recomputes only when a plan is assigned. The recompute function
has one caller.

**Files.** `src/lib/queries/nutritionRules.ts:224` and `:387`.

**Decision D-28.** Cheaper interim: compare the weight in the target's own reason
text against the athlete's current weight and say when they differ.

### G-05. Renaming a session detaches it from its own history

**Risk: MEDIUM.** The training report groups by session title. A rename silently
costs that session its comparability, with no warning.

**Files.** `src/lib/queries/trainingReport.ts:12`, and the session edit form.

**Decision D-33.** The fix is a warning, not a rebuild.

### G-06. Deleting a session can fail with a message that does not help

**Risk: MEDIUM.** Nothing is lost, but the coach is told "something went wrong"
with no reason and no alternative.

**Files.** `src/lib/writeErrors.ts:129` onward. The fix is one case in the message
humaniser, which repairs this class of error everywhere at once.

**Decision D-27.**

### G-07. Editing a programme changes it for everyone on it, silently

**Risk: MEDIUM.** No versioning, no history, no warning.

**Files.** `src/lib/queries/programmes.ts:22`, and the programme edit screen.

**Decision D-37.** The fix is a warning naming how many athletes are assigned.

### G-26. The retention run is not all or nothing

**Risk: MEDIUM-HIGH**, because it is the one screen that permanently deletes
athlete data.

**What exists.** Categories are processed in sequence and the run returns on the
first error (`src/lib/retention/compute.ts:206` onward), leaving earlier
categories deleted and later ones not.

**Decision D-43.** Make it resumable rather than transactional.

### G-27. Changing a test's direction leaves every existing best flag wrong

**Risk: MEDIUM.** The rule that flags the best attempt runs when a result is
written, not when a definition changes
(`supabase/migrations/0024_testing.sql:163`).

**Decision D-41.** The fix is a one line guard refusing the change once results
exist.

---

## Band 3: misleading a coach into a wrong decision

### G-28. "Personal best" is not a personal best

**Risk: MEDIUM.** The flag marks the best attempt **on one day**, not a lifetime
best (`supabase/migrations/0024_testing.sql:152`). Screens label it Personal best.

**What the app computes is correct**; only the label is wrong. Gym weights take
the most recent flagged attempt, which is right for a one repetition maximum.

**Decision D-40.** Rename on screen, and give a true lifetime best its own name
where one is wanted.

### G-08. Readiness is two different numbers under one name

**Risk: MEDIUM.** Analytics shows nothing where every other screen shows a score,
for any athlete who skipped one slider. An internal note claims the two match.

**Files.** `src/lib/stats.ts:25`, `src/lib/analyticsBuilder.ts:120`.

**Decision D-22.** Two fixes: rename one on screen, and correct the note.

### G-09. An empty thresholds list looks like a calm squad

**Risk: MEDIUM**, and highest for a new club, which is exactly when nobody notices.

**Files.** The dashboard's open flags region.

**Decision D-39.**

### G-10. Four unexplained cutoffs decide every training report verdict

**Risk: MEDIUM.** 122, 110, 92 and 82 decide whether a coach is told a session was
much harder than usual. Nothing records where they came from.

**Files.** `src/lib/queries/trainingReport.ts:165` to `:174`.

**Decision D-11.** The work is agreeing them, then writing the reasoning down.

### G-11. Two leaderboard measures can be ranked but never updated

**Risk: LOW-MEDIUM.** A board built on running distance or high intensity efforts
works today and quietly stops gaining entries.

**Files.** `src/lib/queries/gpsImport.ts:40`,
`supabase/migrations/0056_gps_leaderboard_metrics.sql:95` and `:101`.

**Decision D-24.**

### G-12. Publishing a week's selection has no confirmation

**Risk: LOW-MEDIUM.** It discloses a week of selection to the whole squad and
cannot be taken back.

**Files.** `src/components/PublishWeekButton/PublishWeekButton.tsx`.

**Decision D-36.**

### G-13. Applying a week template leaves compliance blank until the next day

**Risk: LOW-MEDIUM.** A week built on Sunday reads as unmeasured until Monday.

**Files.** `src/lib/queries/weekTemplates.ts:22`. The generator exists and is safe
to call more than once; only the call is missing.

**Decision D-30.**

---

## Band 4: required but not built

### G-14. There is no way to add a player to the squad

**Risk: MEDIUM as a product gap, LOW as a defect.** A club that signs a player in
October cannot record them. No screen, no route, no insert anywhere in `src/`.

**Decision D-16.** Owner: sport scientist.

### G-15. The role permission warning at the point of granting

**Risk: MEDIUM**, because it is the only place the nutritionist rule can be lost.

**Files.** `src/app/(staff)/settings/users/create/route.ts:107` and the user detail
screen.

**Decision D-25.**

### G-16. Quiet hours for notifications

**Risk: LOW.** The columns exist; no screen sets them.

**Files.** `src/lib/queries/notificationPreferences.ts:20`. **Decision D-18.**

### G-17. Billing

**Risk: LOW as a defect, and possibly not a gap at all.** There is no billing
surface and the app says plan changes are a sales conversation.

**Decision D-17.** The decision needed is whether this is permanently out of scope
or merely not yet built. These are different documents.

---

## Band 5: navigation and consistency

### G-18. The injuries area is not in the sidebar

**Risk: LOW as a defect, MEDIUM in practice.** A medic has no navigation route to
the problem reports queue that only they can work.

**Decision D-34.** This is also the natural place to enforce G-01.

### G-19. Nothing links to the Timetable screen

**Risk: LOW.** It works and is unreachable except by typing the address.

**Decision D-31.** The recommendation is to retire it.

### G-20. WITHDRAWN. The reports hub is correct as built

The hub is deliberately open and marks each card unavailable to a role that cannot
open it (`src/app/(staff)/reports/page.tsx:120`). Decision D-08 is withdrawn. The
row is kept so the numbering does not shift under anyone who has quoted it.

### G-21. Flag escalation is fixed at 24 hours for every club

**Risk: LOW.** Unexplained, and not configurable, although a thresholds table
exists for exactly this kind of rule.

**Files.** `src/lib/queries/flags.ts:108`. **Decision D-12.**

### G-22. The compliance "under half" line is unexplained

**Risk: LOW.** **Decision D-32.**

### G-23. One wellness window is declared in two files

**Risk: LOW.** Both are currently 14. It is on the list because it is how one
screen quietly starts disagreeing with another.

**Files.** `src/lib/queries/playerProfile.ts:136`,
`src/lib/queries/athleteReport.ts:136`. **Decision D-13.**

### G-24. A 110 kg reference athlete is hard coded into nutrition, unexplained

**Risk: LOW.** **Files.** `src/lib/nutritionMeals.ts:59`. **Decision D-10.**

---

## Still unverified, and worth resolving before sign-off

These are not gaps. They are questions the specification could not answer from
the code, each of which would change what a screen specification says.

| Question | Where | Why it matters |
|---|---|---|
| Does re-uploading the same GPS file duplicate rows or replace them? | `src/lib/queries/gpsImport.ts` | Decides whether a coach correcting a file doubles a week's distances |
| Is a new threshold applied to existing data? | `src/lib/queries/thresholds.ts` | Decides whether creating a rule is quiet or raises hundreds of flags at once |
| Does deleting a group used by a session's expectations get refused? | `src/lib/queries/groups.ts` | Would silently change what compliance measures |
| Does an export respect the current group filter? | `src/app/(staff)/settings/exports/generate/route.ts` | A coach may reasonably expect it to match what they were looking at |
| Is the retention run all or nothing? | `src/app/(staff)/settings/retention/run/route.ts` | It permanently deletes athlete data |
| Can a test's direction be changed after results exist? | `src/lib/queries/testing.ts` | It would silently re-decide every personal best |
| Must a temporary password be changed on first sign in? | Bulk invite and sign in | Part of G-03 |

---

## Band 6: opened by the five-role migration, 2026-09-05

These four are the deliberate remainder of the role model push. Each one was
found by running the suite, and each is written down rather than guessed at.

### G-29. CLOSED, 2026-09-05. Role checks read against the matrix

Was: 114 role checks in 77 files, none of which named `strength_conditioning`
or `nutritionist`, so both roles were refused product-wide.

Closed by `src/lib/access.ts`, which holds one named role set per distinct
column pattern in §3, and by migrations 0066 to 0069, which move the database
the same way. 27 route gates now name a set instead of writing role literals
inline, and `npm run test:role-model` asserts each one against the matrix row it
comes from. The remainder of the 114 are render flags implementing the partial
cells of §4, not gates.

**What is NOT closed is G-33 below**, which is the half of the matrix that would
take access away rather than grant it.

### G-29a. The original entry, kept for its reasoning

114 role checks live in 77 files. The migration renamed the literals in all of
them, so none names a role that no longer exists, and `npm run test:role-model`
proves that. What it does not prove is that any given check admits the right
people now that there are five roles instead of four. **Not one of the 114
mentions `strength_conditioning` or `nutritionist`**, so both roles are refused
by every screen-level check that names roles explicitly.

That is fail-closed and therefore safe, but it means an S&C coach currently
cannot open most of the screens §3 grants them. The matrix already specifies the
answer for every screen; this is the work of applying it.

**Risk: medium-high.** Not a leak. A large amount of the product is invisible to
two of the five roles.

### G-30. `requireReportAccess` cannot express the nutritionist's partial access

§4 gives a nutritionist **V** on the Compliance report and **VP** on the Reports
hub and Squad weekly, and none on Testing, Training, Athlete or Injury. The guard
is one blanket gate, so it refuses the role outright. Splitting it needs a
per-report decision, not a wider list.

**Risk: low.** A role sees less than it should.

### G-31. CLOSED, 2026-09-05. The athlete domain screens

`loadAthleteDomainContext` gated on `coach || medic`, so all three athlete
domain screens (wellness, gym, nutrition) refused the sport scientist, the S&C
and the nutritionist. It now takes a role set, defaulting to every staff role,
and the gym screen passes `ATHLETE_GYM` because §3.1 reads "VE V V VE X" on that
row alone.

### G-31a. The original entry

`src/lib/athleteDomain.server.ts:93` admits coach or medic only. §1 gives the
sport scientist everything. Left alone deliberately in the role push, because it
gates a different surface and this build does not bundle unrelated access
changes.

**Risk: low-medium.** The role that is meant to have no restrictions is refused.

### G-32. Three test files asserted refusals without RLS switched on

`330_tier_rls_test.sql` and `340_assigned_sessions_by_week_test.sql` set JWT
claims but never ran `set local role authenticated`, so they executed as the
table owner. An owner bypasses RLS unless the table is set to FORCE ROW LEVEL
SECURITY, and no table here is. Every refusal those files asserted was therefore
untested; the tier enforcement added by `0061_tier_in_rls.sql` had no working
test at all. `340` additionally inserted into a `groups.created_by` column that
has never existed, so three of its assertions had never passed.

**Fixed in this push**, and recorded here because the shape is worth watching
for: a test that asserts a refusal proves nothing unless the session is actually
subject to RLS. Only `020_cross_tenant_test.sql` carried the line.

**Risk when live: high.** Now closed.

---

## Band 7: decisions the matrix implies that nobody has taken

### G-33. RESOLVED, 2026-09-05. All five rows decided and built

The five-role migration was carried out **widen only**: every role kept what it
could do the day before, the sport scientist gained everything, and the S&C and
the nutritionist got their own domains. Five rows of `docs/access-matrix.md` §3
would have gone further and **removed** something a person uses today, and an
earlier draft that applied one of them broke eleven tenancy assertions, all of
them a coach doing a coach's job. So the five were put to the owner rather than
decided inside a migration.

All five came back decided. Three different answers, which is the value of
having asked rather than guessed:

| Row | Decision | Reasoning given |
|---|---|---|
| §3.1 New and edit session | **Narrowed.** Medic loses scheduling | Not an intentional permission. The same "coach or medic actually meant not-admin" artefact 0066 found everywhere else, so a bug fix rather than a policy change |
| §3.4 Leaderboard | **Split, not taken as written.** Medic loses create, **coach keeps it** | The medic's create is the same artefact. The coach's is a real permission somebody chose, so the **matrix was corrected** to VECD in the coach column rather than the code being built against a cell nobody meant |
| §3.3 Nutrition targets | **Narrowed as written.** Coach and medic both read-only | Specialist territory in the original spec, not a casualty of the four-role bug |
| §3.3 Programme builder | **Narrowed as written.** Gym authoring is the sport scientist's and the S&C's | See the lean-club note below |
| §3.6 Import GPS | **Narrowed as written.** The sport scientist alone | See the lean-club note below |

**Built in** `supabase/migrations/0070_specialist_writes.sql`, which narrows 28
policies, and in `src/lib/access.ts`, where the named sets moved with them.
Scheduling was applied to week templates as well as sessions: a week template is
scheduling under another name, and a medic who cannot create a session but can
create a week of them is not a rule anybody meant.

**The lean club, and why it did not argue for a wider default.** The obvious
objection to the last two rows is a club with no dedicated S&C: narrow the base
role and somebody is locked out of a screen the day it ships, with nobody to
hand it to. The answer is that an account already holds several roles at once. A
coach who also does the S&C work holds both, and the S&C role satisfies the
check. It is the same additive property §2 of the matrix warns about from the
other direction, where a nutritionist holding coach can see injury data, and it
is the reason D-25's combination warning exists at all.

That answer is only worth giving if it is true for these exact screens, so it is
asserted rather than assumed. `supabase/tests/070_programmes_test.sql` carries a
fixture user holding **coach and strength_conditioning together** and checks
they can author a gym programme that neither a plain coach nor a plain medic
can, and that holding two roles grants exactly those two: rehab is still
refused. It worked without any change, which is what "Fydr already supports
this" needed to mean before it could be the answer.

**What this cost, honestly.** 56 tenancy assertions changed, every one of them a
coach or a medic doing something they no longer do. None of them was a defect
being fixed; they were an accurate record of the old rules. The suite ends at
1523 assertions, up from 1516.

---

## Band 8: found by the silent-save audit, 2026-09-05

### G-34. FIXED, 2026-09-05. Screens that let somebody save a change that never happened

**0070 is no longer blocked by this.** All of it is fixed and Run-verified with
both controls: as a medic every one of these now returns a message, and as a
coach every one still works.

**A correction to the original finding, because it was the headline.** #1 named
`expireTarget` and `NutritionTargetsList`, and that component is **dead code**:
no page imports it, so nothing there was ever reachable. I checked reachability
for some of the six and assumed it for that one, on the strength of the page
gate alone. The real nutrition path is `assignPlan`
(`src/lib/queries/nutritionRules.ts:281`): when a target already exists for
TODAY it takes an UPDATE branch and returns success **without ever attempting an
insert**. On any other day it inserts, which raises 42501 and is loud, which is
exactly why the silent case hid. `/nutrition` renders `NutritionWorkspace`,
whose `canEdit` was `isCoach || isMedical`.

**Two other things the fix pass corrected in the finding.** `setTeamAllocation`
is not silent: its update is followed by an insert that raises. And
`TeamAllocationBoard` was never one of the six either, because it already gated
on `canAllocate`; what was wrong there is that the page resolved it from
`isCoach`, omitting the sport scientist. `PublishWeekButton` was the unguarded
one.

**Fixed in two independent halves**, because either alone leaves it reachable:
the control is offered only to roles that may write, resolved from the matching
set in `lib/access.ts`; and each write asks for its affected rows, so a future
mismatch raises instead of lying. `npm run test:silent-saves` asserts both, per
screen and per function.

The one write that does not get a hard row-count rule is `publishWeek`: it is a
bulk update over a week, so zero rows means either "no drafts" or "refused", and
it runs a second query in that branch to say which rather than guessing.

**The original finding follows, unedited.**

### G-34a. As first written

**DEPLOY BLOCKER FOR `0070_specialist_writes.sql`.** That migration must not go
to production until this is fixed. It is not a nice-to-have: 0070 is what
creates five of the six, and shipping it alone turns a working button into a
button that lies.

**The mechanism, which is why this is easy to miss.** Postgres raises `42501`
when an INSERT violates a `WITH CHECK`. It does **not** raise when an UPDATE or
DELETE fails a `USING` clause: the row is simply not matched, the statement
succeeds, and zero rows change. supabase-js `.update()` returns
`{ error: null }` with no row count unless asked. So the app sees success, calls
`router.refresh()`, and the value reappears unchanged with no message.

**All three conditions hold for these six**: RLS filters rather than raises, the
call site never inspects the row count, and the UI offers the control to a role
the policy excludes. Each was verified by running the real UPDATE as that role
against seeded data and rolling back, not by reading policies.

| # | Screen | Control | Reachable by | May write | **Silently fails for** |
|---|---|---|---|---|---|
| 1 | `/nutrition` | Expire a target | coach, medic | SS, nutritionist | **coach, medic** |
| 2 | `/injuries/team-allocation` | Publish week, set/withdraw allocation | SS, coach, medic, S&C | SS, coach | **medic, S&C** |
| 3 | `/settings/thresholds` | Activate / archive | all five | SS, coach | medic, S&C, nutritionist |
| 4 | `/schedule/[sessionId]` | Cancel / reinstate | all five | SS, coach | medic, S&C, nutritionist |
| 5 | `/schedule/planner/[templateId]` | Archive / restore template | all five | SS, coach | medic, S&C, nutritionist |
| 6 | `/leaderboards/[id]` | Publish / delete board | all five | SS, coach, S&C | medic, nutritionist |

**#1 is the worst.** `NutritionTargetsList.tsx:61` reads
`canExpire = isCoach || (isMedical && …)`, so the button is shown to *exactly*
the two roles for whom it now does nothing. Everybody who can see it is
somebody it is broken for.

**#2 matters because the rule was always right.** §4.4 says a medic views
selection and does not set it. Only the feedback is wrong.

**These were introduced by the role model work, not inherited.** Before it,
"any staff" meant coach plus medic, which matched these policies exactly and
left no gap. 0066 and 0070 changed who may write; the UI conditions did not move
with them.

**Not this finding, corrected after a bad first probe.** The programme edit
screens raise `42501` loudly rather than failing silently, because those
policies keep a permissive `USING` and put the restriction in `WITH CHECK`. Still
a defect worth fixing, since a coach is offered an edit surface that always
errors, but a different one. The first probe chained three statements in one
transaction and read two `25P02` "in failed transaction" cascades as results.

**Checked and cleared**, where the UI gates correctly and RLS is defence in
depth doing its job: club details (`isAdmin`), athlete bio (`canEdit`),
notification preferences (self-scoped), `session_attendance` and `test_results`
(exclude nobody), `user_roles` delete and the route-handler `athletes` writes
(all sport-scientist gated), and `meal_library` / `nutrition_rules` deletes,
which are silent at the database but have no UI control that reaches them.

### G-35. FIXED, 2026-09-05, by migration 0072

Two things were missing, not one, and the first fix was wrong because it only
addressed the visible half.

**The policy.** `gps_records` had INSERT and SELECT policies and no UPDATE
policy, so the upsert's conflict path had no rule permitting it.

**The grant.** Adding the policy alone left the same `42501`, because
`authenticated` held no UPDATE grant on the table at all. The two failures wear
the same SQLSTATE and read almost alike:

```
missing GRANT   permission denied for table gps_records
policy refusal  new row violates row-level security policy
```

A policy is permission to use a privilege you already hold. Writing one for a
privilege nobody was granted produces a rule that reads correctly, passes any
check run as a superuser, and cannot be exercised by a real user.

**Generalised so it cannot recur.** `010_rls_coverage_test.sql` now asserts that
every INSERT, UPDATE or DELETE policy in `public` has a matching grant, at table
OR column level. The column half matters: 0045 deliberately gives an athlete
UPDATE on exactly six columns of `gym_session_logs` rather than the whole row,
and a table-level-only check would report that correct design as broken.

**Verified end to end** through the app's own supabase-js upsert, as a signed-in
sport scientist, canary first: first import ok, re-import ok, one row, value
corrected to 5250. Plus six assertions in `100_gps_import_test.sql`, including
the one that would have caught this on the day.

The original entry follows.

### G-35a. As first written

**DEPLOY BLOCKER FOR `0064_gps_no_duplicate_rows.sql`.**

`gps_records` has **INSERT and SELECT policies and no UPDATE policy at all**.
0064 added the unique constraint and `lib/queries/gpsImport.ts` switched from
insert to upsert, so the conflict path is an UPDATE, and it raises
`42501 permission denied for table gps_records` for every caller. Verified as a
sport scientist under RLS:

```
first import        : ok
re-import (upsert)  : raised 42501 permission denied for table gps_records
```

**Why it was reported as working.** The original verification ran over the
`postgres` connection, which owns the table, and an owner bypasses RLS unless
the table is FORCE'd. It exercised the constraint and the upsert semantics and
never exercised the policy. That is the same mistake G-32 records in three test
files, made again in a hand-written probe, and it is the reason a Run-level
check has to run as the role that will really do the thing.

Loud rather than silent, so no data is corrupted: re-importing simply fails.

### G-36. IN PROGRESS, 2026-09-06. Helper built, medical batch converted

`src/lib/write.ts` holds `mustAffect` and `mustAffectOrThrow`. Chain `.select()`
onto the write and hand the builder over; an empty result becomes a stated
refusal instead of a silent success. Unit tested with stubbed results, because
the three outcomes it separates are awkward to produce on demand against a real
database and trivial to state as stubs.

**Batch 1, done: medical and injury.** Five converted, each a single row
addressed by an id the caller was just looking at, so zero rows can only mean a
refusal: editing an injury record, marking a subject access request reviewed,
releasing one, and acknowledging or closing a problem report. Run-verified both
directions, and the releasing one matters most: a silent no-op there is a GDPR
deadline missed with a green tick beside it.

**Six of the eleven medical sites were deliberately NOT converted**, because
zero rows is legitimate for them and asserting a refusal would produce a
confident wrong message:

- `injuries.ts:358` and `rehabGroups.ts:159` close an open row before inserting
  a new one. An athlete with nothing open matches nothing, correctly.
- `teamAllocation.ts:141` withdraws a previous allocation that often does not
  exist, and the insert after it raises anyway.
- `injuries.ts:293` is an upsert; its insert branch raises, so it is already loud.
- `retention/compute.ts:241` and `:246` run as the service role over a list of
  ids, so no policy is consulted and some injuries legitimately have no clinical
  row.

**One thing the conversion turned up.** A coach and a sport scientist cannot
even SELECT an open problem report, so the acknowledge path was never reachable
for them through the UI. The guard is belt and braces rather than a live fix,
which is worth knowing when judging how urgent the rest of this is.

### G-36a. The plan for the remaining 72, not yet done

Classified rather than counted, because the shape decides whether a row-count
check is right at all:

| Shape | Count | What to do |
|---|---|---|
| Single row by id | **50** | Convert. Zero rows is unambiguous |
| Bulk or range | **12** | Do NOT blanket-convert. Each needs the `publishWeek` treatment: ask a second question in the empty branch, or leave it |
| Upsert | **10** | Mostly already loud, since the insert branch raises. Convert only where the update branch can be reached alone |

Proposed batches, each its own commit and review:

1. **Squad and athlete records** (`athletes`, `users`, `user_roles`,
   `organisations`) — 17 sites. Highest remaining consequence: identity, roles
   and club settings.
2. **Performance writes** (`sessions`, `thresholds`, `leaderboards`,
   `programmes` and their children) — the bulk of the 50.
3. **Nutrition and gym**, which are lower consequence and mostly already
   guarded by the G-34 work.
4. **The 12 bulk sites**, one at a time, each with a written judgement about
   what zero rows means there.



**83 of 84 update/delete/upsert call sites never look at what came back.** The
single exception is `src/lib/retention/compute.ts:206`.

The structural fix is one helper that checks the affected row count and throws
when it is zero, on the same principle as `src/lib/access.ts`: one place that
has to be right, rather than 84 that happen to agree. Then a mismatch between
what the UI offers and what a policy permits raises instead of passing as
success, and G-34's whole class stops being possible.

Converting every call site is ongoing work and explicitly not a single pass.
Not a blocker for 0070; G-34's six get a row-count check on their own writes as
part of that fix.

### G-37. The sport scientist cannot edit an athlete's biographical details

`squad/[athleteId]/page.tsx:363` sets `canEditBio = claims.roles.includes('coach')`,
while the `athletes` UPDATE policy admits coach **and** sport scientist. The
inverse of G-34: an allowed action nobody can reach, rather than an offered
action that does nothing.

**Low priority.** No data loss and no silent failure, just a role that cannot do
something §1 says it can.

---

### G-38. FIXED, 2026-09-05. The suite now proves it is subject to RLS

36 canary assertions across 35 files, one after every `set local role
authenticated`, plus a check in `scripts/test-tenancy.mjs` that refuses to run a
suite where any file switches role without asserting the canary.

**Both layers were proved to fire before being trusted**, because a canary that
has never been seen to fail is just another assumption. Removing the role switch
from `020_cross_tenant_test.sql`, which is exactly the G-32 defect, produced:

```
not ok 1 - canary: this session is subject to RLS, so the assertions below measure something
not ok 2 - athlete_consents: coach in org A reads zero rows of org B
```

It fails FIRST, naming the real cause ahead of the cascade it produces. Removing
a canary instead, leaving the switch, stops the runner before any statement
executes.

The original entry follows.

### G-38a. As first written

G-32 and G-35 are the same defect twice: a check that ran without RLS engaged
and reported success. The suite is correct today, audited role by role on
2026-09-05, but nothing in it would catch the line being removed again.

`postgres` carries **`rolbypassrls = true`**, so it is not a question of table
ownership: any statement on that connection without `set local role
authenticated` is RLS-free, and `tests.set_jwt()` alone does not change that.
Measured, on identical reads in one session:

```
as postgres, no role switch          wellness_entries visible: 830
as postgres, claims set, no switch   wellness_entries visible: 830
as authenticated, claims set         wellness_entries visible: 668
  ...other organisations visible:      0
```

The middle line is the trap. Setting claims looks like the act that engages RLS
and is not.

**The fix is a canary**: before asserting anything, each file proves it is
subject to RLS, by reading something a bypassing session would see and a
constrained one would not. A signed-in user seeing more than one organisation
means the run is void, and the file should fail loudly rather than pass
vacuously. Cheap, one assertion per file.

**Current state, audited rather than assumed:** every test file that sets claims
also switches role; 230's apparent match is a comment; 231 and 232 bypass
deliberately for fixture setup and switch before their assertions; `authenticated`
has no BYPASSRLS, owns no tables, and all 65 public tables have RLS enabled.

---

### G-39. FIXED, 2026-09-05. Refusals that a scanner does not recognise as refusals

**This one reached production and locked three roles out of most of the app.**

Eight screens read `coach || medic` and, instead of redirecting, RENDERED a
message: "Not part of this role... Admin manages the club and does not read
athlete performance data, see 01-roles-and-permissions.md §1." `homeRoute()`
refused a ninth way again, by returning a different destination, sending every
non-coach non-medic to `/settings`.

Affected: `/dashboard`, `/flags`, `/squad`, `/squad/[athleteId]`,
`/leaderboards`, `/leaderboards/[leaderboardId]`, `/settings/thresholds`,
`settings/imports/upload`, and the landing route. Sport scientist, S&C and
nutritionist, all three.

**Why the G-29 audit missed it, which is the part worth keeping.** That
inventory decided whether a role check was a "gate" by looking for `redirect(`,
`notFound(` or a 403 nearby. These refuse by rendering, so all eight were
classified as render flags and never individually reviewed; `homeRoute` returns
a path, so it was filed the same way. 86 of 113 sites were classified that way
and only the 27 were read. G-34 had already shown that a refusal need not look
like one, and the lesson was not generalised.

**Not a competing design.** The rule it encoded was real and deliberate, with a
written rationale: a club chairman should not read sleep scores. It went stale
because the role it protected against was ABOLISHED rather than renamed, and its
duties handed to the one role with no restrictions at all. `admin` had no
successor to inherit the restriction.

`docs/01-roles-and-permissions.md` now carries a superseded banner naming what
in it is wrong, and CLAUDE.md's "Permissions, who-sees-what" row points at
`docs/access-matrix.md` and `src/lib/access.ts` instead of a four-role document.

### G-40. Open: 18 role checks that hide a section with no message

The shape the G-39 sweep turned up and did NOT rule out. Eighteen sites gate a
region and render nothing at all for the excluded role, so there is no refusal
text for any scan to find and nothing on screen to tell somebody a thing exists.

Many will be correct: §4's partial-visibility cells are supposed to withhold
regions silently, and the medic-only clinical panel is the clearest example.
Some will be the same four-role artefact as G-39. They have not been read one by
one, and this entry exists so that gap is written down rather than assumed away.

---

### G-41. Diagnosed correctly today and never written down anywhere

A deliberate sweep, prompted by noticing that the programmes bug had been
found, understood, described accurately in conversation, and then left with no
home. Everything below was known and untracked until 2026-09-05.

**FIXED 2026-09-05, deployed with G-40's seven.** Kept in full below because the
way it was lost matters more than the fix.

`programmes/[programmeId]/page.tsx:37` read
`(isCoach && type !== 'rehab') || (isMedical && type === 'rehab')`. Since 0070,
gym authoring belongs to the sport scientist and the S&C, so a **coach opening
any gym programme is shown the full edit surface and gets 42501 on save**, while
the two roles that may edit are shown nothing. It was diagnosed during the
silent-save audit, correctly classified as a LOUD failure rather than a silent
one, and then dropped, because the audit's output was a list of silent saves and
this was not one. Being the wrong shape for the list it was found in is a bad
reason to lose a live bug.

**Also untracked until now:**

- **Meal library authoring** (`NutritionWorkspace.tsx:506`) is `disabled={!isCoach}`
  with the tooltip "only coaching staff author it". `meal_library` admits coach,
  nutritionist and sport scientist, so the nutritionist is refused by the screen
  from writing the nutrition content that is their job.
- **`NutritionTargetsList` is dead code.** No page imports it, confirmed again
  here: zero importers. It carries a working `expireTarget` mutation, so it
  reads like a live screen to anyone who finds it. It was the headline of the
  G-34 audit before the reachability check corrected that.
- **`reports/training/pdf` and `/export`** still derive `actorRole` with the old
  ternary instead of `actingRole()`. Not a defect, both have an honest
  `claims.roles[0]` fallback, unlike the leaderboard pair that fell back to
  'coach'. Inconsistency only.
- **Seven code comments still cite `01-roles-and-permissions.md`** as authority.
  The document now carries a superseded banner, so the citations point at a
  file that says "do not build against this".
- **`settings/exports/page.tsx:58`** prints "Medical access" or "Coach access"
  from a two-way check, so a sport scientist or an S&C is told they have "Coach
  access".

### G-42. FIXED, 2026-09-06. Both approved, both Run-verified

The Exports link resolves from `REPORT_ACCESS`, matching the page behind it.
`canSetAvailability` resolves from a new `AVAILABILITY_EDIT`, which is three
roles rather than "any staff" or "the medic": D-35 gives availability to the
medic, 0042's non-injury path is the documented exception for the coach, and
0068 added the sport scientist to that path. The S&C and the nutritionist hold
neither and stay out.

Verified as each of the five roles against the real policy, and the
classification matters: 42501 is the policy refusing the person, 23505 is the
policy admitting them and the one-live-row rule refusing the row. Only the first
is a permission. The first probe called all three admitted roles a failure
because it read a 23505 as a refusal.

The original entry follows.

### G-42a. As first written

Same shape as G-40's seven and the same four-role artefact, but outside what was
approved on 2026-09-05, so both are left alone deliberately:

- **`settings/page.tsx:308`, the Exports link**, shown on `coach || medic`. The
  page itself gates on `requireReportAccess()`, and §3.6 reads
  `| Exports | V | V | V | V | X |`, so the sport scientist and the S&C are shown
  no link to a page they can open.
- **`squad/[athleteId]/page.tsx:363`, `canSetAvailability`**, on `coach || medic`.
  The availability write policies are now coach+sport_scientist for the
  non-injury path and medic for the injury one, so the union is three roles and
  the sport scientist is missing. Worth a decision rather than an assumption,
  because D-35 says availability is the medic's, and 0042's coach path is the
  documented exception to that.

---

### G-43. OPEN, needs a decision. 0066 widened writes the matrix never widened

Found on 2026-09-06 by a Run-level check during G-36 batch 2, when a medic and a
nutritionist both successfully changed a fixture's status.

**`fixtures` is the confirmed case.** §3.1 reads
`| Fixtures | VEC | VEC | V | V | V |`: the sport scientist and the coach create
and edit, the other three read. Production admits **all five** to both INSERT and
UPDATE. 0066 widened it in the blanket `coach+medic -> any staff` sweep, on the
reasoning that the pair had meant "any staff" in the four-role model, and 0070
did not narrow it because Fixtures was never one of the five rows put to the
owner as G-33.

So this is not a bug in either migration. It is the seam between them: 0066
widened everything that matched a pattern, and 0070 narrowed only the five rows
somebody had looked at.

**Twenty tables now admit all five staff roles to a write:**

`body_composition, body_mass_target_ranges, compliance_expectations,
exercise_overrides, exercises, fixtures, flag_actions, flags,
leaderboard_opt_outs, programme_assignments, programme_blocks,
programme_exercises, programme_sessions, programmes, session_attendance,
session_participants, test_definitions, test_results, training_entries,
wellness_entries`

Several are certainly right. `wellness_entries` and `training_entries` are
athlete self-writes plus staff corrections; `body_composition` matches §3.1's
weigh-in; `flags` is VE in all five columns. The programme tables carry the
gym/rehab split in their WITH CHECK, so their effective rule is narrower than
the role array suggests.

Others look wrong on the same reading as fixtures: `exercises` and
`test_definitions` are authored content, and §3.3/§3.4 give authoring to
specific roles.

**The comparison, done 2026-09-06.** All twenty read one at a time against the
matrix column that governs them, because fixtures was found by accident and an
unchecked table looks exactly like a checked-and-correct one until something
trips over it.

**Six need narrowing.** Every one is a role able to change something the
specification does not give it. None involves injury or clinical data.

| Table | Governing rule | Now | Should be |
|---|---|---|---|
| `fixtures` | §3.1 `Fixtures VEC VEC V V V` | all five | sport scientist, coach |
| `exercises` | §3.3 `Exercise library VEC V V VEC V` | all five | sport scientist, S&C |
| `body_mass_target_ranges` | §3.3 `Body mass target ranges VEC V V V VEC` | all five | sport scientist, nutritionist |
| `session_participants` | §3.1 `New and edit session VEC VEC X X X` | all five | sport scientist, coach |
| `test_definitions` | To-do 2026-09-04: "created and completed by any staff role except the nutritionist" | all five | everyone but the nutritionist |
| `test_results` | Same decision, which supersedes §3.4's `V` for the medic | all five | everyone but the nutritionist |

**One is genuinely ambiguous and wants a decision rather than a reading.**
`body_composition`. §3.1 gives the S&C and the nutritionist `VP` on the athlete
profile, which argues they should not log a weigh-in. But a weigh-in is the
input to the nutrition target the nutritionist owns (§3.3 `VECD`), and the
clean spec's own screen table lists "logs a weigh in" among what the sport
scientist does. The two readings disagree and the document does not settle it.

**Thirteen are right as they stand**, and the reasons differ:

- `flags`, `flag_actions` — §3.1 gives Flags `VE` in all five columns.
- `wellness_entries`, `training_entries` — athlete self-writes, and the policies
  additionally require the caller's own row. Staff corrections go through
  `revise_*`, which 0065 gave all five deliberately.
- `session_attendance` — §3.1 Timetable is `V` for all five.
- `leaderboard_opt_outs` — insert is the medic's alone (medical suppression),
  update is own-row scoped.
- `compliance_expectations` — no matrix row and no screen writes it; 0044
  generates it.
- `programmes`, `programme_blocks`, `programme_sessions`,
  `programme_exercises`, `programme_assignments`, `exercise_overrides` — right
  IN EFFECT rather than on the face of it. Their INSERT is already narrow and
  every one carries the gym/rehab split in its WITH CHECK, so an update by the
  wrong role passes USING and is then refused loudly. The USING clause is wider
  than it needs to be, which is untidy rather than wrong.

**Nothing fixed.** Six narrowings and one decision, reported the way G-40 and
G-42 were.

---

## Summary

**28 gaps, one of them withdrawn. 4 high risk, 2 medium-high, 8 medium, the rest
low or low-medium.**

**The order that matters.** G-02 first, because G-01 depends on it and a partial
role change can open access. **G-25 alongside it**, because it silently corrupts
GPS data today and the fix is a constraint plus an upsert. G-03 next, independent
and cheap to mitigate. Everything else after.

**Six of the seven open questions were resolved by the verification pass**, and
four of them turned into gaps: G-25, G-26, G-27 and G-28. Three earlier findings
were **withdrawn** as wrong: D-08 and D-09 claimed pages were unguarded when they
guard correctly, and D-38's original claim that Fydr sends no invitation emails
was false. G-20 is withdrawn with D-08.

**One question remains open.** Whether the flag engine evaluates only new data or
sweeps existing rows, which decides whether creating a threshold is a quiet act or
raises a great many flags at once. Files searched:
`src/lib/queries/thresholds.ts`, `supabase/migrations/0052*.sql`.
