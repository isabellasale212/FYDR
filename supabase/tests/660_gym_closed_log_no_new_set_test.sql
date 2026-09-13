-- A COMPLETE gym session refuses a NEW set at the database; a correction to
-- an existing set still lands. §0bc, 2026-09-13 (found 2026-09-12: Isabella's
-- rule — correcting a set on a complete session is decided and fine; adding
-- one is not, or "complete" means nothing and adherence changes after the
-- fact).
--
-- THE OLD RULE, asserted because this file replaces it: gym_set_logs_self_insert
-- (0021) checks org + "the log is the caller's" and nothing reads the parent
-- log's status. Before 0110 the closed-log insert below was accepted (proved
-- on scratch inside a rolled-back transaction, 12 live rows → 13).
--
-- WHAT 0110 ENFORCES, one BEFORE INSERT trigger, every caller: a row whose
-- parent gym_session_logs.status = 'complete' and whose revision_of is null
-- raises P0001 session_log_closed. revise_gym_set_log's insert carries
-- revision_of, so a correction passes; a plain insert does not. An in_progress
-- log takes new sets exactly as before.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o  uuid := tests.uid('orga', 'org');
  a1 uuid := tests.uid('orga', 'athlete_1');
  ex uuid := tests.uid('orga', 'ex_closed');
begin
  insert into exercises (id, org_id, name, category) values (ex, o, 'Bench press', 'push');

  -- an open log with one set
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source, started_at)
    values (tests.uid('orga','open_log'), o, a1, current_date, 'in_progress', 'self_report', now() - interval '20 minutes');
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
    values (tests.uid('orga','open_set_1'), o, tests.uid('orga','open_log'), ex, 1, 5, 100);

  -- a complete log with one set: opened, the set logged, then finished — the
  -- order a real session takes (the guard itself refuses a set inserted after
  -- the log is complete, which is the point)
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source, started_at)
    values (tests.uid('orga','closed_log'), o, a1, current_date - 1, 'in_progress', 'self_report', now() - interval '1 day');
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
    values (tests.uid('orga','closed_set_1'), o, tests.uid('orga','closed_log'), ex, 1, 5, 100);
  update gym_session_logs set status = 'complete', completed_at = now() - interval '23 hours'
    where id = tests.uid('orga','closed_log');
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- 1. an open log still takes a new set
select lives_ok(
  format($q$insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
            values (%L, %L, %L, %L, 2, 5, 100)$q$,
         tests.uid('orga','open_set_2'), tests.uid('orga','org'), tests.uid('orga','open_log'), tests.uid('orga','ex_closed')),
  'an in_progress log accepts a new set, as before'
);

-- 1b. and refuses another athlete's set on it — the cross-athlete rule, on an
--     OPEN log so RLS is what refuses (070's version of this now meets the
--     closed-log rule first)
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select throws_ok(
  format($q$insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
            values (%L, %L, %L, %L, 3, 5, 100)$q$,
         tests.uid('orga','open_set_3'), tests.uid('orga','org'), tests.uid('orga','open_log'), tests.uid('orga','ex_closed')),
  '42501', null,
  'athlete_2 cannot log a set onto athlete_1''s open session'
);
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- 2. a complete log refuses a new set
select throws_ok(
  format($q$insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
            values (%L, %L, %L, %L, 2, 5, 150)$q$,
         tests.uid('orga','closed_set_2'), tests.uid('orga','org'), tests.uid('orga','closed_log'), tests.uid('orga','ex_closed')),
  'P0001', 'session_log_closed',
  'a complete log refuses a new set, by name'
);
select is(
  (select count(*)::int from gym_set_logs_current where gym_session_log_id = tests.uid('orga','closed_log')),
  1, 'and the closed log still has one live set'
);

-- 3. a correction on the complete log still lands
select lives_ok(
  format($q$select revise_gym_set_log(%L, %L, '{"reps_completed": 5, "load_kg": 105}'::jsonb)$q$, tests.uid('orga','closed_set_1'), tests.uid('orga','closed_set_1r')),
  'a correction of a set on the complete log is still allowed (decided)'
);
select is(
  (select load_kg from gym_set_logs_current where gym_session_log_id = tests.uid('orga','closed_log')),
  105::numeric, 'the corrected value is live'
);
select is(
  (select count(*)::int from gym_set_logs where gym_session_log_id = tests.uid('orga','closed_log')),
  2, 'the original is kept as a superseded row — a correction, not an addition'
);
select is(
  (select count(*)::int from gym_set_logs_current where gym_session_log_id = tests.uid('orga','closed_log')),
  1, 'one live set, still'
);

-- 4. the service role is held to the same rule
reset role;
select throws_ok(
  format($q$insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
            values (%L, %L, %L, %L, 3, 5, 150)$q$,
         tests.uid('orga','closed_set_3'), tests.uid('orga','org'), tests.uid('orga','closed_log'), tests.uid('orga','ex_closed')),
  'P0001', 'session_log_closed',
  'the rule is about the record, not the caller: the service role is refused too'
);

select * from finish();
rollback;
