-- A removed gym row leaves the row behind in the audit log.
--
-- THE GAP 0096 NAMED AND LEFT OPEN. That migration audits gym CORRECTIONS and
-- says in its own header that a DELETE is "a real question and a separate one".
-- This is that question. Measured on both databases rather than read off the
-- migrations:
--
--   authenticated   INSERT, SELECT          -- no delete path at all
--   service_role    DELETE, TRUNCATE, ...   -- and nothing recorded either
--
-- So a set log can only be removed from below the application, and until now
-- that left no trace. That is not hypothetical: 0085's header records the
-- 2026-09-07 incident where two rows were removed exactly that way and nothing
-- recorded it, and on 2026-09-09 two more were removed from production by hand
-- during the -3 repair. Those two were audited only because the repair wrote the
-- audit rows itself, by hand, as `gym_set_logs.delete` — the action name this
-- trigger now produces, so the log reads as one thing rather than two.
--
-- WHY DELETION IS ALWAYS EXCEPTIONAL HERE, which is what makes a row-per-delete
-- affordable. 0021 states the design: "No delete policy anywhere in this
-- migration. gym_session_logs has an abandoned status for 'this did not happen
-- after all' rather than a delete." Nothing in src/ deletes from either table.
-- Every row this trigger ever writes is therefore somebody working below the
-- app, which is precisely the event worth keeping.
--
-- THE VALUES ARE RECORDED, and for a delete that is the whole point. A
-- correction leaves the old value reachable through the revision chain; a delete
-- destroys it. Reps, loads and volumes are performance numbers every audit_log
-- reader already sees on the training report, so recording them discloses
-- nothing new.
--
-- WITH ONE EXCEPTION, kept deliberately from 0096: gym_session_logs.comment is
-- an athlete writing in their own words about their own body, and audit_log is
-- sport-scientist readable. The trigger records that a comment EXISTED and how
-- long it was, never its text. That means a deleted comment is not recoverable
-- from the audit log, and that is the trade: the privacy boundary holds, and a
-- reader still learns something was lost.
--
-- CASCADES ARE MARKED. gym_set_logs.gym_session_log_id is `on delete cascade`,
-- so removing one session log silently removes every set under it. Twenty audit
-- rows from one act should not read like twenty separate acts, so each row
-- carries `via_cascade`.
--
-- THE SIGNAL IS "THE PARENT IS ALREADY GONE", not pg_trigger_depth(). Depth was
-- tried first and MEASURED WRONG against a real cascade on scratch: it reads 1
-- for the cascaded children, not >1, so every child looked like a direct delete.
-- Parent-existence is also the honest test rather than a proxy — under a cascade
-- the parent row is removed before the children, so an AFTER trigger on the
-- child finds nothing, and that IS what "this came through the parent" means.
--
-- THE COST OF THAT, stated because it is real: under a cascade the athlete
-- cannot be resolved from the child, because the row that names them is already
-- gone. Those rows carry a null athlete_id and the parent's id in
-- `removed.gym_session_log_id`, so a reader lands on the parent's OWN delete row
-- — written by this same trigger, in the same transaction — which does name the
-- athlete. A BEFORE trigger would not help: the cascade still runs after the
-- parent is deleted.
--
-- WHAT THIS STILL DOES NOT COVER, said plainly:
--
--   * TRUNCATE. service_role holds it, and a truncate fires no row triggers, so
--     it would empty these tables past this trigger entirely. audit_log itself
--     is protected by a statement-level `before truncate` guard (0007) and the
--     same guard would work here — but scripts/reset-scratch.mjs truncates every
--     public table in one statement and already has to LIFT audit_log's guard to
--     do it. Its own header says the three reasons that lift is acceptable
--     "none of them generalise", and that it was approved explicitly because
--     "disabling an audit-log protection is not something to do on an agent's
--     own judgement". Adding two more triggers for that script to disable is
--     therefore a decision for Isabella, not a side effect of this migration.
--   * A SUPERUSER connection bypasses triggers as completely as it bypasses the
--     app. 0085's header records that limit; it is unchanged and unchangeable
--     from here.

create or replace function public.audit_gym_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old     jsonb := to_jsonb(old);
  v_athlete uuid;
  v_removed jsonb;
  v_parent_found boolean;
  /* A session log has no parent, so a delete of one is always the act itself. */
  v_cascade boolean := false;
begin
  if tg_table_name = 'gym_set_logs' then
    /* No athlete_id of its own — it lives on the parent. Under a cascade the
       parent is already gone, so this finds nothing and the athlete stays null;
       that absence is exactly what via_cascade below reports, from the same
       lookup rather than from a second guess. */
    select s.athlete_id, true into v_athlete, v_parent_found
    from public.gym_session_logs s
    where s.id = (v_old ->> 'gym_session_log_id')::uuid;
    v_cascade := not coalesce(v_parent_found, false);

    v_removed := jsonb_build_object(
      'gym_session_log_id', v_old ->> 'gym_session_log_id',
      'exercise_id',        v_old ->> 'exercise_id',
      'set_number',         v_old -> 'set_number',
      'reps_completed',     v_old -> 'reps_completed',
      'load_kg',            v_old -> 'load_kg',
      'volume_kg',          v_old -> 'volume_kg',
      'rpe',                v_old -> 'rpe',
      'rir',                v_old -> 'rir',
      'side',               v_old -> 'side',
      'is_warmup',          v_old -> 'is_warmup',
      'logged_at',          v_old ->> 'logged_at',
      'revision_of',        v_old ->> 'revision_of',
      'superseded_by',      v_old ->> 'superseded_by');
  else
    v_athlete := nullif(v_old ->> 'athlete_id', '')::uuid;
    v_removed := jsonb_build_object(
      'entry_date',      v_old ->> 'entry_date',
      'status',          v_old ->> 'status',
      'session_rpe',     v_old -> 'session_rpe',
      'total_volume_kg', v_old -> 'total_volume_kg',
      'started_at',      v_old ->> 'started_at',
      'completed_at',    v_old ->> 'completed_at',
      'source',          v_old ->> 'source',
      'revision_of',     v_old ->> 'revision_of',
      'superseded_by',   v_old ->> 'superseded_by',
      /* Presence and length, never the text. See the header. */
      'comment_present', (v_old ->> 'comment') is not null,
      'comment_length',  coalesce(length(v_old ->> 'comment'), 0));
  end if;

  insert into public.audit_log (
    org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address
  )
  values (
    nullif(v_old ->> 'org_id', '')::uuid,
    public.auth_user_id(),
    public.audit_acting_role(),
    tg_table_name || '.delete',
    tg_table_name,
    nullif(v_old ->> 'id', '')::uuid,
    v_athlete,
    jsonb_build_object('removed', v_removed, 'via_cascade', v_cascade),
    public.audit_client_ip()
  );

  return old;
end;
$$;

comment on function public.audit_gym_delete() is
  'Writes one audit_log row per removed gym row, carrying the values that were '
  'destroyed and whether it came through the parent''s cascade. Separate from '
  'audit_gym_correction() because a delete has no successor row to compare '
  'against. 0097.';

-- AFTER, so a delete refused by a constraint never leaves a row claiming it
-- happened. FOR EACH ROW, so a cascade of twenty sets is twenty records rather
-- than one — each marked via_cascade so nobody reads them as twenty acts.
drop trigger if exists gym_set_logs_delete_audit on public.gym_set_logs;
create trigger gym_set_logs_delete_audit
  after delete on public.gym_set_logs
  for each row execute function public.audit_gym_delete();

drop trigger if exists gym_session_logs_delete_audit on public.gym_session_logs;
create trigger gym_session_logs_delete_audit
  after delete on public.gym_session_logs
  for each row execute function public.audit_gym_delete();
