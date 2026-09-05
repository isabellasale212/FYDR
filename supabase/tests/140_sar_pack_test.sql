-- 140_sar_pack_test.sql
--
-- migration 0032's own header explains the reduced (synchronous, not
-- worker/queue) scope. What still needs proving at the database layer:
-- admin, not medical or coach, is who opens a request; medical, not admin
-- or coach, is who may record a clinical decision; a withhold decision
-- without a reason is refused by the database itself, not just a form
-- validator; and the whole thing stays inside its own organisation.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. An admin opens a SAR request for their own org's athlete
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format(
    $q$insert into sar_requests (id, org_id, athlete_id, requested_by, due_at)
       values (%L, %L, %L, %L, now() + interval '1 month')$q$,
    tests.uid('orga', 'sar_request'), tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_admin')
  ),
  'orga''s admin opens a SAR request for athlete_1'
);


-- ===========================================================================
-- 2. Neither a coach nor medical may open one — admin-initiated, per
-- exports.md's own framing
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format(
    $q$insert into sar_requests (org_id, athlete_id, requested_by, due_at)
       values (%L, %L, %L, now() + interval '1 month')$q$,
    tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')
  ),
  '42501', null,
  'a coach cannot open a SAR request'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format(
    $q$insert into sar_requests (org_id, athlete_id, requested_by, due_at)
       values (%L, %L, %L, now() + interval '1 month')$q$,
    tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_medical')
  ),
  '42501', null,
  'medical cannot open a SAR request either — admin-initiated is a real, checked boundary, not just a UI convention'
);


-- ===========================================================================
-- 3. Medical records a clinical decision; a withhold with no reason is
-- refused by the database itself
-- ===========================================================================

select throws_ok(
  format(
    $q$insert into sar_clinical_reviews (org_id, sar_request_id, injury_id, decision, reviewed_by)
       values (%L, %L, %L, 'withhold', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','sar_request'), tests.uid('orga','injury'), tests.uid('orga','user_medical')
  ),
  '23514', null,
  'withholding a clinical note with no reason is refused by a check constraint, not just a form — the reason IS the positive act 09-security-and-compliance.md §6 requires'
);

select lives_ok(
  format(
    $q$insert into sar_clinical_reviews (org_id, sar_request_id, injury_id, decision, reason, reviewed_by)
       values (%L, %L, %L, 'withhold', 'serious harm test applied — see physio notes', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','sar_request'), tests.uid('orga','injury'), tests.uid('orga','user_medical')
  ),
  'the same withhold decision, now with a reason, is accepted'
);


-- ===========================================================================
-- 4. Neither a coach nor an admin may record a clinical decision — this is
-- medical's decision alone, the same "no coach diagnosis" boundary this
-- schema already enforces on injury_clinical itself
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format(
    $q$insert into sar_clinical_reviews (org_id, sar_request_id, injury_id, decision, reviewed_by)
       values (%L, %L, %L, 'include', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','sar_request'), tests.uid('orga','injury'), tests.uid('orga','user_coach')
  ),
  '42501', null,
  'a coach cannot record a clinical review decision'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format(
    $q$insert into sar_clinical_reviews (org_id, sar_request_id, injury_id, decision, reviewed_by)
       values (%L, %L, %L, 'include', %L)$q$,
    tests.uid('orga','org'), tests.uid('orga','sar_request'), tests.uid('orga','injury'), tests.uid('orga','user_admin')
  ),
  '42501', null,
  'nor can an admin — clinical review is medical''s decision alone, the pack requester does not get to decide what of it is withheld'
);


-- ===========================================================================
-- 5. Medical marks the request reviewed; an admin can then release it
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format(
    $q$update sar_requests set status = 'reviewed' where id = %L$q$,
    tests.uid('orga','sar_request')
  ),
  'medical marks the request reviewed once every clinical decision is recorded'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format(
    $q$update sar_requests set status = 'released', released_by = %L, released_at = now() where id = %L$q$,
    tests.uid('orga','user_admin'), tests.uid('orga','sar_request')
  ),
  'admin releases the reviewed request'
);


-- ===========================================================================
-- 6. Cross-tenant: orgb cannot see or touch orga's request
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select is(
  (select count(*) from sar_requests where id = tests.uid('orga','sar_request')),
  0::bigint,
  'orgb''s admin cannot see orga''s SAR request'
);

select is(
  tests.rows_affected(
    format($q$update sar_requests set status = 'released' where id = %L$q$, tests.uid('orga','sar_request'))
  ),
  0::bigint,
  'and cannot update it either — the statement does not error, RLS just filters the row to zero matches, same as any other row-scoped update'
);


-- ===========================================================================
-- 7. An athlete has no access to either table at all
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from sar_requests),
  0::bigint,
  'the athlete named in the request cannot read it themselves — a SAR is the club responding to a request, not a self-service screen'
);

select * from finish();
rollback;
