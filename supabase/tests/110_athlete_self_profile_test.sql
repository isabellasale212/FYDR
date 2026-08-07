-- 110_athlete_self_profile_test.sql
--
-- migration 0027's own header explains why this exists. Tests both halves
-- of the guarantee: an athlete really can set their own preferred_name, and
-- that write path really doesn't extend one column further — not to
-- squad_number on their own row, and not to any column on someone else's.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. An athlete can set their own preferred_name
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$update athletes set preferred_name = 'Jim' where id = %L$q$, tests.uid('orga','athlete_1')),
  'athlete_1 sets their own preferred name'
);
select is(
  (select preferred_name from athletes where id = tests.uid('orga','athlete_1')),
  'Jim',
  'and it really did change'
);


-- ===========================================================================
-- 2. That write path goes no further than preferred_name
-- ===========================================================================

select throws_ok(
  format($q$update athletes set squad_number = 99 where id = %L$q$, tests.uid('orga','athlete_1')),
  '42501', null,
  'athlete_1 cannot change their own squad number — a column privilege denial, not a row one'
);
select is(
  (select squad_number from athletes where id = tests.uid('orga','athlete_1')),
  2,
  'squad number is untouched'
);


-- ===========================================================================
-- 3. That write path goes no further than their own row
-- ===========================================================================

select lives_ok(
  format($q$update athletes set preferred_name = 'Hijacked' where id = %L$q$, tests.uid('orga','athlete_2')),
  'the statement itself does not error — RLS filters the row silently, same as any other row-scoped update'
);
select is(
  (select preferred_name from athletes where id = tests.uid('orga','athlete_2')),
  null,
  'athlete_2''s row is untouched — athlete_1''s update matched zero rows under RLS'
);


-- ===========================================================================
-- 4. Staff's existing write path is unaffected by this migration
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update athletes set squad_number = 15 where id = %L$q$, tests.uid('orga','athlete_2')),
  'a coach still has full write access to an athlete record, unchanged by this migration'
);

select * from finish();
rollback;
