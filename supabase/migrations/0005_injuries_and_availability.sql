-- 0005_injuries_and_availability.sql
--
-- What this does
--   Creates injuries, injury_clinical and availability.
--
-- Which spec sections this implements
--   04-data-model.md §9 (injury and availability)
--   01-roles-and-permissions.md §4 (medical data handling, the clinical split)
--   decisions/adr-007-clinical-data-separation.md
--
-- The rule this file exists to enforce structurally
--   Coaching staff see WHAT AN ATHLETE CAN DO. Medical staff see WHY.
--   Clinical fields live in a separate table from the non clinical injury record and from
--   the availability event log, with distinct RLS policies. They are not one table filtered
--   in the application layer, because that is one careless "select *" away from a breach.
--   01-roles-and-permissions.md §4 is explicit about this and it is the reason
--   injury_clinical exists as a table at all.

-- ---------------------------------------------------------------------------
-- injuries, the non clinical record
--
-- Every column here is visible to coaching staff. Body area is on this table and not on
-- injury_clinical because 01-roles-and-permissions.md §4 gives coaches "body area affected"
-- and withholds mechanism, diagnosis and notes.
-- ---------------------------------------------------------------------------

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
  updated_at      timestamptz not null default now(),
  -- 01-roles-and-permissions.md §1: medical cannot delete an injury record. It is closed,
  -- never deleted. deleted_at exists for the erasure process only, which is an audited
  -- admin action rather than a physio action.
  deleted_at      timestamptz,

  check (actual_return is null or actual_return >= onset_date),
  check (expected_return is null or expected_return >= onset_date)
);

comment on table injuries is
  'Non clinical injury record. Coach visible. Diagnosis, mechanism and notes are in '
  'injury_clinical and are medical only. 01-roles-and-permissions.md §4.';


-- ---------------------------------------------------------------------------
-- injury_clinical, MEDICAL ROLE ONLY
--
-- One row per injury, keyed on injury_id so there is no independent identity to leak.
-- org_id is carried denormalised on purpose: every RLS policy in Fydr opens with
-- org_id = auth_org_id() and a policy that had to join to injuries to find the tenancy
-- would be a policy that can be got wrong. CONTRACT.md rule 1.
--
-- Access, 01-roles-and-permissions.md §4:
--   coach   no access at all, for any operation
--   medical full access
--   athlete NO access to this table. The athlete reads injury_clinical_athlete_view,
--           created in 0009, which excludes clinical_notes. Working notes stay working
--           notes: physios will stop writing honestly if athletes read them.
--   admin   no access
-- ---------------------------------------------------------------------------

create table injury_clinical (
  injury_id      uuid primary key references injuries(id) on delete cascade,
  org_id         uuid not null references organisations(id),
  diagnosis      text,
  mechanism      text,
  severity       injury_severity,
  tissue_type    text,
  imaging        text,
  referral       text,
  -- The one column no athlete ever sees, through any path.
  clinical_notes text,
  treatment_plan text,
  updated_by     uuid references users(id),
  updated_at     timestamptz not null default now()
);

comment on table injury_clinical is
  'Medical role only, every operation. Never joined into a coach facing query. Athletes '
  'read injury_clinical_athlete_view, which excludes clinical_notes. ADR-007.';

comment on column injury_clinical.clinical_notes is
  'Physio working notes. Not visible to coaches and not visible to the athlete. '
  '01-roles-and-permissions.md §4 carve out 1.';


-- ---------------------------------------------------------------------------
-- availability
--
-- An event log, not a mutable status. The current status is the most recent row with
-- effective_to null. This gives availability history free, which is what every end of
-- season report needs. 04-data-model.md §9.
--
-- ONLY MEDICAL MAY INSERT. 01-roles-and-permissions.md §2 and §4: "Set availability
-- status: the only role that can". Coaches cannot, anywhere, and the policy in 0012 has no
-- coach clause at all rather than a coach clause with a condition on it.
-- ---------------------------------------------------------------------------

create table availability (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id),
  athlete_id      uuid not null references athletes(id),
  status          availability_status not null,
  -- 'no contact', 'no sprinting', 'upper body only'. Coach visible: this is what an
  -- athlete can do, which is exactly what coaching staff are entitled to.
  restrictions    text[],
  reason_category availability_reason,
  injury_id       uuid references injuries(id),
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  set_by          uuid not null references users(id),
  -- Non clinical, coach visible. The editor labels it as such. A physio writing a
  -- diagnosis here is a training problem, not a schema one, but the label is the defence.
  note            text,
  created_at      timestamptz not null default now(),

  check (effective_to is null or effective_to >= effective_from)
);

comment on table availability is
  'Event log. Current status is the latest row with effective_to null. Insert is medical '
  'only, 01-roles-and-permissions.md §4. Coaches read it and never write it.';

-- Current status lookup, 04-data-model.md §15. Also stops two open availability rows for
-- one athlete, which would make "the current status" ambiguous.
create unique index availability_one_open_per_athlete
  on availability (athlete_id) where effective_to is null;
