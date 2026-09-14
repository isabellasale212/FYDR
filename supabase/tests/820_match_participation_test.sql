-- 820_match_participation_test.sql
--
-- Migration 0127: the coach's post-match sheet. Written by the coach and the
-- sport scientist (SESSION_EDIT), read by every staff role and by the athlete
-- for their own row; started and came on never both; minutes nullable — not
-- recorded is not zero; every change audited; the org scope.

begin;
select * from no_plan();

select tests.fixtures();

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');

-- 1. the coach writes the sheet
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into match_participation (id, org_id, fixture_id, athlete_id, started, minutes, recorded_by)
            values (%L, %L, %L, %L, true, 80, %L)$q$,
         tests.uid('orga','mp_1'), tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  'the coach records athlete_1 started, 80 minutes');
select lives_ok(
  format($q$insert into match_participation (id, org_id, fixture_id, athlete_id, came_on, recorded_by)
            values (%L, %L, %L, %L, true, %L)$q$,
         tests.uid('orga','mp_2'), tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_2'), tests.uid('orga','user_coach')),
  'and athlete_2 came on, minutes not recorded');
select is((select minutes from match_participation where id = tests.uid('orga','mp_2')), null, 'not recorded is null, never zero');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id, started, came_on) values (%L, %L, %L, true, true)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_1')),
  '23514', null, 'started and came on, never both');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id, minutes) values (%L, %L, %L, 130)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_2')),
  '23514', null, 'minutes are 0 to 120');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_1')),
  '23505', null, 'one row per athlete per fixture');
select lives_ok(format($q$update match_participation set minutes = 25 where id = %L$q$, tests.uid('orga','mp_2')), 'the coach corrects the sheet');
select is((select minutes from match_participation where id = tests.uid('orga','mp_2')), 25, 'the correction lands');

-- 2. the sport scientist writes too; the medic, the S&C and the nutritionist read only
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(format($q$update match_participation set minutes = 26 where id = %L$q$, tests.uid('orga','mp_2')), 'the sport scientist edits');
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is((select count(*)::int from match_participation where fixture_id = tests.uid('orga','fixture')), 2, 'the medic reads the sheet');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_2')),
  '42501', null, 'the medic cannot write it');
update match_participation set minutes = 99 where id = tests.uid('orga','mp_1');
select is((select minutes from match_participation where id = tests.uid('orga','mp_1')), 80, 'nor update it');
delete from match_participation where id = tests.uid('orga','mp_1');
select is((select count(*)::int from match_participation where id = tests.uid('orga','mp_1')), 1, 'nor remove a row');
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select is((select count(*)::int from match_participation where fixture_id = tests.uid('orga','fixture')), 2, 'the S&C reads');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_2')),
  '42501', null, 'and cannot write');
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select is((select count(*)::int from match_participation where fixture_id = tests.uid('orga','fixture')), 2, 'the nutritionist reads');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_2')),
  '42501', null, 'and cannot write');

-- 3. the athlete reads their own row and nobody else's
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*)::int from match_participation), 1, 'athlete_1 reads one row');
select is((select athlete_id from match_participation), tests.uid('orga','athlete_1'), 'their own');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id, started) values (%L, %L, %L, true)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_1')),
  '42501', null, 'and cannot write their own sheet');

-- 4. the org scope
select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is((select count(*)::int from match_participation), 0, 'orgb''s coach sees none of orga''s');
select throws_ok(
  format($q$insert into match_participation (org_id, fixture_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','fixture'), tests.uid('orga','athlete_1')),
  '42501', null, 'and cannot write into orga');

-- 5. the audit
select tests.set_jwt(tests.uid('orga', 'user_coach'));
delete from match_participation where id = tests.uid('orga','mp_2');
reset role;
select is((select count(*)::int from audit_log where action = 'match_participation.set' and entity_id = tests.uid('orga','fixture')), 4, 'two inserts and two edits: four set rows');
select is((select count(*)::int from audit_log where action = 'match_participation.remove' and entity_id = tests.uid('orga','fixture')), 1, 'one remove');
select is((select actor_id from audit_log where action = 'match_participation.remove' order by id desc limit 1), tests.uid('orga','user_coach'), 'with the actor');
select is((select metadata -> 'was' ->> 'minutes' from audit_log where action = 'match_participation.remove' order by id desc limit 1), '26', 'and what it was');
select is((select athlete_id from audit_log where action = 'match_participation.set' order by id limit 1), tests.uid('orga','athlete_1'), 'against the athlete');

select * from finish();
rollback;
