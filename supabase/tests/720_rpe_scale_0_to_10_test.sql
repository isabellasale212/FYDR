-- The RPE package, change three (2026-09-13): the session rating is CR-10,
-- 0 to 10. Zero is a real rating meaning rest; 11 and -1 are still refused;
-- a rated-0 session has a load of 0, present, not null.

begin;
select * from no_plan();

select tests.fixtures();

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- 1. zero is accepted
select lives_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by)
            values (%L, %L, null, current_date, 0, 45, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'user_athlete_1')),
  'a session rated 0 (rest) is accepted'
);

-- 2. and its load is zero, present — not null, not absent
select is(
  (select session_load from training_entries where athlete_id = tests.uid('orga', 'athlete_1') and rpe = 0 and entry_date = current_date),
  0.0::numeric, 'a rated-0 session carries a load of 0.0, a real value'
);

-- 3. the range still holds at both ends
select throws_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by)
            values (%L, %L, null, current_date - 1, 11, 45, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'user_athlete_1')),
  '23514', null, '11 is refused'
);
select throws_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by)
            values (%L, %L, null, current_date - 2, -1, 45, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'user_athlete_1')),
  '23514', null, '-1 is refused'
);

-- 4. the constraint is the one 0117 named, and the column says the scale
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.training_entries'::regclass and conname = 'training_entries_rpe_check'),
  'CHECK (((rpe >= (0)::numeric) AND (rpe <= (10)::numeric)))', 'the check is 0 to 10'
);
select matches(
  (select col_description('public.training_entries'::regclass, attnum) from pg_attribute where attrelid = 'public.training_entries'::regclass and attname = 'rpe'),
  '0 to 10 since migration 0117', 'the column records the scale and the date it changed'
);

-- 5. a coach's planned RPE is not the session scale and still refuses 0
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$update sessions set planned_rpe = 0 where id = %L$q$, tests.uid('orga', 'session')),
  '23514', null, 'planned_rpe stays 1 to 10'
);

select * from finish();
rollback;
