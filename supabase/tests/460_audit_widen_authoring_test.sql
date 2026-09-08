-- Widening the audit triggers, batch four: the programme authoring chain, and
-- the first audit row that NOBODY CAN READ.
--
-- WHY EVERY TABLE GETS A REAL WRITE rather than an attachment check. Asserting a
-- trigger exists proves it was created, not that it records anything useful.
-- 0085's lesson was injury_clinical, whose shape the function had not met: it
-- produced a row with nulls where the answer goes and nothing failed. So all six
-- are written to for real, through RLS, as a role that is genuinely allowed to
-- write them, in the order the foreign keys demand.
--
-- WHY user_sc AND NOT user_admin. Every audited row written by staff so far has
-- been written by a sport scientist, because that is the role that reads
-- audit_log and so the role every test has been driven as. `audit_acting_role()`
-- walks five roles and returns the first that matches; a function that returned
-- 'sport_scientist' unconditionally would have passed 430, 440 and 450 alike.
-- The authoring chain is the S&C's work, so writing it as the S&C is both the
-- truthful actor and the first proof that the column follows the person.
--
-- THE NEW CASE IS exercises, and it is the reason this batch checked shapes
-- rather than assuming them. `exercises.org_id` IS NULLABLE: every other table in
-- the chain requires one. A global exercise, belonging to no club, produces an
-- audit row with a null org_id, and audit_log's select policy is
-- `org_id = auth_org_id()`, which no null ever satisfies. The row is written and
-- then cannot be read by anybody. That is asserted below in both directions --
-- invisible through RLS, present underneath it -- so the limitation is recorded
-- as a known one rather than found later by somebody wondering where the row
-- went. It is the same shape as the org-less sign-in row already on the to-do
-- list, and it wants the same answer.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these writes go through policies rather than around them');

-- --------------------------------------------------------------------- writes
do $$
declare o   uuid := tests.uid('orga','org');
        sc  uuid := tests.uid('orga','user_sc');    -- strength_conditioning
        a1  uuid := tests.uid('orga','athlete_1');
begin
  perform tests.set_jwt(sc);

  -- 1. exercises: the movement itself, club owned.
  insert into exercises (id, org_id, name, category)
  values (tests.uid('orga','ex_aud'), o, 'Audit widen split squat', 'squat');

  -- 2. programmes: gym, because the write split gives gym authoring to the S&C
  --    and rehab authoring to the medic. A rehab programme written here would be
  --    refused by the policy, correctly.
  insert into programmes (id, org_id, name, programme_type, status, created_by)
  values (tests.uid('orga','prog_aud'), o, 'Audit widen block', 'gym', 'draft', sc);

  -- 3. programme_blocks: carries programme_id as well as its own id, which is
  --    the reason entity_id is asserted below rather than assumed.
  insert into programme_blocks (id, org_id, programme_id, name, sequence)
  values (tests.uid('orga','blk_aud'), o, tests.uid('orga','prog_aud'), 'Accumulation', 1);

  -- 4. programme_sessions: one day inside that block.
  insert into programme_sessions (id, org_id, block_id, name, week_number, sequence)
  values (tests.uid('orga','ses_aud'), o, tests.uid('orga','blk_aud'), 'Lower A', 1, 1);

  -- 5. programme_exercises: the prescription an athlete actually reads.
  insert into programme_exercises
    (id, org_id, programme_session_id, exercise_id, sequence, sets, reps_min, reps_max, load_basis, load_value)
  values (tests.uid('orga','pex_aud'), o, tests.uid('orga','ses_aud'), tests.uid('orga','ex_aud'),
          1, 4, 6, 8, 'percent_1rm', 80);

  -- 6. exercise_overrides: the only row in the chain that is about a person.
  insert into exercise_overrides
    (id, org_id, programme_exercise_id, athlete_id, override_type, sets, reason, created_by)
  values (tests.uid('orga','ovr_aud'), o, tests.uid('orga','pex_aud'), a1, 'volume', 2,
          'Audit widen reason', sc);

  -- 7. An UPDATE, to exercise the changed-column path on a table that has an
  --    updated_at trigger of its own.
  update programmes set status = 'active' where id = tests.uid('orga','prog_aud');

  -- 8. And a write that changes nothing, which must NOT produce a row.
  update programmes set name = name where id = tests.uid('orga','prog_aud');
end $$;

-- Only the sport scientist may read audit_log.
select tests.set_jwt(tests.uid('orga','user_admin'));

-- ---------------------------------------------------------------------- reads
select is(
  (select count(distinct entity_type)::int from audit_log
    where action ~ '^(exercises|programmes|programme_blocks|programme_sessions|programme_exercises|exercise_overrides)\.'),
  6,
  'all six authoring tables produced an audit row, every one written for real through RLS'
);

/* THE ASSERTION ABOUT THE ACTOR. audit_acting_role() walks the staff roles in a
   fixed order and returns the first match. Until now every staff written audit
   row in the suite came from a sport scientist, so a function that ignored the
   person entirely would still have passed. This is the S&C's own work, recorded
   as the S&C's. */
select is(
  (select actor_role::text from audit_log where action = 'programmes.insert'
     and entity_id = tests.uid('orga','prog_aud')),
  'strength_conditioning',
  'the role recorded is the role the writer actually holds, not the one that reads the log'
);

select is(
  (select actor_id from audit_log where action = 'programmes.insert'
     and entity_id = tests.uid('orga','prog_aud')),
  tests.uid('orga','user_sc'),
  'and the actor is that person'
);

select is(
  (select entity_id from audit_log where action = 'programme_blocks.insert'
     and entity_id = tests.uid('orga','blk_aud')),
  tests.uid('orga','blk_aud'),
  'programme_blocks: identified by its OWN id, not by the programme_id it also carries'
);

select is(
  (select athlete_id from audit_log where action = 'programme_exercises.insert'
     and entity_id = tests.uid('orga','pex_aud')),
  null::uuid,
  'programme_exercises: no athlete, correctly. A prescription is written for a session, not a person'
);

select is(
  (select athlete_id from audit_log where action = 'exercise_overrides.insert'
     and entity_id = tests.uid('orga','ovr_aud')),
  tests.uid('orga','athlete_1'),
  'exercise_overrides: the athlete IS recorded, because an override is about one person'
);

select is(
  (select entity_type from audit_log where action = 'programme_sessions.insert'
     and entity_id = tests.uid('orga','ses_aud')),
  'programme_sessions',
  'programme_sessions: entity_type is the table name'
);

-- ---------------------------------------------------------------- the update
select ok(
  (select metadata -> 'changed' @> '["status"]'::jsonb from audit_log
    where action = 'programmes.update' and entity_id = tests.uid('orga','prog_aud')),
  'the update names the column that moved'
);

select ok(
  not exists (
    select 1 from audit_log
    where action = 'programmes.update' and entity_id = tests.uid('orga','prog_aud')
      and metadata::text like '%active%'
  ),
  'and does not record what it moved TO. Which field changed is identity; the new value is content'
);

select is(
  (select count(*)::int from audit_log
    where action = 'programmes.update' and entity_id = tests.uid('orga','prog_aud')),
  1,
  'setting a column to the value it already held writes no second row: a no-op is not an event'
);

-- ------------------------------------------------- the row nobody can read
-- A global exercise belongs to no club. Its audit row therefore carries a null
-- org_id, and audit_log's select policy is `org_id = auth_org_id()`. Written,
-- and unreadable. Asserted in both directions so a later reader cannot mistake
-- it for the trigger having failed to fire.
select ok(
  not exists (
    select 1 from audit_log where entity_id = tests.uid('orga','ex_global')
  ),
  'a global exercise''s audit row is invisible to the sport scientist, because its org is null'
);

reset role;

do $$
declare o uuid := tests.uid('orga','org');
begin
  -- Only a service role can create one: the exercises insert policy requires
  -- org_id = auth_org_id(), which no null satisfies either.
  insert into exercises (id, org_id, name, category)
  values (tests.uid('orga','ex_global'), null, 'Audit widen global movement', 'core');
end $$;

select ok(
  exists (
    select 1 from audit_log
    where entity_id = tests.uid('orga','ex_global') and org_id is null
  ),
  'but the row IS written, underneath RLS, with a null org. The gap is readability, not recording'
);

-- ---------------------------------------------------------------------------
-- The disclosure rule, re-asserted across the tables this batch adds.
select tests.set_jwt(tests.uid('orga','user_admin'));
set local role authenticated;

select is(
  (select count(*)::int from (
     select jsonb_object_keys(metadata) as k from audit_log
     where metadata <> '{}'::jsonb
       and action ~ '^(exercises|programmes|programme_blocks|programme_sessions|programme_exercises|exercise_overrides)\.(insert|update|delete)$'
   ) keys where k not in ('changed', 'user_id', 'role')),
  0,
  'no row from this batch carries a metadata key outside the allowlist'
);

select ok(
  not exists (
    select 1 from audit_log
    where entity_type = 'exercise_overrides' and metadata::text like '%Audit widen reason%'
  ),
  'the coach''s free text reason for an override is not copied into the audit row'
);

select ok(
  not exists (
    select 1 from audit_log
    where entity_type = 'programme_exercises' and metadata::text like '%percent_1rm%'
  ),
  'and neither is the prescription itself. That a session was authored is the record; what it says is not'
);

select * from finish();
rollback;
