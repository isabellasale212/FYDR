-- 250_suspend_assignments_for_rehab_test.sql
--
-- Migration 0050's own header explains the defect this closes: assignProgramme()'s rehab
-- carve-out (CLAUDE.md §6, "assigning a rehab programme suspends the athlete's active gym
-- assignment rather than cancelling it") was unconditionally rejected by RLS, because
-- programme_assignments_update's WITH CHECK (migration 0022) requires a medical actor's
-- row to resolve to programme_type = 'rehab' via its OWN programme_id — true for the new
-- rehab row, never true for the existing gym/conditioning/nutrition row being suspended.
-- suspend_assignments_for_rehab is the narrow SECURITY DEFINER function that replaces the
-- plain client UPDATE assignProgramme() used to attempt.
--
-- Which rules this implements
--   CLAUDE.md §6's rehab exception, migration 0050's own header
--   CLAUDE.md §5: "Write the test for a permission rule before the rule" — this function
--     is reachable by any authenticated caller (grant execute ... to authenticated) and
--     does its own role/org/programme_type checks in the function body, not via RLS, so
--     those checks have no other test coverage anywhere in this suite.
--   070_programmes_test.sql's own split (coach owns gym, medical owns rehab) — re-asserted
--     here as "only medical may suspend for a rehab assignment", not re-proved in general.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o        uuid := tests.uid('orga', 'org');
  a1       uuid := tests.uid('orga', 'athlete_1');
  a2       uuid := tests.uid('orga', 'athlete_2');
  ucoa     uuid := tests.uid('orga', 'user_coach');
  umed     uuid := tests.uid('orga', 'user_medical');
  prog_gym uuid := tests.uid('orga', 'prog_gym');
  prog_reh uuid := tests.uid('orga', 'prog_rehab');
begin
  insert into programmes (id, org_id, name, programme_type, status, created_by) values
    (prog_gym, o, 'Pre-season strength', 'gym',   'active', ucoa),
    (prog_reh, o, 'Return to running',   'rehab', 'active', umed);

  -- athlete_1: an active gym assignment, the one the rehab assignment should suspend.
  insert into programme_assignments (id, org_id, programme_id, athlete_id, starts_on, status)
    values (tests.uid('orga','assign_a1_gym'), o, prog_gym, a1, current_date, 'active');

  -- athlete_2: an identical active gym assignment on the SAME programme, used to prove the
  -- function scopes by athlete_id, not just org_id — suspending athlete_1's must not touch it.
  insert into programme_assignments (id, org_id, programme_id, athlete_id, starts_on, status)
    values (tests.uid('orga','assign_a2_gym'), o, prog_gym, a2, current_date, 'active');
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. Role check: only medical may call this, matching medical's exclusive
--    rehab-authoring lane (070_programmes_test.sql, section 2).
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$select suspend_assignments_for_rehab(%L, %L)$q$,
         tests.uid('orga','athlete_1'), tests.uid('orga','prog_rehab')),
  'P0001', 'not_permitted',
  'an athlete cannot suspend their own assignments via this function'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$select suspend_assignments_for_rehab(%L, %L)$q$,
         tests.uid('orga','athlete_1'), tests.uid('orga','prog_rehab')),
  'P0001', 'not_permitted',
  'a coach cannot call this either — rehab assignment is medical''s exclusive action, the '
  'same split 070_programmes_test.sql proves for authoring the programme itself'
);


-- ===========================================================================
-- 2. Precondition: p_rehab_programme_id must actually resolve to a rehab
--    programme in the caller's own org — never a general suspend-anything escape hatch.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$select suspend_assignments_for_rehab(%L, %L)$q$,
         tests.uid('orga','athlete_1'), tests.uid('orga','prog_gym')),
  'P0001', 'not_a_rehab_programme',
  'medical cannot use this to suspend assignments by naming a gym programme — the target '
  'must genuinely be a rehab programme'
);

select throws_ok(
  format($q$select suspend_assignments_for_rehab(%L, gen_random_uuid())$q$,
         tests.uid('orga','athlete_1')),
  'P0001', 'not_a_rehab_programme',
  'a programme id that does not exist at all is refused the same way as a real gym one'
);


-- ===========================================================================
-- 3. The real path: medical assigns a rehab programme, athlete_1's existing
--    active gym assignment is suspended with the documented reason.
-- ===========================================================================

select lives_ok(
  format($q$select suspend_assignments_for_rehab(%L, %L)$q$,
         tests.uid('orga','athlete_1'), tests.uid('orga','prog_rehab')),
  'medical suspends athlete_1''s active non-rehab assignments ahead of a rehab assignment'
);

select is(
  (select status from programme_assignments where id = tests.uid('orga','assign_a1_gym')),
  'suspended',
  'athlete_1''s gym assignment is now suspended'
);
select is(
  (select suspended_reason from programme_assignments where id = tests.uid('orga','assign_a1_gym')),
  'Rehab programme assigned',
  'the suspension reason matches what assignProgramme() (and the screen) expects to show'
);

select is(
  (select status from programme_assignments where id = tests.uid('orga','assign_a2_gym')),
  'active',
  'athlete_2''s identical assignment on the same programme is untouched — scoped by '
  'athlete_id, not just org_id or programme_id'
);


-- ===========================================================================
-- 4. Idempotence / no self-suspend: calling it again with the same rehab
--    programme does nothing further — there is nothing left to suspend, and an
--    assignment already on that exact programme_id is excluded by construction.
-- ===========================================================================

-- A plain INSERT, not the do $$ .. $$ block section 0's fixtures used (that ran
-- before `set local role authenticated` above, so it bypassed RLS as the test's
-- own superuser role). This one runs as `authenticated` under the still-active
-- user_medical JWT (set in section 2, never reset since), so it is subject to
-- programme_assignments_write's real WITH CHECK — which requires assigned_by =
-- auth_user_id(), same as any real medical-authored assignment would carry.
insert into programme_assignments (id, org_id, programme_id, athlete_id, starts_on, status, assigned_by)
  values (tests.uid('orga','assign_a1_rehab'), tests.uid('orga','org'), tests.uid('orga','prog_rehab'),
          tests.uid('orga','athlete_1'), current_date, 'active', tests.uid('orga','user_medical'));

select lives_ok(
  format($q$select suspend_assignments_for_rehab(%L, %L)$q$,
         tests.uid('orga','athlete_1'), tests.uid('orga','prog_rehab')),
  'calling it again with the athlete''s own live rehab assignment already in place is safe'
);
select is(
  (select status from programme_assignments where id = tests.uid('orga','assign_a1_rehab')),
  'active',
  'the rehab assignment itself is never suspended by assigning it — programme_id <> '
  'p_rehab_programme_id excludes its own row'
);

select * from finish();
rollback;
