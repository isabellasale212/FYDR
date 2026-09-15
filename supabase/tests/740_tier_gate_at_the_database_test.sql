-- 740_tier_gate_at_the_database_test.sql
--
-- Migration 0119: keep and hide at the row. A club on the core (Basic) tier
-- keeps its GPS rows and its staff cannot read, insert or update them; on
-- performance (Premium) every staff read and write works as before. The two
-- written exceptions are pinned here: the service role (the SAR pack) and the
-- athlete's own rows read on any tier.

begin;
select * from no_plan();

select tests.fixtures();

-- A GPS row for athlete_1, written as the schema owner so the fixture does
-- not depend on the gate it is about to test.
insert into gps_records (org_id, athlete_id, record_date, total_distance_m, high_speed_distance_m, max_speed_ms)
values (tests.uid('orga','org'), tests.uid('orga','athlete_1'), current_date, 5200, 610, 8.4);

-- 1. the helper reads the real tier and fails closed
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(public.auth_org_is_premium(), false, 'core: auth_org_is_premium() is false (the fixture org is on the default tier)');
select tests.clear_jwt();
select is(public.auth_org_is_premium(), false, 'no session: false, never null');

update public.organisations set tier = 'performance' where id = tests.uid('orga', 'org');
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(public.auth_org_is_premium(), true, 'performance: true');
select tests.clear_jwt();

-- 2. Premium: staff read and the import writes work
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the assertions below');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 1, 'premium: a coach reads the GPS row');
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into import_batches (id, org_id, filename, row_count, accepted_count, rejected_count, imported_by)
            values (%L, %L, 'premium.csv', 1, 1, 0, %L)$q$, tests.uid('orga','batch_1'), tests.uid('orga','org'), tests.uid('orga','user_admin')),
  'premium: the sport scientist starts an import batch');
select lives_ok(
  format($q$insert into gps_records (org_id, athlete_id, record_date, total_distance_m, import_batch_id, source)
            values (%L, %L, current_date - 1, 4100, %L, 'file_import')$q$, tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','batch_1')),
  'premium: and writes a GPS row against it');
select is((select count(*)::int from import_batches where org_id = tests.uid('orga','org')), 1, 'premium: the batch is readable');

-- 2b. Premium: the roles the old policies refused are still refused — the
-- gate narrows on tier and widens nothing (check-policy-replacements).
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$insert into gps_records (org_id, athlete_id, record_date, total_distance_m, source) values (%L, %L, current_date - 3, 100, 'file_import')$q$, tests.uid('orga','org'), tests.uid('orga','athlete_1')),
  '42501', null, 'premium: the S&C still cannot write a GPS row');
select throws_ok(
  format($q$insert into import_batches (org_id, filename, row_count, accepted_count, rejected_count, imported_by) values (%L, 'sc.csv', 1, 1, 0, %L)$q$, tests.uid('orga','org'), tests.uid('orga','user_sc')),
  '42501', null, 'premium: nor start an import');
select throws_ok(
  format($q$insert into import_held_rows (org_id, batch_id, row_number, player_name, record_date, reason) values (%L, %L, 1, 'X', current_date, 'no match')$q$, tests.uid('orga','org'), tests.uid('orga','batch_1')),
  '42501', null, 'premium: nor hold a row');
select throws_ok(
  format($q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by) values (%L, %L, 'X', %L)$q$, tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_sc')),
  '42501', null, 'premium: nor remember a spelling');
select is((select count(*) from import_held_rows where org_id = tests.uid('orga','org')), 0::bigint, 'premium: the S&C reads no held rows');
select is((select count(*) from athlete_import_aliases where org_id = tests.uid('orga','org')), 0::bigint, 'premium: nor aliases');
update gps_records set total_distance_m = 2 where athlete_id = tests.uid('orga','athlete_1');
select is((select count(*) from gps_records where athlete_id = tests.uid('orga','athlete_1') and total_distance_m = 2), 0::bigint, 'premium: the S&C''s update matches nothing');

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select throws_ok(
  format($q$insert into gps_records (org_id, athlete_id, record_date, total_distance_m, source) values (%L, %L, current_date - 3, 100, 'file_import')$q$, tests.uid('orga','org'), tests.uid('orga','athlete_1')),
  '42501', null, 'premium: the nutritionist still cannot write a GPS row');
select throws_ok(
  format($q$insert into import_batches (org_id, filename, row_count, accepted_count, rejected_count, imported_by) values (%L, 'nut.csv', 1, 1, 0, %L)$q$, tests.uid('orga','org'), tests.uid('orga','user_nutritionist')),
  '42501', null, 'premium: nor start an import');
select throws_ok(
  format($q$insert into import_held_rows (org_id, batch_id, row_number, player_name, record_date, reason) values (%L, %L, 1, 'X', current_date, 'no match')$q$, tests.uid('orga','org'), tests.uid('orga','batch_1')),
  '42501', null, 'premium: nor hold a row');
select throws_ok(
  format($q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by) values (%L, %L, 'X', %L)$q$, tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_nutritionist')),
  '42501', null, 'premium: nor remember a spelling');
select is((select count(*) from import_held_rows where org_id = tests.uid('orga','org')), 0::bigint, 'premium: the nutritionist reads no held rows');
select is((select count(*) from athlete_import_aliases where org_id = tests.uid('orga','org')), 0::bigint, 'premium: nor aliases');
update gps_records set total_distance_m = 2 where athlete_id = tests.uid('orga','athlete_1');
select is((select count(*) from gps_records where athlete_id = tests.uid('orga','athlete_1') and total_distance_m = 2), 0::bigint, 'premium: the nutritionist''s update matches nothing');

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into import_batches (org_id, filename, row_count, accepted_count, rejected_count, imported_by) values (%L, 'med.csv', 1, 1, 0, %L)$q$, tests.uid('orga','org'), tests.uid('orga','user_medical')),
  '42501', null, 'premium: the medic still cannot start an import');
select throws_ok(
  format($q$insert into import_held_rows (org_id, batch_id, row_number, player_name, record_date, reason) values (%L, %L, 1, 'X', current_date, 'no match')$q$, tests.uid('orga','org'), tests.uid('orga','batch_1')),
  '42501', null, 'premium: nor hold a row');
select throws_ok(
  format($q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by) values (%L, %L, 'X', %L)$q$, tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_medical')),
  '42501', null, 'premium: nor remember a spelling');
select is((select count(*) from import_held_rows where org_id = tests.uid('orga','org')), 0::bigint, 'premium: the medic reads no held rows');
select is((select count(*) from athlete_import_aliases where org_id = tests.uid('orga','org')), 0::bigint, 'premium: nor aliases');

-- 3. Basic: the rows stay, the staff reads and writes stop — empty, never an error
reset role;
update public.organisations set tier = 'core' where id = tests.uid('orga', 'org');
select is((select count(*)::int from gps_records where org_id = tests.uid('orga','org')), 2, 'core: both rows are still in the table (kept, not deleted)');
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 0, 'core: a coach reads no GPS rows — hidden, not an error');
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*)::int from gps_records where org_id = tests.uid('orga','org')), 0, 'core: nor does the sport scientist');
select is((select count(*)::int from import_batches where org_id = tests.uid('orga','org')), 0, 'core: the batch list is empty too');
select throws_ok(
  format($q$insert into import_batches (org_id, filename, row_count, accepted_count, rejected_count, imported_by)
            values (%L, 'basic.csv', 1, 1, 0, %L)$q$, tests.uid('orga','org'), tests.uid('orga','user_admin')),
  '42501', null,
  'core: the sport scientist cannot start an import');
select throws_ok(
  format($q$insert into gps_records (org_id, athlete_id, record_date, total_distance_m, source)
            values (%L, %L, current_date - 2, 3000, 'file_import')$q$, tests.uid('orga','org'), tests.uid('orga','athlete_1')),
  '42501', null,
  'core: nor write a GPS row');
update gps_records set total_distance_m = 1 where athlete_id = tests.uid('orga','athlete_1');
select tests.clear_jwt();
reset role;
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1') and total_distance_m = 1), 0, 'core: the sport scientist''s update matched nothing');
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');

-- 4. the written exceptions
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 2, 'core: the athlete still reads their own rows (Article 15 is theirs, not the plan''s)');
select tests.clear_jwt();
reset role;
-- The service role bypasses RLS; the SAR pack (lib/queries/sarPackAssembly.ts)
-- reads through it. Asserted as the owner with RLS not applied — the same
-- privilege position — so a future change that puts a tier check somewhere
-- RLS is not (a trigger, a view) fails here.
select is((select count(*)::int from gps_records where org_id = tests.uid('orga','org')), 2, 'core: the service-role path still reads every row for a subject access request');

-- 5. back on Premium, everything returns
update public.organisations set tier = 'performance' where id = tests.uid('orga', 'org');
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from gps_records where athlete_id = tests.uid('orga','athlete_1')), 2, 'premium again: the coach reads both rows — kept and restored');

select * from finish();
rollback;
