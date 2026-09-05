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
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


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

/* G-33 row 4, decided 2026-09-05: GPS import is the sport scientist's alone,
   on both the batch and the rows it writes. docs/access-matrix.md §3.6 reads
   "Import GPS | VC | X | X | X | X" and is now enforced. A coach who also runs
   the imports at a lean club holds both roles on one account; see
   070_programmes_test.sql for that pattern asserted end to end. */
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into import_batches (org_id, filename, imported_by) values (%L, 'coach.csv', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '42501', null,
  'a coach can no longer start a GPS import'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into import_batches (id, org_id, filename, row_count, accepted_count, rejected_count, imported_by)
            values (%L, %L, 'training-6aug.csv', 2, 2, 0, %L)$q$,
         tests.uid('orga','batch_1'), tests.uid('orga','org'), tests.uid('orga','user_admin')),
  'a sport scientist starts the GPS import batch'
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

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into gps_records
              (id, org_id, athlete_id, record_date, total_distance_m, high_speed_distance_m,
               max_speed_ms, import_batch_id, source)
            values (%L, %L, %L, current_date, 6260, 589, 8.42, %L, 'file_import')$q$,
         tests.uid('orga','gps_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','batch_1')),
  'the sport scientist commits a GPS record from the import'
);

/* Was "medical commits one too — no coach-owns/medical-owns split". There is a
   split now, and it is not between coach and medic: the write belongs to the
   role that owns the import screen, and everyone else reads. */
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into gps_records
              (org_id, athlete_id, record_date, total_distance_m, import_batch_id, source)
            values (%L, %L, current_date, 5090, %L, 'file_import')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','batch_1')),
  '42501', null,
  'a medic cannot commit one'
);

select is(
  (select import_batch_id from gps_records where id = tests.uid('orga','gps_1')),
  tests.uid('orga','batch_1'),
  'the committed record really does point at the batch that produced it'
);

/* Was a refusal. import_batches was gated on coach-or-medic, which 0066 read
   as "any staff" and widened, so the sport scientist can now start an import.
   docs/access-matrix.md 3.6 would go further and make GPS import theirs alone;
   that half is a narrowing and is left to G-33. */
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into import_batches (org_id, filename, imported_by) values (%L, 'sportsci.csv', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_admin')),
  'a sport scientist CAN start a GPS import'
);

-- ===========================================================================
-- G-35. Re-importing a file must REPLACE the row, not fail and not duplicate.
--
-- This is what migration 0064 was for, and what it could not actually do. 0064
-- added the unique constraint and gpsImport.ts switched to an upsert, so the
-- conflict path is an UPDATE, and gps_records had INSERT and SELECT policies
-- and no UPDATE policy at all. Every re-import raised 42501 for every real user.
--
-- It was reported as verified because the check ran over a connection carrying
-- rolbypassrls, which never consulted a policy. That is the same defect as G-32
-- and it is why every file in this suite now opens with a canary.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));

select lives_ok(
  format($q$insert into gps_records
              (org_id, athlete_id, record_date, session_id, total_distance_m, import_batch_id, source)
            values (%L, %L, date '2026-05-04', null, 5000, %L, 'file_import')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','batch_1')),
  'the first import of a day writes a row'
);

select throws_ok(
  format($q$insert into gps_records
              (org_id, athlete_id, record_date, session_id, total_distance_m, import_batch_id, source)
            values (%L, %L, date '2026-05-04', null, 9999, %L, 'file_import')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','batch_1')),
  '23505', null,
  'a plain second insert is refused by the 0064 constraint, which is the duplicate bug fixed'
);

select lives_ok(
  format($q$insert into gps_records
              (org_id, athlete_id, record_date, session_id, total_distance_m, import_batch_id, source)
            values (%L, %L, date '2026-05-04', null, 5250, %L, 'file_import')
            on conflict (org_id, athlete_id, record_date, session_id)
            do update set total_distance_m = excluded.total_distance_m$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','batch_1')),
  'and the re-import upsert SUCCEEDS: this is the assertion that would have caught G-35'
);

select is(
  (select count(*) from gps_records where org_id = tests.uid('orga','org')
     and athlete_id = tests.uid('orga','athlete_2') and record_date = date '2026-05-04'),
  1::bigint,
  'still one row, not two'
);

select is(
  (select total_distance_m from gps_records where org_id = tests.uid('orga','org')
     and athlete_id = tests.uid('orga','athlete_2') and record_date = date '2026-05-04'),
  5250::numeric,
  'and it carries the corrected figure, which is the whole point of replace-on-conflict'
);

-- The write stays the import owner's. A coach reads GPS and does not write it.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  tests.rows_affected(format($q$update gps_records set total_distance_m = 1
                              where org_id = %L and athlete_id = %L and record_date = date '2026-05-04'$q$,
                              tests.uid('orga','org'), tests.uid('orga','athlete_2'))),
  0::bigint,
  'a coach cannot rewrite a GPS row: the new UPDATE policy is the import owner''s alone'
);


select * from finish();
rollback;
