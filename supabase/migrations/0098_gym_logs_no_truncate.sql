-- TRUNCATE cannot empty the gym logs, because a truncate leaves no audit trail.
--
-- THE HOLE 0097 LEFT AND NAMED. That migration audits every DELETE on
-- gym_set_logs and gym_session_logs, row by row, with the values destroyed. A
-- TRUNCATE walks straight past all of it: it fires no row-level triggers, so
-- 263 rows can leave with no record that they ever existed. And service_role
-- holds TRUNCATE on both tables — measured, on both databases.
--
-- SO THE ANSWER IS NOT TO AUDIT IT BUT TO REFUSE IT, which is exactly what 0007
-- decided for audit_log itself: "Truncate would empty the evidence in one
-- statement and leave no trace." A statement-level BEFORE TRUNCATE trigger
-- raises, and unlike a grant it holds against service_role too.
--
-- WHY THESE TWO TABLES AND NOT A SWEEP. gym_set_logs is an ADR-005 immutable
-- entry (0045) whose whole design is that history is kept and corrected rather
-- than replaced, and gym_session_logs is its parent with `on delete cascade`.
-- A table built around never losing a row should not be emptiable in one
-- statement. Whether the same argument extends to wellness_entries,
-- training_entries and nutrition_checkins is a real question and deliberately
-- not answered here — it is the same shape of question 0097 left about this one,
-- and it wants the same explicit decision rather than a mechanical widening.
--
-- WHAT IT COSTS, and this is the part that needed Isabella's approval rather
-- than my judgement. scripts/reset-scratch.mjs truncates every public table in
-- ONE statement, and already has to LIFT audit_log's guard to do it. Its header
-- says the three reasons that lift is acceptable "none of them generalise", and
-- that it was approved explicitly because "disabling an audit-log protection is
-- not something to do on an agent's own judgement". This migration makes that
-- list three triggers instead of one. The script now derives the list from the
-- database rather than naming them, so a fourth guard added later is lifted and
-- restored without anybody remembering to edit it — and it still verifies every
-- one is back before it exits.
--
-- A SUPERUSER still bypasses triggers entirely. 0085 records that limit; it is
-- unchanged and unchangeable from here.
--
-- TO REVERSE:
--   drop trigger gym_set_logs_no_truncate on gym_set_logs;
--   drop trigger gym_session_logs_no_truncate on gym_session_logs;

create or replace function public.gym_log_no_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'truncate is not permitted on %: 0097 audits every row deleted from it, and a truncate fires no row triggers',
    tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.gym_log_no_truncate() is
  'Refuses TRUNCATE on the gym log tables. A truncate would empty rows that '
  '0097 exists to record, past every row-level trigger. Same decision 0007 took '
  'for audit_log. 0098.';

drop trigger if exists gym_set_logs_no_truncate on public.gym_set_logs;
create trigger gym_set_logs_no_truncate
  before truncate on public.gym_set_logs
  for each statement execute function public.gym_log_no_truncate();

drop trigger if exists gym_session_logs_no_truncate on public.gym_session_logs;
create trigger gym_session_logs_no_truncate
  before truncate on public.gym_session_logs
  for each statement execute function public.gym_log_no_truncate();
