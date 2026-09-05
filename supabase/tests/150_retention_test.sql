-- 150_retention_test.sql
--
-- migration 0034's own header explains the finding: retention.
-- nightly_preview() is SECURITY DEFINER and writes across every
-- organisation in one call, so a PUBLIC execute grant — Postgres's own
-- default for a newly created function, easy to miss — would have let
-- any authenticated user in any club trigger it via Supabase's RPC
-- surface. This is the regression test for that fix: not the counting
-- logic itself (verified live, against real synthetic old data, in this
-- build's own session log), just the one thing a schema test can check
-- that a live session can't prove stays true forever — that the
-- permission denial is still there.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');
select tests.set_jwt(tests.uid('orga', 'user_admin'));

select throws_ok(
  $q$select retention.nightly_preview()$q$,
  '42501', null,
  'an authenticated user — even an admin, even in a real club — cannot call the nightly job directly; only pg_cron''s own role can'
);

select * from finish();
rollback;
