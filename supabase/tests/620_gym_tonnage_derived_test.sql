-- 620_gym_tonnage_derived_test.sql
--
-- §0at, decided by Isabella 2026-09-12: gym tonnage is DERIVED from the live
-- sets, not stored. Before 0106 gym_session_logs.total_volume_kg was written
-- by exactly one path — 0045's correction RPC — so 41 of 45 complete sessions
-- on scratch carried a null and My data read "Not logged" for almost every
-- real session. 0106 redefines gym_session_logs_current so total_volume_kg is
-- the sum of the live sets' volume_kg: one source of truth, nothing to
-- backfill. The to-do entry's own guard: log one set into a fresh session and
-- the history row shows the tonnage.
--
--   1. a fresh session with one set of 5 × 100 reads 500 through the view,
--      while the base column is untouched (null)
--   2. a second set adds to it
--   3. a correction moves it — the superseded set does not double count
--   4. a session whose sets carry no load reads null (an absent number is
--      absent, never 0)
--   5. a session with no sets reads null
--   6. the base column is never what the view reports: a stale stored value
--      is ignored

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o   uuid := tests.uid('orga', 'org');
  a1  uuid := tests.uid('orga', 'athlete_1');
  ex  uuid := tests.uid('orga', 'exercise');
begin
  insert into exercises (id, org_id, name, category) values (ex, o, 'Back squat', 'squat');
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source)
    values (tests.uid('orga','t_log_1'), o, a1, current_date, 'in_progress', 'self_report'),
           (tests.uid('orga','t_log_2'), o, a1, current_date - 1, 'complete', 'self_report'),
           (tests.uid('orga','t_log_3'), o, a1, current_date - 2, 'complete', 'self_report');
  -- t_log_3 carries a STALE stored value and no sets: the view must not report it.
  update gym_session_logs set total_volume_kg = 9999 where id = tests.uid('orga','t_log_3');
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the assertions below');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- 1. One set into a fresh session.
insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
values (tests.uid('orga','t_set_1'), tests.uid('orga','org'), tests.uid('orga','t_log_1'), tests.uid('orga','exercise'), 1, 5, 100);
select is(
  (select total_volume_kg from gym_session_logs_current where id = tests.uid('orga','t_log_1')),
  500::numeric, '1. one set of 5 × 100: the session reads 500 kg through the view'
);
select is(
  (select total_volume_kg from gym_session_logs where id = tests.uid('orga','t_log_1')),
  null, 'while the base column is untouched — nothing is stored'
);

-- 2. A second set.
insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
values (tests.uid('orga','t_set_2'), tests.uid('orga','org'), tests.uid('orga','t_log_1'), tests.uid('orga','exercise'), 2, 5, 102.5);
select is(
  (select total_volume_kg from gym_session_logs_current where id = tests.uid('orga','t_log_1')),
  1012.5::numeric, '2. a second set of 5 × 102.5 makes 1012.5 kg'
);

-- 3. A correction moves it, and the superseded set does not double count.
select lives_ok(
  format($q$select revise_gym_set_log(%L, %L, '{"load_kg": 110}'::jsonb)$q$, tests.uid('orga','t_set_1'), tests.uid('orga','t_set_1_rev')),
  '3. the athlete corrects set 1 to 110 kg'
);
select is(
  (select total_volume_kg from gym_session_logs_current where id = tests.uid('orga','t_log_1')),
  1062.5::numeric, 'and the session reads 550 + 512.5 = 1062.5 kg — the old 500 is not counted'
);

-- 4. Sets with no load.
insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
values (tests.uid('orga','t_set_3'), tests.uid('orga','org'), tests.uid('orga','t_log_2'), tests.uid('orga','exercise'), 1, 10, null);
select is(
  (select total_volume_kg from gym_session_logs_current where id = tests.uid('orga','t_log_2')),
  null, '4. a session whose sets carry no load reads null, never 0'
);

-- 5 / 6. No sets, and a stale stored value.
select is(
  (select total_volume_kg from gym_session_logs_current where id = tests.uid('orga','t_log_3')),
  null, '5/6. a session with no live sets reads null — the stale stored 9999 is not what the view reports'
);

-- The view is still the live-rows-only view it was.
select is(
  (select count(*)::int from gym_session_logs_current where athlete_id = tests.uid('orga','athlete_1') and id in (tests.uid('orga','t_log_1'), tests.uid('orga','t_log_2'), tests.uid('orga','t_log_3'))),
  3, 'the view still lists every live session log'
);

select * from finish();
rollback;
