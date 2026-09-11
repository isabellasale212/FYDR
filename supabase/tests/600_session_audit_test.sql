-- 600_session_audit_test.sql
--
-- §0al second half, decided 2026-09-11: publishing a session to athletes, and
-- removing one, write audit rows. Migration 0104 puts triggers on sessions and
-- session_participants of the same shape as 0097/0099. This file exercises
-- every event as the coach the app would run them as:
--
--   1. create              → sessions.create, actor the coach, the fields
--   2. update (starts_at)  → sessions.update with changed.starts_at from/to
--   3. update (nothing)    → no row: an updated_at-only touch is not an act
--   4. soft delete         → sessions.delete, soft: true, the session as it was
--   5. participant add     → session_participants.add with the group
--   6. participant remove  → session_participants.remove, not via cascade
--   7. hard delete cascade → sessions.delete soft: false, and the participant
--                            removal marked via_cascade (as service role, since
--                            authenticated holds no delete)
--   8. truncate refused on both tables

begin;
select * from no_plan();

select tests.fixtures();

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the assertions below');
select tests.set_jwt(tests.uid('orga', 'user_coach'));

-- ===========================================================================
-- 1. Create
-- ===========================================================================
insert into sessions (id, org_id, season_id, session_type, title, starts_at, duration_min, location, md_offset, created_by)
values (tests.uid('orga', 'audited_session'), tests.uid('orga', 'org'), tests.uid('orga', 'season'),
        'training', 'Reviewer publish test', '2026-09-13T08:00:00Z', 60, 'Main pitch', 1, tests.uid('orga', 'user_coach'));

-- ===========================================================================
-- 2. Update a field the log cares about
-- ===========================================================================
update sessions set starts_at = '2026-09-13T09:00:00Z' where id = tests.uid('orga', 'audited_session');

-- ===========================================================================
-- 3. Touch nothing audited
-- ===========================================================================
update sessions set updated_at = now() where id = tests.uid('orga', 'audited_session');

-- ===========================================================================
-- 5 / 6. A participant added, then removed
-- ===========================================================================
insert into session_participants (id, org_id, session_id, group_id)
values (tests.uid('orga', 'audited_participant'), tests.uid('orga', 'org'), tests.uid('orga', 'audited_session'), tests.uid('orga', 'group'));
delete from session_participants where id = tests.uid('orga', 'audited_participant');

-- ===========================================================================
-- 4. Soft delete — the app's only removal path (deleteSession sets deleted_at)
-- ===========================================================================
update sessions set deleted_at = now() where id = tests.uid('orga', 'audited_session');

-- Read as the sport scientist, the one role that may read audit_log.
select tests.set_jwt(tests.uid('orga', 'user_admin'));

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.create'),
  1, '1. the create wrote one sessions.create row'
);
select is(
  (select actor_id from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.create'),
  tests.uid('orga', 'user_coach'), 'attributed to the coach who created it'
);
select is(
  (select actor_role::text from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.create'),
  'coach', 'in the role they acted in'
);
select is(
  (select metadata -> 'session' ->> 'title' from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.create'),
  'Reviewer publish test', 'carrying the title in full — a staff-authored scheduling fact, not anyone''s own words'
);
select is(
  (select (metadata -> 'session' ->> 'duration_min')::int from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.create'),
  60, 'and the duration'
);
select ok(
  (select (metadata -> 'session' ->> 'notes_present')::boolean = false and (metadata -> 'session' ->> 'notes_length')::int = 0
     from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.create'),
  'notes as presence and length only'
);

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.update'),
  1, '2/3. exactly one sessions.update — the updated_at-only touch wrote nothing'
);
select is(
  (select metadata -> 'changed' -> 'starts_at' ->> 'to' from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.update'),
  '2026-09-13T09:00:00+00:00', 'the update says what starts_at became'
);
select is(
  (select metadata -> 'changed' -> 'starts_at' ->> 'from' from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.update'),
  '2026-09-13T08:00:00+00:00', 'and what it was'
);
select is(
  (select count(*)::int from jsonb_object_keys((select metadata -> 'changed' from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.update')) k),
  1, 'and names only the field that moved'
);

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.delete'),
  1, '4. the soft delete wrote one sessions.delete row'
);
select ok(
  (select (metadata ->> 'soft')::boolean and metadata -> 'removed' ->> 'title' = 'Reviewer publish test'
     from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.delete'),
  'marked soft, carrying the session as it was'
);

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga', 'audited_participant') and action = 'session_participants.add'),
  1, '5. adding the group wrote session_participants.add'
);
select is(
  (select metadata ->> 'group_id' from audit_log where entity_id = tests.uid('orga', 'audited_participant') and action = 'session_participants.add'),
  tests.uid('orga', 'group')::text, 'naming the group'
);
select ok(
  (select (metadata ->> 'via_cascade')::boolean = false
     from audit_log where entity_id = tests.uid('orga', 'audited_participant') and action = 'session_participants.remove'),
  '6. removing it wrote session_participants.remove, a direct act'
);

-- ===========================================================================
-- 7. A hard delete, which only service_role can do, cascades to participants
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
insert into session_participants (id, org_id, session_id, group_id)
values (tests.uid('orga', 'cascaded_participant'), tests.uid('orga', 'org'), tests.uid('orga', 'audited_session'), tests.uid('orga', 'group'));
delete from sessions where id = tests.uid('orga', 'audited_session');

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.delete' and (metadata ->> 'soft')::boolean = false),
  1, '7. the hard delete wrote sessions.delete with soft: false'
);
select ok(
  (select (metadata ->> 'via_cascade')::boolean
     from audit_log where entity_id = tests.uid('orga', 'cascaded_participant') and action = 'session_participants.remove'),
  'and the participant it took with it is marked via_cascade'
);
select is(
  (select actor_id from audit_log where entity_id = tests.uid('orga', 'audited_session') and action = 'sessions.delete' and (metadata ->> 'soft')::boolean = false),
  null, 'with no actor — it came from below the app'
);

-- ===========================================================================
-- 8. Truncate is refused
-- ===========================================================================
-- sessions cannot be truncated in this transaction at all: a plain TRUNCATE
-- is refused by training_entries' foreign key (0A000) and a CASCADE by that
-- table's pending trigger events (55006), both before this migration's
-- trigger gets a turn. So the trigger is asserted structurally here and its
-- behaviour is proved on session_participants, where nothing stands in front
-- of it.
select is(
  (select count(*)::int from pg_trigger where tgname = 'sessions_no_truncate' and tgenabled <> 'D'),
  1, 'sessions carries an enabled BEFORE TRUNCATE trigger'
);
select throws_ok('truncate session_participants', '42501', null, 'truncate session_participants is refused');

select * from finish();
rollback;
