-- 230_generate_compliance_expectations_test.sql
--
-- public.generate_compliance_expectations(org, date) — migration 0044. The nightly-
-- equivalent job docs/04-data-model.md §11 and docs/05-architecture.md §7 both describe
-- ("Expectations are generated nightly from the schedule and week template for the
-- following day") but that, until this migration, had no generation mechanism anywhere
-- in the schema: compliance_expectations had exactly one writer, supabase/seed.sql's own
-- bulk insert, confirmed by src/lib/queries/weekTemplates.ts's own header comment
-- ("nothing has ever written a fresh compliance_expectations row past initial seed").
--
-- Written BEFORE the migration, per CLAUDE.md §5.
--
-- No psql meta-commands (\gset, \set): scripts/test-tenancy.mjs falls back to a plain
-- Node/pg statement runner when psql is not on PATH, and that runner has no meta-command
-- support at all. The one genuinely dynamic value this file needs — the fixture session's
-- own local calendar date, which depends on wall-clock time at test-run time, not a fixed
-- constant like tests.uid()'s deterministic ids — is threaded through with
-- set_config()/current_setting() instead, the same technique tests.set_jwt() already uses
-- in 000_setup_test_helpers.sql.
--
-- What this test asserts, and why
--   1. Idempotent: two calls for the same org+date insert the row set once, never twice.
--      This is the whole point of the function — a missed run, a retried cron tick, or a
--      manual backfill overlapping a date that already has rows must never duplicate.
--   2. Wellness: one row per active athlete per org per day, session_id null,
--      unconditional on the schedule. This is a deliberate divergence from
--      03-flows.md's "no wellness entry expected on a rest day" language — documented at
--      length in migration 0044's own header — chosen because it is what seed.sql's
--      reference implementation actually does (04-data-model.md §11's bulk insert) and
--      because this build's live schedule currently has no sessions at all past its seed
--      window for either organisation, so a session-gated rule would leave the whole
--      compliance product dark. `left_club` athletes are excluded; other-org athletes are
--      never touched.
--   3. training_rpe: one row per (session, resolved participant) where
--      sessions.requires_rpe is true, session_id set, matching seed.sql's own generation
--      (session_type in training/gym/match all produce a training_rpe expectation — RPE
--      is "how hard was it", asked after any session type except a meeting).
--   4. gym: one row per (session, resolved participant) for session_type = 'gym' only —
--      net new versus seed.sql, which never generated this domain at all despite
--      docs/screens/squad-status.md's read-side query already having a domain = 'gym'
--      branch that reads gym_session_logs. Filling in the write side that was always
--      meant to exist alongside it.
--   5. Participant resolution matches docs/screens/session-detail.md's own "resolved"
--      CTE exactly: zero session_participants rows means the whole squad; named
--      individuals and group members (as at session start, group_memberships is
--      historical) are unioned.
--   6. Cancelled and soft-deleted sessions generate nothing.
--   7. A pre-existing waived row (is_required = false, waived_reason set) is never
--      touched by a re-run — the function only inserts missing rows, it never updates.
--   8. Cross-org: generating for orga never writes a row into orgb, and vice versa.
--   9. An unknown/deleted org raises rather than silently doing nothing.

begin;
select * from no_plan();

select tests.fixtures();

-- Stays on the connecting (superuser) role throughout this file, deliberately: the
-- function under test is security definer with execute revoked from public/authenticated
-- (0044's own grants, mirroring 0034_retention_revoke_public_execute.sql), so it is only
-- ever invoked by pg_cron or a direct service connection — never through PostgREST RPC —
-- and this file exercises exactly that calling shape.

-- tests.fixtures() dates its one session at starts_at = now() - 1 day, but its
-- group_memberships row (the 'Forwards' group both fixture athletes belong to) is dated
-- added_at = now() — the moment fixtures() ran. Participant resolution is historical, as
-- at the session's own starts_at (session-detail.md's own rule, matched exactly by this
-- migration): a membership added AFTER a session already happened does not resolve for
-- that session. That is correct behaviour, and it means the fixture's own session, used
-- unmodified, would resolve zero group-based participants — not a bug in the function,
-- a mismatch between this fixture's two timestamps. Moved into the future instead of
-- backdating the membership, so this file never mutates the shared tests.build_org()
-- fixture shape other test files may also depend on.
update public.sessions
   set starts_at = now() + interval '1 day'
 where id = tests.uid('orga', 'session');

-- Stash the fixture session's own local calendar date, computed the same way the
-- function does, rather than hard-coding a value that would drift with wall-clock time.
select set_config(
  'fydr_test.expectation_date',
  (select ((s.starts_at at time zone o.timezone)::date)::text
     from public.sessions s
     join public.organisations o on o.id = s.org_id
    where s.id = tests.uid('orga', 'session')),
  true
);


-- ===========================================================================
-- 1. First run: wellness for both athletes, training_rpe for the one session
-- ===========================================================================

select isnt(
  public.generate_compliance_expectations(
    tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date),
  null,
  'generate_compliance_expectations returns a row count without raising'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'wellness'),
  2,
  'wellness: exactly one row per active athlete (2 fixture athletes), no more'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'wellness' and session_id is not null),
  0,
  'wellness rows are never session-linked'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe' and session_id = tests.uid('orga', 'session')),
  2,
  'training_rpe: one row per resolved participant of the one fixture session (2, via the Forwards group)'
);

select is(
  (select is_required from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe' and session_id = tests.uid('orga', 'session')
      and athlete_id = tests.uid('orga', 'athlete_1')),
  true,
  'a freshly generated expectation is required by default, no auto-waiving from schedule generation alone'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'gym'),
  0,
  'gym: zero rows — the one fixture session is session_type=training, not gym'
);


-- ===========================================================================
-- 2. Idempotency: same org+date again inserts nothing new
-- ===========================================================================

select is(
  public.generate_compliance_expectations(
    tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date),
  0,
  'a second call for the same org+date inserts zero additional rows'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'wellness'),
  2,
  'wellness row count is unchanged after the second call — no duplicates'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe' and session_id = tests.uid('orga', 'session')),
  2,
  'training_rpe row count is unchanged after the second call — no duplicates'
);


-- ===========================================================================
-- 3. A pre-existing waiver survives a re-run untouched
-- ===========================================================================

update public.compliance_expectations
   set is_required = false, waived_reason = 'Unavailable through injury, wellness not required'
 where org_id = tests.uid('orga', 'org')
   and expectation_date = current_setting('fydr_test.expectation_date')::date
   and domain = 'wellness' and athlete_id = tests.uid('orga', 'athlete_1');

select public.generate_compliance_expectations(
  tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);

select is(
  (select waived_reason from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'wellness' and athlete_id = tests.uid('orga', 'athlete_1')),
  'Unavailable through injury, wellness not required',
  'a manually waived expectation keeps its waiver after re-generation — the function inserts missing rows only, it never updates'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'wellness' and athlete_id = tests.uid('orga', 'athlete_1')),
  1,
  'still exactly one wellness row for that athlete/date — the waiver did not spawn a duplicate'
);


-- ===========================================================================
-- 4. Cancelled and soft-deleted sessions generate nothing
-- ===========================================================================

update public.sessions set status = 'cancelled' where id = tests.uid('orga', 'session');

delete from public.compliance_expectations
 where org_id = tests.uid('orga', 'org')
   and expectation_date = current_setting('fydr_test.expectation_date')::date
   and domain = 'training_rpe';

select public.generate_compliance_expectations(
  tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe'),
  0,
  'a cancelled session generates no training_rpe expectation'
);

update public.sessions set status = 'completed', deleted_at = now()
 where id = tests.uid('orga', 'session');

select public.generate_compliance_expectations(
  tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe'),
  0,
  'a soft-deleted session generates no training_rpe expectation either'
);

update public.sessions set deleted_at = null, status = 'completed'
 where id = tests.uid('orga', 'session');


-- ===========================================================================
-- 5. Gym domain: a gym-type session generates a gym expectation, not training_rpe only
-- ===========================================================================

update public.sessions set session_type = 'gym' where id = tests.uid('orga', 'session');

delete from public.compliance_expectations
 where org_id = tests.uid('orga', 'org')
   and expectation_date = current_setting('fydr_test.expectation_date')::date
   and domain in ('training_rpe', 'gym');

select public.generate_compliance_expectations(
  tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'gym' and session_id = tests.uid('orga', 'session')),
  2,
  'a gym-type session generates a gym-domain expectation for each resolved participant'
);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe' and session_id = tests.uid('orga', 'session')),
  2,
  'a gym-type session with requires_rpe still generates its training_rpe expectation too — RPE and the gym log are two different asks'
);

update public.sessions set session_type = 'training' where id = tests.uid('orga', 'session');


-- ===========================================================================
-- 6. Individually-named participant, not just group resolution
-- ===========================================================================

delete from public.session_participants where session_id = tests.uid('orga', 'session');
insert into public.session_participants (org_id, session_id, athlete_id)
  values (tests.uid('orga', 'org'), tests.uid('orga', 'session'), tests.uid('orga', 'athlete_1'));

delete from public.compliance_expectations
 where org_id = tests.uid('orga', 'org')
   and expectation_date = current_setting('fydr_test.expectation_date')::date
   and domain = 'training_rpe';

select public.generate_compliance_expectations(
  tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);

select is(
  (select array_agg(athlete_id order by athlete_id) from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe'),
  ARRAY[tests.uid('orga', 'athlete_1')],
  'an individually named participant resolves to just that athlete, not the whole group'
);

-- Zero participant rows means the whole squad (session-detail.md's own rule).
delete from public.session_participants where session_id = tests.uid('orga', 'session');

delete from public.compliance_expectations
 where org_id = tests.uid('orga', 'org')
   and expectation_date = current_setting('fydr_test.expectation_date')::date
   and domain = 'training_rpe';

select public.generate_compliance_expectations(
  tests.uid('orga', 'org'), current_setting('fydr_test.expectation_date')::date);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'training_rpe'),
  2,
  'zero session_participants rows resolves to the whole squad (both fixture athletes)'
);

insert into public.session_participants (org_id, session_id, group_id)
  values (tests.uid('orga', 'org'), tests.uid('orga', 'session'), tests.uid('orga', 'group'));


-- ===========================================================================
-- 7. Cross-org: generating for orga never writes into orgb, and vice versa
-- ===========================================================================

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orgb', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date),
  0,
  'orga''s generation runs wrote nothing into orgb for the same date'
);

select public.generate_compliance_expectations(
  tests.uid('orgb', 'org'), current_setting('fydr_test.expectation_date')::date);

select is(
  (select count(*)::int from public.compliance_expectations
    where org_id = tests.uid('orga', 'org')
      and expectation_date = current_setting('fydr_test.expectation_date')::date
      and domain = 'wellness'),
  2,
  'generating for orgb afterwards left orga''s rows exactly as they were'
);


-- ===========================================================================
-- 8. An unknown or deleted organisation raises rather than silently no-op'ing
-- ===========================================================================

select throws_ok(
  format($q$select public.generate_compliance_expectations(%L::uuid, current_date)$q$,
         '00000000-0000-4000-8000-000000000000'),
  'P0001', null,
  'a non-existent org raises org_not_found rather than doing nothing quietly'
);

select * from finish();
rollback;
