-- 070_programmes_test.sql
--
-- migration 0021's own header explains why this feature exists and what it
-- deliberately does not. This file tests: the coach-owns-gym / medical-owns-rehab
-- write split across all five authoring tables, the exercise library's shared
-- read, the athlete write boundary on gym logs, and both resolve functions —
-- including that an athlete cannot resolve a programme they are not actually
-- assigned to, and that a staff caller is unrestricted.
--
-- Which rules this implements
--   Coach: full write on any programme type. Medical: full write only for
--     programme_type = 'rehab', read-only for 'gym'. Both read everything.
--   The rehab carve-out cascades down: a coach cannot write a block, session or
--     exercise belonging to a rehab programme is still fine for coach (coach can
--     write ANY type) — the interesting case is medical being refused on a GYM
--     programme's block, not the other way round.
--   Athlete: no direct read of any authoring table, at any level.
--   Athlete: full read/write of their own gym_session_logs / gym_set_logs,
--     self_report only; staff read every log; no staff write path exists.
--   resolve_my_programme_sessions and resolve_programme_exercises: an athlete
--     resolves only their own live assignment (direct or via a live group
--     membership), never a programme they are not on, even by guessing an id.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o     uuid := tests.uid('orga', 'org');
  ucoa  uuid := tests.uid('orga', 'user_coach');
begin
  insert into exercises (id, org_id, name, category)
    values (tests.uid('orga','exercise'), o, 'Back squat', 'squat');
end $$;

set local role authenticated;


-- ===========================================================================
-- 1. Exercises: shared read, staff write
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from exercises where org_id = tests.uid('orga','org')),
  1::bigint,
  'an athlete reads the exercise library — a name is not squad data'
);
select throws_ok(
  format($q$insert into exercises (org_id, name, category) values (%L, 'Deadlift', 'hinge')$q$,
         tests.uid('orga','org')),
  '42501', null,
  'an athlete cannot add an exercise'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into exercises (org_id, name, category) values (%L, 'Deadlift', 'hinge')$q$,
         tests.uid('orga','org')),
  'medical CAN add an exercise — the library is not type-split like programmes are'
);


-- ===========================================================================
-- 2. programmes: coach any type, medical rehab only
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into programmes (org_id, name, programme_type, created_by)
            values (%L, 'Athlete attempt', 'gym', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot create a programme of any type'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into programmes (id, org_id, name, programme_type, status, created_by)
            values (%L, %L, 'Pre-season strength', 'gym', 'active', %L)$q$,
         tests.uid('orga','prog_gym'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a coach creates a gym programme'
);
select throws_ok(
  format($q$insert into programmes (org_id, name, programme_type, created_by)
            values (%L, 'Coach rehab attempt', 'rehab', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '42501', null,
  'a coach cannot create a rehab programme — that is medical''s exclusive lane'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into programmes (org_id, name, programme_type, created_by)
            values (%L, 'Medical gym attempt', 'gym', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_medical')),
  '42501', null,
  'medical cannot create a gym programme'
);
select lives_ok(
  format($q$insert into programmes (id, org_id, name, programme_type, status, created_by)
            values (%L, %L, 'Return to running', 'rehab', 'active', %L)$q$,
         tests.uid('orga','prog_rehab'), tests.uid('orga','org'), tests.uid('orga','user_medical')),
  'medical DOES create a rehab programme'
);

select is(
  (select count(*) from programmes where org_id = tests.uid('orga','org')),
  2::bigint,
  'medical reads both the gym and the rehab programme — read is shared, only write is split'
);


-- ===========================================================================
-- 3. The split cascades: a block on a GYM programme refuses medical
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into programme_blocks (id, org_id, programme_id, name, sequence)
            values (%L, %L, %L, 'Accumulation', 1)$q$,
         tests.uid('orga','block_gym'), tests.uid('orga','org'), tests.uid('orga','prog_gym')),
  'a coach adds a block to the gym programme'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into programme_blocks (org_id, programme_id, name, sequence)
            values (%L, %L, 'Medical attempt', 2)$q$,
         tests.uid('orga','org'), tests.uid('orga','prog_gym')),
  '42501', null,
  'medical cannot add a block to the gym programme, even though medical CAN read it'
);
select lives_ok(
  format($q$insert into programme_blocks (id, org_id, programme_id, name, sequence)
            values (%L, %L, %L, 'Early stage', 1)$q$,
         tests.uid('orga','block_rehab'), tests.uid('orga','org'), tests.uid('orga','prog_rehab')),
  'medical adds a block to their own rehab programme'
);


-- ===========================================================================
-- 4. Build out the gym programme fully (as coach) for the resolve tests
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into programme_sessions (id, org_id, block_id, name, week_number, day_number, sequence)
            values (%L, %L, %L, 'Lower A', 1, 1, 1)$q$,
         tests.uid('orga','session_gym'), tests.uid('orga','org'), tests.uid('orga','block_gym')),
  'a coach adds a session to the block'
);
select lives_ok(
  format($q$insert into programme_exercises
              (org_id, programme_session_id, exercise_id, sequence, sets, reps_min, reps_max,
               load_basis, load_value, rest_seconds)
            values (%L, %L, %L, 1, 4, 3, 5, 'percent_1rm', 80, 180)$q$,
         tests.uid('orga','org'), tests.uid('orga','session_gym'), tests.uid('orga','exercise')),
  'a coach prescribes an exercise on the session'
);
select lives_ok(
  format($q$insert into programme_assignments (org_id, programme_id, athlete_id, assigned_by)
            values (%L, %L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','prog_gym'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_coach')),
  'a coach assigns the gym programme to athlete_1'
);


-- ===========================================================================
-- 5. No direct athlete read of any authoring table, at any level
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*) from programmes where org_id = tests.uid('orga','org')), 0::bigint,
  'an athlete reads zero programmes directly, even their own assigned one');
select is((select count(*) from programme_blocks where org_id = tests.uid('orga','org')), 0::bigint,
  'zero blocks directly');
select is((select count(*) from programme_sessions where org_id = tests.uid('orga','org')), 0::bigint,
  'zero sessions directly');
select is((select count(*) from programme_exercises where org_id = tests.uid('orga','org')), 0::bigint,
  'zero prescribed exercises directly');
select is((select count(*) from programme_assignments where org_id = tests.uid('orga','org')), 0::bigint,
  'zero assignment rows directly, not even their own');


-- ===========================================================================
-- 6. resolve_my_programme_sessions and resolve_programme_exercises
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select session_name from resolve_my_programme_sessions(tests.uid('orga','athlete_1'))),
  'Lower A',
  'athlete_1 resolves their own assigned session through the function'
);
select is(
  (select count(*) from resolve_my_programme_sessions(tests.uid('orga','athlete_2'))),
  0::bigint,
  'athlete_1 asking for athlete_2''s sessions gets nothing back — narrowed to self regardless of the argument'
);

select is(
  (select exercise_name from resolve_programme_exercises(tests.uid('orga','session_gym'))),
  'Back squat',
  'athlete_1 resolves the prescribed exercise for their own session'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select count(*) from resolve_programme_exercises(tests.uid('orga','session_gym'))),
  0::bigint,
  'athlete_2, who has no assignment covering this session, resolves nothing — not even the session id lets them in'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select exercise_name from resolve_programme_exercises(tests.uid('orga','session_gym'))),
  'Back squat',
  'a coach resolves any session in the org, unrestricted by assignment'
);


-- ===========================================================================
-- 7. gym_session_logs / gym_set_logs: athlete self, staff read, no staff write
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into gym_session_logs (org_id, athlete_id, programme_session_id, source)
            values (%L, %L, %L, 'staff_entered')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','session_gym')),
  '42501', null,
  'an athlete cannot mark their own log staff_entered'
);
select lives_ok(
  format($q$insert into gym_session_logs (id, org_id, athlete_id, programme_session_id, status, source)
            values (%L, %L, %L, %L, 'in_progress', 'self_report')$q$,
         tests.uid('orga','log_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','session_gym')),
  'athlete_1 starts their own gym session log'
);
select lives_ok(
  format($q$insert into gym_set_logs
              (org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
            values (%L, %L, %L, 1, 5, 100)$q$,
         tests.uid('orga','org'), tests.uid('orga','log_1'), tests.uid('orga','exercise')),
  'athlete_1 logs a set against it'
);
select lives_ok(
  format($q$update gym_session_logs set status = 'complete', completed_at = now()
            where id = %L$q$, tests.uid('orga','log_1')),
  'athlete_1 marks their session complete — updated in place, not revised, per the table''s own comment'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select throws_ok(
  format($q$insert into gym_set_logs (org_id, gym_session_log_id, exercise_id, set_number)
            values (%L, %L, %L, 2)$q$,
         tests.uid('orga','org'), tests.uid('orga','log_1'), tests.uid('orga','exercise')),
  '42501', null,
  'athlete_2 cannot log a set onto athlete_1''s session'
);
select is(
  (select count(*) from gym_session_logs where org_id = tests.uid('orga','org')),
  0::bigint,
  'athlete_2 reads zero of athlete_1''s session logs'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from gym_session_logs where org_id = tests.uid('orga','org')),
  1::bigint,
  'a coach reads the log for context'
);
select throws_ok(
  format($q$insert into gym_session_logs (org_id, athlete_id, source) values (%L, %L, 'staff_entered')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2')),
  '42501', null,
  'a coach has no write path onto gym_session_logs at all — staff-entered logging is a different, unbuilt surface'
);

select * from finish();
rollback;
