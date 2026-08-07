# ADR-007: Clinical data in a separate table

## Status

**ACCEPTED.** 2026-08. Binding as `CLAUDE.md` §2 rule 3 and specified in
`01-roles-and-permissions.md` §4.

---

## Context

The rule the product has to enforce: **coaching staff see what an athlete can do, medical
staff see why.**

| Field | Coach | Medical | Athlete |
|---|:--:|:--:|:--:|
| Availability status | Yes | Yes | Yes |
| Expected return date | Yes | Yes | Yes |
| Training restrictions | Yes | Yes | Yes |
| Body area affected | Yes | Yes | Yes |
| Injury mechanism | No | Yes | Yes |
| Diagnosis | No | Yes | Yes |
| Clinical notes | No | Yes | **No** |
| Treatment record | No | Yes | Partial |
| Imaging and referrals | No | Yes | Yes |

Three forces make this more than a display preference.

**Legal.** Under UK GDPR health data is special category data requiring an Article 9 lawful
basis in addition to an Article 6 basis. A coach reading a physio's diagnosis is not a UI
inconsistency, it is processing special category data without a basis, and it is reportable.

**Professional.** Physios keep working notes. "Suspect he is exaggerating this to avoid
selection" is the kind of clinical observation that gets written when notes are private and
never gets written when they are not. If clinical notes are readable by coaching staff, physios
will keep a second record outside Fydr, and the product loses the data it exists to hold. This
is why athletes are also excluded from free-text clinical notes (`01-roles-and-permissions.md`
§3, carve-out 1) even though they can see their own diagnosis.

**Structural.** Injury and availability data is read constantly by coaching staff: the injury
dashboard, the availability board, session planning, the squad list. It is a hot path. Whatever
mechanism separates clinical from non-clinical has to be efficient and impossible to bypass
accidentally.

The tempting design is one `injuries` table holding everything, with the application selecting
different columns per role. `01-roles-and-permissions.md` §4 already rules that out in one
sentence: it is one careless `select *` away from a breach. This ADR records why, in full.

---

## Decision

**Clinical fields live in a physically separate table with its own RLS policies and its own
audit obligation. There is no table containing both an availability field and a clinical
field.**

The schema is in `04-data-model.md` §9:

```sql
-- Non-clinical. Read by coaching staff, medical staff, and the athlete.
create table injuries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id),
  athlete_id      uuid not null references athletes(id),
  body_area       body_area not null,
  side            body_side,
  onset_date      date not null,
  status          injury_status not null default 'open',
  expected_return date,
  actual_return   date,
  session_id      uuid references sessions(id),
  occurred_in     occurrence_context,
  reported_by     uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Clinical. Medical role only, plus a restricted athlete view.
create table injury_clinical (
  injury_id      uuid primary key references injuries(id) on delete cascade,
  org_id         uuid not null references organisations(id),
  diagnosis      text,
  mechanism      text,
  severity       injury_severity,
  tissue_type    text,
  imaging        text,
  referral       text,
  clinical_notes text,
  treatment_plan text,
  updated_by     uuid references users(id),
  updated_at     timestamptz not null default now()
);
```

Four rules attach to it.

**1. Policies, not filters.**

```sql
alter table injury_clinical enable row level security;

create policy clinical_medical_all on injury_clinical for all
  using (org_id = auth_org_id()
         and auth_has_any_role(array['medical']::app_role[]));

-- The athlete's own record, minus clinical_notes. See rule 2.
create policy clinical_athlete_select on injury_clinical for select
  using (org_id = auth_org_id()
         and exists (select 1 from injuries i
                      where i.id = injury_clinical.injury_id
                        and i.athlete_id = auth_athlete_id()));
```

There is no policy granting `coach` or `admin` anything on this table. Not a restrictive one,
none at all. A coach's `select * from injury_clinical` returns zero rows.

**2. The athlete's view excludes free-text notes at the schema level.**

The athlete policy above would expose `clinical_notes`, which carve-out 1 forbids. Column
privileges are not usable here because the athlete and the physio use the same database role.
So athletes read through a view and have no privilege on the base table:

```sql
create view my_injury_clinical
with (security_invoker = true) as
  select ic.injury_id, ic.diagnosis, ic.mechanism, ic.severity,
         ic.tissue_type, ic.imaging, ic.referral, ic.updated_at
         -- clinical_notes and treatment_plan are deliberately absent
  from injury_clinical ic
  join injuries i on i.id = ic.injury_id
  where i.athlete_id = auth_athlete_id();

revoke all on injury_clinical from authenticated;
grant select on injury_clinical to medical_reader;   -- role held via policy, see below
grant select on my_injury_clinical to authenticated;
```

Since Supabase uses a single `authenticated` role with roles carried in JWT claims, the
practical implementation is: the athlete policy is written against the view's join and the base
table exposes `clinical_notes` only under the medical policy. Where the two overlap, split the
athlete policy into a `security definer` view that projects the permitted columns. The rule to
hold onto is that **an athlete's client never issues a query naming `clinical_notes`, and no
policy would let it succeed if it did.**

**3. Coaches read a view that cannot reach the clinical table.**

```sql
create view injuries_coach_view
with (security_invoker = true) as
  select i.id, i.org_id, i.athlete_id, i.body_area, i.side,
         i.onset_date, i.status, i.expected_return, i.actual_return,
         i.occurred_in,
         a.status as availability_status,
         a.restrictions,
         a.note as availability_note      -- non-clinical, coach-visible by design
  from injuries i
  left join lateral (
    select av.status, av.restrictions, av.note
    from availability av
    where av.athlete_id = i.athlete_id
      and av.effective_to is null
    order by av.effective_from desc
    limit 1
  ) a on true;
```

`security_invoker = true` matters: the view runs with the caller's privileges, so RLS on the
underlying tables still applies. A `security definer` view would bypass the policies and turn
the view itself into the vulnerability.

**4. Every read of clinical data is audited.**

`04-data-model.md` §13 lists `injury_clinical.read` as a mandatory audit event. Postgres does
not fire triggers on `select`, so reads go through an RPC rather than a direct table read:

```sql
create or replace function public.read_injury_clinical(p_injury_id uuid)
returns injury_clinical
language plpgsql
security invoker            -- RLS still applies. This does not grant anything.
as $$
declare
  v_row injury_clinical;
begin
  select * into v_row from injury_clinical where injury_id = p_injury_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into audit_log (org_id, actor_id, actor_role, action,
                         entity_type, entity_id, athlete_id, metadata)
  select v_row.org_id, auth_user_id(), 'medical', 'injury_clinical.read',
         'injury_clinical', p_injury_id, i.athlete_id,
         jsonb_build_object('via', 'rpc')
  from injuries i where i.id = p_injury_id;

  return v_row;
end;
$$;
```

The function is `security invoker`, so it grants nothing on its own. If a coach calls it, RLS
returns no row and they get `not_found`, indistinguishable from an injury that does not exist.
The audit entry exists because "who read this athlete's diagnosis, and when" is a question that
gets asked after a dispute, and the answer must not be "we do not log that".

### Naming inconsistency to resolve

`01-roles-and-permissions.md` §4 previously named the tables `injury_clinical_detail` and
`injury_availability`. `04-data-model.md` §9 names them `injuries` and `injury_clinical`, with
availability as a separate event log table. **The data model is correct and the roles document
was out of date.** This was a documentation defect with a known answer, not an open question, so
it carries no `O-nn` number. **Resolved**: `01-roles-and-permissions.md` §4 now uses the schema
names.

---

## Consequences

**Good:**

- **`select *` cannot leak clinical data**, because the columns are not in the table being
  selected from. This is the whole argument and it is worth more than any amount of careful
  application code.
- The permission boundary is one policy on one table, which is small enough to read in full and
  verify by inspection.
- The RLS test suite asserts it directly: `coach reads 0 rows from injury_clinical` is one line
  and it is unambiguous.
- An AI assistant writing a coach-facing query cannot accidentally include a clinical field,
  because joining `injury_clinical` would be a conspicuous act rather than an omission.
- Audit is enforceable, since reads funnel through one function.
- Retention can differ. Clinical records may need to be kept longer than performance data under
  professional obligations, and a separate table makes differential retention a `delete` on one
  table rather than a column-level nulling exercise.
- Encryption at rest could be applied to this table alone if a club ever demands it, without
  affecting query performance elsewhere.

**Bad, and accepted:**

- **A join is required** for the medical injury screen. It is a primary-key join on a table with
  at most a few thousand rows per organisation. Immaterial.
- **1:1 tables are a smell** in the general case and reviewers will flag it. It is deliberate
  and this document is the reason.
- **Two writes on injury creation**, which need a transaction so a clinical row cannot exist
  without its parent, or vice versa. Wrapped in a single RPC.
- **Nullable everything** in `injury_clinical`. A physio records a body area immediately and a
  diagnosis three days later after a scan. No `not null` constraints are available beyond the
  key.
- **The athlete's partial view is fiddly.** Athletes see diagnosis but not clinical notes, which
  cannot be expressed by row-level policies alone and needs the view in rule 2. This is the
  weakest part of the implementation and the part most worth writing tests around.
- **Reads through an RPC are less ergonomic** than a PostgREST select, and clients must not fall
  back to direct table reads for convenience. Enforced by a lint rule banning
  `.from('injury_clinical')` in application code.
- **The audit log grows** with a row per clinical read. At a few hundred reads per club per
  month this is nothing, and it is archived monthly (`05-architecture.md` §7).

---

## Alternatives considered

### 1. One table, column-level filtering in the application

`injuries` holds everything; the API selects different column lists per role.

Rejected, and it is worth being precise about why, because it is the design most teams reach
for.

| Failure mode | Likelihood |
|---|---|
| A developer or an assistant writes `select *` on a coach-facing screen | High. It is the default thing to write. |
| A new column is added and the coach-facing allowlist is not updated | High. Nothing fails, nothing warns, the field simply appears. |
| A debug endpoint, an export, or a report returns the full row | Moderate, and exports are exactly where it matters |
| An error message or a Sentry payload includes the full row | Moderate |
| A realtime `postgres_changes` payload includes the full row | High, and this one is invisible until it has already happened |

Every one of those is a reportable breach of special category data. The chosen design makes all
five impossible rather than unlikely. The cost of the safe design is a join.

There is a second, subtler problem: the safe version of this design cannot be tested
convincingly. "No query anywhere returns `clinical_notes` to a coach" is a statement about every
line of code in the repository. With separate tables it is a statement about one policy, and it
is one assertion in the RLS suite.

### 2. One table with Postgres column-level privileges

`grant select (id, body_area, status) on injuries to coach_role`.

Rejected on mechanism. Supabase authenticates every end user as the same database role,
`authenticated`, with the actual role in a JWT claim. Column privileges are granted to database
roles, so they cannot distinguish a coach from a physio here. Making them work would mean one
database role per application role plus a connection-level role switch, which fights the
platform and breaks PostgREST's pooling model.

Even setting that aside, column privileges produce a permission-denied error rather than an
empty result, which tells a coach that a column exists and they are not allowed to see it. For
"does this athlete have a diagnosis recorded", that is itself a small disclosure.

### 3. One table, exposed only through per-role views

`injuries` with `injuries_coach_view` and `injuries_medical_view`, and no direct access to the
base table.

Rejected as close but not sufficient. It relies on the base table remaining inaccessible
forever, so a single grant, a `security definer` function written for another purpose, or one
migration that enables a broader policy re-exposes everything. The chosen design does not depend
on remembering: there is no clinical column in the table coaches can read.

Views are still used, on top of the separated tables, for column shaping. They are a
convenience layer, not the boundary.

### 4. Clinical data in a separate database or schema

Move clinical data out entirely, behind its own service.

Rejected as disproportionate at this scale, and it would break the one join the medical screen
legitimately needs. Worth revisiting only if Fydr ever becomes a medical record system of
record, which `CLAUDE.md` §7 explicitly says it is not.

### 5. Application-level encryption of clinical fields

Encrypt clinical columns with a key held outside the database.

Rejected for v1. It defends against database exfiltration, which is not the threat model here:
the threat is an over-broad application query by an authorised user, and encryption does not
help because the application holds the key. It also makes clinical fields unsearchable, which a
physio will need. Reconsider if a club's procurement demands encryption at rest beyond what the
platform provides, and note the separate table makes it a contained change.

---

## Open questions

None. The decision is settled and the legal position leaves no room for a configurable
alternative.

One correction has been applied rather than left open: `01-roles-and-permissions.md` §4 used
to name the tables `injury_clinical_detail` and `injury_availability`, which the schema does not
use. See "Naming inconsistency to resolve" above. That document now uses the schema names.
