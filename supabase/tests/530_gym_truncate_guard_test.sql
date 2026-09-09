-- TRUNCATE is refused on the gym log tables.
--
-- WHY THIS IS ITS OWN FILE, and it is not tidiness. A transaction that has
-- already deleted or inserted rows carries PENDING TRIGGER EVENTS, and TRUNCATE
-- then fails with 55006 — "cannot TRUNCATE because it has pending trigger
-- events" — BEFORE reaching any BEFORE TRUNCATE trigger. Asserting the refusal
-- inside 520, after its deletes, therefore proved nothing: it caught 55006 and
-- the guard was never reached. (The same 55006 appeared during the -3 repair on
-- 2026-09-09, from a deferred foreign key, and produced a false proof there too
-- until it was noticed.)
--
-- So this file runs the attempt FIRST, with no DML of its own and no fixtures.
--
-- WHAT IT PROVES. 0097 audits every row deleted from gym_set_logs and
-- gym_session_logs, with the values destroyed. A truncate fires no row triggers,
-- so it would empty both tables past all of it — and service_role holds TRUNCATE
-- on each, measured on both databases. 0098 refuses instead of auditing, which
-- is the decision 0007 already took for audit_log: "Truncate would empty the
-- evidence in one statement and leave no trace."

begin;
select * from no_plan();

-- Nothing above this line writes, so there are no pending trigger events and the
-- guard is actually reached.
reset role;

select throws_ok(
  'truncate table gym_set_logs',
  '42501',
  null,
  'TRUNCATE on gym_set_logs is refused, even on a connection that holds the grant'
);

select throws_ok(
  'truncate table gym_session_logs cascade',
  '42501',
  null,
  'and on the parent, where CASCADE would take every set with it'
);

/* The message has to say which table and why, because whoever meets it is
   already doing something unusual and needs to know what it protects. */
select throws_like(
  'truncate table gym_set_logs',
  '%0097 audits every row deleted from it%',
  'and the refusal explains itself, naming the audit trail it protects'
);

/* audit_log's own guard from 0007 must still be there. reset-scratch.mjs now
   derives its lift list from the catalogue, so this is the assertion that the
   list it derives is not empty by accident. */
select is(
  (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal
     and (t.tgtype & 32) <> 0 and (t.tgtype & 2) <> 0),
  3,
  'three BEFORE TRUNCATE guards exist in public: audit_log, gym_set_logs, gym_session_logs'
);

select * from finish();
rollback;
