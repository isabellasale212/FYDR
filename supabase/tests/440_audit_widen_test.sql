-- Widening the audit triggers: seven more tables, and two row shapes the
-- function had not met.
--
-- WHY EVERY TABLE GETS A REAL WRITE rather than an attachment check. Asserting
-- the trigger exists proves it was created, not that it records anything
-- useful. 0085's lesson was injury_clinical: a table whose shape the function
-- did not anticipate produced a row with nulls where the answer goes, and
-- nothing failed. Two of the seven here are that same case again — athletes has
-- no athlete_id because the row IS the athlete, and user_roles has none because
-- a role grant is not about an athlete — so each one is written to for real,
-- through RLS, as a role that is genuinely allowed to.
--
-- The disclosure rule from 0085 is re-asserted at the end across ALL audited
-- tables, not just the clinical ones: metadata may carry identity, never
-- content.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these writes go through policies rather than around them');

-- --------------------------------------------------------------------- writes
do $$
declare o   uuid := tests.uid('orga','org');
        a1  uuid := tests.uid('orga','athlete_1');
        a2  uuid := tests.uid('orga','athlete_2');
        adm uuid := tests.uid('orga','user_admin');   -- sport scientist
        tm  uuid := tests.uid('orga','team');
        td  uuid := tests.uid('orga','td_audit');
        pr  uuid := tests.uid('orga','prog_audit');
begin
  perform tests.set_jwt(adm);

  -- 1. athletes: the row IS the athlete.
  update athletes set squad_number = 77 where id = a1;

  -- 2. athlete_consents: purpose <> healthkit_sync passes consent_write_allowed
  --    without the org needing to be premium.
  insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
  values (o, a2, 'leaderboard_visibility', now(), '2026.1');

  -- 3. body_composition: recorded_by must be the writer.
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by)
  values (tests.uid('orga','bc_widen'), o, a1, current_date, 99.5, adm);

  -- 4. test_results needs a definition to belong to; both are the writer's.
  insert into test_definitions (id, org_id, name, test_category, unit)
  values (td, o, 'Audit widen test', 'strength', 'kg');
  insert into test_results (id, org_id, athlete_id, test_definition_id, test_date, value, recorded_by)
  values (tests.uid('orga','tr_widen'), o, a1, td, current_date, 120.0, adm);

  -- 5. programme_assignments: the policy requires the programme to be this
  --    org's and assigned_by to be the writer.
  insert into programmes (id, org_id, name, programme_type, status, created_by)
  values (pr, o, 'Audit widen programme', 'gym', 'active', adm);
  insert into programme_assignments (id, org_id, programme_id, athlete_id, starts_on, status, assigned_by)
  values (tests.uid('orga','pa_widen'), o, pr, a1, current_date, 'active', adm);

  -- 6. team_allocations: a fixture row already exists, so this is an update.
  --    The column is `status` (draft/published/withdrawn), not `selection`.
  update team_allocations set status = 'withdrawn'
  where org_id = o and athlete_id = a1 and team_id = tm;

  -- 7. user_roles: the table that grants privilege.
  insert into user_roles (org_id, user_id, role)
  values (o, tests.uid('orga','user_coach'), 'nutritionist');
end $$;

-- Only the sport scientist may read audit_log.
select tests.set_jwt(tests.uid('orga','user_admin'));

-- ---------------------------------------------------------------------- reads
select is(
  (select count(distinct entity_type)::int from audit_log
    where action ~ '^(athletes|athlete_consents|body_composition|test_results|programme_assignments|team_allocations|user_roles)\.'),
  7,
  'all seven tables produced an audit row — every one written for real, through RLS'
);

-- The two shapes the function had not met.
--
-- Scoped by the field that changed, not just the entity: tests.fixtures() runs
-- `update athletes set default_team_id = ...` of its own, and the trigger
-- audits that too — which is the mechanism working, and why an assertion keyed
-- only on the athlete found more than one row.
select is(
  (select athlete_id from audit_log
    where action = 'athletes.update' and entity_id = tests.uid('orga','athlete_1')
      and metadata -> 'changed' = '["squad_number"]'::jsonb),
  tests.uid('orga','athlete_1'),
  'athletes: the athlete is the row''s own id, not the null a generic trigger would have written'
);

-- Scoped the same way: tests.fixtures() grants nine roles of its own, all
-- audited. The grant this file made is the coach ALSO becoming a nutritionist,
-- which no fixture row matches.
select is(
  (select athlete_id from audit_log where action = 'user_roles.insert'
     and metadata ->> 'user_id' = tests.uid('orga','user_coach')::text
     and metadata ->> 'role' = 'nutritionist'),
  null::uuid,
  'user_roles: no athlete, correctly — a role grant is not about an athlete'
);

select is(
  (select count(*)::int from audit_log where action = 'user_roles.insert'
     and metadata ->> 'user_id' = tests.uid('orga','user_coach')::text
     and metadata ->> 'role' = 'nutritionist'),
  1,
  'but it names WHOSE roles changed and which role, which audit_log has no columns for'
);

select is(
  (select count(*)::int from audit_log where action = 'user_roles.insert'
     and metadata ? 'user_id' and metadata ? 'role') > 0,
  true,
  'identity and authorisation reach the metadata; content never does'
);

-- Ordinary shapes still behave.
select is(
  (select athlete_id from audit_log where action = 'body_composition.insert'
     and entity_id = tests.uid('orga','bc_widen')),
  tests.uid('orga','athlete_1'),
  'body_composition carries its athlete'
);

select is(
  (select athlete_id from audit_log where action = 'test_results.insert'
     and entity_id = tests.uid('orga','tr_widen')),
  tests.uid('orga','athlete_1'),
  'and so does test_results'
);

select is(
  (select athlete_id from audit_log where action = 'programme_assignments.insert'
     and entity_id = tests.uid('orga','pa_widen')),
  tests.uid('orga','athlete_1'),
  'and programme_assignments, where it is nullable because a group assignment has none'
);

select is(
  (select metadata -> 'changed' from audit_log where action = 'team_allocations.update'),
  '["status"]'::jsonb,
  'team_allocations records the field that changed, being an update rather than an insert'
);

select is(
  (select actor_role::text from audit_log where action = 'athletes.update'
     and entity_id = tests.uid('orga','athlete_1')
     and metadata -> 'changed' = '["squad_number"]'::jsonb),
  'sport_scientist',
  'every one is attributed to the role that actually wrote it'
);

-- --------------------------------------------------------------------------
-- The disclosure rule, across ALL audited tables rather than the clinical ones.
-- metadata may carry identity; it may not carry content. `changed` is a list of
-- field NAMES, and user_id/role are the only values allowed through.
-- TRIGGER-written rows only. Rows the application writes — settings/users/create
-- and the others — have their own metadata conventions and predate this rule;
-- scanning them made this assertion fail on a fixture row, which was the
-- assertion overreaching rather than a leak.
select is(
  (select count(*)::int from (
     select jsonb_object_keys(metadata) as k from audit_log
     where metadata <> '{}'::jsonb
       and action ~ '^[a-z_]+\.(insert|update|delete)$'
   ) keys where k not in ('changed', 'user_id', 'role')),
  0,
  'no trigger-written row carries a metadata key outside the allowlist — content never reaches this table'
);

select ok(
  not exists (
    select 1 from audit_log
    where entity_type = 'body_composition' and metadata::text like '%99.5%'
  ),
  'a body mass is not copied into the audit row, only the fact that one was written'
);

select * from finish();
rollback;
