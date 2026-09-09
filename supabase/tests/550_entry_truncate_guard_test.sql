-- TRUNCATE is refused on the other three immutable entry tables.
--
-- ITS OWN FILE FOR THE REASON 530 GIVES, which cost a false proof to learn: a
-- transaction that has already written carries PENDING TRIGGER EVENTS, and
-- TRUNCATE then fails with 55006 BEFORE reaching any BEFORE TRUNCATE trigger.
-- Asserting the refusal after 540's inserts would catch 55006 and never reach
-- the guard. So this file runs the attempts first, with no DML and no fixtures.
--
-- WHAT IT PROVES. 0099 audits every row deleted from these three, with the
-- values destroyed. A truncate fires no row triggers, so it would empty all of
-- them past every one of those rows — and service_role holds TRUNCATE on each,
-- measured rather than assumed. 0098 took this decision for the gym logs and
-- 0007 took it for audit_log first: refuse, rather than try to audit an
-- unauditable statement.

begin;
select * from no_plan();

-- Nothing above this line writes, so there are no pending trigger events and the
-- guards are actually reached.
reset role;

select throws_ok('truncate table wellness_entries', '42501', null,
  'TRUNCATE on wellness_entries is refused, even on a connection that holds the grant');
select throws_ok('truncate table training_entries', '42501', null,
  'and on training_entries');
select throws_ok('truncate table nutrition_checkins', '42501', null,
  'and on nutrition_checkins');

/* CASCADE is the one that would slip past a per-table habit: it reaches tables
   nobody named in the statement. */
select throws_ok('truncate table wellness_entries cascade', '42501', null,
  'and CASCADE does not get round it either');

select throws_like('truncate table training_entries',
  '%0099 audits every row deleted from it%',
  'and the refusal explains itself, naming the audit trail it protects');
select throws_like('truncate table nutrition_checkins',
  '%nutrition_checkins%',
  'and names the table, because whoever meets this is already doing something unusual');

select * from finish();
rollback;
