-- 760_athlete_devices_test.sql — migration 0121: the athlete's beacon and the
-- reachability figure's rows.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok($$select public.record_athlete_device('ios', 'browser', false)$$, 'an athlete records how the app is running');
select lives_ok($$select public.record_athlete_device('ios', 'standalone', true)$$, 'and again from the Home Screen');
select lives_ok($$select public.record_athlete_device('ios', 'standalone', true)$$, 'a second open updates, never duplicates');
select is((select count(*)::int from athlete_devices where athlete_id = tests.uid('orga','athlete_1')), 2, 'one row per platform and mode');
select throws_ok($$select public.record_athlete_device('watch', 'standalone', true)$$, '22023', null, 'an unknown platform is refused');
select throws_ok(
  format($q$insert into athlete_devices (org_id, athlete_id, platform, display_mode) values (%L, %L, 'ios', 'browser')$q$, tests.uid('orga','org'), tests.uid('orga','athlete_2')),
  '42501', null, 'no direct insert — the function is the only write');
select is((select count(*)::int from athlete_devices where athlete_id = tests.uid('orga','athlete_2')), 0, 'an athlete reads no other athlete''s rows');

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from athlete_devices where athlete_id = tests.uid('orga','athlete_1')), 2, 'a coach reads the club''s rows for the figure');
select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is((select count(*)::int from athlete_devices), 0, 'another club reads none');
select tests.clear_jwt();
reset role;
select is((select count(*)::int from information_schema.columns where table_name = 'athlete_devices' and column_name in ('user_agent', 'device_id', 'token')), 0, 'no device identifier is stored');

select * from finish();
rollback;
