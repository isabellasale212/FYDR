-- 050_rehab_groups_test.sql
--
-- migration 0018's own header explains why this feature exists and what it deliberately
-- does not. This file tests the part that actually matters: the one rule
-- screens/rehab-groups.md treats as non-negotiable, "Only medical allocates", enforced
-- at the RLS layer on two tables at once (group_memberships when the target group is a
-- rehab group, and rehab_assignments unconditionally), plus the interval invariant on
-- rehab_assignments.
--
-- Which rules this implements
--   A coach cannot write a group_memberships row for a rehab group. A coach keeps every
--     other group-management ability untouched (the regression this migration exists
--     not to cause).
--   Only medical may insert or update rehab_assignments.
--   An athlete has no access to rehab_assignments at all, not even their own.
--   An athlete in a rehab group is not directly reachable through this table's RLS —
--     cross-tenant isolation for rehab_assignments itself is covered generically by
--     020_cross_tenant_test.sql via tests.club_tables(), not repeated here.
--   At most one open rehab_assignments row per athlete, enforced by the migration's
--     partial unique index.

begin;
select * from no_plan();

select tests.fixtures();

-- Extra fixture data this file needs: tests.fixtures() gives orga a rehab-eligible
-- athlete already (athlete_1 / James Barnes, availability 'modified' from the shared
-- injury fixture) but no rehab group to allocate them to. Seeded here, elevated, before
-- the role switch hands control to RLS for every assertion that follows.
do $$
declare
  o    uuid := tests.uid('orga', 'org');
  grp  uuid := tests.uid('orga', 'rehab_group');
begin
  insert into groups (id, org_id, name, group_type) values (grp, o, 'Rehab A', 'rehab');
end $$;

set local role authenticated;


-- ===========================================================================
-- 1. group_memberships: a rehab group is medical only to write to
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select throws_ok(
  format($q$insert into group_memberships (org_id, group_id, athlete_id)
            values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','rehab_group'), tests.uid('orga','athlete_1')),
  '42501', null,
  'a coach cannot allocate an athlete to a rehab group'
);

-- The regression this migration must not cause: a coach still manages an ordinary
-- group exactly as before. tests.fixtures() already put athlete_2 in the Forwards
-- group; removing them and re-adding athlete_1 to a fresh positional group covers both
-- the update and the insert path a coach actually uses day to day.
select lives_ok(
  format($q$update group_memberships set removed_at = now()
            where org_id = %L and group_id = %L and athlete_id = %L and removed_at is null$q$,
         tests.uid('orga','org'), tests.uid('orga','group'), tests.uid('orga','athlete_2')),
  'a coach can still remove an athlete from an ordinary, non-rehab group'
);
-- added_at defaults to now(), and the whole suite runs inside one transaction, so a
-- bare now() here would collide with the fixture row's own added_at on the table's
-- (group_id, athlete_id, added_at) unique constraint from 0002 — not a product bug,
-- just this test needing a distinct instant the way a real re-add, minutes apart,
-- would get for free.
select lives_ok(
  format($q$insert into group_memberships (org_id, group_id, athlete_id, added_at)
            values (%L, %L, %L, now() + interval '1 second')$q$,
         tests.uid('orga','org'), tests.uid('orga','group'), tests.uid('orga','athlete_2')),
  'a coach can still add an athlete to an ordinary, non-rehab group'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select lives_ok(
  format($q$insert into group_memberships (org_id, group_id, athlete_id)
            values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','rehab_group'), tests.uid('orga','athlete_1')),
  'medical allocates an athlete to a rehab group'
);


-- ===========================================================================
-- 2. rehab_assignments: medical writes, coach and medical read, athlete reads nothing
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select throws_ok(
  format($q$insert into rehab_assignments (org_id, athlete_id, rehab_group_id, phase, set_by)
            values (%L, %L, %L, 'Phase 2', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','rehab_group'),
         tests.uid('orga','user_coach')),
  '42501', null,
  'a coach cannot set a rehab phase'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select lives_ok(
  format($q$insert into rehab_assignments (org_id, athlete_id, rehab_group_id, phase, set_by)
            values (%L, %L, %L, 'Phase 2', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','rehab_group'),
         tests.uid('orga','user_medical')),
  'medical sets a rehab phase'
);

select throws_ok(
  format($q$insert into rehab_assignments (org_id, athlete_id, rehab_group_id, phase, set_by)
            values (%L, %L, %L, 'Phase 3', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','rehab_group'),
         tests.uid('orga','user_medical')),
  '23505', null,
  'a second open rehab_assignments row for the same athlete is refused, not silently allowed'
);

select lives_ok(
  format($q$update rehab_assignments set effective_to = now()
            where org_id = %L and athlete_id = %L and effective_to is null$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1')),
  'medical closes the open interval'
);
select lives_ok(
  format($q$insert into rehab_assignments (org_id, athlete_id, rehab_group_id, phase, set_by)
            values (%L, %L, %L, 'Phase 3', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','rehab_group'),
         tests.uid('orga','user_medical')),
  'and opens a new one once the old one is closed — the interval pattern, not a raw edit'
);

select is(
  (select count(*) from rehab_assignments where org_id = tests.uid('orga','org')),
  2::bigint,
  'both the closed and the current row are still there — history preserved, nothing deleted'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from rehab_assignments where org_id = tests.uid('orga','org')),
  2::bigint,
  'a coach reads rehab phase history — non-clinical, the same boundary as availability'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from rehab_assignments where org_id = tests.uid('orga','org')),
  0::bigint,
  'an athlete reads zero rehab_assignments rows, even their own — no self-select policy exists yet'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from rehab_assignments where org_id = tests.uid('orga','org')),
  0::bigint,
  'an admin reads zero rehab_assignments rows, same as every other clinical-adjacent table'
);

select * from finish();
rollback;
