-- 233_login_attempts_test.sql
--
-- login-security checklist item 4: /login has no rate limiting. Migration
-- 0048_login_attempts.sql builds the table and the two SECURITY DEFINER functions this
-- file exercises directly. Written before the migration was applied to the live database
-- (CLAUDE.md §5: "write the test for a permission rule before the rule"), against the
-- function contract the migration file itself documents at length.
--
-- Stays on the connecting (superuser) role for section 1 and 2, deliberately: both
-- functions under test are security definer with execute revoked from public/anon/
-- authenticated (0048's own grants, mirroring 0034_retention_revoke_public_execute.sql
-- and 0044's generate_compliance_expectations), so they are only ever invoked by
-- src/app/auth/sign-in/route.ts's service-role admin client -- never through PostgREST RPC
-- -- and this file exercises exactly that calling shape. Section 3 switches to
-- `authenticated` deliberately, to test the one thing that IS reachable through PostgREST:
-- the admin-only read policy.
--
-- What this file asserts, and why
--   1. An email nobody has ever failed against is not locked (the common case).
--   2. Five failures in a row lock the sixth attempt out -- the exact threshold
--      09-security-and-compliance.md §8.1 and §9.4 both specify.
--   3. The lockout duration is real (close to the documented first-tier 30 seconds), not
--      a token value.
--   4. THE DOS CONTROL: a further failed attempt while already locked does not extend
--      locked_until. This is the specific anti-abuse property 0048's header calls out --
--      without it, an attacker who can never guess the password could still hold a real
--      user's account locked indefinitely.
--   5. THE ESCALATION CURVE: once a lock has been served and a second run of 5 failures
--      trips a second lockout, the second lockout is longer than the first (2 minutes vs
--      30 seconds) -- "exponential backoff" is not just a word in the doc, the numbers
--      actually climb.
--   6. THE WINDOW: a failure more than 30 minutes after the last one starts a fresh count
--      of 1 rather than piling onto a stale streak from long before.
--   7. A successful sign-in clears the row entirely -- attempt_count, lock_count and
--      locked_until all gone, not just zeroed -- the "reset the counter on a successful
--      sign-in" requirement.
--   8. RLS: an admin reads their own organisation's login_attempts rows; a coach (wrong
--      role) and an admin in the other organisation (wrong org) both read zero, and anon
--      holds no privilege on the table at all (the last one is also covered generically by
--      010_rls_coverage_test.sql's dynamic "anon holds no privilege on any table in
--      public" sweep -- asserted here too, directly against this table, for a single
--      dedicated file a reviewer can read start to finish without cross-referencing).

begin;
select * from no_plan();

select tests.fixtures();


-- ===========================================================================
-- 1. Unknown email: not locked
-- ===========================================================================

select is(
  (select is_locked from public.login_attempt_gate('nobody.ever@fixture.example')),
  false,
  'gate: an email with no attempt history at all is not locked'
);

select is(
  (select seconds_remaining from public.login_attempt_gate('nobody.ever@fixture.example')),
  0,
  'gate: seconds_remaining is 0 when not locked'
);


-- ===========================================================================
-- 2. Five failures lock the sixth attempt out
-- ===========================================================================

-- Failures 1-4: never locked, attempts_remaining counts down.
select is(
  (select attempts_remaining from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  4, 'failure 1 of 5: 4 remaining, not locked'
);
select is(
  (select is_locked from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  false, 'failure 2 of 5: still not locked'
);
select is(
  (select attempts_remaining from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  2, 'failure 3 of 5: 2 remaining'
);
select is(
  (select attempts_remaining from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  1, 'failure 4 of 5: 1 remaining'
);

-- Failure 5: the lock trips.
select is(
  (select is_locked from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  true, 'failure 5 of 5: locked'
);

-- gate() agrees, from a completely separate call.
select is(
  (select is_locked from public.login_attempt_gate('locktest@fixture.example')),
  true, 'gate: agrees the account is now locked'
);

-- The first lockout is the 30 second tier: comfortably under a minute, comfortably over
-- zero. Not asserting an exact second count (wall-clock timing in a test), just the tier.
select ok(
  (select seconds_remaining from public.login_attempt_gate('locktest@fixture.example')) between 1 and 30,
  'gate: first lockout is the 30 second tier, not some other duration'
);

select is(
  (select attempt_count from public.login_attempts where email = 'locktest@fixture.example'),
  0, 'attempt_count resets to 0 the moment the lock trips -- next cycle starts fresh'
);
select is(
  (select lock_count from public.login_attempts where email = 'locktest@fixture.example'),
  1, 'lock_count is now 1 -- first time this email has ever been locked'
);


-- ===========================================================================
-- 3. THE DOS CONTROL: guessing again while locked does not extend the lock
-- ===========================================================================

select set_config(
  'fydr_test.locked_until_before',
  (select locked_until::text from public.login_attempts where email = 'locktest@fixture.example'),
  true
);

-- Attempt #6, #7, #8 while still locked -- simulating an attacker continuing to hammer
-- an account they cannot get into, specifically trying to keep the lock topped up.
select is(
  (select is_locked from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  true, 'attempt while locked: still reported as locked'
);
select is(
  (select is_locked from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  true, 'a second attempt while locked: still locked'
);
select is(
  (select locked_until from public.login_attempts where email = 'locktest@fixture.example')::text,
  current_setting('fydr_test.locked_until_before'),
  'locked_until is UNCHANGED after repeated attempts during the lockout -- the DoS-'
  'against-a-legitimate-user control this migration''s header documents at length'
);
select is(
  (select attempt_count from public.login_attempts where email = 'locktest@fixture.example'),
  0, 'attempt_count is also untouched while locked -- these attempts are not counted at all'
);


-- ===========================================================================
-- 4. THE ESCALATION CURVE: a second lockout is longer than the first
-- ===========================================================================

-- Force the first lock to have already expired (cannot sleep 30 real seconds in a test
-- suite). Raw table UPDATE -- this file runs as the superuser connection, which bypasses
-- RLS the same way every other pgTAP fixture-setup statement in this suite does.
update public.login_attempts
   set locked_until = now() - interval '1 second'
 where email = 'locktest@fixture.example';

-- Confirmed unlocked again.
select is(
  (select is_locked from public.login_attempt_gate('locktest@fixture.example')),
  false, 'gate: unlocked again once locked_until is in the past'
);

-- Five more failures. lock_count carries over from before (it is 1, never reset by time),
-- so this is the SECOND lockout this email has ever earned. `perform`, not a bare select:
-- these functions return a table/set, and a bare `select fn(args)` at the top of a SELECT
-- list captures the whole row as one ambiguous composite value instead of just running it
-- for effect -- do $$ ... perform ...; $$ discards the result cleanly.
do $$
begin
  perform public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false);
  perform public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false);
  perform public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false);
  perform public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false);
end $$;
select is(
  (select is_locked from public.login_attempt_record_result(p_email => 'locktest@fixture.example', p_success => false)),
  true, 'a second run of 5 failures locks again'
);

select is(
  (select lock_count from public.login_attempts where email = 'locktest@fixture.example'),
  2, 'lock_count is now 2'
);

-- The second tier is 2 minutes: strictly longer than the first lockout's 30 second tier.
select ok(
  (select seconds_remaining from public.login_attempt_gate('locktest@fixture.example')) > 30,
  'THE CURVE ESCALATES: the second lockout (2 minute tier) is longer than the first '
  '(30 second tier) -- exponential backoff is a real, measured property, not just the '
  'doc''s wording'
);
select ok(
  (select seconds_remaining from public.login_attempt_gate('locktest@fixture.example')) <= 120,
  'the second lockout is the 2 minute tier specifically, not something uncapped'
);


-- ===========================================================================
-- 5. THE WINDOW: a stale failure starts a fresh count rather than piling on
-- ===========================================================================

delete from public.login_attempts where email = 'windowtest@fixture.example';

do $$
begin
  perform public.login_attempt_record_result(p_email => 'windowtest@fixture.example', p_success => false);
  perform public.login_attempt_record_result(p_email => 'windowtest@fixture.example', p_success => false);
end $$;
select is(
  (select attempt_count from public.login_attempts where email = 'windowtest@fixture.example'),
  2, 'two failures in a row: count is 2'
);

-- Back-date the last attempt by 31 minutes -- older than the 30 minute window.
update public.login_attempts
   set last_attempt_at = now() - interval '31 minutes'
 where email = 'windowtest@fixture.example';

do $$
begin
  perform public.login_attempt_record_result(p_email => 'windowtest@fixture.example', p_success => false);
end $$;
select is(
  (select attempt_count from public.login_attempts where email = 'windowtest@fixture.example'),
  1, 'a failure more than 30 minutes after the last one resets the streak to 1, not 3'
);


-- ===========================================================================
-- 6. A successful sign-in clears the row entirely
-- ===========================================================================

do $$
begin
  perform public.login_attempt_record_result(p_email => 'successtest@fixture.example', p_success => false);
  perform public.login_attempt_record_result(p_email => 'successtest@fixture.example', p_success => false);
end $$;
select isnt(
  (select attempt_count from public.login_attempts where email = 'successtest@fixture.example'),
  null, 'sanity: the row exists with a nonzero count before the success'
);

do $$
begin
  perform public.login_attempt_record_result(p_email => 'successtest@fixture.example', p_success => true);
end $$;

select is(
  (select count(*)::int from public.login_attempts where email = 'successtest@fixture.example'),
  0, 'a successful sign-in deletes the row outright -- "reset the counter on a successful '
     'sign-in", fully, not just zeroed'
);


-- ===========================================================================
-- 7. RLS: the admin-only, own-organisation-only read policy
-- ===========================================================================

-- Two rows, org-scoped to the shared fixture's two organisations, simulating what
-- src/app/auth/sign-in/route.ts does after resolving org_id from public.users.
do $$
begin
  perform public.login_attempt_record_result(
    p_email => 'orga.coach@fixture.example', p_success => false, p_org_id => tests.uid('orga', 'org'));
  perform public.login_attempt_record_result(
    p_email => 'orgb.coach@fixture.example', p_success => false, p_org_id => tests.uid('orgb', 'org'));
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');

-- Positive control: org A's admin reads org A's row.
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*)::int from public.login_attempts where email = 'orga.coach@fixture.example'),
  1, 'positive control: org A''s admin DOES read org A''s own login_attempts row'
);

-- Negative control 1: org A's admin reads zero rows of org B's login_attempts.
select is(
  (select count(*)::int from public.login_attempts where email = 'orgb.coach@fixture.example'),
  0, 'org A''s admin reads zero of org B''s login_attempts rows'
);

-- Negative control 2: wrong role. A coach in org A -- not an admin -- reads zero, even for
-- their own organisation's row.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*)::int from public.login_attempts where email = 'orga.coach@fixture.example'),
  0, 'a coach (not admin) in org A reads zero login_attempts rows, even their own org''s'
);

-- Negative control 3: anon holds no privilege on this table at all. Dedicated assertion
-- against login_attempts by name, alongside 010_rls_coverage_test.sql's generic dynamic
-- sweep over every table in public.
select is(
  (select count(*)::int from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = 'login_attempts'
      and g.grantee = 'anon')::int,
  0, 'anon holds no privilege on login_attempts'
);


select * from finish();
rollback;
