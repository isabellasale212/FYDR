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

### G-33. The matrix would take access away from the coach and the medic, and this build did not

The five-role work was carried out **widen only**. Every role kept what it could
do the day before the migration; the sport scientist gained everything, and the
S&C and the nutritionist got their own domains. Nobody lost anything.

`docs/access-matrix.md` §3 is stricter than that in five places, and each would
remove something a person uses today:

| Matrix row | Says | Today | Effect of applying it |
|---|---|---|---|
| §3.3 Programme builder | coach **V** | coach creates gym programmes | A coach could no longer build gym work |
| §3.3 Nutrition targets | coach **V**, medic **V** | both write targets | Both would become read-only |
| §3.4 Leaderboard | coach **V**, medic **V** | both create boards | Both would become read-only |
| §3.6 Import GPS | coach **X**, medic **X** | both import | Neither could import GPS |
| §3.1 New and edit session | medic **X** | medic creates sessions | A medic could no longer schedule |

**Why it was not applied.** An earlier draft of migration 0067 did apply the
first of these, and the tenancy suite failed on eleven assertions, every one of
them a coach doing something a coach does today. That is the signal worth
listening to rather than overruling.

The grid is a **design**, not a description of the built product, and it says so
about itself in §6: "The code has four roles, not five" and every nutritionist
cell "is currently a **V**, because a nutritionist is a coach". It was written
during the specification build to describe where the product is going. Removing
an ability somebody relies on, on the strength of a cell in that document, is a
decision for a person to take with the consequences in front of them.

**What resolving it needs:** a yes or no on each of the five rows above. Nothing
else is blocked by it, and the current state is safe in the direction that
matters, since no role sees injury or medical data it should not.

**Risk: low, and it is the risk of doing too little.** Some roles can do more
than the matrix intends. None can see what D-01 forbids.

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
