-- 180_week_templates_test.sql
--
-- week_templates (migration 0003) and its RLS (migration 0012) had zero
-- pgTAP coverage — real schema, real grants, no application code had ever
-- read or written the table until the MD-n planner (screens/md-planner.md)
-- gave it one. Unlike groups, admin has no access here (screens/md-planner.md's
-- own role table: "Admin | No access"), matching the real RLS predicate
-- exactly (auth_has_any_role(array['coach','medical'])) — admin is
-- deliberately absent from that array, not an oversight to fix.
-- Also covers sessions.applied_template_id (migration 0037), added
-- alongside this feature.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. create: coach or medical only. Not athlete, not admin.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into week_templates (org_id, name, structure) values (%L, 'Standard week', '{}'::jsonb)$q$,
         tests.uid('orga','org')),
  '42501', null,
  'an athlete cannot create a week template'
);

/* Was a refusal, on the reasoning that "the real RLS predicate names coach and
   medical only". That predicate meant "any staff" in the four-role model and
   0066 widened it, so the sport scientist creates templates now. A distinct
   name, because the coach creates 'Standard week' further down and the two
   would collide. */
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into week_templates (org_id, name, structure) values (%L, 'Sport scientist week', '{}'::jsonb)$q$,
         tests.uid('orga','org')),
  'a sport scientist CAN create a week template'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into week_templates (id, org_id, name, structure)
            values (%L, %L, 'Standard 1-game week', '{"version":2,"days":[]}'::jsonb)$q$,
         tests.uid('orga','template_standard'), tests.uid('orga','org')),
  'a coach creates a week template'
);


-- ===========================================================================
-- 2. read and update: medical shares full write, same as coach — the real
--    RLS has no coach-owns/medical-owns split for this table, unlike
--    programmes. screens/md-planner.md's narrower "medical is read-only
--    except rehab-only templates" rule is a client-side courtesy the UI
--    applies on top; it is not enforced at the database and this test
--    verifies the database's real, coarser rule rather than asserting a
--    restriction that does not actually exist yet.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select isnt(
  (select id from week_templates where id = tests.uid('orga','template_standard')),
  null,
  'medical can read the coach''s template'
);
/* G-33 row 5, decided 2026-09-05: the medic loses scheduling. A week template
   is scheduling under another name, so this assertion has inverted. It used to
   read "medical can also write it, the real RLS grants both roles equally",
   which was true and was the artefact: coach-or-medic meant not-admin.

   rows_affected, not lives_ok. An UPDATE that RLS filters out does not raise:
   it matches nothing and succeeds quietly, so lives_ok would still pass here
   and prove nothing at all. Counting the rows is what tells a refusal from a
   no-op, and this whole block was only caught because a later assertion read
   the name back. */
select is(
  tests.rows_affected(
    format($q$update week_templates set name = 'Standard 1-game week (edited)' where id = %L$q$,
           tests.uid('orga','template_standard'))),
  0::bigint,
  'medical can no longer write it: the update matches no row rather than erroring'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from week_templates where id = tests.uid('orga','template_standard')),
  0::bigint,
  'an athlete cannot see a week template at all — not on any athlete route, per week_templates_staff_select''s own comment'
);


-- ===========================================================================
-- 3. cross-tenant isolation
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is(
  (select count(*) from week_templates where id = tests.uid('orga','template_standard')),
  0::bigint,
  'orgb''s coach cannot see orga''s template at all'
);
select lives_ok(
  format($q$update week_templates set name = 'Stolen' where id = %L$q$, tests.uid('orga','template_standard')),
  'the statement does not error for orgb''s coach either — org_id scoping filters the row, not a raised error'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select name from week_templates where id = tests.uid('orga','template_standard')),
  'Standard 1-game week',
  'and back in orga, the name is the coach''s original: neither orgb''s coach '
  'nor orga''s own medic changed it'
);


-- ===========================================================================
-- 4. sessions.applied_template_id (migration 0037) — a session created from
--    a template links back to it, and that link is readable under the
--    same RLS every other session column already has.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update sessions set template_key = 'b3f1c2', applied_template_id = %L
            where id = %L$q$,
         tests.uid('orga','template_standard'), tests.uid('orga','session')),
  'a coach links a real session back to the template that created it'
);
select is(
  (select applied_template_id from sessions where id = tests.uid('orga','session')),
  tests.uid('orga','template_standard'),
  'the link reads back correctly'
);

select * from finish();
rollback;
