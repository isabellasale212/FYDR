-- 220_exercise_overrides_and_one_rm_test.sql
--
-- Written before the migration that makes it pass (0043_exercise_overrides_and_one_rm.sql),
-- per CLAUDE.md §5: "Write the test for a permission rule before the rule."
--
-- migration 0021's own header names exercise_overrides and percent_1rm resolution as real,
-- deliberate cuts. Migration 0043 closes both. This file tests the parts generic coverage
-- does not:
--   - 010_rls_coverage_test.sql and 020_cross_tenant_test.sql already sweep every table
--     with an org_id column (tests.club_tables()), so exercise_overrides gets RLS-enabled,
--     has-a-policy, policy-mentions-auth_org_id, and cross-organisation isolation for free.
--     Not re-tested here.
--   - What IS specific to this table: the coach-owns-gym / medical-owns-rehab write split
--     (same shape as 070_programmes_test.sql's split on programme_exercises), the "an
--     athlete must never enumerate exercise_overrides" rule from 04-data-model.md's
--     divergence-leak paragraph (stricter than an ordinary self-row policy — there is no
--     athlete select policy on this table at all), the one-override-per-type-per-athlete
--     unique constraint, and the resolve_programme_exercises override + percent_1rm
--     resolution logic, which is where the real risk in this migration lives: get the
--     override precedence or the 1RM math wrong and a coach sees a confidently wrong number
--     on their screen, which is worse than the honest gap this migration is closing.
--   - resolve_my_programme_sessions' new programmes.status filter (a real bug this
--     migration also fixes: a still-drafting programme was visible to an assigned athlete
--     because the function never checked it).

begin;
select * from no_plan();

select tests.fixtures();

-- ---------------------------------------------------------------------------
-- Setup: a gym programme (coach-owned) and a rehab programme (medical-owned),
-- one exercise linked to a strength test, one not, a 1RM result for athlete_1
-- only, and both athletes assigned to both programmes so override precedence
-- can be exercised per athlete.
-- ---------------------------------------------------------------------------

do $$
declare
  o     uuid := tests.uid('orga', 'org');
  ucoa  uuid := tests.uid('orga', 'user_coach');
  umed  uuid := tests.uid('orga', 'user_medical');
  a1    uuid := tests.uid('orga', 'athlete_1');
  a2    uuid := tests.uid('orga', 'athlete_2');
begin
  insert into test_definitions (id, org_id, name, test_category, unit, higher_is_better)
    values (tests.uid('orga','test_1rm_squat'), o, 'Back squat 1RM', 'strength', 'kg', true);

  insert into exercises (id, org_id, name, category, one_rm_test_definition_id) values
    (tests.uid('orga','exercise_squat'), o, 'Back squat', 'squat', tests.uid('orga','test_1rm_squat')),
    (tests.uid('orga','exercise_unlinked'), o, 'Hang clean', 'olympic', null),
    (tests.uid('orga','exercise_sub'), o, 'Goblet squat', 'squat', null);

  -- Only athlete_1 has a 1RM on file. athlete_2 is the "not on file" case.
  insert into test_results (org_id, athlete_id, test_definition_id, test_date, value, source, recorded_by)
    values (o, a1, tests.uid('orga','test_1rm_squat'), current_date - 7, 140, 'staff_entered', umed);

  insert into programmes (id, org_id, name, programme_type, status, created_by) values
    (tests.uid('orga','prog_gym'), o, 'Pre-season strength', 'gym', 'active', ucoa),
    (tests.uid('orga','prog_rehab'), o, 'Return to running', 'rehab', 'active', umed),
    (tests.uid('orga','prog_draft'), o, 'Still drafting', 'gym', 'draft', ucoa);

  insert into programme_blocks (id, org_id, programme_id, name, sequence) values
    (tests.uid('orga','block_gym'), o, tests.uid('orga','prog_gym'), 'Accumulation', 1),
    (tests.uid('orga','block_rehab'), o, tests.uid('orga','prog_rehab'), 'Stage 1', 1),
    (tests.uid('orga','block_draft'), o, tests.uid('orga','prog_draft'), 'Block 1', 1);

  insert into programme_sessions (id, org_id, block_id, name, week_number, sequence) values
    (tests.uid('orga','session_gym'), o, tests.uid('orga','block_gym'), 'Lower A', 1, 1),
    (tests.uid('orga','session_rehab'), o, tests.uid('orga','block_rehab'), 'Stage 1', 1, 1),
    (tests.uid('orga','session_draft'), o, tests.uid('orga','block_draft'), 'Full body', 1, 1);

  insert into programme_exercises
      (id, org_id, programme_session_id, exercise_id, sequence, sets, reps_min, reps_max,
       load_basis, load_value)
    values
    (tests.uid('orga','pe_1rm'), o, tests.uid('orga','session_gym'), tests.uid('orga','exercise_squat'),
     1, 4, 3, 5, 'percent_1rm', 80),
    (tests.uid('orga','pe_unlinked'), o, tests.uid('orga','session_gym'), tests.uid('orga','exercise_unlinked'),
     2, 5, 3, 3, 'percent_1rm', 75),
    (tests.uid('orga','pe_abs'), o, tests.uid('orga','session_gym'), tests.uid('orga','exercise_squat'),
     3, 3, 8, 8, 'absolute', 100),
    (tests.uid('orga','pe_rehab'), o, tests.uid('orga','session_rehab'), tests.uid('orga','exercise_squat'),
     1, 3, 10, 10, 'absolute', 20),
    (tests.uid('orga','pe_draft'), o, tests.uid('orga','session_draft'), tests.uid('orga','exercise_squat'),
     1, 3, 10, 10, 'absolute', 40);

  insert into programme_assignments (org_id, programme_id, athlete_id, assigned_by) values
    (o, tests.uid('orga','prog_gym'), a1, ucoa),
    (o, tests.uid('orga','prog_gym'), a2, ucoa),
    (o, tests.uid('orga','prog_rehab'), a1, umed),
    (o, tests.uid('orga','prog_draft'), a1, ucoa);
end $$;

set local role authenticated;


-- ===========================================================================
-- 1. exercise_overrides: write split identical in shape to programme_exercises
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into exercise_overrides
              (org_id, programme_exercise_id, athlete_id, override_type, reason)
            values (%L, %L, %L, 'exempt', 'self-service attempt')$q$,
         tests.uid('orga','org'), tests.uid('orga','pe_abs'), tests.uid('orga','athlete_1')),
  '42501', null,
  'an athlete cannot create their own override'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into exercise_overrides
              (org_id, programme_exercise_id, athlete_id, override_type, load_value, reason, created_by)
            values (%L, %L, %L, 'load_cap', 70, 'post-op knee', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','pe_1rm'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_medical')),
  '42501', null,
  'medical cannot override an exercise on a coach-owned gym programme, even though medical can read it'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into exercise_overrides
              (id, org_id, programme_exercise_id, athlete_id, override_type, load_value, reason, created_by)
            values (%L, %L, %L, %L, 'load_cap', 70, 'post-op knee', %L)$q$,
         tests.uid('orga','ov_cap'), tests.uid('orga','org'), tests.uid('orga','pe_1rm'),
         tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  'a coach caps athlete_1''s load on the gym programme'
);
select throws_ok(
  format($q$insert into exercise_overrides
              (org_id, programme_exercise_id, athlete_id, override_type, load_value, reason, created_by)
            values (%L, %L, %L, 'load_cap', 60, 'second cap attempt', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','pe_1rm'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_coach')),
  '23505', null,
  'a second load_cap on the same athlete and element violates the one-per-type unique key'
);
-- Coach is NOT restricted to gym the way medical is restricted to rehab —
-- 070_programmes_test.sql's own comment is explicit: "Coach: full write on
-- any programme type." The interesting, asymmetric case is medical refused
-- on a gym programme (tested above), not this direction.
select lives_ok(
  format($q$insert into exercise_overrides
              (org_id, programme_exercise_id, athlete_id, override_type, reason, created_by)
            values (%L, %L, %L, 'note', 'coach note on a rehab exercise', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','pe_rehab'), tests.uid('orga','athlete_2'),
         tests.uid('orga','user_coach')),
  'a coach CAN override an exercise on a rehab programme too — write is coach-unrestricted, medical-restricted'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into exercise_overrides
              (org_id, programme_exercise_id, athlete_id, override_type, reason, created_by)
            values (%L, %L, %L, 'exempt', 'lumbar restriction', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','pe_rehab'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_medical')),
  'medical exempts athlete_1 from their own rehab programme''s exercise'
);


-- ===========================================================================
-- 2. "An athlete must never be able to enumerate exercise_overrides"
--    (04-data-model.md's divergence-leak paragraph) — no athlete select
--    policy at all, not even a self-row one.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from exercise_overrides where org_id = tests.uid('orga','org')),
  0::bigint,
  'athlete_1 reads zero override rows directly, even the load_cap that names them'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from exercise_overrides where org_id = tests.uid('orga','org')),
  3::bigint,
  'a coach reads every override in the org for context, gym and rehab alike'
);


-- ===========================================================================
-- 3. resolve_programme_exercises: squad-generic call is unchanged (no
--    p_athlete_id) — the existing staff list view must not regress.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select load_value from resolve_programme_exercises(tests.uid('orga','session_gym'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  80::numeric,
  'squad-generic resolve returns the raw parent load_value, uncapped'
);
select is(
  (select is_overridden from resolve_programme_exercises(tests.uid('orga','session_gym'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  false,
  'squad-generic resolve reports no override — it is not asking for any athlete'
);
select is(
  (select resolved_load_kg from resolve_programme_exercises(tests.uid('orga','session_gym'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  null::numeric,
  'squad-generic resolve never computes a kg figure — that requires an athlete'
);


-- ===========================================================================
-- 4. resolve_programme_exercises with p_athlete_id: overrides apply
-- ===========================================================================

-- athlete_1: load_cap on pe_1rm (70, parent 80 -> capped to 70), no override on pe_abs.
select is(
  (select resolved_load_kg from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_1'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  round(70 * 140 / 100.0, 1),
  'athlete_1''s load_cap (70) binds under the parent (80): resolved kg is 70% of their real 1RM, not 80%'
);
select is(
  (select is_overridden from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_1'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  true,
  'athlete_1''s pe_1rm row is reported overridden'
);
select is(
  (select one_rm_missing from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_1'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  false,
  'athlete_1 has a 1RM on file, so nothing is reported missing once resolved'
);
select is(
  (select load_value from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_1'))
    where programme_exercise_id = tests.uid('orga','pe_abs')),
  100::numeric,
  'athlete_1''s uncapped exercise resolves to the plain parent value'
);

-- athlete_2: no overrides at all. percent_1rm on pe_1rm has no result for them.
select is(
  (select resolved_load_kg from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_2'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  null::numeric,
  'athlete_2 has no 1RM on file: resolved_load_kg is null, never a guessed number'
);
select is(
  (select one_rm_missing from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_2'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  true,
  'athlete_2''s missing 1RM is reported explicitly — "1RM not on file", not silence'
);
select is(
  (select one_rm_linked from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_2'))
    where programme_exercise_id = tests.uid('orga','pe_unlinked')),
  false,
  'Hang clean has no linked 1RM test at all — a distinct case from "linked but no result"'
);
select is(
  (select one_rm_missing from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_2'))
    where programme_exercise_id = tests.uid('orga','pe_unlinked')),
  true,
  'an unlinked exercise prescribed at percent_1rm still reports missing — it can never resolve for anyone'
);

-- Exempt: athlete_1 is exempt from pe_rehab. The row must not appear at all.
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from resolve_programme_exercises(tests.uid('orga','session_rehab'), tests.uid('orga','athlete_1'))
    where programme_exercise_id = tests.uid('orga','pe_rehab')),
  0::bigint,
  'an exempt exercise is filtered out of that athlete''s resolved session entirely, not shown crossed out'
);


-- ===========================================================================
-- 5. An athlete resolving for themselves ignores whatever p_athlete_id they
--    pass — same stance resolve_my_programme_sessions already takes.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select resolved_load_kg from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_1'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  null::numeric,
  'athlete_2 asking to resolve as athlete_1 still only ever resolves themselves — no cap, no 1RM'
);
select is(
  (select is_overridden from resolve_programme_exercises(tests.uid('orga','session_gym'), tests.uid('orga','athlete_1'))
    where programme_exercise_id = tests.uid('orga','pe_1rm')),
  false,
  'and sees no override, because athlete_1''s cap was never applied to them'
);


-- ===========================================================================
-- 6. resolve_my_programme_sessions: a draft programme is invisible to an
--    assigned athlete (the real bug this migration fixes), an active one is not.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from resolve_my_programme_sessions(tests.uid('orga','athlete_1'))
    where programme_id = tests.uid('orga','prog_draft')),
  0::bigint,
  'athlete_1 is assigned to the draft programme but does not see it — it has never been published'
);
select is(
  (select count(*) from resolve_my_programme_sessions(tests.uid('orga','athlete_1'))
    where programme_id = tests.uid('orga','prog_gym')),
  1::bigint,
  'the active gym programme still resolves normally'
);


-- ===========================================================================
-- 7. Publishing: a coach moves a programme from draft to active; medical
--    cannot publish a coach-owned gym programme.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$update programmes set status = 'active' where id = %L$q$, tests.uid('orga','prog_draft')),
  '42501', null,
  'medical cannot publish a coach-owned gym programme'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update programmes set status = 'active' where id = %L$q$, tests.uid('orga','prog_draft')),
  'the coach who owns it publishes the draft programme'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from resolve_my_programme_sessions(tests.uid('orga','athlete_1'))
    where programme_id = tests.uid('orga','prog_draft')),
  1::bigint,
  'once published, the same athlete now sees it — nothing else about the assignment changed'
);

select * from finish();
rollback;
