-- Deleting a weigh-in: through delete_weigh_in(), soft, audited — and by whom,
-- and when.
--
-- REWRITTEN for migration 0131 (docs/decisions/body-mass-rule.md §3, Isabella,
-- 15 September 2026). Under 0084 this file proved a same-day hard delete whose
-- refusal was SILENT (a USING clause matching no row). Both halves changed:
-- the delete is a soft delete through one function, and a refusal RAISES, so a
-- screen is told. What stays: the four logging roles may remove what they
-- logged today (created_at, in the club's zone — the day it was typed, not
-- the day it describes), and the coach may not remove anything. What is new:
-- the sport scientist may delete a weigh-in of any age, and every delete is
-- an audit row by name.
--
-- 850_body_mass_rules_test.sql holds the rest of §3 (the edit window) and the
-- other sections; this file keeps the delete's own terms in one place.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare o uuid := tests.uid('orga','org'); a1 uuid := tests.uid('orga','athlete_1');
        a2 uuid := tests.uid('orga','athlete_2');
        u uuid := tests.uid('orga','user_sc');
begin
  /* One row per (athlete, day) since 0131's unique index, so the rows differ
     in the day they describe as well as the day they were logged; the pair
     that matters for the window is bc_today (logged now) and bc_old (logged
     three days ago), both the S&C's. */
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_today'), o, a1, current_date, 101.0, u, now());
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_old'), o, a1, current_date - 3, 102.0, u, now() - interval '3 days');
  /* Seeded here, as postgres, rather than in-test: the insert policy requires
     recorded_by = auth_user_id(), so seeding a row for another role from inside
     an authenticated session would fail on the WRITE and never reach the delete
     this file is about. */
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_nut'), o, a2, current_date, 103.0, tests.uid('orga','user_nutritionist'), now());
  insert into body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by, created_at)
    values (tests.uid('orga','bc_coach'), o, a2, current_date - 1, 104.0, tests.uid('orga','user_coach'), now());
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 0. The hard delete is gone
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$delete from body_composition where id = %L$q$, tests.uid('orga','bc_today')),
  '42501', null,
  'DELETE on the table is refused outright: 0084''s grant is revoked, the only way out is delete_weigh_in()'
);


-- ===========================================================================
-- 1. Today's entry: the S&C can remove it
-- ===========================================================================

select lives_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc_today')),
  'the S&C deletes a weigh-in logged today'
);
select is(
  (select count(*)::int from body_composition where id = tests.uid('orga','bc_today')),
  0,
  'and it is out of their own read'
);
reset role;
select is(
  (select (deleted_at is not null, deleted_by) from body_composition where id = tests.uid('orga','bc_today')),
  (true, tests.uid('orga','user_sc')),
  'soft: the row stays, marked, saying who'
);
select is(
  (select count(*)::int from audit_log where action = 'body_composition.delete' and entity_id = tests.uid('orga','bc_today')
     and actor_id = tests.uid('orga','user_sc') and (metadata ->> 'any_time')::boolean = false),
  1,
  'audited by name, and the row says it was the same-day path, not the sport scientist''s'
);
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');


-- ===========================================================================
-- 2. An entry logged three days ago: refused, and LOUDLY
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc_old')),
  'P0001', 'weigh_in_delete_not_permitted',
  'the S&C may not delete an entry logged three days ago — and is told so, not shown a silent no-op'
);
select is(
  (select body_mass_kg from body_composition where id = tests.uid('orga','bc_old')),
  102.0::numeric,
  'the row is still there — asserted on the row, not on the absence of an error'
);


-- ===========================================================================
-- 3. The sport scientist may, at any time
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc_old')),
  'the sport scientist deletes the three-day-old entry (body-mass-rule.md §3: the escape hatch for a typo noticed later)'
);
reset role;
select is(
  (select count(*)::int from audit_log where action = 'body_composition.delete' and entity_id = tests.uid('orga','bc_old')
     and actor_id = tests.uid('orga','user_admin') and (metadata ->> 'any_time')::boolean = true),
  1,
  'audited as the sport scientist''s any-time delete'
);
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');


-- ===========================================================================
-- 4. The nutritionist may too; the coach may not; nor may the athlete
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc_coach')),
  'P0001', null,
  'the COACH cannot delete even an entry recorded under their name — they cannot log or edit one either (WEIGH_IN_EDIT)'
);

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select lives_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc_nut')),
  'the nutritionist can — body mass is theirs to keep, and so is a mistake in it'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select throws_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc_coach')),
  'P0001', null,
  'the athlete cannot delete their own weigh-in'
);

select * from finish();
rollback;
