-- The RPE package, change one (2026-09-13): RPE is a club setting
-- (organisations.collects_rpe, migration 0118). Off: no training_rpe
-- expectation is written; wellness and gym expectations are untouched; the
-- switch is the sport scientist's.

begin;
select * from no_plan();

select tests.fixtures();

-- The same fixture shape 230 uses: the session moved into the future so its
-- group membership resolves; the local date stashed.
update public.sessions set starts_at = now() + interval '1 day' where id = tests.uid('orga', 'session');
select set_config('fydr_test.expectation_date',
  (select ((s.starts_at at time zone o.timezone)::date)::text from public.sessions s join public.organisations o on o.id = s.org_id where s.id = tests.uid('orga', 'session')), true);

-- 1. the default is on
select is((select collects_rpe from organisations where id = tests.uid('orga', 'org')), true, 'a club collects RPE by default');

-- 2. on: the fixture session (requires_rpe) writes training_rpe expectations
select public.generate_compliance_expectations(tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);
select cmp_ok(
  (select count(*)::int from compliance_expectations where org_id = tests.uid('orga', 'org') and domain = 'training_rpe' and session_id = tests.uid('orga', 'session')),
  '>', 0, 'on: training_rpe expectations are written for the session');

-- 3. off: switch, clear the day, regenerate — no training_rpe row, wellness still there
update organisations set collects_rpe = false where id = tests.uid('orga', 'org');
delete from compliance_expectations where org_id = tests.uid('orga', 'org') and expectation_date = current_setting('fydr_test.expectation_date')::date;
select public.generate_compliance_expectations(tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);
select is(
  (select count(*)::int from compliance_expectations where org_id = tests.uid('orga', 'org') and domain = 'training_rpe' and expectation_date = current_setting('fydr_test.expectation_date')::date),
  0, 'off: no training_rpe expectation is written for the day');
select cmp_ok(
  (select count(*)::int from compliance_expectations where org_id = tests.uid('orga', 'org') and domain = 'wellness' and expectation_date = current_setting('fydr_test.expectation_date')::date),
  '>', 0, 'off: wellness expectations are still written');

-- 4. the switch is the sport scientist's, not the coach's, not the athlete's
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
update organisations set collects_rpe = true where id = tests.uid('orga', 'org');
select is((select collects_rpe from organisations where id = tests.uid('orga', 'org')), false, 'the coach cannot flip it (the update matched nothing)');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
update organisations set collects_rpe = true where id = tests.uid('orga', 'org');
select is((select collects_rpe from organisations where id = tests.uid('orga', 'org')), false, 'nor can an athlete');
select tests.set_jwt(tests.uid('orga', 'user_admin'));
update organisations set collects_rpe = true where id = tests.uid('orga', 'org');
select is((select collects_rpe from organisations where id = tests.uid('orga', 'org')), true, 'the sport scientist can');

-- 5. another club's sport scientist cannot
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
update organisations set collects_rpe = false where id = tests.uid('orga', 'org');
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select collects_rpe from organisations where id = tests.uid('orga', 'org')), true, 'a sport scientist in another club changes nothing here');

select * from finish();
rollback;
