-- 750_athlete_consent_test.sql
--
-- PATTERN-S9, migration 0120: the two consent records, in_data, what a
-- decision gates, the guardian's tokenised route, and the self-update guard.

begin;
select * from no_plan();

select tests.fixtures();
-- One expected session for the generator, as 230/730 do.
update public.sessions set starts_at = now() + interval '1 day' where id = tests.uid('orga', 'session');
select set_config('fydr_test.expectation_date',
  (select ((s.starts_at at time zone o.timezone)::date)::text from public.sessions s join public.organisations o on o.id = s.org_id where s.id = tests.uid('orga', 'session')), true);

-- 1. in_data is computed from the performance record alone
select is((select in_data from athletes where id = tests.uid('orga','athlete_1')), true, 'fixture: an athlete who agreed is in data');
update athletes set consent_declined_at = now() where id = tests.uid('orga','athlete_1');
select is((select in_data from athletes where id = tests.uid('orga','athlete_1')), false, 'declined: out of data');
update athletes set consent_declined_at = null, consent_withdrawn_at = now() where id = tests.uid('orga','athlete_1');
select is((select in_data from athletes where id = tests.uid('orga','athlete_1')), false, 'withdrawn: out of data');
update athletes set consent_withdrawn_at = null, consent_given_at = null where id = tests.uid('orga','athlete_1');
select is((select in_data from athletes where id = tests.uid('orga','athlete_1')), false, 'undecided: out of data');
update athletes set health_consent_declined_at = now(), consent_given_at = now() where id = tests.uid('orga','athlete_1');
select is((select in_data from athletes where id = tests.uid('orga','athlete_1')), true, 'the health decision does not move in_data — it is the performance record');
update athletes set health_consent_declined_at = null where id = tests.uid('orga','athlete_1');

-- 2. the generator asks nothing of an athlete not in data
update athletes set consent_declined_at = now() where id = tests.uid('orga','athlete_2');
select public.generate_compliance_expectations(tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);
select cmp_ok((select count(*)::int from compliance_expectations where athlete_id = tests.uid('orga','athlete_1') and expectation_date = current_setting('fydr_test.expectation_date')::date), '>', 0, 'the athlete in data is expected');
select is((select count(*)::int from compliance_expectations where athlete_id = tests.uid('orga','athlete_2') and expectation_date = current_setting('fydr_test.expectation_date')::date), 0, 'the declined athlete is expected nothing — dropped from the denominator, not counted as a non-submitter');

-- 3. the entry gates, as the athlete
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select throws_ok(
  format($q$insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours, source, created_by) values (%L, %L, current_date, 8.0, 'self_report', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_athlete_2')),
  '42501', null, 'declined: a morning check-in does not land');
select throws_ok(
  format($q$insert into training_entries (org_id, athlete_id, entry_date, rpe, duration_min, source, created_by) values (%L, %L, current_date, 5, 60, 'self_report', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_athlete_2')),
  '42501', null, 'declined: nor a session rating');
select throws_ok(
  format($q$insert into gym_session_logs (org_id, athlete_id, entry_date, started_at, source) values (%L, %L, current_date, now(), 'self_report')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2')),
  '42501', null, 'declined: nor a gym session');
select throws_ok(
  format($q$insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year, iso_week, answer, source, created_by) values (%L, %L, date_trunc('week', current_date)::date, extract(isoyear from current_date)::int, extract(week from current_date)::int, 'yes', 'self_report', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_athlete_2')),
  '42501', null, 'declined: nor the weekly nutrition check-in');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours, source, created_by) values (%L, %L, current_date, 8.0, 'self_report', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_athlete_1')),
  'in data: the check-in lands');

-- 4. the athlete cannot write the decision directly; the functions are the path
select throws_ok(
  format($q$update athletes set consent_given_at = now() + interval '1 second' where id = %L$q$, tests.uid('orga','athlete_1')),
  '42501', null, 'the self-update guard refuses a direct write to consent_given_at');
select throws_ok(
  format($q$update athletes set guardian_email = 'x@y.z' where id = %L$q$, tests.uid('orga','athlete_1')),
  '42501', null, 'and to guardian_email');
select throws_ok(
  format($q$update athletes set parental_consent_method = 'in_person' where id = %L$q$, tests.uid('orga','athlete_1')),
  '42501', null, 'and to parental_consent_method (a hole closed)');
select lives_ok(
  format($q$update athletes set preferred_name = 'Jim' where id = %L$q$, tests.uid('orga','athlete_1')),
  'preferred_name still theirs');

-- 5. record_data_consent: an adult decides both blocks with one tap; audited
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select lives_ok($$select public.record_data_consent('agree', 'placeholder:LEGAL-3A+3B:2026-09-13')$$, 'the declined athlete agrees');
select is((select in_data from athletes where id = tests.uid('orga','athlete_2')), true, 'and is in data again');
select is((select health_consent_given_at is not null and health_consent_declined_at is null from athletes where id = tests.uid('orga','athlete_2')), true, 'the health record is given too, and its decline cleared');
select is((select consent_version from athletes where id = tests.uid('orga','athlete_2')), 'placeholder:LEGAL-3A+3B:2026-09-13', 'the version the screen showed is stored');
select lives_ok($$select public.record_data_consent('decline', 'placeholder:LEGAL-3A+3B:2026-09-13')$$, 'then declines');
select is((select in_data from athletes where id = tests.uid('orga','athlete_2')), false, 'out of data');
select throws_ok($$select public.record_data_consent('maybe', 'v')$$, '22023', null, 'only agree or decline');
select tests.clear_jwt();
reset role;
select is((select count(*)::int from audit_log where athlete_id = tests.uid('orga','athlete_2') and action in ('consent.agreed', 'consent.declined')), 2, 'both decisions are audited');

-- 6. withdrawal
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok($$select public.withdraw_data_consent()$$, 'an athlete in data withdraws');
select is((select in_data from athletes where id = tests.uid('orga','athlete_1')), false, 'and is out of data');
select is((select health_consent_withdrawn_at is not null from athletes where id = tests.uid('orga','athlete_1')), true, 'the health record is withdrawn with it');
select throws_ok($$select public.withdraw_data_consent()$$, 'P0001', 'nothing_to_withdraw', 'nothing to withdraw twice');
select tests.clear_jwt();
reset role;
select is((select count(*)::int from wellness_entries where athlete_id = tests.uid('orga','athlete_1')), 2, 'the entries submitted before withdrawing (the fixture''s and the one above) are left alone (LEGAL-3E)');

-- 7. the minor and the guardian route
update athletes set date_of_birth = current_date - interval '16 years', consent_given_at = null, consent_withdrawn_at = null, health_consent_given_at = null, health_consent_withdrawn_at = null,
  guardian_name = 'Bernadette Rafferty', guardian_email = 'b.rafferty@example.com'
  where id = tests.uid('orga','athlete_1');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok($$select public.record_data_consent('agree', 'v')$$, 'P0001', 'guardian_decides', 'a minor cannot decide for themselves — a guardian answers');
select set_config('fydr_test.token', (select token from public.request_guardian_consent(tests.uid('orga','athlete_1'), 'placeholder:LEGAL-3A+3B:2026-09-13')), true);
select ok(length(current_setting('fydr_test.token')) = 64, 'the athlete sends the guardian link and gets the raw token once');
select is((select count(*)::int from guardian_consent_requests where athlete_id = tests.uid('orga','athlete_1')), 1, 'the request row is theirs to see');
select isnt((select token_hash from guardian_consent_requests where athlete_id = tests.uid('orga','athlete_1')), current_setting('fydr_test.token'), 'and holds the hash, not the token');
select tests.clear_jwt();
-- the guardian: anon, by token
set local role anon;
select is((select state from public.guardian_request_by_token(current_setting('fydr_test.token'))), 'open', 'anon reads the request by token: open');
select is((select athlete_first_name from public.guardian_request_by_token(current_setting('fydr_test.token'))), 'James', 'with the athlete''s first name');
select is((select count(*)::int from public.guardian_request_by_token('not-a-token')), 0, 'an unknown token reads nothing');
select is(public.guardian_decide(current_setting('fydr_test.token'), 'agree'), 'ok', 'the guardian agrees');
select is(public.guardian_decide(current_setting('fydr_test.token'), 'agree'), 'decided', 'single use: a second answer is refused');
select is(public.guardian_decide('not-a-token', 'agree'), 'unknown', 'an unknown token writes nothing');
reset role;
select is((select in_data from athletes where id = tests.uid('orga','athlete_1')), true, 'the athlete is in data');
select is((select parental_consent_method::text from athletes where id = tests.uid('orga','athlete_1')), 'guardian_link', 'recorded as the guardian''s own answer on the link');
select is((select parental_consent_recorded_by from athletes where id = tests.uid('orga','athlete_1')), null, 'with no staff member recorded — nobody at the club was in the route');
select is((select count(*)::int from audit_log where athlete_id = tests.uid('orga','athlete_1') and action = 'guardian_consent.agreed'), 1, 'audited as the guardian''s');
-- expiry
update guardian_consent_requests set decided_at = null, decision = null, expires_at = now() - interval '1 hour' where athlete_id = tests.uid('orga','athlete_1');
set local role anon;
select is((select state from public.guardian_request_by_token(current_setting('fydr_test.token'))), 'expired', 'an expired link says so');
select is(public.guardian_decide(current_setting('fydr_test.token'), 'decline'), 'expired', 'and takes no answer');
reset role;
-- not a minor: no request
update athletes set date_of_birth = date '1999-06-09' where id = tests.uid('orga','athlete_2');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(format($$select public.request_guardian_consent(%L, 'v')$$, tests.uid('orga','athlete_2')), 'P0001', 'not_a_minor', 'no guardian request for an adult');
select tests.clear_jwt();
reset role;

-- 8. the health gate on the clinical tables
update athletes set health_consent_declined_at = now() where id = tests.uid('orga','athlete_2');
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into injuries (org_id, athlete_id, body_area, side, onset_date, status, reported_by) values (%L, %L, 'knee', 'left', current_date, 'open', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_medical')),
  '42501', null, 'health declined: the medic cannot open an injury for them');
select lives_ok(
  format($q$insert into injuries (org_id, athlete_id, body_area, side, onset_date, status, reported_by) values (%L, %L, 'knee', 'left', current_date, 'open', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_medical')),
  'health given: an injury is recorded');
select tests.clear_jwt();
reset role;

select * from finish();
rollback;
