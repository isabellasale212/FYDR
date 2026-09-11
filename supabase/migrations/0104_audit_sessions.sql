-- 0104_audit_sessions.sql
--
-- §0al, second half — decided by Isabella 2026-09-11: "the sessions table goes
-- into the next audit-trigger batch (with §0p/§0q's shape)". Built 2026-09-12.
--
-- WHAT WAS MEASURED. After a full publish exercise on scratch — a session
-- created through the wizard, published, seen on five athletes' phones, then
-- removed and the removal published — audit_log held six report.squad_weekly.
-- view rows and two .export rows from READING a report, and nothing at all for
-- the two writes. sessions carried only sessions_set_updated_at; schedule.ts
-- never touched audit_log. Reading was audited; the staff app's single
-- highest-reach write was not. "Who changed the week, when" was unanswerable.
--
-- THE SHAPE, the same as 0097 and 0099: AFTER row triggers, security definer
-- (audit_log's own policy is org + actor and would refuse the row otherwise),
-- actor from auth_user_id(), role from audit_acting_role(), address from
-- audit_client_ip(), and a statement-level BEFORE TRUNCATE refusal so nothing
-- can walk past the row triggers in one statement. A trigger rather than an
-- RPC change, for the same reason as 0099: it catches what happens below the
-- app, where no RPC runs — and the app's own three write paths (the schedule
-- grid's publish, the full-screen forms, the week-template apply) all land in
-- the same two tables, so one trigger covers all of them without drift.
--
-- THE EVENTS. One row per act, named by what happened rather than by the SQL
-- verb, because a soft delete IS an update in SQL and a removal to a coach:
--
--   sessions.create              an insert; metadata.session carries the
--                                scheduling fields as created
--   sessions.update              an update that changed at least one audited
--                                field; metadata.changed is {field: {from, to}}
--                                for exactly those fields. An update that
--                                touches nothing audited (updated_at alone)
--                                writes NO row
--   sessions.delete              deleted_at going from null to set — the app's
--                                only removal path — carrying the session as it
--                                was, with soft: true. A restore (deleted_at
--                                back to null, which no app path does today) is
--                                an update on deleted_at and is recorded as one
--   sessions.delete, soft: false a hard delete, which authenticated cannot do
--                                (0012 grants no delete) but service_role can;
--                                the same event name so a reader finds every
--                                removal under one action
--   session_participants.add     an insert: which group or athlete was put in
--   session_participants.remove  a delete; via_cascade when the session itself
--                                was hard-deleted (0097's parent-gone test)
--
-- WHAT IS RECORDED IN FULL, and why that is right here where 0096's free-text
-- rule says the opposite for athlete entries: title and location are staff-
-- authored scheduling facts, not anyone's own words about their body, and the
-- log's whole purpose is to answer "what did the week say before". A row that
-- said only "title changed, 12 characters" would not answer it. notes (the
-- session's free-text notes column) IS held to the rule — presence and length —
-- because coaches write about athletes there.
--
-- THE FIELDS AUDITED on sessions: title, session_type, starts_at, duration_min,
-- location, md_offset, status, fixture_id, season_id, deleted_at, plus notes as
-- presence/length. planned_rpe and planned_load are included as numbers.
-- requires_* flags and the dead requires_nutrition are not: nothing writes
-- them.

-- ---------------------------------------------------------------------------
-- 1. The session as the log sees it. One place, so create, update and delete
--    describe the same fields the same way.
-- ---------------------------------------------------------------------------
create or replace function public.audit_session_snapshot(p_row jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'title',         p_row -> 'title',
    'session_type',  p_row -> 'session_type',
    'starts_at',     p_row -> 'starts_at',
    'duration_min',  p_row -> 'duration_min',
    'location',      p_row -> 'location',
    'md_offset',     p_row -> 'md_offset',
    'status',        p_row -> 'status',
    'fixture_id',    p_row -> 'fixture_id',
    'season_id',     p_row -> 'season_id',
    'planned_rpe',   p_row -> 'planned_rpe',
    'planned_load',  p_row -> 'planned_load',
    'deleted_at',    p_row -> 'deleted_at',
    'notes_present', (p_row ->> 'notes') is not null,
    'notes_length',  coalesce(length(p_row ->> 'notes'), 0)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. sessions: create, update, soft delete, hard delete.
-- ---------------------------------------------------------------------------
create or replace function public.audit_session_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old      jsonb;
  v_new      jsonb;
  v_before   jsonb;
  v_after    jsonb;
  v_changed  jsonb := '{}'::jsonb;
  v_key      text;
  v_action   text;
  v_meta     jsonb;
  v_row      jsonb;
begin
  if tg_op = 'INSERT' then
    v_new    := to_jsonb(new);
    v_action := 'sessions.create';
    v_meta   := jsonb_build_object('session', public.audit_session_snapshot(v_new));
    v_row    := v_new;

  elsif tg_op = 'UPDATE' then
    v_old    := to_jsonb(old);
    v_new    := to_jsonb(new);
    v_before := public.audit_session_snapshot(v_old);
    v_after  := public.audit_session_snapshot(v_new);
    for v_key in select jsonb_object_keys(v_after) loop
      if v_before -> v_key is distinct from v_after -> v_key then
        v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('from', v_before -> v_key, 'to', v_after -> v_key));
      end if;
    end loop;
    -- Nothing the log cares about moved (updated_at alone, a requires_* flag):
    -- no row. A log that records "something happened, nothing changed" for
    -- every touch is one nobody reads.
    if v_changed = '{}'::jsonb then
      return new;
    end if;
    if (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
      v_action := 'sessions.delete';
      v_meta   := jsonb_build_object('removed', v_before, 'soft', true);
    else
      v_action := 'sessions.update';
      v_meta   := jsonb_build_object('changed', v_changed);
    end if;
    v_row := v_new;

  else -- DELETE
    v_old    := to_jsonb(old);
    v_action := 'sessions.delete';
    v_meta   := jsonb_build_object('removed', public.audit_session_snapshot(v_old), 'soft', false);
    v_row    := v_old;
  end if;

  insert into public.audit_log (
    org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address
  )
  values (
    nullif(v_row ->> 'org_id', '')::uuid,
    public.auth_user_id(),
    public.audit_acting_role(),
    v_action,
    'sessions',
    nullif(v_row ->> 'id', '')::uuid,
    null,
    v_meta,
    public.audit_client_ip()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. session_participants: add and remove. The athlete_id column is set when
--    the row names an athlete directly; a group row names nobody in
--    particular and leaves it null, with the group in the metadata.
-- ---------------------------------------------------------------------------
create or replace function public.audit_session_participant_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     jsonb;
  v_action  text;
  v_cascade boolean := false;
begin
  if tg_op = 'INSERT' then
    v_row    := to_jsonb(new);
    v_action := 'session_participants.add';
  else
    v_row    := to_jsonb(old);
    v_action := 'session_participants.remove';
    -- 0097's test, not pg_trigger_depth(): under a cascade the parent is
    -- already gone by the time an AFTER trigger on the child runs.
    v_cascade := not exists (
      select 1 from public.sessions s where s.id = nullif(v_row ->> 'session_id', '')::uuid
    );
  end if;

  insert into public.audit_log (
    org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address
  )
  values (
    nullif(v_row ->> 'org_id', '')::uuid,
    public.auth_user_id(),
    public.audit_acting_role(),
    v_action,
    'session_participants',
    nullif(v_row ->> 'id', '')::uuid,
    nullif(v_row ->> 'athlete_id', '')::uuid,
    jsonb_build_object(
      'session_id', v_row -> 'session_id',
      'group_id',   v_row -> 'group_id',
      'athlete_id', v_row -> 'athlete_id',
      'via_cascade', v_cascade
    ),
    public.audit_client_ip()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. And no truncate on either. Same function shape as 0099's.
-- ---------------------------------------------------------------------------
create or replace function public.session_no_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'truncate is not permitted on %: 0104 audits every row changed in it, and a truncate fires no row triggers',
    tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists sessions_audit on public.sessions;
create trigger sessions_audit
  after insert or update or delete on public.sessions
  for each row execute function public.audit_session_change();
drop trigger if exists sessions_no_truncate on public.sessions;
create trigger sessions_no_truncate
  before truncate on public.sessions
  for each statement execute function public.session_no_truncate();

drop trigger if exists session_participants_audit on public.session_participants;
create trigger session_participants_audit
  after insert or delete on public.session_participants
  for each row execute function public.audit_session_participant_change();
drop trigger if exists session_participants_no_truncate on public.session_participants;
create trigger session_participants_no_truncate
  before truncate on public.session_participants
  for each statement execute function public.session_no_truncate();

-- The trigger functions run as definer and are never called directly.
revoke execute on function public.audit_session_change() from public, anon, authenticated;
revoke execute on function public.audit_session_participant_change() from public, anon, authenticated;
revoke execute on function public.session_no_truncate() from public, anon, authenticated;
