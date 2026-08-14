-- 240_mfa_aal2_helper_test.sql
--
-- migration 0048's public.auth_is_aal2() — login-security checklist item 3 (MFA). Written
-- before the migration, per CLAUDE.md §5 ("write the test for a permission rule before the
-- rule"), even though this helper is not (yet) a permission rule any policy enforces — see
-- the migration's own header for exactly why that wiring is a deliberate, separate follow-up
-- rather than part of this pass.
--
-- What this file proves
--   1. The helper reads the JWT's top-level `aal` claim correctly: aal2 -> true, aal1 ->
--      true is false (sic, false), a claims object with no `aal` key at all -> false (the
--      documented default), and no session at all -> false.
--   2. It is role-agnostic — a coach and an athlete with the same claim get the same
--      answer, because MFA assurance is a property of the session, not the role.
--   3. It is genuinely unreferenced by any live RLS policy today. This is the test suite's
--      own record of the "shipped but deliberately not wired in yet" state 0048 documents in
--      prose, made into something that breaks loudly — rather than silently going stale —
--      the day somebody adds `auth_is_aal2()` to a policy without reading that migration's
--      header first. If you just did that on purpose, update this assertion's expected
--      count and its message, not just delete it.

begin;
select * from no_plan();

select tests.fixtures();


-- ===========================================================================
-- 1. The claim itself
-- ===========================================================================

set local role authenticated;

select tests.clear_jwt();
select is(
  public.auth_is_aal2(),
  false,
  'no session at all reads as not-aal2'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  public.auth_is_aal2(),
  false,
  'the default tests.set_jwt() call (aal1) is not aal2'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'), 'aal1');
select is(
  public.auth_is_aal2(),
  false,
  'an explicit aal1 claim is not aal2'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'), 'aal2');
select is(
  public.auth_is_aal2(),
  true,
  'an explicit aal2 claim reads as aal2'
);

-- A claims object with no `aal` key at all — what every fixture built before this parameter
-- existed, and what a token from before this feature shipped, both look like. Bypasses
-- tests.set_jwt() on purpose to exercise the coalesce default directly rather than through
-- another helper that might mask it.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', tests.uid('orga','user_coach')::text,
    'role', 'authenticated',
    'app_metadata', jsonb_build_object(
      'org_id', tests.uid('orga','org'),
      'roles', '["coach"]'::jsonb,
      'athlete_id', null,
      'cv', 1
    )
  )::text,
  true
);
select is(
  public.auth_is_aal2(),
  false,
  'a claims object with no aal key at all defaults to not-aal2, same as aal1'
);


-- ===========================================================================
-- 2. Role-agnostic: an athlete's aal2 session reads the same as staff's
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'), 'aal2');
select is(
  public.auth_is_aal2(),
  true,
  'an athlete session with aal2 reads as aal2 too — this helper is about the session, not the role'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  public.auth_is_aal2(),
  false,
  'and the same athlete without a second factor completed reads as not-aal2'
);


-- ===========================================================================
-- 3. Deliberately not wired into any policy yet — see migration 0048's own header.
-- ===========================================================================

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%auth_is_aal2%'
        or coalesce(with_check, '') ilike '%auth_is_aal2%'
      )
  ),
  0,
  'auth_is_aal2() is not yet referenced by any RLS policy — migration 0048''s header '
  || 'explains why (zero enrolled staff today; wiring it in now would lock out the whole '
  || 'roster). If you just wired it into a policy on purpose, that is real progress — '
  || 'update this assertion''s expected count, and update docs/09-security-and-compliance.md '
  || 'and docs/11-open-questions.md O-323 in the same commit, not just this test.'
);

select * from finish();
rollback;
