-- 790 — PATTERN-S3 C6, migration 0124: Proposed, Approved, Returned with a
-- required reason, one row both roles read.

begin;
select * from no_plan();

select tests.fixtures();
do $$
declare
  o uuid := tests.uid('orga','org');
begin
  insert into programmes (id, org_id, name, programme_type, status, created_by) values
    (tests.uid('orga','prog_rehab'), o, 'Knee rehab block', 'rehab', 'active', tests.uid('orga','user_sc'));
  insert into injuries (id, org_id, athlete_id, body_area, side, onset_date, status, reported_by)
    values (tests.uid('orga','injury_1'), o, tests.uid('orga','athlete_1'), 'knee', 'left', current_date, 'rehab', tests.uid('orga','user_medical'));
  insert into programme_assignments (id, org_id, programme_id, athlete_id, injury_id, starts_on, status, assigned_by)
    values (tests.uid('orga','prop_1'), o, tests.uid('orga','prog_rehab'), tests.uid('orga','athlete_1'), tests.uid('orga','injury_1'), current_date, 'proposed', tests.uid('orga','user_sc')),
           (tests.uid('orga','prop_2'), o, tests.uid('orga','prog_rehab'), tests.uid('orga','athlete_1'), tests.uid('orga','injury_1'), current_date, 'proposed', tests.uid('orga','user_sc'));
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary');

-- only the medic decides
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(format($$select public.decide_proposal(%L, 'approve', null)$$, tests.uid('orga','prop_1')), '42501', null, 'the S&C cannot approve their own proposal');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(format($$select public.decide_proposal(%L, 'approve', null)$$, tests.uid('orga','prop_1')), '42501', null, 'nor a coach');

-- the medic: return needs a reason; approve assigns
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(format($$select public.decide_proposal(%L, 'return', '  ')$$, tests.uid('orga','prop_1')), 'P0001', 'reason_required', 'returning without a reason is refused');
select lives_ok(format($$select public.decide_proposal(%L, 'return', 'Too much load for week one — halve the sets')$$, tests.uid('orga','prop_1')), 'returned with a reason');
select is((select status::text from programme_assignments where id = tests.uid('orga','prop_1')), 'returned', 'the row reads returned');
select is((select return_reason from programme_assignments where id = tests.uid('orga','prop_1')), 'Too much load for week one — halve the sets', 'with the reason on the row');
select isnt((select decided_by from programme_assignments where id = tests.uid('orga','prop_1')), null, 'and who decided');
select lives_ok(format($$select public.decide_proposal(%L, 'approve', null)$$, tests.uid('orga','prop_2')), 'the second is approved');
select is((select status::text from programme_assignments where id = tests.uid('orga','prop_2')), 'active', 'approved stores active — approval assigns; the same row is the athlete''s programme');
select throws_ok(format($$select public.decide_proposal(%L, 'approve', null)$$, tests.uid('orga','prop_2')), 'P0001', 'not_a_proposal', 'a decided row is not decided twice');
select is((select count(*)::int from injury_timeline_event where injury_id = tests.uid('orga','injury_1') and type in ('programme_signed_off','note')), 2, 'the medic''s timeline carries both — the sign-off and the note, as before');

-- both roles read the returned row and its reason
select is((select return_reason from programme_assignments where id = tests.uid('orga','prop_1')), 'Too much load for week one — halve the sets', 'the medic reads the reason');
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select is((select return_reason from programme_assignments where id = tests.uid('orga','prop_1')), 'Too much load for week one — halve the sets', 'the S&C reads the reason on the row — no longer in person');
select is((select count(*)::int from programme_assignments where injury_id = tests.uid('orga','injury_1')), 2, 'and both rows, in one list');
select tests.clear_jwt();
reset role;
select is((select count(*)::int from audit_log where action in ('proposal.approved','proposal.returned')), 2, 'both decisions audited');

select * from finish();
rollback;
