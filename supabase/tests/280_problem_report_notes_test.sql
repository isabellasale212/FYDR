-- 280_problem_report_notes_test.sql
--
-- problem_report_notes (migration 0055): the medic's own triage notes against an
-- athlete-submitted problem report. 210_problem_reports_test.sql is the sibling
-- file and owns the report itself; this one owns the notes hung off it.
--
-- Why this is a separate TABLE and therefore a separate test file
--   problem_reports carries problem_reports_athlete_select (migration 0040:128-130):
--   the athlete reads their OWN report row back, deliberately, because the visible
--   status is the trust loop the athlete-side screen exists to close. Postgres RLS
--   is row-level, not column-level, so a note column added to that table would be
--   readable by the very athlete it is written about, through one direct PostgREST
--   column select. Migration 0040's own header names that risk ("one careless
--   select * away"), and ADR-007 forbids column-filtered sensitivity inside one
--   table outright. The separation here is the same structural split
--   injuries/injury_clinical already uses (CLAUDE.md rule 3): a different table,
--   with a different policy set, not a UI filter over a shared row.
--
-- Which rules this implements — written BEFORE the migration, per CLAUDE.md §5
--   Medical: the ONLY role with any access at all. Reads every note in its own
--     organisation, appends new ones, stamped with its own user id.
--   Athlete: NO access — including, and especially, to notes written on their OWN
--     report. This is the assertion the whole table exists for. The athlete sees
--     their report and its status (0040); they never see what the medic wrote
--     about it.
--   Coach: no access, same as problem_reports itself — 01-roles-and-permissions.md
--     §1 routes a report "to medical staff", and a note about a report is strictly
--     more sensitive than the report.
--   Admin: no access, same as every per-athlete data domain.
--   Nobody, medical included, updates or deletes a note. A written note is a
--     record; a correction is a new note. No update/delete grant for authenticated
--     at all, so both raise 42501 rather than quietly matching zero rows.
--   Cross-org: orgb's medic reads none of orga's notes and cannot append one to
--     orga's report, naming EITHER org's id.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 0. A report to hang notes off, in each org. The athlete files it, exactly as
--    210_problem_reports_test.sql covers in detail.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$insert into problem_reports (id, org_id, athlete_id, category, body, created_by)
            values (%L, %L, %L, 'injury_or_pain',
                    'My left hamstring has felt tight since Tuesday and it is getting worse.', %L)$q$,
         tests.uid('orga','report_1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_athlete_1')),
  'orga athlete_1 files the report the notes below are written against'
);

select tests.set_jwt(tests.uid('orgb', 'user_athlete_1'));
select lives_ok(
  format($q$insert into problem_reports (id, org_id, athlete_id, body, created_by)
            values (%L, %L, %L, 'Orgb has its own report, for the cross-tenant section.', %L)$q$,
         tests.uid('orgb','report_1'), tests.uid('orgb','org'), tests.uid('orgb','athlete_1'),
         tests.uid('orgb','user_athlete_1')),
  'orgb athlete_1 files a report in orgb'
);


-- ===========================================================================
-- 1. Appending a note: medical only, in their own name
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into problem_report_notes (id, org_id, report_id, body, created_by)
            values (%L, %L, %L, 'Called him Wednesday. Tightness on the bike only, full ROM, no pain on resisted flexion. Watching Thursday.', %L)$q$,
         tests.uid('orga','note_1'), tests.uid('orga','org'), tests.uid('orga','report_1'),
         tests.uid('orga','user_medical')),
  'medical appends a note to a report in their own organisation'
);

select lives_ok(
  format($q$insert into problem_report_notes (id, org_id, report_id, body, created_by)
            values (%L, %L, %L, 'Thursday: symptom free through the session. Closing this one.', %L)$q$,
         tests.uid('orga','note_2'), tests.uid('orga','org'), tests.uid('orga','report_1'),
         tests.uid('orga','user_medical')),
  'medical appends a second note to the same report — notes are an append log, not one overwritable field'
);

select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, 'Attributed to the coach.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','report_1'), tests.uid('orga','user_coach')),
  '42501', null,
  'a medic cannot attribute a note to another user — created_by must be the acting user'
);

select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, repeat('x', 1001), %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','report_1'), tests.uid('orga','user_medical')),
  '23514', null,
  'the note body is bounded at 1000 characters, same as the report body it annotates'
);

select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, '   ', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','report_1'), tests.uid('orga','user_medical')),
  '23514', null,
  'a whitespace-only note is refused'
);

-- The subject of the report is the person who must not be able to write here
-- either: a note is the medic's record, not a correspondence thread.
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, 'The athlete adding to their own report.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','report_1'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'the reporting athlete cannot append a note to their own report'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, 'A coach writing on a medical report.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','report_1'), tests.uid('orga','user_coach')),
  '42501', null,
  'a coach cannot append a note — coach has no access to this domain at all'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, 'An admin writing on a medical report.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','report_1'), tests.uid('orga','user_admin')),
  '42501', null,
  'an admin cannot append a note either'
);


-- ===========================================================================
-- 2. Reads: medical org-wide, and NOBODY else — least of all the athlete the
--    note is about. This is the section the separate table exists for.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orga','org')),
  0::bigint,
  'the athlete reads ZERO notes on their OWN report — the reason this is a separate table and not a column on problem_reports'
);
-- And explicitly by their own report id, the exact shape a hand-written
-- PostgREST call from the athlete app would take.
select is(
  (select count(*) from problem_report_notes where report_id = tests.uid('orga','report_1')),
  0::bigint,
  'the athlete reads zero even when naming their own report id directly'
);
-- The athlete still reads the report itself, unchanged by migration 0055.
select is(
  (select count(*) from problem_reports where id = tests.uid('orga','report_1')),
  1::bigint,
  'the athlete still reads their own report row — 0055 changes nothing about 0040''s trust loop'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orga','org')),
  0::bigint,
  'a teammate reads zero notes'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orga','org')),
  0::bigint,
  'a coach reads ZERO notes — not the body, not the existence, same as the report itself'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orga','org')),
  0::bigint,
  'an admin reads zero notes'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orga','org')),
  2::bigint,
  'medical reads every note in the organisation — org-wide, not only the ones they wrote'
);


-- ===========================================================================
-- 3. A written note is a record: no update, no delete, for anyone
-- ===========================================================================

select throws_ok(
  format($q$update problem_report_notes set body = 'tidied up' where id = %L$q$,
         tests.uid('orga','note_1')),
  '42501', null,
  'medical cannot rewrite a note — no update policy and no update grant, a correction is a new note'
);

select throws_ok(
  format($q$update problem_report_notes set deleted_at = now() where id = %L$q$,
         tests.uid('orga','note_1')),
  '42501', null,
  'medical cannot soft-delete a note either — erasure is the audited service path only'
);

select throws_ok(
  format($q$delete from problem_report_notes where id = %L$q$, tests.uid('orga','note_1')),
  '42501', null,
  'nobody holding the authenticated role can hard-delete a note (CLAUDE.md rule 4)'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$delete from problem_report_notes where report_id = %L$q$, tests.uid('orga','report_1')),
  '42501', null,
  'the athlete cannot hard-delete notes about themselves either'
);


-- ===========================================================================
-- 4. Cross-org: orgb's medic reads nothing of orga's and cannot write into it
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_medical'));
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orga','org')),
  0::bigint,
  'orgb''s physio reads zero of orga''s notes'
);
select is(
  (select count(*) from problem_report_notes where report_id = tests.uid('orga','report_1')),
  0::bigint,
  'orgb''s physio reads zero naming orga''s report id directly'
);

select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, 'Cross-tenant note, orga org_id.', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','report_1'), tests.uid('orgb','user_medical')),
  '42501', null,
  'orgb''s physio cannot append to orga''s report naming orga''s org_id explicitly'
);
select throws_ok(
  format($q$insert into problem_report_notes (org_id, report_id, body, created_by)
            values (%L, %L, 'Cross-tenant note, own org_id.', %L)$q$,
         tests.uid('orgb','org'), tests.uid('orga','report_1'), tests.uid('orgb','user_medical')),
  '42501', null,
  'orgb''s physio cannot append to orga''s report even naming orgb''s own org_id — the parent-report exists() check fails to find it under orgb'
);

-- The mirror: orgb's own report is writable by orgb's own physio, so the
-- refusals above are tenancy, not a broken policy.
select lives_ok(
  format($q$insert into problem_report_notes (id, org_id, report_id, body, created_by)
            values (%L, %L, %L, 'Orgb''s physio writing on orgb''s own report.', %L)$q$,
         tests.uid('orgb','note_1'), tests.uid('orgb','org'), tests.uid('orgb','report_1'),
         tests.uid('orgb','user_medical')),
  'orgb''s physio appends a note to orgb''s own report — the policy works, it is the tenancy that refused above'
);
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orgb','org')),
  1::bigint,
  'orgb''s physio reads exactly their own org''s single note'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from problem_report_notes where org_id = tests.uid('orgb','org')),
  0::bigint,
  'and orga''s physio reads none of orgb''s — isolation in both directions'
);

select * from finish();
rollback;
