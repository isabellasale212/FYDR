-- Who may create, edit and archive a squad group.
--
-- The specification confirms this on screens 55, 56 and 57 as a firm decision:
-- the sport scientist and the coach, with the medic, S&C and nutritionist view
-- only. It was enforced nowhere. /settings/groups/new and
-- /settings/groups/[groupId] had no role check at all, and groups' own policies
-- admitted the medic, so the database would not have caught what the screens let
-- through either.
--
-- Membership is asserted here too, and deliberately NOT as the same rule. It has
-- its own carve-out for rehab groups, which predates this decision. Keeping both
-- in one file is the point: the next person to "simplify" these into a single
-- set has to delete an assertion that says why they are different.

begin;
select * from no_plan();

select tests.fixtures();

-- A rehab group and a non-rehab group, seeded before the role switch so the
-- membership assertions have both types to work with.
insert into groups (id, org_id, name, group_type)
values (tests.uid('orga','grp_training'), tests.uid('orga','org'), 'Backs unit', 'training'),
       (tests.uid('orga','grp_rehab'), tests.uid('orga','org'), 'Return to play', 'rehab');

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. Creating a group
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into groups (org_id, name, group_type) values (%L, 'SS group', 'custom')$q$,
         tests.uid('orga','org')),
  'the sport scientist creates a group'
);
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into groups (org_id, name, group_type) values (%L, 'Coach group', 'custom')$q$,
         tests.uid('orga','org')),
  'and the coach'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into groups (org_id, name, group_type) values (%L, 'Medic group', 'custom')$q$,
         tests.uid('orga','org')),
  '42501', null,
  'the MEDIC cannot — narrowed 2026-09-06, this role could before'
);
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$insert into groups (org_id, name, group_type) values (%L, 'SC group', 'custom')$q$,
         tests.uid('orga','org')),
  '42501', null,
  'nor the S&C'
);
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select throws_ok(
  format($q$insert into groups (org_id, name, group_type) values (%L, 'Nut group', 'custom')$q$,
         tests.uid('orga','org')),
  '42501', null,
  'nor the nutritionist'
);


-- ===========================================================================
-- 2. Renaming and archiving. Archive IS the delete: there is no DELETE policy,
--    because a group is retired rather than erased.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update groups set name = 'Backs unit renamed' where id = %L$q$, tests.uid('orga','grp_training')),
  'the coach renames a group'
);
/* Archiving sets deleted_at, not an archived_at column: queries/groups.ts's
   archiveGroup is the definition. Worth recording that its refusal message
   already read "belongs to the coach and the sport scientist" while the policy
   still admitted the medic — the sentence was right and the rule was not. */
select lives_ok(
  format($q$update groups set deleted_at = now() where id = %L$q$, tests.uid('orga','grp_training')),
  'and archives one — which is what "delete" means here'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$update groups set name = 'Medic rename' where id = %L$q$, tests.uid('orga','grp_rehab')),
  'the medic''s rename is not refused by privilege — the UPDATE grant exists, so RLS is what holds'
);
select is(
  (select name from groups where id = tests.uid('orga','grp_rehab')),
  'Return to play',
  'and it moved NOTHING: the medic cannot rename a group'
);

select is(
  (select count(*) from pg_policies where tablename = 'groups' and cmd = 'DELETE')::int,
  0,
  'there is no DELETE policy on groups at all — retired, never erased'
);


-- ===========================================================================
-- 3. Membership is a DIFFERENT rule, with a rehab carve-out
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into group_memberships (org_id, group_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','grp_training'), tests.uid('orga','athlete_1')),
  'the coach adds an athlete to a NON-rehab group'
);
select throws_ok(
  format($q$insert into group_memberships (org_id, group_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','grp_rehab'), tests.uid('orga','athlete_1')),
  '42501', null,
  'but NOT to a rehab group — the carve-out this decision does not touch'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into group_memberships (org_id, group_id, athlete_id) values (%L, %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','grp_rehab'), tests.uid('orga','athlete_2')),
  'the medic does, which is why membership was left alone: view-only on the group does not mean view-only on rehab allocation'
);


-- ===========================================================================
-- 4. Everyone still READS the structure
-- ===========================================================================

select is(
  (select count(*) from pg_policies where tablename = 'groups' and cmd = 'SELECT'
     and coalesce(qual, '') like '%app_role%')::int,
  0,
  'the SELECT policy names no role: group structure is readable by the whole organisation'
);
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select cmp_ok((select count(*) from groups where org_id = tests.uid('orga','org')),
  '>', 0::bigint, 'so the nutritionist still reads groups — the filters depend on it');

select * from finish();
rollback;
