-- 0018_rehab_assignments.sql
--
-- What this does
--   Adds rehab_assignments (an athlete's tracked rehabilitation phase, interval style
--   like availability) and tightens group_memberships so that a rehab group
--   (groups.group_type = 'rehab') can only ever be written to by medical, while every
--   other group type keeps the existing coach/medical/admin write access untouched.
--
-- Which spec sections this implements
--   screens/rehab-groups.md, screen 42
--   02-information-architecture.md line 444: "Medical-owned. Not the whiteboard item,
--     but a real feature backed by rehab_assignments.rehab_group_id"
--   20-route-map.md line 99 / 1013: /injuries/rehab-groups, medical full, coach read only
--
-- Deliberately smaller than the full spec, and every cut is real:
--   - No programmes / programme_assignments table. The spec's own field map joins
--     rehab_assignments.programme_id to programmes for a "shared programme" column, and
--     the interactions table has a whole "Assign rehab programme" flow. Neither programmes
--     nor programme_assignments exist in this schema — that is the same "genuine new part
--     of the database" decision Gym programme and the rest of Reports are already queued
--     behind, not a quick add alongside this one. rehab_assignments here tracks phase and
--     group only. The day a programme system lands, programme_id is one additive column
--     and one join away, not a redesign.
--   - No gym_session_logs / compliance_expectations join for a rehab ComplianceRing.
--     gym_session_logs does not exist (same reason as above: no gym-programme domain
--     yet), so there is nothing to log completion against.
--   - No session scheduling link (session_participants.group_id) and so no "17 of 21
--     sessions this week" line, no realtime clearance notice, no drag and drop. Drag and
--     drop is cut the same way team-allocation.md's was: a chip picker instead, which
--     also makes "in two rehab groups at once" structurally harder to reach by accident.
--   - "An athlete belongs to at most one rehab group" is enforced in the query layer, the
--     same choice team_allocations made for "one team per week": closing the prior open
--     row before opening a new one, not a database constraint. See
--     lib/queries/rehabGroups.ts's header.
--
-- Learned from 0013 and 0017, both caught only by npm run test:tenancy after the fact:
--   Postgres hands `public` (and so `anon`, which inherits it) default privileges on
--   every table the moment it is created. Revoking that BEFORE granting narrowly, in
--   this same migration, so there is no gap for that test to find this time.

-- ---------------------------------------------------------------------------
-- rehab_assignments
--
-- Event log, not a mutable status, matching availability's own shape exactly
-- (0005_injuries_and_availability.sql): the current phase is the most recent row with
-- effective_to null. phase is free text, matching screens/rehab-groups.md's own
-- RehabGroupColumnProps ("phase: string | null") rather than a fixed enum: a physio
-- describes "Return to running" or "Phase 3" in their own words, not from a picklist
-- this schema would have to guess in advance.
--
-- ONLY MEDICAL MAY INSERT OR UPDATE. screens/rehab-groups.md's own role table: "Medical
-- is the only role that may assign rehabilitation programmes" and, more specifically,
-- "Only medical allocates" in Validation rules. Coach has no clause on this table at
-- all, the same "no clause, not a gated one" rule 0012 states for availability.
-- ---------------------------------------------------------------------------

create table rehab_assignments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id),
  athlete_id      uuid not null references athletes(id),
  -- Null means "tracked but not yet allocated to a group" — an athlete just moved into
  -- rehabilitation sits in the unallocated pool with no phase or a provisional one.
  rehab_group_id  uuid references groups(id),
  phase           text,
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  set_by          uuid not null references users(id),
  created_at      timestamptz not null default now(),

  check (effective_to is null or effective_to >= effective_from)
);

comment on table rehab_assignments is
  'Event log of an athlete''s rehab group and phase over time. Current row is the one '
  'with effective_to null. Insert and update are medical only. screens/rehab-groups.md.';

-- Mirrors availability_one_open_per_athlete (0005): stops two open phase rows for one
-- athlete, which would make "the current phase" ambiguous.
create unique index rehab_assignments_one_open_per_athlete
  on rehab_assignments (athlete_id) where effective_to is null;

alter table rehab_assignments enable row level security;
revoke all on public.rehab_assignments from public, anon, authenticated;
grant select, insert, update on public.rehab_assignments to authenticated;
grant select, insert, update, delete on public.rehab_assignments to service_role;

create policy rehab_assignments_staff_select on public.rehab_assignments for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

-- No athlete self-select. screens/rehab-groups.md's role table: "No access to this
-- screen. An athlete sees their own rehab programme in the Programme tab" — that tab is
-- part of the gym-programme domain this pass does not build, so there is nowhere yet
-- for an athlete to read their own phase. A real, documented gap, not a forgotten one.

create policy rehab_assignments_medical_insert on public.rehab_assignments for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['medical']::app_role[])
              and set_by = auth_user_id());

-- Update exists only to close an interval by setting effective_to, the same reasoning
-- as availability_medical_update in 0012.
create policy rehab_assignments_medical_update on public.rehab_assignments for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['medical']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy. Never deleted, CLAUDE.md rule 4.


-- ---------------------------------------------------------------------------
-- Tightening group_memberships: a rehab group is medical-only to write to.
--
-- 0012's group_memberships_staff_insert/update policies are deliberately generic —
-- coach, medical and admin can all manage positional, training, age and custom groups,
-- and that is correct and stays correct here. What is missing is the one carve-out
-- screens/rehab-groups.md requires: "Only medical allocates" for group_type = 'rehab'
-- specifically. RLS policies for the same command are OR'd together, so a second,
-- looser policy cannot narrow a first, wider one — the original policies have to be
-- replaced with a version that adds the carve-out, which is why this is a drop and
-- recreate rather than an additional create policy. CLAUDE.md §5 "migrations are
-- additive" is about not hand-editing an applied migration file; replacing a policy's
-- logic from a new migration, the way 0013 and 0017 already replaced privileges, is the
-- normal way to do that.
--
-- Every other group type keeps exactly the access it already has. Removing a member
-- from Forwards, or adding one to the Academy group, is unaffected: this only blocks a
-- coach when the row's own group_id points at a group_type = 'rehab' group.
-- ---------------------------------------------------------------------------

drop policy group_memberships_staff_insert on public.group_memberships;

create policy group_memberships_staff_insert on public.group_memberships for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and (
      auth_has_any_role(array['medical']::app_role[])
      or (
        auth_has_any_role(array['coach','admin']::app_role[])
        and not exists (
          select 1 from groups g
          where g.id = group_id and g.org_id = auth_org_id() and g.group_type = 'rehab'
        )
      )
    )
  );

drop policy group_memberships_staff_update on public.group_memberships;

create policy group_memberships_staff_update on public.group_memberships for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]))
  with check (
    org_id = auth_org_id()
    and (
      auth_has_any_role(array['medical']::app_role[])
      or (
        auth_has_any_role(array['coach','admin']::app_role[])
        and not exists (
          select 1 from groups g
          where g.id = group_id and g.org_id = auth_org_id() and g.group_type = 'rehab'
        )
      )
    )
  );
