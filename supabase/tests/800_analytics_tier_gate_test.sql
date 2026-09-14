-- 800_analytics_tier_gate_test.sql
--
-- Migration 0125: analytics is premium at the database. analytics_daily_rows()
-- is the destination's one read: no rows for a club that is not premium (keep
-- and hide, 0119's mechanism, never an error), no rows for anyone but the
-- sport scientist (D-02), rows scoped to the caller's club, dispatched on the
-- source table and refusing any other, and the in_data denominator applied.

begin;
select * from no_plan();

select tests.fixtures();

-- A GPS row and a gym session with two live sets and one superseded one, as
-- the schema owner, so the fixture does not depend on the gate under test.
insert into gps_records (org_id, athlete_id, record_date, total_distance_m, high_speed_distance_m, max_speed_ms)
values (tests.uid('orga','org'), tests.uid('orga','athlete_1'), current_date - 1, 5200, 610, 8.4);
-- Logged while in progress (0110 refuses a new set on a closed log), then completed.
insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source)
values (tests.uid('orga','gymlog_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'), current_date - 1, 'in_progress', 'self_report');
insert into exercises (id, org_id, name, category) values (tests.uid('orga','ex_1'), tests.uid('orga','org'), 'Back squat', 'squat');
insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg, is_warmup)
values (tests.uid('orga','set_1'), tests.uid('orga','org'), tests.uid('orga','gymlog_1'), tests.uid('orga','ex_1'), 1, 5, 100, false),
       (tests.uid('orga','set_2'), tests.uid('orga','org'), tests.uid('orga','gymlog_1'), tests.uid('orga','ex_1'), 2, 5, 100, false),
       (tests.uid('orga','set_w'), tests.uid('orga','org'), tests.uid('orga','gymlog_1'), tests.uid('orga','ex_1'), 0, 10, 40, true);
-- The correction: the old set is superseded first (one live row per slot), then the revision lands.
update gym_set_logs set superseded_by = tests.uid('orga','set_2b') where id = tests.uid('orga','set_2');
insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg, is_warmup, revision_of)
values (tests.uid('orga','set_2b'), tests.uid('orga','org'), tests.uid('orga','gymlog_1'), tests.uid('orga','ex_1'), 2, 5, 110, false, tests.uid('orga','set_2'));
update gym_session_logs set status = 'complete', completed_at = now() where id = tests.uid('orga','gymlog_1');

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');

-- 1. Basic (the fixture org's default tier): the sport scientist gets nothing, not an error
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(public.auth_org_is_premium(), false, 'the fixture org is on the default (core) tier');
select lives_ok($$select * from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date)$$, 'basic: the call lives');
select is((select count(*)::int from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date)), 0, 'basic: wellness — no rows, keep and hide');
select is((select count(*)::int from public.analytics_daily_rows('training_entries_current', current_date - 7, current_date)), 0, 'basic: training — no rows');
select is((select count(*)::int from public.analytics_daily_rows('gym_set_logs', current_date - 7, current_date)), 0, 'basic: gym — no rows');
select is((select count(*)::int from public.analytics_daily_rows('gps_records', current_date - 7, current_date)), 0, 'basic: GPS — no rows');
select is((select count(*)::int from wellness_entries_current where org_id = tests.uid('orga','org')), 2, 'while the table itself still reads for the club: the gate is the destination''s, not the data''s');

-- 2. Premium: the sport scientist reads every source
reset role;
update public.organisations set tier = 'performance' where id = tests.uid('orga', 'org');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(public.auth_org_is_premium(), true, 'performance: premium');
select is((select count(*)::int from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date)), 2, 'premium: both athletes'' wellness rows');
select is((select (cols->>'sleep_hours')::numeric from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date, tests.uid('orga','athlete_1'))), 7.5::numeric, 'the columns ride as jsonb; one athlete narrows');
select is((select (cols->>'session_load')::numeric from public.analytics_daily_rows('training_entries_current', current_date - 7, current_date)), 560.0::numeric, 'training: session_load (7 × 80)');
select is((select (cols->>'volume_kg')::numeric from public.analytics_daily_rows('gym_set_logs', current_date - 7, current_date)), 1050::numeric, 'gym: the live working sets summed per session — 5×100 + 5×110, the superseded set and the warm-up excluded');
select is((select (cols->>'total_distance_m')::numeric from public.analytics_daily_rows('gps_records', current_date - 7, current_date)), 5200::numeric, 'GPS: the record joins the panels, dated on record_date');
select is((select entry_date from public.analytics_daily_rows('gps_records', current_date - 7, current_date)), current_date - 1, 'as entry_date');
select is((select count(*)::int from public.analytics_daily_rows('wellness_entries_current', current_date + 1, current_date + 7)), 0, 'a window with nothing in it is empty');
select throws_ok($$select * from public.analytics_daily_rows('athletes', current_date - 7, current_date)$$, '22023', 'analytics_daily_rows: unknown source_table athletes', 'any other source table is refused: the dispatch is on source_table, never a key prefix');

-- 3. Premium, wrong role: nothing (D-02)
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date)), 0, 'a coach gets no rows');
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select is((select count(*)::int from public.analytics_daily_rows('gps_records', current_date - 7, current_date)), 0, 'nor the S&C');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*)::int from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date)), 0, 'nor an athlete');

-- 4. Scope and the denominator
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select is((select count(*)::int from public.analytics_daily_rows('gps_records', current_date - 7, current_date)), 0, 'orgb''s sport scientist sees none of orga''s rows (orgb is on core; and the org scope holds regardless)');
reset role;
update public.organisations set tier = 'performance' where id = tests.uid('orgb', 'org');
set local role authenticated;
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select is((select count(*)::int from public.analytics_daily_rows('gps_records', current_date - 7, current_date)), 0, 'premium orgb: still none of orga''s GPS — the org scope');
select is((select count(*)::int from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date)), 2, 'and its own wellness rows');
reset role;
update public.athletes set consent_withdrawn_at = now() where id = tests.uid('orga','athlete_2');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*)::int from public.analytics_daily_rows('wellness_entries_current', current_date - 7, current_date)), 1, 'an athlete out of data (0120) is out of the analytics rows');

-- 5. Restore: back to core, gone again
reset role;
update public.organisations set tier = 'core' where id = tests.uid('orga', 'org');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*)::int from public.analytics_daily_rows('gps_records', current_date - 7, current_date)), 0, 'downgraded: hidden again, the rows kept');

select * from finish();
rollback;
