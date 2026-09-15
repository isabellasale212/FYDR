-- 840_test_assignments_test.sql
--
-- Migration 0130: tests are assignable to groups and individual athletes
-- (decision batch 14 September 2026, #3). A table linking a test definition
-- to groups and to athletes; a whole-squad row for what a club has not
-- narrowed (backfilled for every live definition, so nothing changes on day
-- one); one function that says who a test is assigned to, and one an
-- athlete may call for their own list. The catalogue's confirmed sentence —
-- "an athlete who has never been assigned a test does not appear for it" —
-- then reads true.
--
-- Written BEFORE the migration (CLAUDE.md §5: a permission rule gets its
-- test first).
--
-- What this file asserts
--   1. Backfill: a definition that existed before 0130 carries one live
--      whole-squad assignment.
--   2. Shape: a row names a group, an athlete, or neither (whole squad) —
--      never both; one live whole-squad row per definition; the group and
--      the athlete must belong to the definition's organisation.
--   3. Who writes: the roles that define a test (sport scientist, coach,
--      medic, S&C) assign one; the nutritionist and an athlete are refused.
--      Who reads: every staff role; an athlete reads the table not at all
--      and uses the function.
--   4. test_assigned_athlete_ids: whole squad = every live athlete in data;
--      a group row = its current members; an athlete row = that athlete;
--      the union of rows; a removed row no longer counts; a member removed
--      from the group no longer counts.
--   5. resolve_my_assigned_tests: an athlete's own list; staff for anyone in
--      the org; another athlete's list is empty.
--   6. Cross-tenant: org B's coach cannot assign org A's test.

begin;
select * from no_plan();

select tests.fixtures();

-- A definition that "existed before 0130": inserted directly, then the
-- backfill's own statement run again for it (idempotent by construction).
insert into public.test_definitions (id, org_id, name, test_category, unit, higher_is_better)
values (tests.uid('orga','test_cmj'), tests.uid('orga','org'), 'CMJ', 'power', 'cm', true);
insert into public.test_definitions (id, org_id, name, test_category, unit, higher_is_better)
values (tests.uid('orga','test_sprint'), tests.uid('orga','org'), '10m sprint', 'speed', 's', false);
insert into public.test_definitions (id, org_id, name, test_category, unit, higher_is_better)
values (tests.uid('orgb','test_b'), tests.uid('orgb','org'), 'Bronco', 'endurance', 's', false);
select public.backfill_whole_squad_test_assignments();

-- ===========================================================================
-- 1. Backfill
-- ===========================================================================

select is(
  (select count(*)::int from public.test_assignments
    where test_definition_id = tests.uid('orga','test_cmj') and group_id is null and athlete_id is null and removed_at is null),
  1,
  'a pre-existing definition carries one live whole-squad assignment'
);
select public.backfill_whole_squad_test_assignments();
select is(
  (select count(*)::int from public.test_assignments where test_definition_id = tests.uid('orga','test_cmj')),
  1,
  'running the backfill again adds nothing'
);

-- A third athlete, out of data (declined), to prove the whole-squad set is
-- "in data", the same population every denominator uses.
insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status, consent_declined_at)
values (tests.uid('orga','athlete_declined'), tests.uid('orga','org'), 'Test', 'Declined', date '2000-01-01', 'active', now());
-- And a fourth, in data, in no group.
insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status, consent_given_at, consent_version)
values (tests.uid('orga','athlete_loner'), tests.uid('orga','org'), 'Test', 'Loner', date '2000-01-01', 'active', now(), 'test');

-- ===========================================================================
-- 2. Shape
-- ===========================================================================

select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id, group_id, athlete_id)
          values (%L, %L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','test_sprint'), tests.uid('orga','group'), tests.uid('orga','athlete_1')),
  '23514', null, 'a row names a group or an athlete, never both'
);
select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id) values (%L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','test_sprint')),
  '23505', null, 'one live whole-squad row per definition'
);
select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id, group_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','test_sprint'), tests.uid('orgb','group')),
  'P0001', null, 'a group from another organisation is refused'
);
select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','test_sprint'), tests.uid('orgb','athlete_1')),
  'P0001', null, 'an athlete from another organisation is refused'
);
select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id) values (%L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orgb','test_b')),
  'P0001', null, 'a definition from another organisation is refused'
);

-- ===========================================================================
-- 3. Who writes, who reads
-- ===========================================================================

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');

-- The sprint's whole-squad row goes; the coach narrows it to Forwards + Loner.
select tests.set_jwt(tests.uid('orga','user_coach'));
update public.test_assignments set removed_at = now()
 where test_definition_id = tests.uid('orga','test_sprint') and group_id is null and athlete_id is null;
select is(
  (select count(*)::int from public.test_assignments where test_definition_id = tests.uid('orga','test_sprint') and removed_at is null),
  0, 'the coach retires the whole-squad row'
);
select lives_ok(
  format($q$insert into public.test_assignments (id, org_id, test_definition_id, group_id, created_by)
          values (%L, %L, %L, %L, %L)$q$,
         tests.uid('orga','ta_sprint_fwd'), tests.uid('orga','org'), tests.uid('orga','test_sprint'), tests.uid('orga','group'), tests.uid('orga','user_coach')),
  'the coach assigns the sprint to Forwards'
);
select lives_ok(
  format($q$insert into public.test_assignments (id, org_id, test_definition_id, athlete_id, created_by)
          values (%L, %L, %L, %L, %L)$q$,
         tests.uid('orga','ta_sprint_loner'), tests.uid('orga','org'), tests.uid('orga','test_sprint'), tests.uid('orga','athlete_loner'), tests.uid('orga','user_coach')),
  'and to one athlete directly'
);

select tests.set_jwt(tests.uid('orga','user_sc'));
select lives_ok(
  format($q$insert into public.test_assignments (id, org_id, test_definition_id, athlete_id, created_by)
          values (%L, %L, %L, %L, %L)$q$,
         tests.uid('orga','ta_cmj_a2'), tests.uid('orga','org'), tests.uid('orga','test_cmj'), tests.uid('orga','athlete_2'), tests.uid('orga','user_sc')),
  'the S&C assigns too (the roles that define a test)'
);
select tests.set_jwt(tests.uid('orga','user_nutritionist'));
select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id, athlete_id, created_by)
          values (%L, %L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','test_cmj'), tests.uid('orga','athlete_1'), tests.uid('orga','user_nutritionist')),
  '42501', null, 'the nutritionist is refused'
);
select is(
  (select count(*)::int from public.test_assignments where org_id = tests.uid('orga','org')),
  0, 'and reads none of it (testing is X for the nutritionist)'
);
select tests.set_jwt(tests.uid('orga','user_athlete_1'));
select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id, athlete_id)
          values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','test_cmj'), tests.uid('orga','athlete_1')),
  '42501', null, 'an athlete is refused'
);
select is((select count(*)::int from public.test_assignments), 0, 'and reads the table not at all');
select tests.set_jwt(tests.uid('orga','user_medical'));
select cmp_ok((select count(*)::int from public.test_assignments where org_id = tests.uid('orga','org')), '>', 0, 'the medic reads it');

-- ===========================================================================
-- 4. Who a test is assigned to
-- ===========================================================================

reset role;
select is(
  (select array_agg(id order by id) from public.test_assigned_athlete_ids(tests.uid('orga','test_cmj')) as t(id)),
  (select array_agg(id order by id) from (values (tests.uid('orga','athlete_1')), (tests.uid('orga','athlete_2')), (tests.uid('orga','athlete_loner'))) v(id)),
  'whole squad: every live athlete in data — the declined athlete is not assigned anything'
);
select is(
  (select array_agg(id order by id) from public.test_assigned_athlete_ids(tests.uid('orga','test_sprint')) as t(id)),
  (select array_agg(id order by id) from (values (tests.uid('orga','athlete_1')), (tests.uid('orga','athlete_2')), (tests.uid('orga','athlete_loner'))) v(id)),
  'Forwards (its two members) plus the one athlete named directly'
);

update public.group_memberships set removed_at = now()
 where group_id = tests.uid('orga','group') and athlete_id = tests.uid('orga','athlete_2');
select is(
  (select array_agg(id order by id) from public.test_assigned_athlete_ids(tests.uid('orga','test_sprint')) as t(id)),
  (select array_agg(id order by id) from (values (tests.uid('orga','athlete_1')), (tests.uid('orga','athlete_loner'))) v(id)),
  'an athlete who leaves the group leaves the assignment — evaluated against current membership'
);
update public.test_assignments set removed_at = now() where id = tests.uid('orga','ta_sprint_loner');
select is(
  (select array_agg(id order by id) from public.test_assigned_athlete_ids(tests.uid('orga','test_sprint')) as t(id)),
  (select array_agg(id order by id) from (values (tests.uid('orga','athlete_1'))) v(id)),
  'a removed assignment no longer counts'
);
select is(
  (select count(*)::int from public.test_assigned_athlete_ids(tests.uid('orgb','test_b'))),
  2, 'org B''s test, whole squad: org B''s two athletes and nobody of org A''s'
);

-- ===========================================================================
-- 5. The athlete's own list
-- ===========================================================================

set local role authenticated;
select tests.set_jwt(tests.uid('orga','user_athlete_1'));
select is(
  (select array_agg(test_definition_id order by test_definition_id) from public.resolve_my_assigned_tests(tests.uid('orga','athlete_1'))),
  (select array_agg(id order by id) from (values (tests.uid('orga','test_cmj')), (tests.uid('orga','test_sprint'))) v(id)),
  'athlete 1 reads their two tests'
);
select tests.set_jwt(tests.uid('orga','user_athlete_2'));
select is(
  (select array_agg(test_definition_id order by test_definition_id) from public.resolve_my_assigned_tests(tests.uid('orga','athlete_2'))),
  (select array_agg(id order by id) from (values (tests.uid('orga','test_cmj'))) v(id)),
  'athlete 2 reads one: the sprint is no longer theirs'
);
select is(
  (select count(*)::int from public.resolve_my_assigned_tests(tests.uid('orga','athlete_1'))),
  0, 'and nothing about a teammate'
);
select tests.set_jwt(tests.uid('orga','user_coach'));
select is(
  (select count(*)::int from public.resolve_my_assigned_tests(tests.uid('orga','athlete_1'))),
  2, 'staff read any athlete''s list in their org'
);
select tests.set_jwt(tests.uid('orgb','user_coach'));
select is(
  (select count(*)::int from public.resolve_my_assigned_tests(tests.uid('orga','athlete_1'))),
  0, 'and nothing about another organisation''s athlete'
);

-- ===========================================================================
-- 6. Cross-tenant write
-- ===========================================================================

select throws_ok(
  format($q$insert into public.test_assignments (org_id, test_definition_id, athlete_id, created_by)
          values (%L, %L, %L, %L)$q$,
         tests.uid('orgb','org'), tests.uid('orga','test_cmj'), tests.uid('orgb','athlete_1'), tests.uid('orgb','user_coach')),
  null, null, 'org B''s coach cannot assign org A''s test, whatever org_id they claim'
);

select * from finish();
rollback;
