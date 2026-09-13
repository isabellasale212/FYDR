-- A logged set keeps the prescription it was logged against. PATTERN-S5 C1,
-- 2026-09-13 (the board's Q1: "is the prescription stored against the logged
-- set, or read from the programme?" — it was read live, so editing a block
-- rewrote what every past set was compared to).
--
-- WHAT 0111 ADDS: three nullable columns on gym_set_logs — prescribed_reps,
-- prescribed_load_kg, prescribed_step_kg — written by the logger at logging
-- with the prescription as resolved for that athlete at that moment. Null on
-- rows logged before 0111 and on a set that had no prescription (no
-- programme, or a basis with no kilogram to state). The _current view exposes
-- them; a correction (revise_gym_set_log) carries the original's snapshot and
-- ignores any prescribed_* in its payload — a correction fixes what was
-- lifted, never what was asked.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o  uuid := tests.uid('orga', 'org');
  a1 uuid := tests.uid('orga', 'athlete_1');
  ex uuid := tests.uid('orga', 'ex_snap');
  pr uuid := tests.uid('orga', 'prog_snap');
  bl uuid := tests.uid('orga', 'block_snap');
  ps uuid := tests.uid('orga', 'psess_snap');
  pe uuid := tests.uid('orga', 'pex_snap');
begin
  insert into exercises (id, org_id, name, category) values (ex, o, 'Back squat', 'squat');
  insert into programmes (id, org_id, name, programme_type, status) values (pr, o, 'Snapshot programme', 'gym', 'active');
  insert into programme_blocks (id, org_id, programme_id, name, sequence, duration_weeks) values (bl, o, pr, 'Block 1', 1, 4);
  insert into programme_sessions (id, org_id, block_id, name, week_number, sequence) values (ps, o, bl, 'Lower A', 1, 1);
  insert into programme_exercises (id, org_id, programme_session_id, exercise_id, sequence, sets, reps_min, reps_max, load_basis, load_value)
    values (pe, o, ps, ex, 1, 3, 8, 8, 'absolute', 100);

  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source, started_at, programme_session_id)
    values (tests.uid('orga','snap_log'), o, a1, current_date, 'in_progress', 'self_report', now() - interval '10 minutes', ps);
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- 1. the athlete logs a set with the prescription as resolved at that moment
select lives_ok(
  format($q$insert into gym_set_logs (id, org_id, gym_session_log_id, programme_exercise_id, exercise_id, set_number, reps_completed, load_kg,
                                      prescribed_reps, prescribed_load_kg, prescribed_step_kg)
            values (%L, %L, %L, %L, %L, 1, 8, 102.5, 8, 100, 2.5)$q$,
         tests.uid('orga','snap_set_1'), tests.uid('orga','org'), tests.uid('orga','snap_log'), tests.uid('orga','pex_snap'), tests.uid('orga','ex_snap')),
  'a set is logged with its prescription snapshot'
);
select is(
  (select prescribed_load_kg from gym_set_logs_current where id = tests.uid('orga','snap_set_1')),
  100::numeric, 'the _current view exposes the snapshot'
);

-- 2. a set logged without a prescription carries none — null, not zero
select lives_ok(
  format($q$insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
            values (%L, %L, %L, %L, 2, 8, 100)$q$,
         tests.uid('orga','snap_set_2'), tests.uid('orga','org'), tests.uid('orga','snap_log'), tests.uid('orga','ex_snap')),
  'a set with no prescription is accepted without one'
);
select is(
  (select prescribed_load_kg is null and prescribed_reps is null and prescribed_step_kg is null from gym_set_logs_current where id = tests.uid('orga','snap_set_2')),
  true, 'and its snapshot is null, never 0'
);

-- 3. a negative prescription is refused, like a negative load (0095)
select throws_ok(
  format($q$insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg, prescribed_load_kg)
            values (%L, %L, %L, %L, 3, 8, 100, -5)$q$,
         tests.uid('orga','snap_set_3'), tests.uid('orga','org'), tests.uid('orga','snap_log'), tests.uid('orga','ex_snap')),
  '23514', null,
  'a negative prescribed load is refused at the database'
);

-- 4. the coach edits the block: the programme changes, the logged set does not
reset role;
update programme_exercises set load_value = 110, reps_min = 6, reps_max = 6 where id = tests.uid('orga','pex_snap');
select is(
  (select load_value from programme_exercises where id = tests.uid('orga','pex_snap')),
  110::numeric, 'the programme now prescribes 110'
);
select is(
  (select prescribed_load_kg from gym_set_logs_current where id = tests.uid('orga','snap_set_1')),
  100::numeric, 'the set logged against 100 still says 100 — editing a block never rewrites what a past set is compared to'
);
select is(
  (select prescribed_reps from gym_set_logs_current where id = tests.uid('orga','snap_set_1')),
  8, 'nor its reps'
);

-- 5. a correction carries the snapshot and cannot change it
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$select revise_gym_set_log(%L, %L, '{"reps_completed": 7, "load_kg": 102.5, "prescribed_load_kg": 999}'::jsonb)$q$,
         tests.uid('orga','snap_set_1'), tests.uid('orga','snap_set_1r')),
  'the set is corrected'
);
select is(
  (select reps_completed from gym_set_logs_current where id = tests.uid('orga','snap_set_1r')),
  7, 'the corrected reps are live'
);
select is(
  (select prescribed_load_kg from gym_set_logs_current where id = tests.uid('orga','snap_set_1r')),
  100::numeric, 'the correction carries the prescription the set was logged against — a payload prescribed_* is ignored'
);
select is(
  (select prescribed_step_kg from gym_set_logs_current where id = tests.uid('orga','snap_set_1r')),
  2.5::numeric, 'step included'
);

-- 6. the athlete cannot rewrite a logged set's snapshot in place (immutable once submitted — rule 6)
select throws_ok(
  format($q$update gym_set_logs set prescribed_load_kg = 50 where id = %L$q$, tests.uid('orga','snap_set_1r')),
  '42501', 'permission denied for table gym_set_logs',
  'the athlete has no UPDATE on gym_set_logs at all: the snapshot cannot be rewritten in place, only carried by a correction'
);

select * from finish();
rollback;
