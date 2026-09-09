-- A removed gym row leaves the row behind in the audit log.
--
-- WHAT 0096 LEFT OPEN. It audits gym corrections and says a DELETE is "a real
-- question and a separate one". Measured on both databases: `authenticated`
-- holds INSERT and SELECT only, `service_role` holds DELETE and TRUNCATE, and
-- nothing recorded either. So a set log can only be removed from below the app,
-- and that left no trace — the same shape as the 2026-09-07 incident 0085's
-- header records, and the same shape as the two rows removed from production by
-- hand on 2026-09-09 during the -3 repair.
--
-- THE TWO HALVES THIS FILE PROVES, and the second is why the file exists rather
-- than a comment: that no authenticated role can delete at all, and that when
-- somebody below the app does, the values are kept.
--
-- WRITTEN PARTLY AS SUPERUSER, deliberately and unusually. A delete cannot be
-- performed as `authenticated` — that is the point of the first assertion — so
-- the audited deletes run with the role reset, which is exactly how a real one
-- would happen. That also makes the null actor_id below correct rather than a
-- gap: a connection with no JWT has no person to name, and saying so is better
-- than attributing it to somebody who clicked nothing.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o  uuid := tests.uid('orga', 'org');
  a1 uuid := tests.uid('orga', 'athlete_1');
  ex uuid := tests.uid('orga', 'exercise');
begin
  insert into exercises (id, org_id, name, category) values (ex, o, 'Back squat', 'squat');

  -- log_1: one set, deleted directly.
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source)
    values (tests.uid('orga','log_1'), o, a1, current_date, 'in_progress', 'self_report');
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number,
                            reps_completed, load_kg, rpe, is_warmup)
    values (tests.uid('orga','set_1'), o, tests.uid('orga','log_1'), ex, 1, 8, 92.5, 7.5, false);

  -- log_2: complete, with a comment and TWO sets, deleted as a parent so the
  -- cascade can be observed.
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source,
                                started_at, completed_at, session_rpe, comment)
    values (tests.uid('orga','log_2'), o, a1, current_date, 'complete', 'self_report',
            now() - interval '1 hour', now(), 8.0, 'Left knee sore on the last two sets');
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number, reps_completed, load_kg)
    values (tests.uid('orga','set_2a'), o, tests.uid('orga','log_2'), ex, 1, 5, 100),
           (tests.uid('orga','set_2b'), o, tests.uid('orga','log_2'), ex, 2, 5, 105);
end $$;

-- ------------------------------------------------ 1. no app role may delete
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on, so the refusal below measures something');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select throws_ok(
  format($q$delete from gym_set_logs where id = %L$q$, tests.uid('orga','set_1')),
  '42501',
  null,
  'an athlete cannot delete their own set log — there is no delete grant to authenticated at all'
);
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$delete from gym_session_logs where id = %L$q$, tests.uid('orga','log_1')),
  '42501',
  null,
  'and neither can the sport scientist — deletion is not an application operation (0021)'
);

-- --------------------------------- 2. a delete from below the app is recorded
reset role;
/* reset role does NOT clear request.jwt.claims — it is transaction-local config,
   not a role attribute — so the first run of this file recorded the sport
   scientist as the actor of a superuser delete. Cleared explicitly, because the
   whole point of the assertion below is that a connection below the app has
   nobody to name. */
select set_config('request.jwt.claims', '', true);
delete from gym_set_logs where id = tests.uid('orga','set_1');

set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));   -- only they may read audit_log

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga','set_1')),
  1,
  'removing a set log writes exactly one audit row'
);
select is(
  (select action from audit_log where entity_id = tests.uid('orga','set_1')),
  'gym_set_logs.delete',
  'under the same action name the -3 repair wrote by hand, so the log reads as one thing'
);
select is(
  (select athlete_id from audit_log where entity_id = tests.uid('orga','set_1')),
  tests.uid('orga','athlete_1'),
  'gym_set_logs carries no athlete_id, and the row names the athlete anyway, through the parent'
);
select ok(
  (select actor_id is null from audit_log where entity_id = tests.uid('orga','set_1')),
  'the actor is null, because a connection below the app has no person to name'
);

/* THE VALUES, which for a delete are the entire point: a correction leaves the
   old value reachable through the revision chain, a delete destroys it. */
select is(
  (select metadata -> 'removed' ->> 'reps_completed' from audit_log where entity_id = tests.uid('orga','set_1')),
  '8', 'the reps that were destroyed are kept'
);
select is(
  (select metadata -> 'removed' ->> 'load_kg' from audit_log where entity_id = tests.uid('orga','set_1')),
  '92.50', 'and the load'
);
select is(
  (select metadata -> 'removed' ->> 'volume_kg' from audit_log where entity_id = tests.uid('orga','set_1')),
  '740.00', 'and the generated volume, so a total can be reconciled afterwards'
);
select ok(
  (select (metadata ->> 'via_cascade')::boolean = false
     from audit_log where entity_id = tests.uid('orga','set_1')),
  'and it is marked as a direct delete, not a cascade'
);

-- ------------------------------------ 3. a parent delete marks its cascade
reset role;
select set_config('request.jwt.claims', '', true);
delete from gym_session_logs where id = tests.uid('orga','log_2');

set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));

select is(
  (select count(*)::int from audit_log
    where entity_id in (tests.uid('orga','log_2'), tests.uid('orga','set_2a'), tests.uid('orga','set_2b'))),
  3,
  'deleting a session log records the session AND both sets the cascade took with it'
);
select is(
  (select count(*)::int from audit_log
    where entity_id in (tests.uid('orga','set_2a'), tests.uid('orga','set_2b'))
      and (metadata ->> 'via_cascade')::boolean),
  2,
  'both child rows are marked via_cascade, so twenty sets never read as twenty separate acts'
);
/* The cost of the cascade, asserted rather than left to be discovered: the row
   naming the athlete is already gone, so these carry a null athlete and the
   parent's id instead. */
select is(
  (select count(*)::int from audit_log
    where entity_id in (tests.uid('orga','set_2a'), tests.uid('orga','set_2b'))
      and athlete_id is null),
  2,
  'and they carry no athlete, because the row that named them went first'
);
select is(
  (select count(distinct metadata -> 'removed' ->> 'gym_session_log_id')::int from audit_log
    where entity_id in (tests.uid('orga','set_2a'), tests.uid('orga','set_2b'))),
  1,
  'they both name the parent, so a reader reaches the row that does name the athlete'
);
select ok(
  (select (metadata ->> 'via_cascade')::boolean = false
     from audit_log where entity_id = tests.uid('orga','log_2')),
  'while the parent itself is not — it is the act'
);
select is(
  (select metadata -> 'removed' ->> 'session_rpe' from audit_log where entity_id = tests.uid('orga','log_2')),
  '8.0', 'the session RPE that was destroyed is kept'
);

/* THE ONE VALUE DELIBERATELY NOT KEPT, carried over from 0096. A session comment
   is an athlete writing about their own body, and audit_log is sport-scientist
   readable. Presence and length, never the text — which does mean a deleted
   comment is unrecoverable from here, and that is the trade. */
select ok(
  (select (metadata -> 'removed' ->> 'comment_present')::boolean
     from audit_log where entity_id = tests.uid('orga','log_2')),
  'the row records that a comment existed'
);
select is(
  (select metadata -> 'removed' ->> 'comment_length' from audit_log where entity_id = tests.uid('orga','log_2')),
  '35', 'and how much was lost'
);
select ok(
  not exists (select 1 from audit_log where metadata::text like '%knee sore%'),
  'but never what it said, in any row this file wrote'
);

-- ------------------------------------------------------------- no key drift
select is(
  (select count(*)::int from (
     select jsonb_object_keys(metadata) as k from audit_log
     where action in ('gym_set_logs.delete', 'gym_session_logs.delete')
   ) keys where k not in ('removed', 'via_cascade')),
  0,
  'no delete row carries a metadata key outside the two this migration defines'
);

-- ------------------------------- 4. the truncate guard is the right SHAPE
/* The refusal itself is proved in 530, which must run before any DML: a
   transaction that has already deleted rows has PENDING TRIGGER EVENTS, and
   TRUNCATE then fails with 55006 before reaching the guard at all — the same
   error a deferred FK produced during the -3 repair. What CAN be checked here is
   the shape, and the shape is the whole point: only a BEFORE, statement-level
   trigger stops a truncate. A later edit making it FOR EACH ROW would leave a
   trigger that a truncate walks straight past. */
select is(
  (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relname in ('gym_set_logs','gym_session_logs')
      and not t.tgisinternal
      and (t.tgtype & 32) <> 0        -- fires on TRUNCATE
      and (t.tgtype & 2) <> 0         -- BEFORE
      and (t.tgtype & 1) = 0),        -- statement-level, not FOR EACH ROW
  2,
  'both truncate guards are BEFORE and statement-level, the only shape that stops a truncate'
);

select * from finish();
rollback;
