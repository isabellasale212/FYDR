-- 0111_gym_set_prescription_snapshot.sql
--
-- PATTERN-S5 C1, built 2026-09-13: "a logged set keeps the prescription it
-- was logged against — reps, load and step snapshotted at logging, so editing
-- a block never rewrites what a past set is compared to."
--
-- WHAT WAS FOUND. gym_set_logs holds the actuals (reps_completed, load_kg)
-- and the programme exercise is joined live wherever a logged set is read
-- back against its prescription (fetchGymSessionSetDetails, the logger's
-- reference line, My data). So a coach editing a block's load from 100 to
-- 110 changed, retrospectively and silently, what every set already logged
-- against 100 appeared to have been asked for — and a per-athlete override
-- or a new 1RM result did the same for a percent_1rm prescription. The
-- board's Q1 ("stored against the logged set, or read from the programme?")
-- named it; this makes the answer "stored".
--
-- WHAT THIS DOES. Three nullable columns on gym_set_logs, written by the
-- logger at logging with the prescription AS RESOLVED FOR THAT ATHLETE at
-- that moment (the absolute kg, or a percent_1rm already resolved against
-- their own latest 1RM; the reps prefill; the exercise's own kg step):
--   prescribed_reps      int
--   prescribed_load_kg   numeric(6,2)
--   prescribed_step_kg   numeric(4,2)
-- Null means "no prescription at logging" — a set logged before this
-- migration, a set logged with no programme exercise, or a basis with no
-- kilogram to state (bodyweight, percent of bodyweight, an RPE target). Never
-- zero: the logger writes null, and a reader says "not recorded" (CLAUDE.md
-- rule 6's spirit — a past record is what it was, not what the plan now is).
-- Non-negative, like load_kg (0095).
--
-- gym_set_logs_current is recreated so the columns reach every reader that
-- honours ADR-005 rule 3 (a view built with `select *` fixes its column list
-- at creation; create or replace appends the new ones). Grants are unchanged.
--
-- revise_gym_set_log (0045) is redefined to carry the original's three
-- values into the correction row and to IGNORE any prescribed_* in its
-- payload: a correction fixes what was lifted, never what was asked. Nothing
-- else in the function changes. 0110's closed-log trigger is untouched and
-- still meets the correction path.
--
-- Test: 670_gym_set_prescription_snapshot_test.sql.

alter table gym_set_logs
  add column prescribed_reps    int,
  add column prescribed_load_kg numeric(6,2),
  add column prescribed_step_kg numeric(4,2);

comment on column gym_set_logs.prescribed_reps is
  'PATTERN-S5 C1 (0111): the reps prescribed at logging, resolved for this athlete. Null = no prescription at logging (pre-0111, no programme exercise). Never rewritten by a programme edit.';
comment on column gym_set_logs.prescribed_load_kg is
  'PATTERN-S5 C1 (0111): the load prescribed at logging, resolved for this athlete (absolute kg, or percent_1rm against their 1RM then). Null = none to state (pre-0111, no programme, bodyweight/%BW/RPE basis). Never rewritten by a programme edit.';
comment on column gym_set_logs.prescribed_step_kg is
  'PATTERN-S5 C1 (0111): the exercise''s kg step at logging (0108). Null = not recorded.';

alter table gym_set_logs
  add constraint gym_set_logs_prescribed_reps_non_negative
    check (prescribed_reps is null or prescribed_reps >= 0),
  add constraint gym_set_logs_prescribed_load_kg_non_negative
    check (prescribed_load_kg is null or prescribed_load_kg >= 0),
  add constraint gym_set_logs_prescribed_step_kg_non_negative
    check (prescribed_step_kg is null or prescribed_step_kg >= 0);

-- The view: same definition, re-expanded so the three new columns are in it.
create or replace view public.gym_set_logs_current with (security_invoker = true) as
  select * from public.gym_set_logs
  where superseded_by is null;

-- The correction path carries the snapshot. Body otherwise identical to 0045.
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
  -- index in 0045 §1 permits exactly one live row per slot, so the close must land before
  -- the new row can occupy it.
  update public.gym_set_logs
     set superseded_by = p_new_id
   where id = p_original_id;

  -- Identity columns (gym_session_log_id, programme_exercise_id, exercise_id, set_number)
  -- come from the original, never from p_payload — ADR-005 rule 2: a correction fixes
  -- what was logged, it does not move the set to a different slot. The prescription
  -- snapshot (0111) is identity in the same sense: what the set was asked for is part
  -- of what was logged, so it is copied from the original and p_payload cannot set it.
  insert into public.gym_set_logs (
    id, org_id, gym_session_log_id, programme_exercise_id, exercise_id, set_number,
    reps_completed, load_kg, rpe, rir, side, is_warmup, logged_at, revision_of,
    prescribed_reps, prescribed_load_kg, prescribed_step_kg
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
    now(), v_original.id,
    v_original.prescribed_reps, v_original.prescribed_load_kg, v_original.prescribed_step_kg
  )
  returning id into v_new_id;

  -- screens/gym-logging.md edge case 20: total_volume_kg on the parent log is recomputed
  -- server-side from the live sets only (0045's own note applies unchanged).
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
