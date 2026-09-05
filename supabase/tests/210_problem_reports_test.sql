-- 210_problem_reports_test.sql
--
-- problem_reports (migration 0040): the athlete's "Report a problem" write path,
-- 03-flows.md §6 ("Athlete reports a problem from Today tab" -> medical) and
-- 01-roles-and-permissions.md §1 ("Report a problem or injury concern to medical
-- staff" — the athlete capability names its reader).
--
-- Which rules this implements — written BEFORE the migration, per CLAUDE.md §5
--   Athlete: inserts their OWN report (open only, created_by = self), reads their
--     own reports and nobody else's. No update, no delete: a sent report is a
--     statement of record, corrected by sending another.
--   Medical: reads every report in the org, and is the ONLY role that can act —
--     acknowledge, then close — stamped with their own user id by trigger.
--     Medical cannot rewrite what the athlete wrote.
--   Coach: NO ACCESS. Not the body, not the row. 01-roles-and-permissions.md
--     says reports go "to medical staff"; the flow diagram notifies Medical only;
--     ADR-007 forbids column-filtered middle grounds. The card the athlete taps
--     promises "read by your club's medical staff" — this test is that promise.
--   Admin: no access, same as every other per-athlete data domain.
--   Cross-org: nothing, in either direction, as usual.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. Inserts: an athlete files their own report, and only their own
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$insert into problem_reports (id, org_id, athlete_id, category, body, created_by)
            values (%L, %L, %L, 'injury_or_pain',
                    'My left hamstring has felt tight since Tuesday and it is getting worse.', %L)$q$,
         tests.uid('orga','report_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_athlete_1')),
  'an athlete files a report about themselves'
);

select lives_ok(
  format($q$insert into problem_reports (id, org_id, athlete_id, body, created_by)
            values (%L, %L, %L, 'No category on this one — the category is optional.', %L)$q$,
         tests.uid('orga','report_2'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_athlete_1')),
  'the category is optional: a report with no category is accepted'
);

select throws_ok(
  format($q$insert into problem_reports (org_id, athlete_id, body, created_by)
            values (%L, %L, 'Filed against a teammate.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot file a report about another athlete'
);

select throws_ok(
  format($q$insert into problem_reports (org_id, athlete_id, body, created_by)
            values (%L, %L, 'Wrong created_by.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_athlete_2')),
  '42501', null,
  'an athlete cannot attribute their report to someone else'
);

select throws_ok(
  format($q$insert into problem_reports (org_id, athlete_id, body, status, acknowledged_at, acknowledged_by, created_by)
            values (%L, %L, 'Pre-acknowledged.', 'acknowledged', now(), %L, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_athlete_1'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'a report can only ever be filed open — an athlete cannot pre-acknowledge it'
);

select throws_ok(
  format($q$insert into problem_reports (org_id, athlete_id, body, created_by)
            values (%L, %L, repeat('x', 1001), %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_athlete_1')),
  '23514', null,
  'the body is bounded at 1000 characters'
);

select throws_ok(
  format($q$insert into problem_reports (org_id, athlete_id, body, created_by)
            values (%L, %L, '   ', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_athlete_1')),
  '23514', null,
  'a whitespace-only body is refused'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into problem_reports (org_id, athlete_id, body, created_by)
            values (%L, %L, 'Coach raising a concern does not go through this table.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  '42501', null,
  'staff cannot insert into problem_reports — it is the athlete''s own voice only'
);


-- ===========================================================================
-- 2. Reads: the athlete and medical, nobody else
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from problem_reports where org_id = tests.uid('orga','org')),
  2::bigint,
  'the reporting athlete reads their own two reports back'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select count(*) from problem_reports where org_id = tests.uid('orga','org')),
  0::bigint,
  'a teammate reads zero — reports are never visible to other athletes'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from problem_reports where org_id = tests.uid('orga','org')),
  0::bigint,
  'a coach reads ZERO rows — not the body, not the existence. The report goes to medical staff.'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from problem_reports where org_id = tests.uid('orga','org')),
  0::bigint,
  'an admin reads zero rows, same as every per-athlete domain'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from problem_reports where org_id = tests.uid('orga','org')),
  2::bigint,
  'medical reads every report in the organisation'
);


-- ===========================================================================
-- 3. The athlete cannot revise, resolve, or remove what they sent
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- No update policy for athletes: the statement succeeds but matches nothing.
update problem_reports set body = 'rewritten' where id = tests.uid('orga','report_1');
select is(
  (select body from problem_reports where id = tests.uid('orga','report_1')),
  'My left hamstring has felt tight since Tuesday and it is getting worse.',
  'an athlete''s update of their own report is a no-op — a sent report is a record'
);

update problem_reports
   set status = 'closed', closed_at = now(), closed_by = tests.uid('orga','user_athlete_1')
 where id = tests.uid('orga','report_1');
select is(
  (select status::text from problem_reports where id = tests.uid('orga','report_1')),
  'open',
  'an athlete cannot close their own report either — medical owns the status'
);

select throws_ok(
  format($q$delete from problem_reports where id = %L$q$, tests.uid('orga','report_1')),
  '42501', null,
  'nobody holding the authenticated role can hard-delete a report (rule 4)'
);


-- ===========================================================================
-- 4. Medical acts on it: acknowledge, then close, stamped honestly
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select throws_ok(
  format($q$update problem_reports
               set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = %L
             where id = %L$q$,
         tests.uid('orga','user_coach'), tests.uid('orga','report_1')),
  '42501', null,
  'medical cannot stamp the acknowledgement with someone else''s id'
);

select lives_ok(
  format($q$update problem_reports
               set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = %L
             where id = %L$q$,
         tests.uid('orga','user_medical'), tests.uid('orga','report_1')),
  'medical acknowledges an open report'
);
select is(
  (select status::text from problem_reports where id = tests.uid('orga','report_1')),
  'acknowledged',
  'the report is now acknowledged'
);

select throws_ok(
  format($q$update problem_reports set body = 'tidied up by the physio'
             where id = %L$q$, tests.uid('orga','report_1')),
  '42501', null,
  'medical cannot rewrite what the athlete wrote — the body is immutable'
);

select throws_ok(
  format($q$update problem_reports set deleted_at = now()
             where id = %L$q$, tests.uid('orga','report_1')),
  '42501', null,
  'medical cannot soft-delete a report — erasure is the audited service path only'
);

select lives_ok(
  format($q$update problem_reports
               set status = 'closed', closed_at = now(), closed_by = %L
             where id = %L$q$,
         tests.uid('orga','user_medical'), tests.uid('orga','report_1')),
  'medical closes an acknowledged report'
);

select throws_ok(
  format($q$update problem_reports
               set status = 'open', acknowledged_at = null, acknowledged_by = null,
                   closed_at = null, closed_by = null
             where id = %L$q$, tests.uid('orga','report_1')),
  '42501', null,
  'a closed report stays closed — there is no reopen, the athlete files a new one'
);

-- Straight open -> closed, without an acknowledgement first, is allowed (a
-- duplicate or a mis-tap does not need the full two-step).
select lives_ok(
  format($q$update problem_reports
               set status = 'closed', closed_at = now(), closed_by = %L
             where id = %L$q$,
         tests.uid('orga','user_medical'), tests.uid('orga','report_2')),
  'medical closes an open report directly, no acknowledgement step required'
);


-- ===========================================================================
-- 5. Cross-org: nothing, in either direction
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_medical'));
select is(
  (select count(*) from problem_reports where org_id = tests.uid('orga','org')),
  0::bigint,
  'orgb''s physio cannot see orga''s reports'
);

update problem_reports
   set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = tests.uid('orgb','user_medical')
 where id = tests.uid('orga','report_1');
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select status::text from problem_reports where id = tests.uid('orga','report_1')),
  'closed',
  'orgb''s physio''s attempt to act on orga''s report was a no-op'
);

select tests.set_jwt(tests.uid('orgb', 'user_athlete_1'));
select throws_ok(
  format($q$insert into problem_reports (org_id, athlete_id, body, created_by)
            values (%L, %L, 'Cross-org insert.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orgb','user_athlete_1')),
  '42501', null,
  'orgb''s athlete cannot write into orga naming orga''s ids explicitly'
);

select * from finish();
rollback;
