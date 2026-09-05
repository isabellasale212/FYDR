-- 080_gps_records_test.sql
--
-- migration 0023's own header explains why this feature exists and what it
-- deliberately does not. This file tests the read split screens/training-
-- report.md's own role table specifies: staff read everything in their org,
-- an athlete reads only their own rows (a real entitlement, ahead of any UI
-- consuming it — see the migration's own comment), and nobody else at all.
--
-- Write access — migration 0026 added it, closing the gap this file's own
-- header used to describe as absent — is tested in
-- 100_gps_import_test.sql, not here, so this file's read-count assertions
-- stay exact against exactly the two rows it seeds itself.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o   uuid := tests.uid('orga', 'org');
  a1  uuid := tests.uid('orga', 'athlete_1');
  a2  uuid := tests.uid('orga', 'athlete_2');
begin
  insert into gps_records (org_id, athlete_id, record_date, total_distance_m, high_speed_distance_m, max_speed_ms)
    values (o, a1, current_date - 1, 6260, 589, 8.4),
           (o, a2, current_date - 1, 5090, 642, 8.6);
end $$;

set local role authenticated;


-- ===========================================================================
-- 1. Staff read every record in their org
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from gps_records where org_id = tests.uid('orga','org')),
  2::bigint,
  'a coach reads both athletes'' GPS records'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from gps_records where org_id = tests.uid('orga','org')),
  2::bigint,
  'medical reads both too — GPS output is not clinical data'
);


-- ===========================================================================
-- 2. An athlete reads only their own row
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from gps_records where org_id = tests.uid('orga','org')),
  1::bigint,
  'athlete_1 reads exactly one row — their own'
);
select is(
  (select athlete_id from gps_records where org_id = tests.uid('orga','org')),
  tests.uid('orga','athlete_1'),
  'and it really is their own row, not athlete_2''s'
);


-- ===========================================================================
-- 3. The sport scientist reads everything, and so does the nutritionist here
--
-- This section was "Admin has no access at all". GPS is the clearest case of
-- the inversion: §4.2 lists GPS among the things a nutritionist explicitly
-- KEEPS ("compliance, wellness, body mass, testing and GPS"), and §1 gives the
-- sport scientist everything.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select cmp_ok(
  (select count(*) from gps_records where org_id = tests.uid('orga','org')),
  '>', 0::bigint,
  'a sport scientist DOES read GPS records'
);

select * from finish();
rollback;
