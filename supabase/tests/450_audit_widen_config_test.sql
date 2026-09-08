-- Widening the audit triggers, batch three: five configuration and authoring
-- tables, and the first audit row an ATHLETE has ever written.
--
-- WHY EVERY TABLE GETS A REAL WRITE rather than an attachment check. Asserting a
-- trigger exists proves it was created, not that it records anything useful.
-- 0085's lesson was injury_clinical, whose shape the function had not met: it
-- produced a row with nulls where the answer goes and nothing failed. So each of
-- the five is written to for real, through RLS, as a role that is genuinely
-- allowed to write it.
--
-- THE NEW CASE IS leaderboard_opt_outs, and it is why that table is in this
-- batch rather than a later one. Its `_self_insert` policy lets an ATHLETE write
-- their own opt out. Every audited row until now has been written by staff.
-- `audit_acting_role()` walks the five STAFF roles and returns NULL when none
-- matches, so an athlete's own opt out is recorded with a real actor_id and a
-- null actor_role. That is correct, and it is asserted below so that a later
-- reader does not "fix" the null by defaulting it to 'athlete'.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these writes go through policies rather than around them');

-- --------------------------------------------------------------------- writes
do $$
declare o   uuid := tests.uid('orga','org');
        adm uuid := tests.uid('orga','user_admin');   -- sport scientist
        a1  uuid := tests.uid('orga','athlete_1');
        sea uuid;
begin
  perform tests.set_jwt(adm);

  -- 1. thresholds: the rule that decides what raises a flag.
  insert into thresholds (id, org_id, name, domain, metric, comparison, value)
  values (tests.uid('orga','thr_cfg'), o, 'Audit widen threshold', 'wellness',
          'wellness.readiness_score', 'z_score', -1.5);

  -- 2. leaderboards: which board exists, over which metric.
  insert into leaderboards (id, org_id, name, metric_key, aggregation,
                            population_type, window_type, created_by)
  values (tests.uid('orga','lb_cfg'), o, 'Audit widen board',
          'training.total_session_load', 'total', 'squad', 'all_time', adm);

  -- 3. week_templates: the shape a week gets when a template is applied.
  insert into week_templates (id, org_id, name, structure)
  values (tests.uid('orga','wt_cfg'), o, 'Audit widen template', '{"days":[]}'::jsonb);

  -- 4. fixtures: reuse the season the seeded fixture belongs to, rather than
  --    inventing one, so the foreign key is real.
  select season_id into sea from fixtures where org_id = o limit 1;
  insert into fixtures (id, org_id, season_id, opponent, kickoff_at, home_away)
  values (tests.uid('orga','fx_cfg'), o, sea, 'Audit Widen RFC',
          now() + interval '7 days', 'home');
end $$;

-- 5. leaderboard_opt_outs, written BY THE ATHLETE as themselves. A separate
--    block because it needs a different JWT: the self-insert policy requires
--    athlete_id = auth_athlete_id().
do $$
declare o    uuid := tests.uid('orga','org');
        a1   uuid := tests.uid('orga','athlete_1');
        usr  uuid;
begin
  -- set_jwt takes a USER, and athlete_1 is an athlete id. The two are different
  -- things: an athlete row carries user_id, and only some athletes have one.
  -- Resolved by join rather than by guessing the fixture's own name for it, so
  -- this keeps working if the fixture set is renamed.
  select u.id into usr from users u join athletes a on a.user_id = u.id where a.id = a1;
  if usr is null then
    raise exception 'fixture athlete_1 has no linked user, so the athlete-written case cannot be tested';
  end if;

  perform tests.set_jwt(usr);
  insert into leaderboard_opt_outs (id, org_id, athlete_id, opted_out_by, opt_out_source)
  values (tests.uid('orga','opt_cfg'), o, a1, usr, 'athlete');
end $$;

-- Only the sport scientist may read audit_log.
select tests.set_jwt(tests.uid('orga','user_admin'));

-- ---------------------------------------------------------------------- reads
select is(
  (select count(distinct entity_type)::int from audit_log
    where action ~ '^(thresholds|leaderboards|leaderboard_opt_outs|week_templates|fixtures)\.'),
  5,
  'all five tables produced an audit row, every one written for real through RLS'
);

select is(
  (select entity_id from audit_log where action = 'thresholds.insert'
     and entity_id = tests.uid('orga','thr_cfg')),
  tests.uid('orga','thr_cfg'),
  'thresholds: the row is identified by its own id'
);

select is(
  (select athlete_id from audit_log where action = 'thresholds.insert'
     and entity_id = tests.uid('orga','thr_cfg')),
  null::uuid,
  'and carries no athlete, correctly: a threshold is a club rule, not a person'
);

select is(
  (select actor_role::text from audit_log where action = 'leaderboards.insert'
     and entity_id = tests.uid('orga','lb_cfg')),
  'sport_scientist',
  'leaderboards: attributed to the role that actually wrote it'
);

select is(
  (select org_id from audit_log where action = 'week_templates.insert'
     and entity_id = tests.uid('orga','wt_cfg')),
  tests.uid('orga','org'),
  'week_templates: the org is recorded, so the row is readable by that club and no other'
);

select is(
  (select entity_type from audit_log where action = 'fixtures.insert'
     and entity_id = tests.uid('orga','fx_cfg')),
  'fixtures',
  'fixtures: entity_type is the table name'
);

-- ------------------------------------------- the athlete written row, in full
select is(
  (select athlete_id from audit_log where action = 'leaderboard_opt_outs.insert'
     and entity_id = tests.uid('orga','opt_cfg')),
  tests.uid('orga','athlete_1'),
  'leaderboard_opt_outs: the athlete the opt out is about is recorded'
);

select is(
  (select actor_id from audit_log where action = 'leaderboard_opt_outs.insert'
     and entity_id = tests.uid('orga','opt_cfg')),
  (select u.id from users u join athletes a on a.user_id = u.id
    where a.id = tests.uid('orga','athlete_1')),
  'and the ACTOR is that athlete''s own user, because they opted themselves out'
);

/* THE ASSERTION THIS FILE EXISTS FOR. audit_acting_role() walks the five staff
   roles and returns null when none matches. An athlete holds none of them, so
   their own audit row carries a real actor and no role. Recording 'athlete'
   here would be worse than null: it would imply a staff role in a column whose
   entire purpose is saying which staff role somebody acted in. */
select is(
  (select actor_role from audit_log where action = 'leaderboard_opt_outs.insert'
     and entity_id = tests.uid('orga','opt_cfg')),
  null::public.app_role,
  'and a NULL role, because an athlete acted in no staff role. Not ''athlete''.'
);

-- ---------------------------------------------------------------------------
-- The disclosure rule, re-asserted across the tables this batch adds. metadata
-- may carry identity; it may not carry content.
select is(
  (select count(*)::int from (
     select jsonb_object_keys(metadata) as k from audit_log
     where metadata <> '{}'::jsonb
       and action ~ '^(thresholds|leaderboards|leaderboard_opt_outs|week_templates|fixtures)\.(insert|update|delete)$'
   ) keys where k not in ('changed', 'user_id', 'role')),
  0,
  'no row from this batch carries a metadata key outside the allowlist'
);

select ok(
  not exists (
    select 1 from audit_log
    where entity_type = 'week_templates' and metadata::text like '%days%'
  ),
  'a week template''s structure is not copied into the audit row, only that one was written'
);

select ok(
  not exists (
    select 1 from audit_log
    where entity_type = 'thresholds' and metadata::text like '%-1.5%'
  ),
  'and a threshold''s value is not copied either'
);

select * from finish();
rollback;
