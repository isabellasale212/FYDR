-- 810_premium_plan_page_and_gaps_test.sql
--
-- Migration 0126: the three gaps the premium inventory named. A tier flip
-- writes an audit row; the retention run's soft delete on gps_records is
-- filtered at the row for every signed-in read and by the two definer reads;
-- premium_history_kept() tells the sport scientist what is kept on any plan.

begin;
select * from no_plan();

select tests.fixtures();

-- Two GPS rows for athlete_1: one live, one retired by retention.
insert into gps_records (id, org_id, athlete_id, record_date, total_distance_m)
values (tests.uid('orga','gps_live'), tests.uid('orga','org'), tests.uid('orga','athlete_1'), current_date - 1, 5200),
       (tests.uid('orga','gps_old'),  tests.uid('orga','org'), tests.uid('orga','athlete_1'), current_date - 400, 4100);
update gps_records set deleted_at = now() where id = tests.uid('orga','gps_old');
insert into import_batches (id, org_id, filename, row_count, accepted_count, rejected_count, imported_by)
values (tests.uid('orga','batch_1'), tests.uid('orga','org'), 'old.csv', 2, 2, 0, tests.uid('orga','user_admin'));

-- 1. a tier flip writes org.tier.changed
select is((select count(*)::int from audit_log where action = 'org.tier.changed' and org_id = tests.uid('orga','org')), 0, 'no flip yet, no row');
update public.organisations set tier = 'performance' where id = tests.uid('orga','org');
select is((select count(*)::int from audit_log where action = 'org.tier.changed' and org_id = tests.uid('orga','org')), 1, 'core → performance: one audit row');
select is((select metadata from audit_log where action = 'org.tier.changed' and org_id = tests.uid('orga','org') order by id desc limit 1), '{"from": "core", "to": "performance"}'::jsonb, 'with from and to');
select is((select entity_type from audit_log where action = 'org.tier.changed' and org_id = tests.uid('orga','org') order by id desc limit 1), 'organisation', 'on the organisation');
update public.organisations set name = name where id = tests.uid('orga','org');
select is((select count(*)::int from audit_log where action = 'org.tier.changed' and org_id = tests.uid('orga','org')), 1, 'an update that leaves the tier alone writes nothing');
update public.organisations set tier = 'core' where id = tests.uid('orga','org');
select is((select count(*)::int from audit_log where action = 'org.tier.changed' and org_id = tests.uid('orga','org')), 2, 'performance → core: a second row — keep and hide has a date');
update public.organisations set tier = 'performance' where id = tests.uid('orga','org');

-- 2. the retired row is out of every signed-in read
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 1, 'premium: a coach reads the live row only');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 1, 'the athlete reads their own live row only');
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*)::int from gps_records where id = tests.uid('orga','gps_old')), 0, 'the sport scientist cannot read the retired row…');
-- A USING mismatch raises nothing and matches no row: asserted as the row's own value.
update gps_records set total_distance_m = 1 where id = tests.uid('orga','gps_old');
update gps_records set total_distance_m = 5201 where id = tests.uid('orga','gps_live');
reset role;
select is((select total_distance_m from gps_records where id = tests.uid('orga','gps_old')), 4100::numeric, '…and cannot update it — the import''s upsert cannot resurrect it');
select is((select total_distance_m from gps_records where id = tests.uid('orga','gps_live')), 5201::numeric, 'while the live row still updates');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*)::int from public.analytics_daily_rows('gps_records', current_date - 500, current_date)), 1, 'analytics_daily_rows (definer) filters the retired row itself');
reset role;
select matches((select pg_get_functiondef('public.compute_leaderboard'::regproc)), 'and g\.deleted_at is null', 'compute_leaderboard (definer) filters it too');
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 2, 'the service role sees both — retention and the SAR pack read as it');

-- 3. premium_history_kept: what the club holds, on any plan
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select gps_rows from public.premium_history_kept()), 1::bigint, 'premium: one live GPS row (the retired one is not "kept")');
select is((select first_date from public.premium_history_kept()), current_date - 1, 'first date');
select is((select import_batches from public.premium_history_kept()), 1::bigint, 'one import batch');
reset role;
update public.organisations set tier = 'core' where id = tests.uid('orga','org');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 0, 'basic: the table hides every row from the sport scientist (0119)');
select is((select gps_rows from public.premium_history_kept()), 1::bigint, 'but the plan page can still say what is kept — the one-place sentence');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from public.premium_history_kept()), 0, 'a coach gets nothing from it');
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select is((select gps_rows from public.premium_history_kept()), 0::bigint, 'orgb''s sport scientist sees orgb''s (none), never orga''s');

select * from finish();
rollback;
