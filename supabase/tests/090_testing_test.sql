-- 090_testing_test.sql
--
-- migration 0024's own header explains why this feature exists and what it
-- deliberately does not. This file tests: the shared coach/medical write
-- access (no type split, unlike programmes or rehab groups), the athlete
-- read-own boundary, and the mark_best_attempt trigger — including the
-- manual-override gap 0025 closed, tested here the same way it was found.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. test_definitions: shared read, coach and medical both write
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into test_definitions (org_id, name, test_category, unit, higher_is_better)
            values (%L, 'CMJ height', 'power', 'cm', true)$q$,
         tests.uid('orga','org')),
  '42501', null,
  'an athlete cannot create a test definition'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into test_definitions (id, org_id, name, test_category, unit, higher_is_better)
            values (%L, %L, 'CMJ height', 'power', 'cm', true)$q$,
         tests.uid('orga','test_cmj'), tests.uid('orga','org')),
  'a coach creates a test definition'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into test_definitions (id, org_id, name, test_category, unit, higher_is_better)
            values (%L, %L, '10m sprint', 'speed', 's', false)$q$,
         tests.uid('orga','test_sprint'), tests.uid('orga','org')),
  'medical creates one too — no coach-owns/medical-owns split on this table, unlike programmes'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from test_definitions where org_id = tests.uid('orga','org')),
  2::bigint,
  'an athlete reads the test library — a name and unit is not squad data'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into test_definitions (org_id, name, test_category, unit, higher_is_better, leaderboard_eligible)
            values (%L, 'Body fat %%', 'body_comp', '%%', false, true)$q$,
         tests.uid('orga','org')),
  '23514', null,
  'a body_comp definition cannot be leaderboard_eligible, even for a coach who is otherwise allowed to write here — the check constraint refuses it regardless'
);


-- ===========================================================================
-- 2. test_results: staff write for any athlete, athlete reads only their own
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into test_results (org_id, athlete_id, test_definition_id, test_date, value, recorded_by)
            values (%L, %L, %L, current_date, 40.0, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','test_cmj'),
         tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot log their own test result — this is staff-entered, not self-report'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into test_results
              (id, org_id, athlete_id, test_definition_id, test_date, value, attempt_number, recorded_by)
            values (%L, %L, %L, %L, current_date, 38.2, 1, %L)$q$,
         tests.uid('orga','res_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','test_cmj'), tests.uid('orga','user_coach')),
  'a coach logs attempt 1 for athlete_1'
);
select lives_ok(
  format($q$insert into test_results
              (id, org_id, athlete_id, test_definition_id, test_date, value, attempt_number, recorded_by)
            values (%L, %L, %L, %L, current_date, 41.5, 2, %L)$q$,
         tests.uid('orga','res_2'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','test_cmj'), tests.uid('orga','user_coach')),
  'and attempt 2, a higher jump'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select count(*) from test_results where org_id = tests.uid('orga','org')),
  0::bigint,
  'athlete_2 reads zero of athlete_1''s results'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from test_results where org_id = tests.uid('orga','org')),
  2::bigint,
  'athlete_1 reads both of their own attempts'
);


-- ===========================================================================
-- 3. mark_best_attempt: direction awareness, tie-break, and the manual-
--    override gap 0025 closed
-- ===========================================================================

select is(
  (select value from test_results where id = tests.uid('orga','res_2')),
  41.5,
  'sanity: attempt 2 really is the higher jump'
);
select is(
  (select is_best from test_results where id = tests.uid('orga','res_2')),
  true,
  'higher-is-better: the trigger marks the higher jump best'
);
select is(
  (select is_best from test_results where id = tests.uid('orga','res_1')),
  false,
  'and the lower one not best'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
-- Manually mark attempt 1 best (e.g. attempt 2 disallowed for a technique fault).
-- The trigger fires only "after insert or update of value, deleted_at" —
-- screens/testing.md's own scoping, kept as specified — so it does not fire
-- on this update at all, and clearing every sibling's is_best is this write's
-- own job, not the trigger's. lib/queries/testing.ts's markBestManual does
-- both statements together; this test does the same two statements directly
-- to prove the invariant the function relies on, before that function exists.
select lives_ok(
  format($q$update test_results set is_best = false
            where athlete_id = %L and test_definition_id = %L and test_date = current_date
              and id <> %L$q$,
         tests.uid('orga','athlete_1'), tests.uid('orga','test_cmj'), tests.uid('orga','res_1')),
  'clear is_best from every other attempt in the group first'
);
select lives_ok(
  format($q$update test_results set is_best = true, is_best_manual = true,
              conditions = 'Attempt 2 disallowed, double-footed take-off'
            where id = %L$q$, tests.uid('orga','res_1')),
  'then medical manually marks attempt 1 as best instead'
);
select is(
  (select is_best from test_results where id = tests.uid('orga','res_2')),
  false,
  'attempt 2 is no longer best once the manual pick is made'
);

-- The gap 0025 closed: a new, even higher attempt must not also claim best
-- alongside the manual pick.
select lives_ok(
  format($q$insert into test_results
              (org_id, athlete_id, test_definition_id, test_date, value, attempt_number, recorded_by)
            values (%L, %L, %L, current_date, 55.0, 3, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','test_cmj'),
         tests.uid('orga','user_medical')),
  'a third, much higher attempt is logged'
);
select is(
  (select count(*) from test_results
    where athlete_id = tests.uid('orga','athlete_1')
      and test_definition_id = tests.uid('orga','test_cmj')
      and test_date = current_date
      and is_best = true),
  1::bigint,
  'exactly one row is best — the higher new attempt did not also claim it alongside the manual pick'
);
select is(
  (select is_best_manual from test_results where id = tests.uid('orga','res_1')),
  true,
  'and it is still the manually-marked attempt 1, untouched'
);

-- Lower-is-better direction, sanity checked the other way round.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into test_results (org_id, athlete_id, test_definition_id, test_date, value, attempt_number, recorded_by)
            values (%L, %L, %L, current_date, 1.85, 1, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','test_sprint'),
         tests.uid('orga','user_coach')),
  'a 10m sprint time is logged for athlete_2'
);
select lives_ok(
  format($q$insert into test_results (org_id, athlete_id, test_definition_id, test_date, value, attempt_number, recorded_by)
            values (%L, %L, %L, current_date, 1.72, 2, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','test_sprint'),
         tests.uid('orga','user_coach')),
  'and a faster second attempt'
);
select is(
  (select value from test_results
    where athlete_id = tests.uid('orga','athlete_2')
      and test_definition_id = tests.uid('orga','test_sprint')
      and is_best = true),
  1.72,
  'lower-is-better: the FASTER (lower) time is marked best, not the higher number'
);

select * from finish();
rollback;
