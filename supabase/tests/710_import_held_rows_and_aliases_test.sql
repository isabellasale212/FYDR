-- PATTERN-S8 C11 (2026-09-13): an import holds what it cannot match;
-- matching once teaches the vendor's spelling.
--
-- WHAT 0115 ADDS: import_held_rows (a held row per unmatched name, resolved
-- by status) and athlete_import_aliases (one remembered spelling per org,
-- pointing at one athlete). Both are the sport scientist's, in their own
-- org; nobody deletes; a colliding alias is refused.

begin;
select * from no_plan();

select tests.fixtures();

-- a batch to hang held rows on, as the app writes it
insert into import_batches (id, org_id, filename, row_count, accepted_count, rejected_count, imported_by)
values (tests.uid('orga', 'batch_1'), tests.uid('orga', 'org'), 'session.csv', 3, 1, 0, tests.uid('orga', 'user_admin'));

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');

-- 1. the sport scientist holds a row and reads it back
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  $q$insert into import_held_rows (org_id, batch_id, row_number, player_name, record_date, values, reason)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'batch_1'), 14, 'J Barnes', current_date, '{"total_distance_m": 5320}'::jsonb, 'No athlete on the roster matches "J Barnes"')$q$,
  'the sport scientist holds a row'
);
select is((select count(*)::int from import_held_rows where status = 'held'), 1, 'and reads it back as held');

-- 2. matching resolves it by status; nothing is deleted
select lives_ok(
  $q$update import_held_rows set status = 'matched', matched_athlete_id = tests.uid('orga', 'athlete_1'), resolved_by = tests.uid('orga', 'user_admin'), resolved_at = now()
     where org_id = tests.uid('orga', 'org') and player_name = 'J Barnes'$q$,
  'matching updates the row'
);
select is((select status from import_held_rows where player_name = 'J Barnes'), 'matched', 'resolved by status');
select throws_ok(
  $q$update import_held_rows set status = 'gone' where player_name = 'J Barnes'$q$,
  '23514', null, 'a status outside held / matched / discarded is refused'
);

-- 3. the alias is remembered, normalised, once per spelling
select lives_ok(
  $q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), 'j barnes', tests.uid('orga', 'user_admin'))$q$,
  'the spelling is remembered'
);
select throws_ok(
  $q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'), 'j barnes', tests.uid('orga', 'user_admin'))$q$,
  '23505', null, 'the same spelling cannot point at a second athlete'
);
select throws_ok(
  $q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), 'J  Barnes', tests.uid('orga', 'user_admin'))$q$,
  '23514', null, 'an un-normalised spelling is refused — the parser and the table agree on the key'
);
select throws_ok(
  $q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), 'jim barnes', tests.uid('orga', 'user_coach'))$q$,
  '42501', null, 'created_by must be the writer'
);

-- 4. the coach reads and writes neither
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from import_held_rows), 0, 'the coach reads no held row');
select is((select count(*)::int from athlete_import_aliases), 0, 'the coach reads no alias');
select throws_ok(
  $q$insert into import_held_rows (org_id, batch_id, row_number, player_name, record_date, reason)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'batch_1'), 15, 'X', current_date, 'r')$q$,
  '42501', null, 'the coach holds nothing'
);
select throws_ok(
  $q$insert into athlete_import_aliases (org_id, athlete_id, alias, created_by)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), 'x', tests.uid('orga', 'user_coach'))$q$,
  '42501', null, 'the coach remembers nothing'
);

-- 5. nobody deletes: the default grant is revoked (0090's lesson) and delete
--    is not granted back, so the verb itself is refused
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  $q$delete from import_held_rows where player_name = 'J Barnes'$q$,
  '42501', null, 'a held row is never deleted, only resolved'
);
select throws_ok(
  $q$delete from athlete_import_aliases where alias = 'j barnes'$q$,
  '42501', null, 'an alias is never deleted'
);

-- 6. another club sees nothing
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select is((select count(*)::int from import_held_rows), 0, 'another club''s sport scientist sees no held row');
select is((select count(*)::int from athlete_import_aliases), 0, 'nor any alias');

select * from finish();
rollback;
