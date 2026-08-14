-- 0044_gym_log_revisions.sql
--
-- What this does
--   Closes integration-audit blocker B3: gym logging was the one entry domain with no
--   ADR-005 revision mechanism, directly contradicting CLAUDE.md §2 rule 6 ("Wellness,
--   gym, and nutrition entries are immutable once submitted") and ADR-005's own table of
--   immutable entries, which names `gym_session_logs, gym_set_logs` explicitly.
--
--   Migration 0021's comment on gym_session_logs said: "Not an ADR-005 immutable entry...
--   updated in place, never revised." That sentence is wrong against both CLAUDE.md rule 6
--   and ADR-005, and is corrected below rather than left to keep contradicting them.
--
-- What is actually revised, and why that is narrower than "both tables, every column"
--   screens/gym-logging.md — the detailed, reasoned screen spec, not just the ADR-005
--   summary table — is specific about what a correction touches:
--     "Tap a completed set row: re-opens it as active for correction. The correction
--      writes a revision, not an update." (§ Interactions)
--     "Each set carries a 'Correct' action for 14 days, which creates a revision."
--     "The athlete corrects a set from three days ago... A revision row is created and
--      total_volume_kg on the parent log is recomputed server-side." (edge case 20)
--   Nowhere does that spec revise gym_session_logs itself — session RPE is written once,
--   at Finish, and the session's lifecycle (in_progress -> complete/abandoned,
--   started_at/completed_at, total_volume_kg) is bookkeeping updated in place throughout.
--   That is a real architectural fact, not an oversight in the spec: gym_session_logs is
--   a PARENT of gym_set_logs (gym_set_logs.gym_session_log_id is `not null`). Swapping a
--   parent row for a new id the ADR-005 way, the same way a flat wellness/training/
--   nutrition entry is swapped, orphans every child set still pointing at the closed
--   parent id — there is nothing else in this codebase's revision pattern (all four
--   existing revise_* functions revise flat, childless rows) that has had to solve this,
--   so it is solved here explicitly rather than silently copying a pattern that does not
--   fit.
--
--   The resolution, matching CLAUDE.md §5 ("when the spec and the code disagree, the spec
--   wins, but say so — it may be the spec that is out of date") applied to a spec-vs-spec
--   conflict rather than a spec-vs-code one: ADR-005's table is treated as the imprecise
--   summary and screens/gym-logging.md's worked-through design as the accurate one, WITH
--   the schema still satisfying the letter of ADR-005 (both tables get revision_of /
--   superseded_by, both get a revise_* RPC) so nothing about "gym entries are immutable
--   once submitted" is left unbuilt:
--
--     gym_set_logs      — the real "entry" in CLAUDE.md's vocabulary sense (one athlete's
--                          submitted record of one set, on one day). Fully immutable, same
--                          shape as wellness_entries: no update grant to `authenticated` at
--                          all, revise_gym_set_log is the only write path to a correction.
--     gym_session_logs  — a lifecycle envelope, not a point-in-time entry. status,
--                          started_at, completed_at and total_volume_kg stay ordinary,
--                          in-place-updatable bookkeeping columns (070_programmes_test.sql
--                          already asserts a session is "updated in place... per the
--                          table's own comment" completing it, and that assertion must keep
--                          passing). session_rpe and comment ARE point-in-time submitted
--                          facts ("How hard was the session?", asked once at Finish) and are
--                          the two columns this migration actually locks down: revisable
--                          only through revise_gym_session_log once status = 'complete', via
--                          a column grant plus a state-checking trigger below. A session-
--                          level revision re-points its still-live child gym_set_logs rows
--                          to the new row id in the same transaction, so "the current
--                          session" always has its sets attached — see revise_gym_session_log
--                          for the detail.
--
-- Which spec sections this implements
--   CLAUDE.md §2 rule 6, decisions/adr-005-immutable-entries.md, screens/gym-logging.md
--   ("Correction" row of the validation table, edge case 20, and the Review/Correcting
--   states in the screen's own state diagram)
--
-- Judgement call, recorded rather than silently made
--   gym-logging.md's 14 day correction window ("Correction | Within 14 days of logged_at |
--   Beyond that the action is absent") is enforced the same way it already is for every
--   other entry table in this codebase: nowhere in SQL. revise_wellness_entry,
--   revise_training_entry and revise_nutrition_checkin none of them carry a server side
--   recency check either — the window is a UI affordance (the "Correct" link disappears),
--   not a database rule. This migration matches that existing convention rather than
--   inventing a stricter one for gym alone.

-- ===========================================================================
-- 1. gym_set_logs: the real, flat, fully immutable entry
-- ===========================================================================

alter table public.gym_set_logs
  add column revision_of   uuid references public.gym_set_logs(id),
  -- Deferrable for the same reason as wellness_entries.superseded_by (migration 0004): a
  -- revision is written as "close the old row, then insert the new one", and the partial
  -- unique index below means the close must land first — so the reference the close
  -- writes points at a row that does not exist yet until the very next statement.
  add column superseded_by uuid references public.gym_set_logs(id) deferrable initially deferred;

alter table public.gym_set_logs
  add constraint gym_set_logs_superseded_by_not_self check (superseded_by is null or superseded_by <> id),
  add constraint gym_set_logs_revision_of_not_self   check (revision_of   is null or revision_of   <> id);

comment on table public.gym_set_logs is
  'ADR-005 immutable entry, CLAUDE.md §2 rule 6. One athlete''s submitted record of one '
  'set. No update grant to authenticated at all, matching wellness_entries exactly — '
  'revise_gym_set_log is the only write path to a correction. screens/gym-logging.md: '
  '"The correction writes a revision, not an update."';

-- No update grant at all, for any role, ever — the wellness pattern, applied here for the
-- first time to a table that had one. gym_set_logs_self_update (migration 0021) is dropped
-- because with the grant gone it is dead: RLS narrows a privilege, it cannot grant one back.
revoke update on public.gym_set_logs from authenticated;
drop policy if exists gym_set_logs_self_update on public.gym_set_logs;

-- body_side::text is not usable directly in an index expression: Postgres's built-in enum
-- output function is marked STABLE, not IMMUTABLE, even though for a closed, fixed enum
-- type the mapping is genuinely deterministic. This one-line wrapper is the standard,
-- well-known workaround — a real cast, just re-labelled immutable because it is.
create or replace function public.gym_body_side_label(body_side)
returns text
language sql
immutable
as $$ select $1::text $$;

-- Every new function is provisioned with a default EXECUTE grant to PUBLIC (the same
-- Supabase default-privilege gap 0013 closed for tables and views, migration 0021's own
-- header names it too). It runs at INSERT/UPDATE time as whichever role performs the
-- write, so `authenticated` needs it back explicitly, or the index expression itself
-- becomes unusable from the app.
revoke execute on function public.gym_body_side_label(body_side) from public;
grant execute on function public.gym_body_side_label(body_side) to authenticated, service_role;

-- One LIVE set per slot: a session, an exercise-in-that-session (its programme_exercise_id
-- when prescribed, falling back to exercise_id for an ad-hoc "Add set" beyond the
-- prescription — screens/gym-logging.md edge case 11: two programme_exercise_id values for
-- the same exercise are two independent set sequences, so the coalesce must prefer the
-- more specific id), a set number, and a side (a unilateral exercise logs left and right as
-- two rows at the same set_number, edge case 12; side coalesces to a sentinel string rather
-- than a body_side value, so it cannot collide with a genuine 'bilateral' row).
--
-- This is the "real unique constraint" B4 in the audit asks for. Before it, `logSet` never
-- passed a client-generated id (a fresh gen_random_uuid() default landed on every call, in
-- lib/queries/programmes.ts), so a retried write after a dropped response created a second,
-- genuinely duplicate row for the same set — nothing in the schema could tell the two
-- apart. With the client now minting `id` itself (see that file's own updated comment) a
-- byte-identical retry collides on the primary key; this index is the second, independent
-- guard for the case a retry mints a fresh id but targets the same slot.
create unique index gym_set_logs_one_live_per_slot
  on public.gym_set_logs (
    gym_session_log_id,
    coalesce(programme_exercise_id, exercise_id),
    set_number,
    coalesce(public.gym_body_side_label(side), '_none_')
  )
  where superseded_by is null;

create view public.gym_set_logs_current with (security_invoker = true) as
  select * from public.gym_set_logs
  where superseded_by is null;

comment on view public.gym_set_logs_current is
  'Live set logs only. ADR-005 rule 3. Read this, never the base table.';

-- 0013_close_default_privilege_gaps.sql's own lesson, repeated here for a new view: a
-- view lands with the same wide-open default grant to public/anon/authenticated any new
-- object gets, so it must be revoked before the narrow grant below means what it says.
revoke all on public.gym_set_logs_current from public, anon, authenticated;
grant select on public.gym_set_logs_current to authenticated;


-- ===========================================================================
-- 2. gym_session_logs: lifecycle envelope, with two locked-down submitted fields
-- ===========================================================================

alter table public.gym_session_logs
  add column revision_of   uuid references public.gym_session_logs(id),
  add column superseded_by uuid references public.gym_session_logs(id) deferrable initially deferred;

alter table public.gym_session_logs
  add constraint gym_session_logs_superseded_by_not_self check (superseded_by is null or superseded_by <> id),
  add constraint gym_session_logs_revision_of_not_self   check (revision_of   is null or revision_of   <> id);

comment on table public.gym_session_logs is
  'A lifecycle envelope (in_progress -> complete/abandoned), not a point-in-time ADR-005 '
  'entry the way its child gym_set_logs rows are — status, started_at, completed_at and '
  'total_volume_kg are bookkeeping, updated in place throughout a session, same as before '
  'this migration. session_rpe and comment ARE submitted, point-in-time facts (asked once, '
  'at Finish) and are the two columns this migration actually locks down once status = '
  '''complete'': see the column grant and gym_session_logs_guard_submitted_fields below. '
  'revision_of/superseded_by exist so a completed session''s summary can still be corrected '
  'through revise_gym_session_log, which is the ADR-005 write path for those two columns '
  'only — this migration''s own header explains the full reasoning, including why the rest '
  'of the row is not treated the same way gym_set_logs now is.';

-- Column-level grant, replacing the blanket one from migration 0021. A client may still
-- freely update the lifecycle columns (that is what keeps a session usable while it is
-- in_progress, and is what 070_programmes_test.sql's "updated in place" assertion already
-- depends on) and may still set session_rpe/comment ONCE, as part of the same statement
-- that flips status to 'complete' (lib/queries/programmes.ts completeSessionLog does both
-- in one update). What the grant removes entirely is any client path to revision_of or
-- superseded_by — those two are RPC-only, full stop, the same absolute rule ADR-005 states
-- for every other entry table, just column-scoped here instead of table-scoped because nothing
-- else on this row needs the same protection.
revoke update on public.gym_session_logs from authenticated;
grant update (status, started_at, completed_at, total_volume_kg, session_rpe, comment)
  on public.gym_session_logs to authenticated;

drop policy if exists gym_session_logs_self_update on public.gym_session_logs;

create policy gym_session_logs_self_update on public.gym_session_logs for update
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id() and superseded_by is null)
  with check (org_id = auth_org_id() and athlete_id = auth_athlete_id());

-- The column grant above stops session_rpe/comment moving to another row via UPDATE's
-- column list; it cannot express "settable once, then locked", because a plain GRANT has
-- no notion of the row's current state. This trigger is that state check: once a session is
-- complete, a further change to session_rpe or comment is refused, for every actor,
-- including a hypothetical service-role fix — ADR-005's whole point is that even a
-- well-intentioned direct edit is the wrong shape of fix, a revision is. It does not need a
-- security-definer bypass for revise_gym_session_log's own internal writes (unlike
-- 0029_athlete_self_update_guard_fix.sql's trigger, which did): that function's only UPDATE
-- against this table sets superseded_by, never session_rpe or comment, so the guard's
-- condition is never true for it — the correction itself always arrives as an INSERT of
-- the new revision row, never an UPDATE of the old one.
create or replace function public.gym_session_log_guard_submitted_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'complete'
     and (new.session_rpe is distinct from old.session_rpe
          or new.comment is distinct from old.comment)
  then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists gym_session_logs_guard_submitted on public.gym_session_logs;
create trigger gym_session_logs_guard_submitted
  before update on public.gym_session_logs
  for each row execute function public.gym_session_log_guard_submitted_fields();

create view public.gym_session_logs_current with (security_invoker = true) as
  select * from public.gym_session_logs
  where superseded_by is null;

comment on view public.gym_session_logs_current is
  'Live session logs only. ADR-005 rule 3. Read this, never the base table.';

revoke all on public.gym_session_logs_current from public, anon, authenticated;
grant select on public.gym_session_logs_current to authenticated;


-- ===========================================================================
-- 3. revise_gym_set_log
--
-- Same transaction shape as revise_wellness_entry (migration 0010): close the original via
-- superseded_by, insert the correction carrying revision_of, atomic, security definer
-- because there is no update grant on gym_set_logs at all (see §1) for an invoker-rights
-- update to work against.
--
-- Athlete-only, no coach/medical branch — unlike revise_wellness_entry/revise_training_
-- entry and like revise_nutrition_checkin, because migration 0021's own RLS never gave
-- staff a write path onto gym_set_logs at all ("no staff_entered insert path at all yet, a
-- real, documented gap" — its comment on gym_session_logs_self_insert). A correction
-- function cannot grant a permission the base table never had.
-- ===========================================================================

create or replace function public.revise_gym_set_log(
  p_original_id uuid,
  p_new_id      uuid,
  p_payload     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_athlete  uuid := public.auth_athlete_id();
  v_original public.gym_set_logs;
  v_new_id   uuid;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.gym_set_logs
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null;      -- may only revise the current revision

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.gym_session_logs gsl
    where gsl.id = v_original.gym_session_log_id
      and gsl.athlete_id = v_athlete
  ) then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first, same reason as revise_wellness_entry: the partial unique
  -- index in §1 permits exactly one live row per slot, so the close must land before the
  -- new row can occupy it.
  update public.gym_set_logs
     set superseded_by = p_new_id
   where id = p_original_id;

  -- Identity columns (gym_session_log_id, programme_exercise_id, exercise_id, set_number)
  -- come from the original, never from p_payload — the same discipline ADR-005 rule 2
  -- requires for entry_date/athlete_id/org_id elsewhere: a correction fixes what was
  -- logged, it does not move the set to a different slot.
  insert into public.gym_set_logs (
    id, org_id, gym_session_log_id, programme_exercise_id, exercise_id, set_number,
    reps_completed, load_kg, rpe, rir, side, is_warmup, logged_at, revision_of
  )
  values (
    p_new_id, v_original.org_id, v_original.gym_session_log_id, v_original.programme_exercise_id,
    v_original.exercise_id, v_original.set_number,
    coalesce((p_payload ->> 'reps_completed')::int,     v_original.reps_completed),
    coalesce((p_payload ->> 'load_kg')::numeric,        v_original.load_kg),
    coalesce((p_payload ->> 'rpe')::numeric,             v_original.rpe),
    coalesce((p_payload ->> 'rir')::int,                 v_original.rir),
    coalesce((p_payload ->> 'side')::public.body_side,   v_original.side),
    coalesce((p_payload ->> 'is_warmup')::boolean,       v_original.is_warmup),
    now(), v_original.id
  )
  returning id into v_new_id;

  -- screens/gym-logging.md edge case 20: "total_volume_kg on the parent log is recomputed
  -- server-side." Summed only from currently-live sets, so a superseded set's old load
  -- does not double count against the corrected one. total_volume_kg is not otherwise
  -- computed anywhere in this build (a real, separate, pre-existing gap — this only keeps
  -- it consistent with itself across a correction, it does not add the missing on-every-set
  -- computation).
  update public.gym_session_logs
     set total_volume_kg = (
       select coalesce(sum(volume_kg), 0)
       from public.gym_set_logs
       where gym_session_log_id = v_original.gym_session_log_id
         and superseded_by is null
     )
   where id = v_original.gym_session_log_id;

  return v_new_id;
end;
$$;

revoke all on function public.revise_gym_set_log(uuid, uuid, jsonb) from public;
grant execute on function public.revise_gym_set_log(uuid, uuid, jsonb) to authenticated;


-- ===========================================================================
-- 4. revise_gym_session_log
--
-- Revises session_rpe and/or comment on a COMPLETE session only — an in_progress session
-- has nothing submitted yet to correct, it is simply edited in place through its normal
-- lifecycle columns (§2). Athlete-only, same reasoning as revise_gym_set_log: there is no
-- staff write path onto gym_session_logs at all.
--
-- The one piece with no precedent in this codebase's other revise_* functions: this row
-- is a PARENT (gym_set_logs.gym_session_log_id is not null, on delete cascade). Closing it
-- the ADR-005 way and writing the correction under a new id would leave every still-live
-- set pointing at the now-superseded original — "the current session" would have zero
-- sets. So the still-live child sets are re-pointed to the new row's id, inside the same
-- transaction. Sets that are themselves already superseded (corrected via
-- revise_gym_set_log earlier) are left exactly where they are: they are history, not part
-- of anyone's "current" read, and rewriting a fact already on the record for the correction
-- window it was actually true under would be exactly the retrospective edit ADR-005 exists
-- to prevent.
-- ===========================================================================

create or replace function public.revise_gym_session_log(
  p_original_id uuid,
  p_new_id      uuid,
  p_payload     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_athlete  uuid := public.auth_athlete_id();
  v_original public.gym_session_logs;
  v_new_id   uuid;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.gym_session_logs
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null;

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  if v_original.athlete_id is distinct from v_athlete then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  if v_original.status <> 'complete' then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  update public.gym_session_logs
     set superseded_by = p_new_id
   where id = p_original_id;

  insert into public.gym_session_logs (
    id, org_id, athlete_id, programme_session_id, session_id, entry_date,
    started_at, completed_at, session_rpe, total_volume_kg, status, comment,
    source, created_at, revision_of
  )
  values (
    p_new_id, v_original.org_id, v_original.athlete_id, v_original.programme_session_id,
    v_original.session_id, v_original.entry_date,
    v_original.started_at, v_original.completed_at,
    coalesce((p_payload ->> 'session_rpe')::numeric, v_original.session_rpe),
    v_original.total_volume_kg, v_original.status,
    coalesce(p_payload ->> 'comment', v_original.comment),
    v_original.source, now(), v_original.id
  )
  returning id into v_new_id;

  -- Re-point still-live children so the current session keeps its sets. See this
  -- function's own header for why this step exists at all.
  update public.gym_set_logs
     set gym_session_log_id = v_new_id
   where gym_session_log_id = p_original_id
     and superseded_by is null;

  return v_new_id;
end;
$$;

revoke all on function public.revise_gym_session_log(uuid, uuid, jsonb) from public;
grant execute on function public.revise_gym_session_log(uuid, uuid, jsonb) to authenticated;
