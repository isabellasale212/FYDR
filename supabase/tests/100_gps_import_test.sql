-- 100_gps_import_test.sql
--
-- migration 0026's own header explains why this exists. Tests the write
-- path 0023 deliberately left absent: coach and medical can now insert an
-- import_batches row and gps_records rows against it, an athlete and an
-- admin still cannot, and the batch id linkage actually holds.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. import_batches: staff insert, self as importer
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into import_batches (org_id, filename, imported_by) values (%L, 'gps.csv', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot start a GPS import'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into import_batches (id, org_id, filename, row_count, accepted_count, rejected_count, imported_by)
            values (%L, %L, 'training-6aug.csv', 2, 2, 0, %L)$q$,
         tests.uid('orga','batch_1'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a coach starts a GPS import batch'
);


-- ===========================================================================
-- 2. gps_records: staff insert against that batch
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into gps_records (org_id, athlete_id, record_date, total_distance_m, import_batch_id, source)
            values (%L, %L, current_date, 5000, %L, 'file_import')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','batch_1')),
  '42501', null,
  'an athlete cannot insert a GPS record via the import path either'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into gps_records
              (id, org_id, athlete_id, record_date, total_distance_m, high_speed_distance_m,
               max_speed_ms, import_batch_id, source)
            values (%L, %L, %L, current_date, 6260, 589, 8.42, %L, 'file_import')$q$,
         tests.uid('orga','gps_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','batch_1')),
  'a coach commits a GPS record from the import'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into gps_records
              (org_id, athlete_id, record_date, total_distance_m, import_batch_id, source)
            values (%L, %L, current_date, 5090, %L, 'file_import')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','batch_1')),
  'medical commits one too — no coach-owns/medical-owns split, same as testing.md'
);

select is(
  (select import_batch_id from gps_records where id = tests.uid('orga','gps_1')),
  tests.uid('orga','batch_1'),
  'the committed record really does point at the batch that produced it'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$insert into import_batches (org_id, filename, imported_by) values (%L, 'x.csv', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_admin')),
  '42501', null,
  'an admin cannot start a GPS import either — no access by default'
);

select * from finish();
rollback;
