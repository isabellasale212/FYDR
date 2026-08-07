# Screen: Injury record

> **Layout status**: provisional. Awaiting client design photographs.

Screen 13 in the inventory (`02-information-architecture.md` §5). Route
`/staff/medical/injuries/{injury_id}`. **Medical role only.**

---

## Purpose

The full record of one injury: the clinical detail that only medical staff may see, and the
non-clinical availability and restrictions that everyone works from.

This is the only screen in Fydr that reads `injury_clinical.clinical_notes`. It is the highest
risk screen in the product and it is specified accordingly: every field is placed on one side of
the clinical boundary explicitly, every read of clinical detail is audited, and the athlete's
own view of the same record is specified here rather than being left to inference.

Fydr is **not** a medical record system of record (`CLAUDE.md` §7). This screen records
availability decisions and the clinical reasoning behind them so that a physio can run a
caseload inside one product. It is not a legal clinical record and the product must not be sold
as one. That distinction belongs in the contract as well as in this document.

Five jobs:

1. Record and edit clinical detail: diagnosis, mechanism, severity, tissue, imaging, referral,
   clinical notes, treatment plan.
2. Record and edit the non-clinical facts everyone else works from: body area, side, onset,
   status, expected return, restrictions, availability.
3. Show the rehabilitation plan, phase, milestones, and the athlete's rehab compliance.
4. Show the full history of the record: every status change, every availability change, every
   clinical update, with actor and time.
5. Give the athlete a view of their own record that includes their diagnosis and excludes the
   physio's working notes.

---

## Roles and access

| Role | Access |
|---|---|
| Medical / Physio | Full read and write. Every clinical read is audited. |
| Athlete (own record only) | Read-only, everything **except** `clinical_notes`. See §"The athlete's view". |
| Coach / S&C | **No access to this screen.** Direct navigation renders `noPermission`. Coaches see availability, restrictions, body area, and expected return on `injury-dashboard.md` and `athlete-profile.md`. |
| Admin | No access. |

**Why coaches are excluded from the screen and not merely from its columns.** The screen exists
to hold clinical content. A coach-visible variant would be a second implementation of the same
route with a different query, and the first time someone adds a field to the shared component it
appears on both. The coach's version of this information already has a home. Two screens, not
one screen with a flag.

**Enforcement**, in three independent layers, because any one of them alone is one refactor away
from failing:

1. **RLS.** No policy grants `coach` or `admin` anything on `injury_clinical`
   (`decisions/adr-007-clinical-data-separation.md`, rule 1). Not a restrictive policy, none at
   all.
2. **Route.** `/staff/medical/*` is a distinct subtree rendered only when the session's roles
   include `medical`. A coach's router has no matching route.
3. **RPC.** All clinical reads go through `read_injury_clinical`, which is `security invoker`,
   so a coach calling it directly gets `not_found`, indistinguishable from a non-existent
   injury.

---

## Entry points

| From | Trigger | Context |
|---|---|---|
| Injury dashboard, a row (medical) | Tap | `injury_id` |
| Injury dashboard, "+ Injury" | Tap | Create mode, athlete picker |
| Athlete profile, injury tab (medical) | "Open record" | `injury_id` |
| Flags, "Create injury record" (medical) | Tap | Create mode, athlete and flag pre-filled |
| Push `staff.injury.reported` | Tap | `/staff/medical/injuries/{id}` |
| Rehab groups, an athlete | Tap | `injury_id` |
| Athlete app, Programme tab, rehab plan | Tap | Athlete's read-only view of their own record |
| Medical report export | n/a | Not a navigation target; the export is generated from this record |

---

## Layout

**Assumption, pending client design photographs.** The two-zone layout, non-clinical above and
clinical below a visible boundary, is a deliberate recommendation and it is the one thing I
would not change on aesthetic grounds. A physio must be able to see at a glance which fields a
coach can also see. Interleaving clinical and non-clinical fields by topic would read more
naturally and would make the boundary invisible, which is exactly the failure this screen exists
to prevent.

### Mobile, medical view, `md` 390 pt

```
┌────────────────────────────────────────────────┐
│ ‹  Injury record                        ⋯     │ 56 sticky
├────────────────────────────────────────────────┤
│  A. Byrne  #14                                 │
│  Left hamstring · onset 1 Aug · 4 days         │
│  ◑ Modified · back Fri 8 Aug                   │
│  ┌────────────────────────────────────────────┐│
│  │ Detail │ Rehab │ History │ Athlete view    ││ 44 tabs
│  └────────────────────────────────────────────┘│
├════════════════════════════════════════════════┤
│  SHARED · visible to coaching staff            │ boundary label
│  ┌──────────────────────────────────────────┐  │
│  │ Body area      Hamstring            ✎    │  │
│  │ Side           Left                 ✎    │  │
│  │ Onset          Fri 1 Aug 2026       ✎    │  │
│  │ Occurred in    Training             ✎    │  │
│  │ Session        Conditioning, 1 Aug  →    │  │
│  │ Status         Rehab                ✎    │  │
│  │ Expected ret.  Fri 8 Aug 2026       ✎    │  │
│  │ Actual return  Not set                   │  │
│  ├──────────────────────────────────────────┤  │
│  │ AVAILABILITY                        ✎    │  │
│  │ ◑ Modified · injury                      │  │
│  │ Restrictions: no sprinting,              │  │
│  │               no max-effort acceleration │  │
│  │ Note: can complete full gym upper.       │  │
│  │       Visible to coaching staff.         │  │
│  │ Set by Dr Okoro, 1 Aug 16:20             │  │
│  └──────────────────────────────────────────┘  │
├════════════════════════════════════════════════┤
│  🔒 CLINICAL · medical staff only              │ boundary
│     Every read of this section is recorded.    │
│  ┌──────────────────────────────────────────┐  │
│  │ Diagnosis      Grade 1 BFLH strain  ✎    │  │
│  │ Mechanism      Decel, 85% effort    ✎    │  │
│  │ Severity       Minor                ✎    │  │
│  │ Tissue type    Muscle, myotendinous ✎    │  │
│  │ Imaging        None. Clinical dx.   ✎    │  │
│  │ Referral       None                 ✎    │  │
│  ├──────────────────────────────────────────┤  │
│  │ TREATMENT PLAN                      ✎    │  │
│  │ Phase 1 isometrics d1-3, progress to     │  │
│  │ eccentric loading d4. Nordic from d7     │  │
│  │ if pain-free.                            │  │
│  ├──────────────────────────────────────────┤  │
│  │ CLINICAL NOTES  🔒 not visible to the    │  │
│  │                    athlete          ✎    │  │
│  │ 1 Aug: Reports tightness at 85% during   │  │
│  │ decel. No palpable defect. ROM full.     │  │
│  │ 4 Aug: Pain-free on isometrics. Keen to  │  │
│  │ return for Sat. Manage expectations.     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [ Update availability ]  [ Close injury ]     │
└────────────────────────────────────────────────┘
```

The clinical notes block carries its own second lock, because it is the one field the athlete
cannot see and a physio writing there needs that fact in front of them. This is the mechanism by
which the professional argument in `decisions/adr-007` survives contact with a real physio: they
will only write honestly if they can see, at the moment of writing, that nobody else will read
it.

### Web, `xl` 1280 px

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│        │  A. Byrne #14 · Left hamstring · onset 1 Aug            ⎙  ⤓        │
│ Fydr   ├──────────────────────────────────────────────────────────────────────┤
│        │  [ Detail | Rehab | History | Athlete view ]                         │
│ ▣ Dash │ ┌── 5 cols ──────────────────┐ ┌── 7 cols ────────────────────────┐ │
│  · Inj │ │ SHARED                     │ │ 🔒 CLINICAL · medical only        │ │
│ ▤ Sched│ │ Body area   Hamstring   ✎  │ │ Every read is recorded.           │ │
│ ▧ Squad│ │ Side        Left        ✎  │ │ ┌───────────────────────────────┐ │ │
│ ▨ Prog │ │ Onset       1 Aug 2026  ✎  │ │ │ Diagnosis  Grade 1 BFLH    ✎ │ │ │
│ ⋯ More │ │ Occurred    Training    ✎  │ │ │ Mechanism  Decel 85%       ✎ │ │ │
│        │ │ Session     Cond. 1 Aug →  │ │ │ Severity   Minor           ✎ │ │ │
│        │ │ Status      Rehab       ✎  │ │ │ Tissue     Myotendinous    ✎ │ │ │
│        │ │ Expected    8 Aug       ✎  │ │ │ Imaging    None            ✎ │ │ │
│        │ │ Actual, │ │ │ Referral   None            ✎ │ │ │
│        │ ├────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│        │ │ AVAILABILITY            ✎  │ │ │ TREATMENT PLAN             ✎ │ │ │
│        │ │ ◑ Modified · injury        │ │ │ Phase 1 isometrics d1-3...   │ │ │
│        │ │ No sprinting               │ │ ├───────────────────────────────┤ │ │
│        │ │ No max-effort accel        │ │ │ CLINICAL NOTES 🔒 athlete    │ │ │
│        │ │ Note: full gym upper OK    │ │ │ cannot see this           ✎ │ │ │
│        │ │ Dr Okoro, 1 Aug 16:20      │ │ │ 1 Aug: Reports tightness...  │ │ │
│        │ ├────────────────────────────┤ │ │ 4 Aug: Pain-free on iso...   │ │ │
│        │ │ ATHLETE SEES               │ │ └───────────────────────────────┘ │ │
│        │ │ Everything above plus      │ │                                   │ │
│        │ │ diagnosis, mechanism,      │ │                                   │ │
│        │ │ severity, imaging,         │ │                                   │ │
│        │ │ referral, treatment plan.  │ │                                   │ │
│        │ │ Not clinical notes.        │ │                                   │ │
│        │ │        [ Preview ]         │ │                                   │ │
│        │ └────────────────────────────┘ └───────────────────────────────────┘ │
└────────┴──────────────────────────────────────────────────────────────────────┘
```

The "Athlete sees" panel with its Preview control is not a nicety. A physio deciding where to
write something needs to know which box the athlete will read, and the fastest way to make that
concrete is to show it.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `AvailabilityPill` | `06-design-system.md` §6.5 | Header status, `editable` |
| `AthleteCard` | §6.1 | Header identity |
| `ConfirmSheet` | §6.18 | Close injury, set unavailable, clear to play |
| `BottomSheet` | §6.19 | Every field editor on mobile |
| `EmptyState` | §6.16 | `noPermission` for a coach, `notStarted` for a record with no clinical detail yet |
| `SessionCard` | §6.14 | The session the injury occurred in |
| `ProgrammeExerciseRow` | §6.13 | Rehab tab, prescribed rehab work |
| `ComplianceRing` | §6.6 | Rehab compliance |
| `ClinicalBoundary` | **New**, this screen | The visible divider, lock glyph, and audit notice. Not decoration: a component so the treatment is identical everywhere it appears. |
| `FieldRow` | **New**, this screen | Label, value, edit affordance, provenance line |
| `MilestoneList` | **New**, this screen | Return-to-play milestones from `rehab_assignments.milestones` |
| `RecordTimeline` | **New**, this screen | History tab |

### `ClinicalBoundary`

```ts
export type ClinicalBoundaryProps = {
  /** 'clinical' renders the lock, the label, and the audit notice.
   *  'shared' renders the plain label only. */
  zone: 'shared' | 'clinical' | 'clinicalNotes';
  /** Rendered once per screen, not per section. */
  showAuditNotice?: boolean;
  children: React.ReactNode;
};
```

Copy, fixed and not to be reworded without changing it here:

| Zone | Label | Sub-label |
|---|---|---|
| `shared` | "Shared" | "Visible to coaching staff." |
| `clinical` | "Clinical" | "Medical staff only. Every read of this section is recorded." |
| `clinicalNotes` | "Clinical notes" | "Medical staff only. Not visible to the athlete." |

---

## Data requirements

### Field map

| Field | Source table.column | Zone | Athlete sees | Transformation |
|---|---|---|---|---|
| Athlete name, number | `athletes.first_name`, `last_name`, `squad_number` | shared | own | |
| Body area | `injuries.body_area` | shared | yes | Enum label, "Hamstring" |
| Side | `injuries.side` | shared | yes | Enum label |
| Onset date | `injuries.onset_date` | shared | yes | "Fri 1 Aug 2026" |
| Days out | derived, `current_date - onset_date` | shared | yes | Integer |
| Occurred in | `injuries.occurred_in` | shared | yes | Enum label |
| Session | `sessions.title`, `starts_at` via `injuries.session_id` | shared | yes | Link to session detail |
| Injury status | `injuries.status` | shared | yes | `open`, `rehab`, `return_to_play`, `closed` |
| Expected return | `injuries.expected_return` | shared | yes | Date, plus "in 3 days" |
| Actual return | `injuries.actual_return` | shared | yes | Date or "Not set" |
| Reported by | `users.full_name` via `injuries.reported_by` | shared | yes | |
| Availability status | `availability.status` | shared | yes | Latest open row |
| Restrictions | `availability.restrictions` | shared | yes | Chips |
| Reason category | `availability.reason_category` | shared | yes | |
| Availability note | `availability.note` | shared | yes | Explicitly non-clinical |
| Set by, set at | `availability.set_by`, `effective_from` | shared | yes | |
| **Diagnosis** | `injury_clinical.diagnosis` | clinical | **yes** | Free text |
| **Mechanism** | `injury_clinical.mechanism` | clinical | **yes** | Free text |
| **Severity** | `injury_clinical.severity` | clinical | **yes** | `minor`, `moderate`, `severe` |
| **Tissue type** | `injury_clinical.tissue_type` | clinical | **yes** | Free text |
| **Imaging** | `injury_clinical.imaging` | clinical | **yes** | Free text |
| **Referral** | `injury_clinical.referral` | clinical | **yes** | Free text |
| **Treatment plan** | `injury_clinical.treatment_plan` | clinical | **partial** | See O-274 |
| **Clinical notes** | `injury_clinical.clinical_notes` | clinicalNotes | **no** | Free text, append-oriented |
| Updated by, updated at | `injury_clinical.updated_by`, `updated_at` | clinical | yes | |
| Rehab programme | `programmes.name` via `rehab_assignments.programme_id` | shared | yes | |
| Rehab group | `groups.name` via `rehab_assignments.rehab_group_id` | shared | yes | |
| Phase | `rehab_assignments.phase` | shared | yes | |
| Milestones | `rehab_assignments.milestones` jsonb | shared | yes | `[{name, target_date, met_on, criteria}]` |
| Rehab compliance | `gym_session_logs` matched to the rehab programme | shared | own | Completed over prescribed |
| History | `audit_log`, `availability`, `injuries.updated_at`, `injury_clinical.updated_at` | mixed | partial | See History tab |

**The athlete-visible set is exactly the coach-visible set plus diagnosis, mechanism, severity,
tissue type, imaging, referral, and treatment plan, minus clinical notes.** That is the rule
from `01-roles-and-permissions.md` §4 and `decisions/adr-007`, restated here because it is the
one thing on this screen a developer must not get wrong from memory.

### Medical read, audited

```sql
-- From decisions/adr-007-clinical-data-separation.md, rule 4.
create or replace function public.read_injury_clinical(p_injury_id uuid)
returns injury_clinical
language plpgsql
security invoker            -- RLS still applies. This does not grant anything.
as $$
declare
  v_row     injury_clinical;
  v_roles   app_role[] := auth_roles();
  v_athlete uuid;
begin
  -- GUARD. This RPC is the MEDICAL read path only.
  -- Without it an athlete passes RLS (clinical_athlete_own grants select on their own
  -- row, all columns) and receives clinical_notes, breaking carve-out 1 in
  -- 01-roles-and-permissions.md §3. Athletes read my_injury_clinical instead, which
  -- excludes clinical_notes at the view level.
  if not ('medical' = any(v_roles)) then
    raise exception 'forbidden: read_injury_clinical is the medical read path'
      using errcode = '42501';
  end if;

  select * into v_row from injury_clinical where injury_id = p_injury_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select i.athlete_id into v_athlete from injuries i where i.id = p_injury_id;

  -- actor_role is the CALLER's role, never a literal. The audit log is the control that
  -- answers "who else read this diagnosis", so it cannot assert what it did not check.
  insert into audit_log (org_id, actor_id, actor_role, action,
                         entity_type, entity_id, athlete_id, metadata)
  values (v_row.org_id, auth_user_id(), 'medical'::app_role, 'injury_clinical.read',
          'injury_clinical', p_injury_id, v_athlete,
          jsonb_build_object('via','rpc','surface','injury_record',
                             'actor_roles', to_jsonb(v_roles)));

  return v_row;
end;
$$;
```

`metadata` records the surface and nothing else. **The values read never go in the audit log.**
The same record with the diagnosis text in `metadata` is a second, less-protected copy of the
clinical data (`09-security-and-compliance.md` §8.5).

### Non-clinical read

```sql
select
  i.id, i.athlete_id, i.body_area, i.side, i.onset_date,
  i.status, i.expected_return, i.actual_return, i.occurred_in,
  i.session_id, i.reported_by, i.created_at, i.updated_at,
  (current_date - i.onset_date)::int as days_out,
  a.first_name, a.last_name, a.squad_number,
  s.title as session_title, s.starts_at as session_starts_at,
  ru.full_name as reported_by_name,
  av.status as availability_status, av.restrictions, av.reason_category,
  av.note as availability_note, av.effective_from as availability_since,
  su.full_name as availability_set_by,
  ra.programme_id, ra.rehab_group_id, ra.phase, ra.milestones,
  p.name as programme_name, g.name as rehab_group_name
from injuries i
join athletes a on a.id = i.athlete_id
left join sessions s on s.id = i.session_id
left join users ru on ru.id = i.reported_by
left join lateral (
  select av.* from availability av
  where av.athlete_id = i.athlete_id and av.effective_to is null
  order by av.effective_from desc limit 1
) av on true
left join users su on su.id = av.set_by
left join lateral (
  select ra.* from rehab_assignments ra
  where ra.injury_id = i.id
  order by ra.starts_on desc limit 1
) ra on true
left join programmes p on p.id = ra.programme_id
left join groups g on g.id = ra.rehab_group_id
where i.id = $1
  and i.org_id = auth_org_id();
```

Readable by medical and by the athlete concerned. Coaches can read `injuries` rows, so this
query would return for a coach too, which is correct: none of it is clinical. The screen is
still closed to coaches at the route level.

### The athlete's view

Per `decisions/adr-007` rule 2, the athlete reads through a view that excludes `clinical_notes`
at the schema level, because column privileges cannot distinguish an athlete from a physio when
both authenticate as `authenticated`.

```sql
create view my_injury_clinical
with (security_invoker = true) as
  select ic.injury_id, ic.diagnosis, ic.mechanism, ic.severity,
         ic.tissue_type, ic.imaging, ic.referral, ic.treatment_plan,
         ic.updated_at
         -- clinical_notes is deliberately absent
  from injury_clinical ic
  join injuries i on i.id = ic.injury_id
  where i.athlete_id = auth_athlete_id();
```

Two differences from the version in ADR-007, both deliberate and both needing a note in that
document:

1. `treatment_plan` is **included**. The permission matrix in
   `01-roles-and-permissions.md` §4 says the athlete sees "Partial" of the treatment record.
   An athlete who cannot read their own rehabilitation plan cannot follow it, and the plan is
   already delivered to them as a rehab programme in the Programme tab. Including it here is
   consistent. O-274 asks for confirmation, because ADR-007's draft excluded it.
2. The athlete's read of their own clinical detail is **not** audited. ADR-007 requires auditing
   reads of `injury_clinical`; an athlete reading their own diagnosis every day would fill the
   audit log with rows nobody will ever query. The mandatory audit event exists to answer "who
   else read this athlete's diagnosis". O-275 asks for confirmation, and the conservative
   alternative is to audit it at a lower fidelity, one row per athlete per day.

**The athlete's client never issues a query naming `clinical_notes`, and no policy would let it
succeed if it did.** That sentence from ADR-007 is the invariant; the view is the mechanism.

### Writes

```sql
-- Create an injury and its clinical row in one transaction, so a clinical
-- row can never exist without its parent or the reverse.
create or replace function public.create_injury(
  p_athlete_id uuid, p_body_area body_area, p_side body_side,
  p_onset_date date, p_occurred_in occurrence_context,
  p_session_id uuid default null,
  p_clinical jsonb default '{}'::jsonb,
  p_availability jsonb default null      -- {status, restrictions, reason_category, note, expected_return}
) returns uuid language plpgsql security invoker as $$ ... $$;

-- Update clinical fields. Writes an audit row of action injury_clinical.update
-- listing the field names changed, never the values.
create or replace function public.update_injury_clinical(
  p_injury_id uuid, p_patch jsonb
) returns void language plpgsql security invoker as $$ ... $$;

-- Set availability. Closes the previous open row and inserts a new one.
create or replace function public.set_availability(
  p_athlete_id uuid, p_status availability_status,
  p_restrictions text[], p_reason_category availability_reason,
  p_injury_id uuid, p_note text, p_effective_from timestamptz default now()
) returns uuid language plpgsql security invoker as $$ ... $$;

-- Close an injury. Sets status closed and actual_return, and sets
-- availability to available unless another open injury exists.
create or replace function public.close_injury(
  p_injury_id uuid, p_actual_return date, p_note text
) returns void language plpgsql security invoker as $$ ... $$;
```

`update_injury_clinical` writes an audit row listing **field names** changed, not values. The
before-and-after of a diagnosis in an audit log is the same disclosure problem as logging the
read payload.

There is no delete. An injury record is closed, never deleted
(`01-roles-and-permissions.md` §1).

### Query keys

```ts
injuryRecord: {
  all: (orgId: string) => [...qk.org(orgId), 'injury-record'] as const,
  shared: (orgId: string, injuryId: string) =>
    [...qk.injuryRecord.all(orgId), 'shared', injuryId] as const,
  clinical: (orgId: string, injuryId: string) =>
    [...qk.injuryRecord.all(orgId), 'clinical', injuryId] as const,
  history: (orgId: string, injuryId: string) =>
    [...qk.injuryRecord.all(orgId), 'history', injuryId] as const,
},
```

| Key | `staleTime` | `gcTime` | Persisted |
|---|---|---|---|
| `shared` | 60 s | 10 min | Yes |
| `clinical` | 0 | **0** | **Never** |
| `history` | 60 s | 5 min | No |

`clinical` having `gcTime: 0` means it is discarded the moment the component unmounts. Combined
with the persister exclusion, clinical data never reaches disk on a device
(`09-security-and-compliance.md` §10.1). Refetching on every mount is the point: each mount is a
deliberate read and each deliberate read is an audit row.

---

## Audit logging requirement

Restated as a requirement rather than as an implementation note, because it is the single
obligation on this screen that carries legal weight.

**Every read of clinical detail is audited.** Postgres does not fire triggers on `select`, so
reads go through `read_injury_clinical` rather than a direct table read.

| Event | `action` | When | `metadata` |
|---|---|---|---|
| Medical opens the record | `injury_clinical.read` | On mount of the clinical zone | `{via: 'rpc', surface: 'injury_record'}` |
| Medical expands the board's clinical columns | `injury_clinical.read` | Per injury returned | `{via: 'batch', surface: 'injury_dashboard'}` |
| Medical edits a clinical field | `injury_clinical.update` | On save | `{fields: ['diagnosis','severity']}`, names only |
| Availability set or changed | `availability.set` | On save | `{status, injury_id, has_restrictions}` |
| Injury created | `injury.create` | On save | `{body_area, occurred_in}` |
| Injury closed | `injury.close` | On save | `{actual_return, days_out}` |
| Medical report exported | `export.run` | On generation | `{includes_clinical: true, injury_id}` |
| Athlete reads their own record | Not audited by default | | See O-275 |

Properties the implementation must have:

1. **The audit write is in the same statement as the read.** A read cannot succeed while its
   audit row fails.
2. **The audit log is append-only**, enforced by revoked grants and a trigger
   (`09-security-and-compliance.md` §8.5). Not by convention.
3. **The audit row is written by a `security definer` function**, so an actor cannot suppress
   their own log entry.
4. **Values are never logged.** `action: 'injury_clinical.read'` with an entity id is an audit
   record. The same record with the diagnosis in `metadata` is a breach waiting to be
   discovered.
5. **A failed authorisation attempt is also audited.** A coach reaching the RPC gets
   `not_found`; the failed attempt is logged as `injury_clinical.read_denied` with the actor and
   the entity, per the "every failed authorisation attempt at the RPC layer" clause in
   `09-security-and-compliance.md` §8.5. This is how a UI bug leaking a medical route becomes
   visible instead of silent.
6. **The admin can view the audit log and never modify it**
   (`01-roles-and-permissions.md` §2). "Who read this athlete's diagnosis, and when" is a
   question that gets asked after a dispute, and the answer must not be "we do not log that".

A test in the mandatory RLS suite asserts: reading one injury's clinical detail increments
`audit_log` by exactly one row with `action = 'injury_clinical.read'`, and a coach performing
the same call returns zero rows and increments the denied counter.

---

## The athlete's view

The athlete sees this record inside their own app, on the Programme tab's rehab section and from
the availability banner on Today. It is the same data, a different shell, and it is specified
here so the two cannot drift.

### What the athlete sees

```
┌────────────────────────────────────────────────┐
│  Your availability                             │
│  ◑ Modified                                    │
│  Your availability is set to modified.         │
│  Speak to medical staff.                       │
│                                                │
│  Restrictions                                  │
│  · No sprinting                                │
│  · No max-effort acceleration                  │
│  Note from medical: can complete full gym      │
│  upper.                                        │
│                                                │
│  Injury                                        │
│  Left hamstring · since 1 Aug (4 days)         │
│  Expected back  Fri 8 Aug                      │
│                                                │
│  Diagnosis      Grade 1 BFLH strain            │
│  How it happened  Deceleration, 85% effort     │
│  Severity       Minor                          │
│  Imaging        None. Clinical diagnosis.      │
│  Referral       None                           │
│                                                │
│  Your plan                                     │
│  Phase 1 isometrics d1-3, progress to          │
│  eccentric loading d4. Nordic from d7 if       │
│  pain-free.                                    │
│                                                │
│  Milestones                                    │
│  ✓ Pain-free walking          met 2 Aug        │
│  ✓ Pain-free isometrics       met 4 Aug        │
│  ○ Pain-free jogging          target 6 Aug     │
│  ○ 90% eccentric strength     target 8 Aug     │
│                                                │
│  Your rehab sessions      ◍ 6 of 7 this week   │
│  [ Open rehab programme ]                      │
│                                                │
│  [ Export my data ]                            │
└────────────────────────────────────────────────┘
```

### What the athlete does not see

- `clinical_notes`. Not truncated, not summarised, not "hidden behind a control". Absent from
  the query, absent from the payload, absent from the view definition.
- Any other athlete's record.
- Any indication that clinical notes exist. The section is not rendered as an empty or locked
  block. A locked block would tell the athlete there is something being kept from them, which is
  a worse outcome than saying nothing: it invites the conversation the carve-out exists to
  avoid, and it puts the physio in the position of refusing.

### Why the athlete sees their diagnosis but not the notes

Stated for the record because it is counter-intuitive and will be questioned. The athlete has a
right of access to their personal data under Article 15 and a diagnosis about them is their data
(`09-security-and-compliance.md` §6). Clinical notes are working notes: "suspect he is
exaggerating this to avoid selection" is the kind of observation that gets written when notes
are private and never gets written when they are not
(`decisions/adr-007-clinical-data-separation.md`). If notes are athlete-readable, physios keep a
second record outside Fydr, and the product loses the data it exists to hold.

**This is a defensible position, not a settled one.** A subject access request will reach the
notes, because Article 15 does not have a "working notes" exemption in the general case. The
product does not hide the notes from a formal SAR; it declines to put them in an app screen. The
SAR pack generation on `exports.md` must therefore be able to include them under a documented,
audited, human-reviewed process, and that process is a legal question that belongs with the
club's DPO. Raised as O-276.

### Athlete-side rules

| Rule | Behaviour |
|---|---|
| Read-only, always | An athlete cannot edit any field. They report a new problem through the Today tab, which notifies medical (`03-flows.md` §6). |
| Availability copy is fixed | "Your availability is set to {status}. Speak to medical staff." (`06-design-system.md` §12.2) |
| Second person | "Your plan", "Your rehab sessions". Never "The athlete's plan". |
| No clinical jargon is softened | The diagnosis renders exactly as the physio wrote it. Rewriting a physio's words for an athlete audience would be Fydr putting words in a clinician's mouth. |
| Offline | Renders from the athlete's local cache **except** the clinical fields, which are not persisted. Offline, the athlete sees availability, restrictions, plan, and milestones, and the clinical block reads "Available online only." |
| Export | The athlete's own export includes everything in this view, per Article 20 portability. It does not include clinical notes. |

---

## States

### Default, medical

Detail tab, shared zone loaded, clinical zone loaded (which is the audited read), availability
current.

### Loading

Shared zone renders skeleton field rows immediately. The clinical zone renders its boundary
header and a skeleton block: the boundary is visible before the content, so the physio knows
what is loading. The audit row is written when the RPC returns, not when the skeleton renders.

### Empty

| Condition | `kind` | Copy |
|---|---|---|
| Injury exists, no clinical row yet | `notStarted` | "No clinical detail recorded." Action: "Add clinical detail". Common and correct: a physio records a body area immediately and a diagnosis three days later after a scan (`decisions/adr-007`, consequences). |
| No rehab assignment | `notStarted` | "No rehab programme assigned." Action: "Assign rehab programme". |
| No milestones | `notStarted` | "No return-to-play milestones set." Action: "Add milestones". |
| No history beyond creation | `noData` | "Created 1 Aug by Dr Okoro. No changes since." |
| Coach navigates here directly | `noPermission` | "Injury detail is visible to medical staff only." Fixed copy from `06-design-system.md` §11.2. No action, no request-access affordance. |
| Athlete has no injury | `allClear` | Athlete view: "You have no current injury." |

### Error

| Failure | Behaviour |
|---|---|
| Shared query | Screen-level error with retry. |
| Clinical RPC returns `not_found` for medical | Rendered as the `notStarted` empty state, not an error. A missing clinical row is normal. |
| Clinical RPC fails on network | "Clinical detail could not be loaded." Retry. No audit row is written, correctly. |
| Save fails | Optimistic update rolls back, the edited value stays in the field, message: "This change was not saved. Your text is still here." Never discards typed clinical text. |
| Concurrent edit | `injury_clinical.updated_at` is sent with the patch. A mismatch returns `stale_write` and the client shows both versions side by side with "Dr Okoro changed this at 11:04". The physio chooses. Clinical text is never silently merged and never silently overwritten. |
| Audit insert fails | The read fails. This is deliberate: an unaudited clinical read is not an acceptable degraded mode. The error reads "Clinical detail could not be opened. Try again." |

### Offline

- Shared zone renders from cache with "Last updated 08:12" and an offline chip.
- **Clinical zone renders `EmptyState kind="offline"`**: "Clinical detail is available online
  only." Not a limitation to apologise for: clinical data is not cached to the device, and the
  audit obligation cannot be met offline anyway.
- All writes disabled.

### Role-specific

| Role | Behaviour |
|---|---|
| Medical | Full screen, all four tabs, all edits. |
| Athlete, own record | The athlete view above, inside the athlete shell, read-only, no clinical notes. |
| Coach | `noPermission`. The route does not exist in the coach shell; this state exists for a deep link that survived a role change. |
| Admin | `noPermission`. |
| Platform support | No access to clinical detail, ever, under any grant (`01-roles-and-permissions.md` §7). |

---

## Interactions

| Action | Result |
|---|---|
| Tap a field's edit affordance | Opens an inline editor (web) or a `BottomSheet` (mobile). Saves on confirm, not on blur, so a mistimed tap cannot alter a diagnosis. |
| Edit a clinical field | Writes through `update_injury_clinical`. Audit row lists the field name. |
| Add to clinical notes | The notes editor is **append-oriented**: the existing text is shown read-only above a new-entry box, and saving prefixes the date. Editing history is possible through an "Edit previous entries" control, which is deliberately slower. A physio's notes are a chronology and treating them as one text blob invites accidental deletion. |
| Tap "Update availability" | Opens the availability editor: status, restrictions, reason category, expected return, non-clinical note. The note field's helper text reads "Visible to coaching staff. Do not record clinical detail here." |
| Set status to `unavailable` | Behind a `ConfirmSheet` stating the consequence: "A. Byrne will be marked unavailable for all sessions. Coaching staff and the athlete will be notified." |
| Tap "Close injury" | `ConfirmSheet` requiring `actual_return`. Sets `injuries.status = 'closed'`, sets availability to `available` unless another open injury exists, resumes any suspended gym programme (`03-flows.md` §4, rehab exception), and notifies coaching staff and the athlete. |
| Tap "Assign rehab programme" | Navigate to the programme picker, filtered to `programme_type = 'rehab'`. Assigning suspends the athlete's gym programme rather than deleting it. |
| Tap "Add to rehab group" | Navigate to `rehab-groups.md` with this athlete pre-selected. |
| Mark a milestone met | Sets `met_on` in the `milestones` jsonb. Writes an audit row. Milestones are the evidence trail behind a return-to-play decision and they are not casually editable: unmarking a met milestone requires a reason. |
| Tap "Preview athlete view" | Renders the exact athlete payload in a sheet, from the same view the athlete's client reads, not from a client-side filter of the medical payload. Previewing a filtered copy would not prove anything. |
| Tap "Export medical report" | Generates a PDF. Writes `export.run` with `includes_clinical: true`. Explicit confirmation states that the file leaves the system's access controls. |
| Tap the History tab | Full chronology: creation, every clinical update (field names, actor, time), every availability change (full detail), every milestone, every rehab assignment. Clinical **values** are not in the history unless the physio holds the medical role, in which case the current values are on the Detail tab anyway. The history shows that a change occurred, not a diff of clinical text. |
| Tap the session link | Navigate to `session-detail.md` for the session the injury occurred in. |

---

## Validation rules

| Rule | Enforcement |
|---|---|
| Only medical writes clinical fields | RLS on `injury_clinical` for all operations. |
| Only medical sets availability | RLS on `availability` insert. The only role that can (`01-roles-and-permissions.md` §4). |
| An injury is never deleted | No delete policy on `injuries`. `close_injury` sets status. |
| A clinical row cannot exist without its injury | Foreign key with `on delete cascade`, and creation is wrapped in one RPC so neither can exist alone. |
| `expected_return >= onset_date` | Check constraint. |
| `actual_return >= onset_date` | Check constraint. |
| Closing requires `actual_return` | RPC-level rejection. |
| Every clinical field is nullable | Deliberate. A physio records a body area immediately and a diagnosis after a scan. No `not null` beyond the key. |
| Setting `unavailable` requires a reason category | RPC-level. |
| The availability note is not a clinical field | Enforced socially by the helper text and structurally by living on `availability`, which coaches read. There is no technical control preventing a physio typing a diagnosis there, and there cannot be. It is the residual risk in this design and it is worth naming in staff training. |
| Concurrent clinical edits are detected | `updated_at` optimistic concurrency, never last-write-wins. |
| The athlete's view excludes `clinical_notes` at the schema level | The view definition. Tested by asserting the athlete's payload has no such key, not by asserting the UI does not render it. |
| Clinical reads are audited | Same-statement insert. Tested. |
| Clinical data is not persisted to disk | Query persister exclusion. Tested. |

---

## Edge cases

| Case | Handling |
|---|---|
| **Injury reported by the athlete, no clinical detail yet.** | `injuries` row exists with `reported_by` set and body area from the athlete's report. Clinical zone renders `notStarted`. Availability is not yet set, so the header shows "Not set" rather than guessing. |
| **Athlete has two open injuries.** | Two records. The availability row points at one. The record shows a chip "This athlete has another open injury" linking across. Closing one does not restore availability if the other is still open, which `close_injury` checks. |
| **Recurrence of the same injury.** | A new record, not a reopened one. The screen shows "Previous: left hamstring, 12 Mar to 2 Apr 2026" as a link. Recurrence is the single most important pattern in soft-tissue injury and merging it into one record destroys the ability to see it. |
| **Injury with no availability change**, for example a minor niggle recorded for tracking. | Legitimate. Availability stays `available`, the record exists, coaches see nothing changed. The board does not list them. |
| **Physio writes a diagnosis into the availability note.** | Not technically preventable. Mitigations: the helper text, a soft client-side warning if the note matches a list of clinical terms, and staff training. The warning is advisory and never blocks. |
| **Athlete opens their view while the physio is editing.** | The athlete's view refetches on focus and shows the saved state. Unsaved physio edits are not visible. |
| **Physio deletes all clinical notes text.** | Permitted. The audit row records `fields: ['clinical_notes']`. The previous text is not recoverable from the audit log by design, because the log must not contain clinical values. If clinical note versioning is required, it needs a separate append-only notes table, which is O-277. |
| **Athlete leaves the club with an open injury.** | The record persists under the retention schedule (`09-security-and-compliance.md` §7). Medical can still open and close it. It disappears from the default board. |
| **Erasure request from a former athlete.** | Handled by the erasure process, not this screen. Clinical records may need to be retained longer than performance data under professional obligations, and the separate table makes differential retention a delete on one table (`decisions/adr-007`, consequences). |
| **A coach's session opens a stale deep link to this route after their medical role was revoked.** | JWT claims may be stale (`05-architecture.md` §"Claim staleness"). The route renders, the RPC returns `not_found`, the screen renders `noPermission`, and the denied attempt is audited. Three layers, and the outermost one being stale does not matter. |
| **Support access.** | `platform_support` never grants access to clinical detail fields (`01-roles-and-permissions.md` §7). Support opening this route sees the shared zone and `noPermission` for the clinical zone. |
| **Injury created against the wrong athlete.** | There is no delete. Medical closes it with a note and creates the correct one. The audit trail shows both, which is the correct outcome for a clinical record even though it is untidy. |
| **The record is open on a shared physio-room monitor.** | The clinical zone does not auto-collapse on idle in v1. It probably should. Raised as part of O-277. |

---

## Performance notes

| Concern | Approach |
|---|---|
| Query shape | Two queries: one non-clinical join, one primary-key RPC. Both trivial. The whole screen is a handful of rows. |
| The join ADR-007 accepts | A primary-key join on a table with at most a few thousand rows per organisation. Immaterial, as predicted. |
| Audit write cost | One insert per read. At a few hundred reads per club per month this is nothing. Archived monthly (`05-architecture.md` §7). |
| No prefetch of clinical data | Ever. Not on hover, not on list render, not on navigation intent. Every prefetch is an audit row for a read nobody made, which pollutes the one log that must stay meaningful. |
| No realtime on clinical | A realtime payload carrying a clinical row is the invisible leak in `decisions/adr-007`, alternative 1. The shared zone may subscribe to `availability`; `injury_clinical` is never in a publication. |
| Cache | Clinical `gcTime: 0`, never persisted. Refetch on every mount, which is the audit design working as intended. |
| Rendering | A form. No lists, no charts, no virtualisation. |
| Export | PDF generated server-side in an Edge Function. The client never assembles a clinical document from its own state. |
| Budget | Shared query 150 ms p95. Clinical RPC 200 ms p95 including the audit insert. Screen interactive 800 ms p95. |

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Heading structure | `h1` athlete name and injury, `h2` per zone ("Shared", "Clinical"), `h3` per block. The zone headings are real headings, so a screen reader user can navigate by zone and always knows which side of the boundary they are on. |
| Zone announcement | The clinical zone heading's accessible name is "Clinical. Medical staff only. Every read of this section is recorded." The audit consequence is in the label. |
| Clinical notes | Its heading reads "Clinical notes. Medical staff only. Not visible to the athlete." A physio using a screen reader must get the same warning a sighted physio gets from the lock glyph. |
| Field rows | `role="group"` per field with the label, the value, and the provenance as one accessible unit: "Diagnosis: Grade 1 BFLH strain. Updated by Dr Okoro, 4 August. Edit." |
| Edit affordances | Never an icon alone. Each carries "Edit {field name}". |
| Confirmations | `ConfirmSheet` titles state the consequence, never "Are you sure?". Cancel is first in reading order and the wider target. |
| Athlete view | Second person throughout. Milestone list is a real list with met and unmet states carried by glyph plus the word "met" or "target", never a tick colour alone. |
| Preview | The preview sheet announces "Preview of what the athlete sees. Read only." on open. |
| Touch targets | Field rows 56 pt, edit affordances 48 pt with 8 pt separation. |
| Dynamic type | Verified to 200%. Clinical notes and treatment plan are the long-text fields and they wrap without truncation at every size. No field is ever truncated with an ellipsis: a truncated diagnosis is a misread diagnosis. |
| Reduced motion | Sheets fade rather than slide. No transitions on zone expansion. |
| Focus | Opening an editor moves focus into it and returns focus to the affordance on close. No keyboard trap in any sheet. |
| Errors | Announced, associated with their field, and describing the fix. A failed save announces "Not saved. Your text is still here." |
| Print, web | The print stylesheet renders the shared zone and, for medical only, the clinical zone with a page header naming the reader and the timestamp. Printing writes an `export.run` audit event, because a printed clinical record leaves every control the system has. |

---

## Open questions

- **O-272**: Two-zone layout with a visible boundary is my strong recommendation and I would
  argue against changing it even if your designs show fields interleaved by topic. The boundary
  is the control. Confirm.
- **O-273**: Clinical notes as an append-only chronology versus a single editable text field.
  I have specified append-oriented with a slower path to editing history. A physio's notes are a
  chronology, and one careless select-all-delete on a text blob loses a season of observations.
  Confirm, because it changes the editor.
- **O-274**: Does the athlete see `treatment_plan`? `01-roles-and-permissions.md` §4 says
  "Partial" for the treatment record and ADR-007's draft view excludes it. I have included it,
  because an athlete who cannot read their rehabilitation plan cannot follow it and the plan
  reaches them as a rehab programme anyway. If you disagree, the view definition changes and
  ADR-007 needs no change.
- **O-275**: Is an athlete's read of their own clinical detail audited? I have said no, because
  it would fill the log with rows nobody will query and the log exists to answer "who else read
  this". The conservative alternative is one row per athlete per day. Your DPO's call.
- **O-276**: Subject access requests and clinical notes. The product does not show notes to
  athletes in-app. Article 15 has no general working-notes exemption, so a formal SAR will reach
  them. The SAR pack process on `exports.md` needs a documented, audited, human-reviewed path to
  include them, and the decision about what is withheld is the club's, not Fydr's. This needs a
  legal answer before launch, not after the first request.
- **O-277**: Three smaller decisions I have made and would like confirmed together: (a) clinical
  note deletions are not recoverable, because versioning them would need a separate append-only
  table; (b) the clinical zone does not auto-collapse after a period of inactivity on a shared
  monitor, which it arguably should; (c) the History tab shows that a clinical field changed but
  never the old and new values, so there is no diff of clinical text anywhere in the product.

---

## Related documents

- Why the tables are separate, and the RPC pattern → `decisions/adr-007-clinical-data-separation.md`
- Who sees which field → `01-roles-and-permissions.md` §4
- Audit obligations and append-only enforcement → `09-security-and-compliance.md` §8.5
- Injury and availability flow → `03-flows.md` §6
- Availability board → `injury-dashboard.md`
- Rehab group allocation → `rehab-groups.md`
- Schema → `04-data-model.md` §9
