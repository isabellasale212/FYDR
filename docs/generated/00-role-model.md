# Stage A0: The role model, as the code actually has it

Generated 4 September 2026. This file reports what is in the code today. It does
not say what the app should be. Stage A0 exists so that you can tell me which
role model is authoritative before I write anything binding.

**Jargon, expanded on first use.** *Schema* means the shape of the database:
the tables and the fixed lists of allowed values. *Enum* means one of those
fixed lists: a column that can only ever hold one of a named set of values.
*Claim* means a fact about the signed-in person that is carried inside their
login token. *Middleware* means code that runs on the server for every page
request, before the page itself is built. *Row level security*, shortened to
RLS, means rules held inside the database itself that decide which rows a
person may read or write, independently of the app.

---

## 1. The short answer

The code has **four** roles, not five: **athlete, coach, medical, admin**.

There is no sport scientist role, no nutritionist role, no separate strength
and conditioning role, and no separate physiotherapist role. Those five job
titles from the newer design do not exist anywhere in the schema, the login
layer, or the screens. The people who do those jobs are given one of the four
roles above.

This is not an accident or an oversight in the seed data. It is written down as
a deliberate decision in the code:

> "Nutritionist. There is no nutritionist role: 01-roles-and-permissions.md §1
> has four roles and a nutritionist is a coach for authorisation purposes."
> `supabase/seed.sql:87`

---

## 2. Which roles exist, and where

### 2.1 In the schema

One enum, created in the first migration, holding exactly four values.

```sql
create type app_role as enum ('athlete', 'coach', 'medical', 'admin');
```
`supabase/migrations/0001_extensions_and_enums.sql:77`

The same four values appear in the generated TypeScript types at
`src/lib/types/database.ts:4636`.

Roles are held in their own table, `user_roles`, with the columns `org_id`,
`user_id`, `role` and `granted_by` (`src/lib/types/database.ts:3858`). Because a
person can have more than one row in that table, a person can hold more than one
role. See section 3.

### 2.2 In the login layer

The list of accepted role names is repeated in the login layer, and it is the
same four:

```ts
const ROLES: readonly string[] = ['athlete', 'coach', 'medical', 'admin'];
```
`src/lib/supabase/claims.ts:22`

Anything that is not one of those four is silently discarded when the token is
read (`src/lib/supabase/claims.ts:53`). So even if a role called `nutritionist`
were somehow written into a token, the app would ignore it.

Roles are read from the signed-in person's token and from nowhere else. The call
that authenticates the session runs first, and the token is only read after that
call succeeds (`src/lib/supabase/claims.ts:66`). This matches the standing rule
that a role is never taken from anything the browser sends.

### 2.3 In the database's own security rules

The database has its own helper that returns the current person's roles
(`supabase/migrations/0010_helper_functions_and_triggers.sql:83`) and a second
helper that asks whether they hold **any** of a given set
(`supabase/migrations/0010_helper_functions_and_triggers.sql:106`). That second
helper is a single line:

```sql
select public.auth_roles() && p;
```
`supabase/migrations/0010_helper_functions_and_triggers.sql:113`

The `&&` there is "do these two lists overlap at all". This matters for section
3: the database grants access if **any** held role qualifies.

### 2.4 In the screens

The sidebar tags every destination with the roles that may see it
(`src/components/Sidebar/Sidebar.tsx:33`). Every row uses only the same four
names. Most rows are `['coach', 'medical']`; three rows add `admin`
(`src/components/Sidebar/Sidebar.tsx:111`, `:163`, `:188`).

**UNVERIFIED: the meaning of each individual sidebar row is not yet traced.**
That is Stage A1 and Stage B2 work. This section only establishes that the
screens use the same four role names and no others.

---

## 3. Can a person hold more than one role, and how do permissions combine?

**Yes, and they combine as a union: the most permissive wins.**

Roles live in a table with one row per granted role, so nothing prevents several
rows for one person. The seed data contains a worked example, and says so:

> "Performance analyst who is also a physio: roles are additive, not exclusive,
> and this row exists so a developer can see the union case working."
> `supabase/seed.sql:93`

That person is granted `coach` and `medical` as two separate rows
(`supabase/seed.sql:94`, `supabase/seed.sql:95`).

Every access decision in the code is an "is this role present" test, and several
of those tests are joined with "or". Nothing anywhere subtracts a permission
because a second role is also held. Three examples:

- Whether a person may enter the staff app at all is coach **or** medical **or**
  admin (`src/lib/supabase/claims.ts:94`).
- Whether a person may open the reports section is coach **or** medical
  (`src/lib/session.ts:122`).
- Inside the database, `auth_has_any_role` is list overlap, as shown above
  (`supabase/migrations/0010_helper_functions_and_triggers.sql:113`).

**One consequence worth stating plainly.** Because a nutritionist is given the
`coach` role, a nutritionist has exactly the permissions of a coach. There is
currently no way to give someone nutrition screens without also giving them
everything else a coach can reach. The same is true of a sport scientist and of
a strength and conditioning lead. In the demo club, four different jobs all hold
the single `coach` role (`supabase/seed.sql:84`, `:86`, `:89`, `:94`).

**This is the central question for you to answer.** The five role design implies
five different views of the app. The code has one staff view for coach, a
partly different one for medical, and a narrow one for admin.

---

## 4. Does an admin or club owner role exist?

**Yes. `admin` exists, it is real, and it is enforced on the server.**

It is not a club owner in the billing sense. It is closer to a club secretary.
The seed describes the demo club's admin exactly that way:

> "Club secretary. Admin only: no wellness, no flags, no medical detail."
> `supabase/seed.sql:97`

### 4.1 What admin can do that nobody else can

Each of these is checked on the server, not just hidden in the browser.

| Job | Where it is enforced |
|---|---|
| See the user list | `src/app/(staff)/settings/users/page.tsx:21` |
| Create a user and grant roles | `src/app/(staff)/settings/users/create/route.ts:47` |
| Invite users in bulk | `src/app/(staff)/settings/users/bulk-invite/page.tsx:17`, `src/app/(staff)/settings/users/bulk-invite/send/route.ts:30` |
| Open one user's record | `src/app/(staff)/settings/users/[userId]/page.tsx:31` |
| Reset a user's two factor login | `src/app/(staff)/settings/users/[userId]/mfa/route.ts:25` |
| Read the audit log | `src/app/(staff)/settings/audit/page.tsx:44` |
| Data retention, preview and run | `src/app/(staff)/settings/retention/page.tsx:30`, `.../preview/route.ts:11`, `.../run/route.ts:14` |
| Release a subject access request | `src/app/(staff)/settings/subject-access/[requestId]/release/route.ts:18` |
| Start a subject access request from a player | `src/app/(staff)/squad/[athleteId]/subject-access/route.ts:22` |
| Edit club name, sport, timezone, country and logo | `src/app/(staff)/settings/page.tsx:474` |

A subject access request can be opened by admin **or** medical
(`src/lib/session.ts:159`).

### 4.2 What admin deliberately cannot do

An admin who holds no other role is blocked from every report, because every
report in this build is named player data (`src/lib/session.ts:120`). Such a
person does not even land on the dashboard when they sign in: they are sent to
Settings instead (`src/lib/supabase/claims.ts:124`). The settings page detects
this case explicitly and renders differently (`src/app/(staff)/settings/page.tsx:46`).

The intended escape hatch is that an admin who genuinely needs squad data is
also granted the coach role, which is recorded as deliberate friction rather
than a gap (`src/lib/session.ts:109`).

---

## 5. Who performs squad setup, invites, billing and org settings?

You asked specifically about these four. The answers differ, and one of them is
a real hole.

### 5.1 User invites: admin, and it is fully built

Covered in section 4.1. Creating a user, granting their roles, and linking them
to a player record all happen in one server route
(`src/app/(staff)/settings/users/create/route.ts:73`, `:107`, `:117`), with a
bulk version alongside it.

### 5.2 Org settings: admin, and it is built but narrow

An admin can edit the club's name, sport, timezone, country and logo through one
form (`src/app/(staff)/settings/page.tsx:474`). Nothing else about the
organisation is editable from the app. Every other read of the organisations
table in the app is a plain read (`src/lib/session.ts:75`,
`src/lib/queries/orgDetails.ts:27`).

### 5.3 Billing: NOT BUILT. Nobody performs it in the app

There is no billing screen, no payment provider, and no way to change the club's
plan from inside Fydr. The Plan card on the settings page displays the tier and
is read only (`src/app/(staff)/settings/page.tsx:104`). The app says so in its
own words to the user:

> "Plan changes are a sales conversation with your Fydr contact."
> `src/app/(staff)/settings/page.tsx:254`

Files searched for a billing surface: all of `src/app` and `src/lib`. The only
matches for billing, subscription or payment terms were the Plan card and its
supporting tier helpers (`src/lib/tier.ts`, `src/lib/tierPreview.ts`).

There is a separate concept of Fydr's own staff, distinct from club staff, who
may preview the product on the lower tier (`src/lib/platformStaff.ts`, used at
`src/lib/session.ts:92`). This is identified by email address, not by a role,
and it is explicitly not the club's own administrator
(`src/app/(staff)/settings/page.tsx:48`).

### 5.4 Squad setup: NOT BUILT. There is no way to add a player

**This is the significant finding of Stage A0.** Nothing in the app creates a
player record. I searched every use of the athletes table in `src/`. Every one
is a read or an update. There is no insert.

The updates that exist only ever attach something to a player who already
exists: linking a login (`src/app/(staff)/settings/users/create/route.ts:117`,
`src/app/(staff)/settings/users/bulk-invite/send/route.ts:126`) and filling in a
date of birth during a bulk invite
(`src/app/(staff)/settings/users/bulk-invite/send/route.ts:88`).

So the squad currently arrives through the seed file
(`supabase/seed.sql:105` onward) or through direct database access, and a club
could not add a new signing through the interface. There is no screen for it and
no server route for it.

Files searched: `src/app/**`, `src/lib/**`, matching on `.from('athletes')` and
on `insert`.

---

## 6. Do athletes reach the staff app?

**No. This is blocked on the server, in three independent places.**

1. **Middleware, before the page is built.** The staff area is a fixed list of
   URL prefixes: `/dashboard`, `/squad`, `/schedule`, `/reports`, `/nutrition`,
   `/programmes` and others (`src/lib/supabase/middleware.ts:7`). A request for
   any of them from a person who is not staff is redirected away, to the athlete
   home if they are an athlete and to the login page otherwise
   (`src/lib/supabase/middleware.ts:84`). This runs on every request
   (`src/proxy.ts:4`).
2. **A second check inside the staff pages themselves.** Every staff page calls
   a guard that repeats the test and redirects an athlete to `/today`
   (`src/lib/session.ts:69`, specifically `:71`). Its own comment calls this the
   second lock.
3. **The database.** Row level security applies independently of both of the
   above, using the role helpers in section 2.3.

The block runs in both directions: a staff member with no athlete role is turned
away from the athlete area as well (`src/lib/supabase/middleware.ts:91`).

A person who is both a player and a coach holds both roles, passes both tests,
and lands in the staff app because it is the larger tool
(`src/lib/supabase/claims.ts:106`).

**Note for the access matrix in Stage B2.** The intended access model you gave
me uses the phrase "all staff". On the evidence here, "all staff" cannot include
athletes, because athletes cannot open any staff URL at all. I will treat it that
way unless you tell me otherwise.

---

## 7. The two role models side by side

| Newer five role design | Exists in code? | What the code actually does |
|---|---|---|
| Sport scientist | No | Would hold `coach`. UNVERIFIED which person in the seed represents this job. |
| Medic | Yes, named `medical` | The only role that can set availability or read clinical notes (`supabase/seed.sql:90`) |
| S&C | No | Holds `coach` (`supabase/seed.sql:85`) |
| Nutritionist | No | Holds `coach`, stated deliberately (`supabase/seed.sql:87`) |
| Coach | Yes, named `coach` | (`supabase/seed.sql:83`) |
| Not mentioned in the design | Yes, named `admin` | Users, audit, retention, subject access, club details. See section 4. |
| Not mentioned in the design | Yes, named `athlete` | Blocked from the staff app entirely. See section 6. |

The older four role spec set in `docs/` matches the code. The newer five role
design does not.

---

## 8. What I need from you before Stage A1

**Question 1, the important one. Which role model is authoritative?**

- **Option A, keep the four roles.** The code is already this. The five job
  titles stay as job titles, and a nutritionist keeps coach permissions. Cheapest
  by a wide margin. The cost is that you cannot restrict a nutritionist to
  nutrition, and the specification will have to say so plainly on every screen.
- **Option B, move to five roles.** This is a schema change to the enum, a
  migration for existing role rows, a rewrite of every role test in the app, and
  a rewrite of every row level security policy that names a role. It also has to
  answer what happens to `admin`, which the five role design does not mention.
  Large, and it touches security rules, so it is the kind of change that wants
  tests written first.
- **Option C, write the specification against four roles now, and record five
  roles as a planned change.** The document set describes what is true, and the
  gap queue in Stage B4 carries the move to five roles as a single high value
  item.

I recommend **Option C**: it lets the specification be accurate immediately,
which is its whole purpose, without pretending the five role design does not
exist.

**Question 2. Does admin survive?** The five role design does not mention it, but
it is real, it is enforced in eleven places, and it owns user management, the
audit log, data retention and subject access requests, which are your legal
obligations rather than optional features. If admin is dropped, someone else has
to inherit all of that. Please confirm admin stays.

**Question 3. Squad setup has no home.** No one can add a player through the app.
Should the specification describe adding a player as a required screen that is
not yet built, and if so, which role owns it? My guess, and I am labelling it as
a guess, is admin, because it sits beside user invites. Confirm or correct.

**Question 4. What does "medic and injury limited" restrict?** You flagged this
as unresolved. From the code, coaching staff see availability status, body area,
restrictions and expected return date, and never the clinical note or the
diagnosis. I will confirm the exact field list in Stage B2 rather than guess it
here.

---

## 9. Unverified items from this stage

- **UNVERIFIED: which seeded person represents the sport scientist job.** The
  seed labels a head coach, an S&C lead, a nutritionist, a physiotherapist, a
  performance analyst who is also a physio, and a club secretary
  (`supabase/seed.sql:83` to `:97`). "Performance analyst" is the closest match
  to sport scientist, but the seed does not use that phrase. Files searched:
  `supabase/seed.sql`, `src/`, `supabase/migrations/`.
- **UNVERIFIED: the per row meaning of the sidebar role tags.** Established that
  they use the same four names, not what each destination is. Stage A1.
- **UNVERIFIED: whether every table has row level security.** Not part of Stage
  A0. Stage A2 raises it.
- **UNVERIFIED: whether any staff page is hidden from the sidebar but still
  loads for an unauthorised role.** The sidebar tags roles per row
  (`src/components/Sidebar/Sidebar.tsx:33`) while the staff guard only tests
  staff versus not staff (`src/lib/session.ts:71`), so this is likely to produce
  findings. Stage A1 and Stage B3 will test it page by page.

---

## 10. Your decision, recorded 4 September 2026

You answered:

> "remove admin, sports scientist has access to everything. the medic and injury
> information is limited in all pages and only viewed by coach, medic, s and c
> and sport scientist not nutritionist"

**The authoritative role model is therefore the five role design, with no
admin.** Everything below is now the target. The code does not match it yet, and
every difference becomes a numbered item in Stage A2 and a queue entry in Stage
B4.

### 10.1 The five roles

| Role | Access |
|---|---|
| Sport scientist | Everything. This is the role with no restrictions. |
| Coach | Everything except full clinical detail. Sees the limited injury view. |
| Medic | Everything except full clinical detail is the wrong way round here: the medic is the one role that sees clinical detail in full. |
| S&C | Sees the limited injury view. |
| Nutritionist | **Sees no injury or medical information at all.** |

### 10.2 The injury and medical rule, as now agreed

Medical information appears in **limited** form on every page that shows it. It
is visible to **coach, medic, S&C and sport scientist**. It is **not** visible
to the **nutritionist**, on any page.

The exact field list that "limited" covers is confirmed in Stage B2, not guessed
here. The existing code already draws a line of this shape, showing availability
status, body area, restrictions and expected return to coaching staff while
withholding the clinical note and diagnosis, so the change is mostly about
adding the nutritionist exclusion rather than inventing a new boundary.

### 10.3 Removing admin leaves work with no owner

This is the one consequence that needs stating plainly rather than being
absorbed silently. Eleven server-enforced capabilities currently belong to
`admin` and to nothing else. They are listed in section 4.1. Four of them are
legal obligations rather than product features:

- **Subject access requests**, both starting one and releasing it
- **Data retention**, including the run that actually deletes athlete data
- **The audit log**
- **User accounts**, including granting roles and resetting two factor login

**Working assumption, which I am proceeding on and flagging rather than
blocking for:** "sport scientist has access to everything" means the sport
scientist inherits all of it.

**The risk in that, in one sentence.** It puts the ability to delete athlete
records and release a person's full data file in the hands of the role that also
does day to day performance analysis, where today it sits with a club secretary
who cannot see squad data at all. That may well be the right call for a club
that has no secretary. It is worth knowing you are making it.

**Confirmed by you on 4 September 2026: "give this role to the sports
scientist".** Admin is removed. All eleven capabilities in section 4.1, including
subject access requests, data retention, the audit log and user accounts, belong
to the sport scientist. This is now settled and is carried as decision D-07 in
`docs/decisions-required.md`.

### 10.4 Squad setup

Nothing in the app can add a player. Since the sport scientist now holds
everything admin held, and squad setup sits beside user invites, this belongs to
the sport scientist too. Carried as decision D-16: a required screen that does
not exist.

---

**Stage A0 is closed. Proceeding to Stage A1, the route inventory.**
