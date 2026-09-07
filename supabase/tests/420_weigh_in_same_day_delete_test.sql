-- Deleting a weigh-in: today's only, and by the four roles that may log one.
--
-- THE REFUSAL HERE IS SILENT, and that is the point of asserting it as a count.
-- The policy gates in USING, so a DELETE that fails it raises nothing at all —
-- it matches no row and the statement succeeds. throws_ok would pass only when
-- the GRANT is missing, which is a different fact, and a screen checking only
-- for an error would report yesterday's entry as deleted.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare o uuid := tests.uid('orga','org'); a1 uuid := tests.uid('orga','athlete_1');
        u uuid := tests.uid('orga','user_sc');
begin
  /* Two rows that differ ONLY in when they were logged. Same athlete, same
     measured_on, so nothing but created_at can explain a different outcome. */
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_today'), o, a1, current_date, 101.0, u, now());
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_old'), o, a1, current_date, 102.0, u, now() - interval '3 days');
  /* Seeded here, as postgres, rather than in-test: the insert policy requires
     recorded_by = auth_user_id(), so seeding a row for another role from inside
     an authenticated session would fail on the WRITE and never reach the delete
     this file is about. */
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_nut'), o, a1, current_date, 103.0, tests.uid('orga','user_nutritionist'), now());
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_coach'), o, a1, current_date, 104.0, tests.uid('orga','user_coach'), now());
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');

/* Created AFTER the role switch, or the authenticated role cannot write to it.
   A data-modifying CTE must sit at the top level, so affected-row counts are
   captured here rather than read from a subquery. */
create temp table del(who text, n bigint);


-- ===========================================================================
-- 1. Today's entry: the S&C can remove it
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));
with d as (delete from body_composition where id = tests.uid('orga','bc_today') returning 1)
insert into del select 'sc_today', count(*) from d;
select is((select n from del where who = 'sc_today'), 1::bigint,
  'the S&C deletes a weigh-in logged today');


-- ===========================================================================
-- 2. An entry logged three days ago: refused, and SILENTLY
-- ===========================================================================

select lives_ok(
  format($q$delete from body_composition where id = %L$q$, tests.uid('orga','bc_old')),
  'deleting an older entry raises NOTHING — the USING clause simply matches no row'
);
with d as (delete from body_composition where id = tests.uid('orga','bc_old') returning 1)
insert into del select 'sc_old', count(*) from d;
select is((select n from del where who = 'sc_old'), 0::bigint,
  'and removes zero rows. This is the silent shape a screen must not read as success');
select is(
  (select body_mass_kg from body_composition where id = tests.uid('orga','bc_old')),
  102.0::numeric,
  'the row is still there — asserted on the row, not on the absence of an error'
);


-- ===========================================================================
-- 3. The nutritionist may too; the coach may not
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
with d as (delete from body_composition where id = tests.uid('orga','bc_coach') returning 1)
insert into del select 'coach_today', count(*) from d;
select is((select n from del where who = 'coach_today'), 0::bigint,
  'the COACH cannot delete even today''s entry — they cannot log or edit one either (WEIGH_IN_EDIT)');

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
with d as (delete from body_composition where id = tests.uid('orga','bc_nut') returning 1)
insert into del select 'nut_today', count(*) from d;
select is((select n from del where who = 'nut_today'), 1::bigint,
  'the nutritionist can — body mass is theirs to keep, and so is a mistake in it');

select * from finish();
rollback;
