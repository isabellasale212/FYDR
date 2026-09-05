# Access matrix

Stage B2. Who can reach what, and what they can do when they get there.

**This document is the target, not a description of today.** It is written
against the five role model agreed on 4 September 2026. Section 6 sets out
exactly what the code enforces right now, and every difference is a numbered
decision already recorded in `docs/decisions-required.md`. Read section 6 before
assuming any line of the grid is currently true.

**Jargon, expanded once.** A *guard* is a check the server runs before it builds
a page. *Row level security* is a second set of rules held inside the database
itself, so that even a mistake in the app cannot hand over rows a person should
not see. *Tier* is which package the club bought: Base, or Premium which adds
GPS.

---

## 1. The five roles

| Role | One line summary |
|---|---|
| **Sport scientist** | Everything. The role with no restrictions, including club administration. |
| **Coach** | The squad, the schedule, reports and testing. Sees injury information in limited form. |
| **Medic** | Everything the coach sees, plus the full clinical record, which nobody else sees. |
| **S&C** | Gym programmes and physical development. Sees injury information in limited form. |
| **Nutritionist** | Nutrition. **Sees no injury or medical information anywhere.** |
| *Athlete* | Not a staff role. Cannot open any staff page at all. Listed only to be explicit. |

---

## 2. Holding more than one role

**A person may hold any number of roles, and their permissions add up. The most
permissive wins.**

Roles are stored one row per granted role, so nothing prevents several. Every
check in the app asks "does this person hold this role", and several are joined
with "or". Nothing anywhere takes a permission away because a second role is also
held. Inside the database the same rule is a single line of list overlap
(`supabase/migrations/0010_helper_functions_and_triggers.sql:113`).

**What this means in practice, and it matters for the nutritionist rule.**
Giving a nutritionist any second role that can see injury information will let
them see it. If the nutritionist exclusion is to hold, a nutritionist must hold
**only** the nutritionist role. There is no mechanism that can enforce that, and
none is proposed: it is a matter of who is granted what.

**A person who is both a player and a coach** holds both roles, and lands in the
staff app, because it is the larger tool.

---

## 3. The grid

**How to read a cell.** **V** view, **E** edit, **C** create, **D** delete,
**X** no access. A cell may combine them, so `VEC` means view, edit and create
but not delete. **P** after a letter means partial: the page opens but regions
or fields are withheld, and section 4 names exactly which. **[Pr]** means the
page or region needs the Premium package.

**Athletes are X on every row without exception** and are omitted from the grid
to keep it readable. The rule is enforced three times over, in the middleware, in
the staff guard, and in the database.

### 3.1 Everyday screens

| Page | Sport scientist | Coach | Medic | S&C | Nutritionist |
|---|---|---|---|---|---|
| Dashboard | V | V | V | V | VP |
| Squad overview | V | V | V | V | VP |
| Athlete profile | VE | VE | VE | VP | VP |
| Athlete wellness | V | V | V | V | V |
| Athlete gym | VE | V | V | VE | X |
| Athlete nutrition | V | V | V | V | VE |
| Schedule | VECD | VECD | V | V | V |
| New and edit session | VEC | VEC | X | X | X |
| Fixtures | VEC | VEC | V | V | V |
| Week templates | VECD | VECD | V | V | V |
| Timetable | V | V | V | V | V |
| Flags | VE | VE | VE | VE | VP |

### 3.2 Injury and availability

**The nutritionist column is X on every row here.** That is the rule you set, and
this block is the reason decision D-01 is ranked highest.

| Page | Sport scientist | Coach | Medic | S&C | Nutritionist |
|---|---|---|---|---|---|
| Injuries list | V | VP | VECD | VP | **X** |
| Injury record | VP | VP | VEC | VP | **X** |
| New injury | VC | VC | VC | VC | **X** |
| Rehab groups | VE | VP | VE | VE | **X** |
| Team allocation | VE | VE | VP | VP | **X** |
| Injury and availability report | VP | VP | V | VP | **X** |

**Note on the medic row for Injury record.** A medic may create and edit an
injury but **may not delete one**. An injury is closed, never deleted. Deletion
exists only for the audited erasure process
(`supabase/migrations/0005_injuries_and_availability.sql:43`).

**Note on the sport scientist.** Sport scientist has access to everything, but
"everything" here still means the limited view: the full clinical record is
medic only, enforced in the database rather than the app, so no role setting can
open it. See section 4.1.

### 3.3 Programmes and nutrition

| Page | Sport scientist | Coach | Medic | S&C | Nutritionist |
|---|---|---|---|---|---|
| Gym programme list | VECD | V | V | VECD | V |
| Programme builder | VEC | V | V | VEC | V |
| Exercise library | VEC | V | V | VEC | V |
| Nutrition targets | VECD | V | V | V | VECD |
| New nutrition target | VC | X | X | X | VC |
| Body mass target ranges | VEC | V | V | V | VEC |

### 3.4 Analysis

| Page | Sport scientist | Coach | Medic | S&C | Nutritionist |
|---|---|---|---|---|---|
| Analytics **[Pr]** | V | **X** | **X** | **X** | **X** |
| Build an analytics view **[Pr]** | VEC | **X** | **X** | **X** | **X** |
| Leaderboard | VECD | V | V | VECD | V |
| Testing | VEC | VEC | V | VEC | X |
| Test history | V | V | V | V | X |

### 3.5 Reports

| Page | Sport scientist | Coach | Medic | S&C | Nutritionist |
|---|---|---|---|---|---|
| Reports hub | V | V | V | V | VP |
| Athlete report | V | V | V | VP | **X** |
| Compliance report | V | V | V | V | V |
| Squad weekly report | V | V | V | V | VP |
| Testing report | V | V | V | V | X |
| Training report **[Pr]** | V | V | V | V | X |
| Injury report | VP | VP | V | VP | **X** |

Every report also has a spreadsheet download and a PDF download. **A download
carries the same permission as the screen it belongs to, without exception.**
This is stated as a rule rather than a row per file because the alternative
produced a real defect once: the training report's two downloads answered a plain
request with the complete GPS board while the screen above them was correctly
gated (`src/lib/session.ts:126`). A hidden button is not a gate.

### 3.6 Settings and administration

Everything in this block belonged to the removed `admin` role and now belongs to
the **sport scientist** alone.

| Page | Sport scientist | Coach | Medic | S&C | Nutritionist |
|---|---|---|---|---|---|
| Settings | V | VP | VP | VP | VP |
| Users | VECD | X | X | X | X |
| Invite athletes in bulk | VC | X | X | X | X |
| Reset a user's two factor login | VE | X | X | X | X |
| Audit log | V | X | X | X | X |
| Data retention | VE | X | X | X | X |
| Subject access requests | VE | X | V | X | X |
| Clinical review of a request | X | X | V | X | X |
| Groups | VECD | VECD | V | V | V |
| Thresholds | VECD | VECD | V | V | X |
| Notifications | VE | VE | VE | VE | VE |
| Exports | V | V | V | V | X |
| Import GPS **[Pr]** | VC | X | X | X | X |
| Club details | VE | X | X | X | X |
| **Add a player to the squad** | VC | X | X | X | X |

**The last row does not exist yet.** No screen and no server route creates a
player anywhere in the app. It is listed because this document defines what the
app is supposed to be, and a club that signs a player must be able to record
them. Decision D-16.

**Clinical review is the one row where the sport scientist is X.** The screen
shows the clinical record, which the database restricts to the medic. Giving the
sport scientist "everything" does not reach through a database policy, and
section 4.1 explains why that is the right outcome rather than a gap.

---

## 4. Partial visibility, field by field

Every **P** in the grid is listed here. A cell marked P without an entry below is
an error in this document.

### 4.1 Injury information: the limited view

This is the answer to the question left open at Stage A0, taken from the columns
themselves rather than described in general terms.

**What coach, S&C and sport scientist see.** From the injury record: **body
area, side, onset date, status, expected return date, actual return date, and
whether it happened in training or a match**
(`supabase/migrations/0005_injuries_and_availability.sql:32` to `:39`). From the
availability record: **status, restrictions, and reason category**.

So a coach can tell that a player is unavailable with a hamstring problem, is
expected back on the 18th, and must not sprint.

**What only the medic sees.** The whole clinical record, which is a separate
table: **diagnosis, mechanism, severity, tissue type, imaging, referral, clinical
notes and treatment plan**
(`supabase/migrations/0005_injuries_and_availability.sql:74`).

So a coach cannot tell what the diagnosis is, and that is the entire point of
splitting the two tables.

**What the nutritionist sees. Nothing from either.**

**How the clinical boundary is enforced, and why it is stronger than the rest of
this document.** It is a database rule, not an app rule: only the medical role
can touch that table at all, for every operation
(`supabase/migrations/0012_rls_policies.sql:696`). A coach calling the function
that reads it gets an empty result rather than an error, which is why the pages
must also avoid calling it: an empty clinical panel rendered by mistake still
looks like a broken page even though no data crossed the boundary
(`src/lib/queries/injuries.ts:195`).

**Athletes see their own record minus one field.** They read a restricted view
that excludes the clinical notes, which is described in the schema as the one
column no athlete ever sees through any path
(`supabase/migrations/0005_injuries_and_availability.sql:83`).

### 4.2 Nutritionist, on shared screens

On the **Dashboard**, **Squad overview**, **Flags**, **Reports hub** and **Squad
weekly report**, a nutritionist sees the page but not the injury derived parts of
it. Specifically withheld:

- The availability split and its named lists, MET-013, wherever it appears
- The reason and restriction text beside any athlete's name
- Any flag whose domain is injury or availability
- The injury column on the squad weekly report

They keep everything else: compliance, wellness, body mass, testing and GPS.

### 4.3 S&C, on the athlete profile and reports

An S&C sees the athlete profile and the athlete report with the limited injury
view of 4.1, and cannot edit an athlete's biographical details.

### 4.4 Medic, on team allocation and rehab groups

A medic views squad selection and rehab grouping but does not set selection. The
distinction is that a medic decides whether an athlete is available, and a coach
decides whether an available athlete is picked.

### 4.5 Settings, for everyone except the sport scientist

Every role opens Settings, because it holds their own profile, their password and
their two factor login. The administration blocks, users, audit, retention, club
details and subject access, are absent for everyone else.

---

## 5. Under 18 academy players

**What is decided and built.**

**Leaderboards require consent.** An athlete under 18 does not appear on any
leaderboard unless consent has been recorded
(`src/lib/leaderboardVisibility.ts:9`). This is an opt in, not an opt out: silence
means absent.

**Records are kept longer.** Injury clinical detail is kept for eight years from
closure, and longer for an athlete who was a minor at the time
(`src/lib/retention/compute.ts:82`). If no date of birth is on file the extension
cannot be applied and the eight year rule alone governs
(`src/lib/retention/compute.ts:88`).

**What is not decided, and is a question back to you.**

Age is available everywhere, and a helper exists whose own comment says it is for
under 18 gates, but it is called in exactly one place in the whole app and there
it only displays an age (`src/lib/format.ts:455`, used at
`src/lib/queries/playerProfile.ts:820`).

So **under 18 behaviour is defined for leaderboards and retention and undefined
on every other screen**: wellness, gym, nutrition, testing, GPS and every report.

**The question, put plainly.** Is there any category of data beyond leaderboards
that a club may not show about an under 18 without consent? If no, that is one
sentence in this document and the matter closes. If yes, it is real work. Decision
D-19.

**One thing that is not a matter of consent.** A person's right to see their own
data, and a club's obligation to hand it over on request, does not change with
age. The subject access process applies identically.

---

## 6. What the code enforces today

**Read this before trusting the grid.** Sections 1 to 5 describe the target. This
section describes the present, so that the difference is visible rather than
implied.

**The code now has the five roles.** This paragraph used to say the opposite,
and was correct when written: there were four values (athlete, coach, medical,
admin), people doing the S&C and nutrition jobs held `coach`, and the seed data
said so deliberately. Migration `0063_role_model_enum.sql` renamed medical to
medic and admin to sport_scientist and added strength_conditioning and
nutritionist, and `supabase/seed.sql` now gives the S&C lead and the
nutritionist their own roles.

**The practical effect has reversed.** Every "nutritionist is X" cell in §3.2 is
now enforced by a guard rather than being aspirational, because a nutritionist is
no longer a coach. See `requireInjuryAccess` below.

**One caveat that has not gone away.** Roles are additive. A person who holds
nutritionist AND coach still sees injury information, because the guards ask
what you hold, not what you are. That is deliberate and is stated at §2.

**Guards that exist today**, and what each admits:

| Guard | Admits | Where |
|---|---|---|
| `requireStaff` | any of the five staff roles | `src/lib/session.ts:69` |
| `requireReportAccess` | coach, medic, sport scientist, S&C | `src/lib/session.ts:120` |
| `requireInjuryAccess` | coach, medic, sport scientist, S&C | `src/lib/session.ts:161` |
| `requireSubjectAccess` | sport scientist or medic | `src/lib/session.ts:198` |
| `loadAthleteDomainContext` | coach or medic | `src/lib/athleteDomain.server.ts:93` |

**`requireReportAccess` is knowingly incomplete for one role.** §4 gives a
nutritionist real access to some reports (Compliance **V**, Reports hub and
Squad weekly **VP**) and none to others. A single blanket gate cannot express a
per-report split, so that role is still refused at the door rather than admitted
to the reports it should see. Tracked in `docs/spec-gaps.md`, not silently
decided here.

**`loadAthleteDomainContext` still admits only coach or medic**, which refuses
the sport scientist although §1 gives that role everything. It is listed here
rather than changed alongside the injury work, because it gates a different
surface and this build deliberately does not bundle unrelated access changes.

**Most pages call only the first**, which is why the grid's fine distinctions do
not exist yet. Of 62 screens, the great majority admit any staff member.

**Where the code is already right.** Three things in the grid are enforced
correctly today and should not be disturbed:

1. **The clinical boundary**, in the database rather than the app
   (`supabase/migrations/0012_rls_policies.sql:696`).
2. **Athletes cannot reach the staff app**, enforced three times over.
3. **Every table has row level security**, all 58 of them.

**The differences, each already a numbered decision.** D-01 injury screens have
no gate. D-02 analytics admits everyone. D-03 nutrition admits everyone. D-04
programmes editable by everyone. D-05 leaderboards editable by everyone. D-06
schedule editable by everyone. D-07 remove admin and move eleven capabilities.
D-08 the reports hub uses the wrong guard. D-16 no way to add a player.
**D-09 was raised here and has been withdrawn: the clinical review screen guards
correctly.**

**No new decisions were raised while writing this matrix.** Every difference
found was already recorded at Stage A2.

---

## 7. The one rule this document cannot enforce

Worth stating on its own, because it is the weak point of the whole model.

**Permissions add up.** A nutritionist who is also given the coach role, for any
reason, sees everything a coach sees, including injury information. The
nutritionist exclusion in section 3.2 holds **only** while a nutritionist holds
that role alone.

Nothing in the app can prevent that, and nothing here proposes that it should:
whoever grants roles has to know it. It belongs in the user management screen as
a warning at the point of granting, and that is raised here as **decision D-25**.
