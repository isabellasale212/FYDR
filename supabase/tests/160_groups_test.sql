-- 160_groups_test.sql
--
-- groups (migration 0009-era schema, RLS in migration 0012) had zero pgTAP
-- coverage anywhere in this suite despite CLAUDE.md §3 calling the group
-- filter "the single most-repeated instruction on the original design" —
-- found while adding updateGroup() (lib/queries/groups.ts), the
-- rename/recolour/redescribe path screens/groups.md's role table promises
-- and this codebase never actually built until now. Covers create, the
-- new update path (staff write, athlete read-only, cross-tenant isolation),
-- and archive/restore, none of which had a test before this file.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. create: staff (coach/medical/admin) only
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into groups (org_id, name, group_type) values (%L, 'Backs', 'positional')$q$,
         tests.uid('orga','org')),
  '42501', null,
  'an athlete cannot create a group'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into groups (id, org_id, name, description, colour, group_type)
            values (%L, %L, 'Backs', 'The other half of the squad', 'Green', 'positional')$q$,
         tests.uid('orga','group_backs'), tests.uid('orga','org')),
  'a coach creates a group'
);


-- ===========================================================================
-- 2. update: the rename/recolour/redescribe path updateGroup() adds.
--    Staff write, same three roles as create — no coach-owns/medical-owns
--    split here, matching test_definitions and body_composition's own
--    shared-staff shape rather than programmes' role-split one.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$update groups set name = 'Hijacked' where id = %L$q$, tests.uid('orga','group_backs')),
  'the statement itself does not error — the staff-only USING clause just filters the row to zero matches, same as any other row-scoped update'
);
select is(
  (select name from groups where id = tests.uid('orga','group_backs')),
  'Backs',
  'athlete''s attempted rename matched zero rows under RLS — the group is untouched'
);

/* The MEDIC made this edit until 2026-09-06. Screens 55-57 confirm group
   management as the sport scientist's and the coach's, with the medic, S&C and
   nutritionist view only, and migration 0078 narrows groups' own policies to
   match. The medic's refusal is asserted in 380_group_management_test.sql; here
   the edit is simply made by a role that still owns it, so the rest of this
   section keeps testing what it was written to test — that all three fields move
   together in one write. */
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update groups set name = 'Backs (Senior)', description = 'Backline, first team', colour = 'Cyan'
            where id = %L$q$,
         tests.uid('orga','group_backs')),
  'the coach renames, redescribes and recolours the group'
);
select is(
  (select name from groups where id = tests.uid('orga','group_backs')),
  'Backs (Senior)',
  'the rename landed'
);
select is(
  (select description from groups where id = tests.uid('orga','group_backs')),
  'Backline, first team',
  'the redescribe landed'
);
select is(
  (select colour from groups where id = tests.uid('orga','group_backs')),
  'Cyan',
  'the recolour landed too — all three fields changed together in one write'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$update groups set colour = 'Indigo' where id = %L$q$, tests.uid('orga','group_backs')),
  'admin recolours it again — the third of the three staff roles this table grants write to'
);

-- Cross-tenant: orgb's admin must not be able to reach orga's group at all.
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select lives_ok(
  format($q$update groups set name = 'Stolen' where id = %L$q$, tests.uid('orga','group_backs')),
  'the statement does not error for orgb''s admin either — org_id scoping filters the row, not a raised error'
);
select is(
  (select count(*) from groups where id = tests.uid('orga','group_backs')),
  0::bigint,
  'orgb''s admin cannot even see the row exists, same select-scoping every other table in this suite has'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select name from groups where id = tests.uid('orga','group_backs')),
  'Backs (Senior)',
  'and back in orga, the name orgb''s admin tried to overwrite is untouched — org_id is the boundary, not role'
);


-- ===========================================================================
-- 3. archive / restore: deleted_at toggled, the row itself never removed —
--    GroupArchiveButton's own mutations, also uncovered until now.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update groups set deleted_at = now() where id = %L$q$, tests.uid('orga','group_backs')),
  'a coach archives the group'
);
select isnt(
  (select deleted_at from groups where id = tests.uid('orga','group_backs')),
  null,
  'deleted_at is set'
);
select lives_ok(
  format($q$update groups set deleted_at = null where id = %L$q$, tests.uid('orga','group_backs')),
  'and restores it'
);
select is(
  (select deleted_at from groups where id = tests.uid('orga','group_backs')),
  null,
  'deleted_at is cleared — a restore, never a second row'
);

select * from finish();
rollback;
