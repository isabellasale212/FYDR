-- 260_meal_library_test.sql
--
-- migration 0051's own header explains why this table exists, why it is org-scoped only
-- (O-892) and why its RLS split (coach write, medical read-only, admin and athlete no
-- access) differs from nutrition_rules' personal-scope medical carve-out. This file
-- tests that split plus the org-scoped meal -> items relationship and soft delete.
--
-- Which rules this implements
--   Coach: full write on meal_library (any meal in their org) and meal_library_items
--     (any meal's items, in their org).
--   Medical: read-only on both tables, no write path at all.
--   Admin: no access to either table, at all — 01-roles-and-permissions.md §1's
--     "admin never sees performance-domain detail" carve-out.
--   Athlete: no access to either table, at all — CLAUDE.md §2 rule 8, this is
--     coach/medical-authored content, never athlete-writable.
--   Soft delete: a coach sets meal_library.deleted_at via UPDATE; no role has a DELETE
--     grant or policy on either table (CLAUDE.md rule 4).
--   Cross-tenant: orgb cannot read or write into orga's library or its items, including
--     an orgb coach trying to attach an item to one of orga's real meal ids.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. Writes: coach full, medical/athlete/admin none
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Athlete attempt', '08:00', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot create a meal'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Admin attempt', '08:00', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_admin')),
  '42501', null,
  'an admin cannot create a meal either — no performance-domain detail by default'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Medical attempt', '08:00', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_medical')),
  '42501', null,
  'medical reads the library for context but does not author it — no write path at all'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into meal_library (id, org_id, name, time_label, created_by)
            values (%L, %L, 'Breakfast, high carb', '07:00', %L)$q$,
         tests.uid('orga','meal_1'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a coach creates a meal'
);
select lives_ok(
  format($q$insert into meal_library (id, org_id, name, time_label, created_by)
            values (%L, %L, 'Post-training shake', '17:45', %L)$q$,
         tests.uid('orga','meal_2'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a coach creates a second meal'
);


-- ===========================================================================
-- 2. Items: coach full write scoped to a real meal in their own org, medical
--    and athlete cannot write items either
-- ===========================================================================

select lives_ok(
  format($q$insert into meal_library_items (org_id, meal_id, sequence, name, qty, unit, protein_g, carb_g, fat_g)
            values (%L, %L, 0, 'Porridge oats', 120, 'g', 13, 80, 9)$q$,
         tests.uid('orga','org'), tests.uid('orga','meal_1')),
  'a coach adds an item to their own meal'
);
select lives_ok(
  format($q$insert into meal_library_items (org_id, meal_id, sequence, name, qty, unit, protein_g, carb_g, fat_g)
            values (%L, %L, 1, 'Whole milk', 400, 'ml', 14, 19, 15)$q$,
         tests.uid('orga','org'), tests.uid('orga','meal_1')),
  'a coach adds a second item to the same meal'
);
select throws_ok(
  format($q$insert into meal_library_items (org_id, meal_id, sequence, name, qty, unit, protein_g, carb_g, fat_g)
            values (%L, %L, 0, 'Bad quantity', -5, 'g', 0, 0, 0)$q$,
         tests.uid('orga','org'), tests.uid('orga','meal_1')),
  '23514', null,
  'a non-positive quantity is rejected by the check constraint'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into meal_library_items (org_id, meal_id, sequence, name, qty, unit, protein_g, carb_g, fat_g)
            values (%L, %L, 2, 'Medical attempt', 100, 'g', 1, 1, 1)$q$,
         tests.uid('orga','org'), tests.uid('orga','meal_1')),
  '42501', null,
  'medical cannot add an item either'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into meal_library_items (org_id, meal_id, sequence, name, qty, unit, protein_g, carb_g, fat_g)
            values (%L, %L, 2, 'Athlete attempt', 100, 'g', 1, 1, 1)$q$,
         tests.uid('orga','org'), tests.uid('orga','meal_1')),
  '42501', null,
  'an athlete cannot add an item'
);


-- ===========================================================================
-- 3. Reads: coach and medical see every meal and item in the org, athlete and
--    admin see none
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from meal_library where org_id = tests.uid('orga','org')),
  2::bigint,
  'a coach reads both meals'
);
select is(
  (select count(*) from meal_library_items where org_id = tests.uid('orga','org')),
  2::bigint,
  'a coach reads both items'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from meal_library where org_id = tests.uid('orga','org')),
  2::bigint,
  'medical reads both meals too — the library is not clinical, it is read for context'
);
select is(
  (select count(*) from meal_library_items where org_id = tests.uid('orga','org')),
  2::bigint,
  'medical reads both items too'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from meal_library where org_id = tests.uid('orga','org')),
  0::bigint,
  'an athlete reads zero meals — no access at all, this is never athlete-facing logging'
);
select is(
  (select count(*) from meal_library_items where org_id = tests.uid('orga','org')),
  0::bigint,
  'an athlete reads zero items'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from meal_library where org_id = tests.uid('orga','org')),
  0::bigint,
  'an admin reads zero meals — no performance-domain detail by default'
);
select is(
  (select count(*) from meal_library_items where org_id = tests.uid('orga','org')),
  0::bigint,
  'an admin reads zero items'
);


-- ===========================================================================
-- 4. Soft delete: coach can retire a meal via UPDATE, nobody else can, and
--    there is no DELETE path for anyone
-- ===========================================================================

-- An UPDATE a policy filters out does not raise, it changes zero rows (correct
-- PostgreSQL behaviour, per tests.rows_affected's own header) — a row-count
-- assertion, not a throws_ok.
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  tests.rows_affected(
    format($q$update meal_library set deleted_at = now() where id = %L$q$, tests.uid('orga','meal_2'))
  ),
  0::bigint,
  'medical cannot soft-delete a meal — no update policy for medical at all, so the row is simply not matched'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update meal_library set deleted_at = now() where id = %L$q$, tests.uid('orga','meal_2')),
  'a coach soft-deletes their own org''s meal'
);
select is(
  (select count(*) from meal_library where org_id = tests.uid('orga','org') and deleted_at is null),
  1::bigint,
  'one live meal remains after the soft delete'
);

select throws_ok(
  format($q$delete from meal_library where id = %L$q$, tests.uid('orga','meal_2')),
  '42501', null,
  'nobody can hard-delete a meal — no delete policy and no delete grant, CLAUDE.md rule 4'
);
select throws_ok(
  format($q$delete from meal_library_items where meal_id = %L$q$, tests.uid('orga','meal_1')),
  '42501', null,
  'nobody can hard-delete an item either'
);


-- ===========================================================================
-- 5. Cross-tenant: orgb cannot read orga's library, and cannot write into it
--    even naming orga's real meal id explicitly
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is(
  (select count(*) from meal_library where org_id = tests.uid('orga','org')),
  0::bigint,
  'orgb''s coach cannot see orga''s meals at all'
);
select is(
  (select count(*) from meal_library_items where org_id = tests.uid('orga','org')),
  0::bigint,
  'orgb''s coach cannot see orga''s items at all'
);
select throws_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Cross-tenant attempt', '08:00', %L)$q$,
         tests.uid('orga','org'), tests.uid('orgb','user_coach')),
  '42501', null,
  'orgb''s coach cannot create a meal inside orga naming orga''s own org_id explicitly'
);
select throws_ok(
  format($q$insert into meal_library_items (org_id, meal_id, sequence, name, qty, unit, protein_g, carb_g, fat_g)
            values (%L, %L, 9, 'Cross-tenant item', 100, 'g', 1, 1, 1)$q$,
         tests.uid('orga','org'), tests.uid('orga','meal_1')),
  '42501', null,
  'orgb''s coach cannot attach an item to orga''s real meal_1, naming orga''s org_id explicitly'
);
select throws_ok(
  format($q$insert into meal_library_items (org_id, meal_id, sequence, name, qty, unit, protein_g, carb_g, fat_g)
            values (%L, %L, 9, 'Cross-tenant item, own org_id', 100, 'g', 1, 1, 1)$q$,
         tests.uid('orgb','org'), tests.uid('orga','meal_1')),
  '42501', null,
  'orgb''s coach cannot attach an item to orga''s real meal_1 even naming orgb''s own org_id — the parent-meal exists() check fails to find meal_1 under orgb'
);

select * from finish();
rollback;
