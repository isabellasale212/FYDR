-- 0110_gym_closed_log_no_new_set.sql
--
-- §0bc — decided by Isabella 2026-09-12, built 2026-09-13: "a COMPLETE gym
-- session refuses a NEW set at the database. Corrections to existing sets
-- stay allowed."
--
-- WHAT WAS FOUND. Nothing at the database stops a new set landing on a closed
-- gym session log; only the screen does. gym_set_logs_self_insert (0021)
-- checks org and "the log is the caller's", and no later migration, trigger
-- or constraint reads the parent log's status — proved on scratch inside a
-- rolled-back transaction (12 live rows → 13). Sets done, MET-041 session
-- volume, MET-040 bests, the coach's positional band, compliance and My data
-- all sum the live sets of a complete log; a set added after the fact changes
-- adherence and the bests retrospectively with completed_at unmoved, from
-- any client the athlete's token reaches.
--
-- WHAT THIS DOES. One BEFORE INSERT trigger on gym_set_logs, for every caller
-- (the service role included — the rule is about the record, not who asks):
-- when the parent gym_session_logs.status is 'complete' and the new row's
-- revision_of is null, raise P0001 session_log_closed. revise_gym_set_log
-- (0045) inserts its replacement row WITH revision_of, so a correction of an
-- existing set on a closed log still lands — its identity columns come from
-- the original row, so it can only re-occupy the slot it fixes. An
-- in_progress log takes new sets exactly as before. A trigger rather than the
-- policy's with-check, so the security-definer correction path and the plain
-- insert path meet one rule. Test: 660_gym_closed_log_no_new_set_test.sql
-- (asserts the old rule is gone).
--
-- THE APP: submitGymSetLog humanises session_log_closed, and flushGymSets
-- treats it as a flagged item (shown once on Today, never retried) — a set
-- queued offline before Finish and flushed after it would otherwise retry
-- for ever against a rule that will never change its mind.

create or replace function public.gym_set_logs_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.gym_log_status;
begin
  if new.revision_of is not null then
    return new; -- a correction: revise_gym_set_log's own insert
  end if;
  select gsl.status into v_status
    from public.gym_session_logs gsl
   where gsl.id = new.gym_session_log_id;
  if v_status = 'complete' then
    raise exception using
      errcode = 'P0001',
      message = 'session_log_closed',
      detail  = format('gym session log %s is complete; a new set cannot be added to it', new.gym_session_log_id),
      hint    = 'Correct a logged set instead. 0110_gym_closed_log_no_new_set.sql';
  end if;
  return new;
end;
$$;

drop trigger if exists gym_set_logs_guard_insert on public.gym_set_logs;
create trigger gym_set_logs_guard_insert
  before insert on public.gym_set_logs
  for each row execute function public.gym_set_logs_guard_insert();

comment on function public.gym_set_logs_guard_insert() is
  '0110 (§0bc): a complete gym session log refuses a new set (session_log_closed); '
  'a correction (revision_of set, revise_gym_set_log) still lands. Every caller.';
